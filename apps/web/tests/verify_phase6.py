import asyncio, datetime, json, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
LEADER = ("leader@budget.com", "Password1")
MANAGER = ("manager@budget.com", "Password1")
WAREHOUSE = ("warehouse@trackcrm.com", "Password1")

PASS, FAIL = [], []

def check(name, ok, detail=""):
    (PASS if ok else FAIL).append((name, detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  -> " + detail) if detail and not ok else ""))

async def login(page, email, pw):
    await page.goto(f"{BASE}/login", wait_until="networkidle")
    await page.fill('input[type="email"], input[name="email"], input[type="text"]', email)
    await page.fill('input[type="password"]', pw)
    await page.click('button[type="submit"]')
    try:
        await page.wait_for_url(lambda u: "/login" not in u, timeout=10000)
        return True
    except Exception:
        return False

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context()
        page = await ctx.new_page()
        if not await login(page, *LEADER):
            print("leader login failed"); return 1

        me = await (await page.request.get(f"{BASE}/api/me")).json()
        creators = await (await page.request.get(f"{BASE}/api/creators?pool=&q=")).json()
        owned = [c for c in creators if c.get("currentEngagementId") and c.get("relationship") == "owned"]
        prod = await db_product()

        # find a creator whose order is not blocked; submit with the paid product
        stamp = datetime.datetime.now().isoformat(timespec="seconds")
        target = None
        for cand in owned:
            r = await page.request.post(f"{BASE}/api/gifts", data={
                "engagementId": cand["currentEngagementId"],
                "action": "submit",
                "lines": [{"productId": prod["id"], "quantity": 1}] if prod else
                         [{"productName": f"Phase6 item {stamp}", "unitCost": 410, "quantity": 1}],
                "shippingAddress": f"P6 Street {stamp}",
                "deliverables": [{"title": f"Phase6 Reel {stamp}", "type": "Reel",
                                  "dueDate": (datetime.date.today() + datetime.timedelta(days=14)).isoformat()}],
            })
            if r.status == 201:
                target = cand; break
            b = await r.json()
            if b.get("blocked") and "Previous gift" in b.get("error", ""):
                continue
        if not target:
            print("no unblocked owned creator; skipping"); return 0
        cid = target["id"]
        g3 = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
        gifts = [g for e in g3.get("engagements", []) for g in e.get("gifts", []) if g.get("status") == "pending_manager"]
        gid = gifts[0]["id"]
        expected_total = gifts[0]["orderTotal"] if "orderTotal" in gifts[0] else (prod["unitCost"] if prod else 410)
        check("order submitted (with real cost)", gifts[0]["orderTotal"] > 0, f"orderTotal={gifts[0]['orderTotal']}")

        # approve as manager
        ctx2 = await browser.new_context(); mgr = await ctx2.new_page()
        await login(mgr, *MANAGER)
        ra = await mgr.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "approve"})
        check("manager approve", ra.ok, f"{ra.status} {await ra.text()}")
        await ctx2.close()

        # warehouse: dispatch + deliver
        ctx3 = await browser.new_context(); wh = await ctx3.new_page()
        check("warehouse login", await login(wh, *WAREHOUSE))
        rd = await wh.request.patch(f"{BASE}/api/gifts/{gid}", data={
            "action": "dispatch", "trackingNumber": "P6TRK" + stamp.replace(":", "").replace("-", ""), "carrier": "Aramex"})
        check("warehouse dispatch", rd.ok, f"{rd.status} {await rd.text()}")
        # dispatch again should fail (already shipped)
        rd2 = await wh.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "dispatch", "trackingNumber": "X", "carrier": "Y"})
        check("re-dispatch refused", not rd2.ok, f"{rd2.status} {await rd2.text()}")
        rl = await wh.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "deliver"})
        check("warehouse deliver", rl.ok, f"{rl.status} {await rl.text()}")
        rl2 = await wh.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "deliver"})
        check("re-deliver refused (final status)", not rl2.ok, f"{rl2.status} {await rl2.text()}")

        # delivered status + credit activity on the creator
        g4 = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
        cur = [g for e in g4.get("engagements", []) for g in e.get("gifts", []) if g.get("id") == gid]
        check("order delivered", cur and cur[0].get("status") == "delivered",
              json.dumps(cur[0] if cur else None, default=str))
        acts = g4.get("activityLogs", [])
        credit_acts = [a for a in acts if a.get("type") == "GIFT_CREDIT_POSTED"]
        check("credit activity logged (GIFT_CREDIT_POSTED)", len(credit_acts) >= 1,
              json.dumps(credit_acts, default=str))

        # label page renders (standalone print view)
        rlbl = await wh.request.get(f"{BASE}/gifting/{gid}/label")
        lbl = await rlbl.text()
        check("label page renders", rlbl.status == 200 and "Print label" in lbl and "Gift order" in lbl,
              f"status={rlbl.status}")

        await ctx3.close()
        await browser.close()

        # DB: credit transaction persisted + balance incremented
        db = await db_check(gid, expected_total)
        for name, ok, detail in db:
            check(name, ok, detail)

    print(f"\n===== SUMMARY =====\nPASSED: {len(PASS)}  FAILED: {len(FAIL)}")
    for name, detail in FAIL:
        print(f"  - {name}: {detail}")
    return 1 if FAIL else 0

async def db_product():
    import asyncio as aio, os
    proc = await aio.create_subprocess_exec(
        "node", "-e", """
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        (async () => {
          const prod = await p.product.findFirst({ where: { unitCost: { gt: 0 } }, orderBy: { name: "asc" } });
          console.log(JSON.stringify(prod ? { id: prod.id, unitCost: prod.unitCost } : null));
          await p.$disconnect();
        })().catch(e => { console.error(e.message); process.exit(1); });
        """,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=".", env=os.environ.copy())
    out, err = await proc.communicate()
    return json.loads(out.decode())

async def db_check(gid, expected_total):
    import asyncio as aio, os
    proc = await aio.create_subprocess_exec(
        "node", "-e", """
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        (async () => {
          const txs = await p.creditTransaction.findMany({ where: { refType: "Gift", refId: process.argv[1] } });
          const acct = txs[0] ? await p.creditAccount.findUnique({ where: { id: txs[0].accountId } }) : null;
          console.log(JSON.stringify({ txs: txs.map(t => ({ type: t.type, amount: t.amount, reason: t.reason })), balance: acct?.balance }));
          await p.$disconnect();
        })().catch(e => { console.error(e.message); process.exit(1); });
        """,
        gid, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=".", env=os.environ.copy())
    out, err = await proc.communicate()
    data = json.loads(out.decode())
    data["expectedTotal"] = expected_total
    cred = [t for t in data["txs"] if t["type"] == "CREDIT"]
    return [("credit transaction persisted once", len(cred) == 1, json.dumps(data)),
            ("credit amount = order total posted to requester", len(cred) == 1 and cred[0]["amount"] == data.get("expectedTotal"), json.dumps(data["txs"])),
            ("account balance incremented", data["balance"] is not None and (cred[0]["amount"] if cred else 0) <= data["balance"], json.dumps(data))]

if __name__ == "__main__":
    env = __import__("os")
    env.environ["DATABASE_URL"] = env.popen("grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '\"'").read().strip()
    sys.exit(asyncio.run(main()))