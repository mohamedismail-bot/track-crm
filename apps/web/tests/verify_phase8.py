# Phase 8 verify: Notifications credit note + dashboard/report insights.
# - GIFT_DELIVERED notification body names the credit effect when grantCredit + creditEnabled.
# - /api/dashboard exposes gifts.report (order totals/AOV), a credit block
#   (credit.view only: top spenders + total outstanding, team-scoped for managers),
#   and an exceptions block (manager/admin: active exception orders).
# - Reports page renders the gifting report + credit balances + active exceptions.
import asyncio, datetime, json, sys, time
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
ADMIN = ("admin@trackcrm.com", "Admin@1234")
LEADER = ("leader@budget.com", "Password1")
MANAGER = ("manager@budget.com", "Password1")
WAREHOUSE = ("warehouse@trackcrm.com", "Password1")

PASS, FAIL = [], []

def check(name, ok, detail=""):
    (PASS if ok else FAIL).append((name, detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  -> " + detail) if detail and not ok else ""))

async def login(page, email, pw):
    for attempt in range(3):
        try:
            await page.goto(f"{BASE}/login", wait_until="networkidle", timeout=45000)
            await page.fill('input[type="email"], input[name="email"], input[type="text"]', email)
            await page.fill('input[type="password"]', pw)
            await page.click('button[type="submit"]')
            await page.wait_for_url(lambda u: "/login" not in u, timeout=25000)
            return True
        except Exception:
            time.sleep(3)
    return False

def required_of(deal_type, dels):
    if deal_type in ("COMMISSION", "BARTER"):
        return [d for d in dels if any(k in (d.get("type") or "").lower() for k in ("video", "tiktok", "reel"))]
    return dels

async def me(page):
    return await (await page.request.get(f"{BASE}/api/me")).json()

async def owned_creators(page):
    creators = await (await page.request.get(f"{BASE}/api/creators?pool=&q=")).json()
    return [c for c in creators if c.get("currentEngagementId") and c.get("relationship") == "owned"]

async def submit_order(page, cid, engId, stamp, label):
    prod = await db_product()
    return await page.request.post(f"{BASE}/api/gifts", data={
        "engagementId": engId, "action": "submit",
        "lines": [{"productId": prod["id"], "quantity": 1}] if prod else
                 [{"productName": f"{label} {stamp}", "unitCost": 320, "quantity": 1}],
        "shippingAddress": f"P8 Street {stamp}",
        "deliverables": [{"title": f"P8 Reel {stamp}", "type": "Reel",
                          "dueDate": (datetime.date.today() + datetime.timedelta(days=14)).isoformat()}],
    })

async def loose_gift(page, cid, status_key):
    d = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
    for e in d.get("engagements", []):
        for g in e.get("gifts", []):
            if g.get("status") == status_key:
                return g, e.get("dealType")
    return None, None

async def creator_deliverables(page, cid, gift_id):
    d = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
    return [x for e in d.get("engagements", []) for x in e.get("deliverables", []) if x.get("giftId") == gift_id]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # ---- leader: find an eligible creator and request gift A -------------
        ctxl = await browser.new_context(); page = await ctxl.new_page()
        if not await login(page, *LEADER):
            print("leader login failed"); return 1
        lead_me = await me(page)
        stamp = datetime.datetime.now().isoformat(timespec="seconds")
        target = None
        for cand in await owned_creators(page):
            r = await submit_order(page, cand["id"], cand["currentEngagementId"], stamp, "P8A")
            if r.status == 201:
                target = cand; break
        check("leader: created gift order A", target is not None,
              "no owned creator accepted a new order")
        if not target:
            print("no eligible creator; skipping"); return 1
        cid = target["id"]
        gA, dealA = await loose_gift(page, cid, "pending_manager")
        check("order A at Pending Manager", gA is not None, f"{cid}")

        # ---- manager: approve A (spawns its deliverables) --------------------
        ctxm = await browser.new_context(); mgr = await ctxm.new_page()
        await login(mgr, *MANAGER)
        mgr_me = await me(mgr)
        r = await mgr.request.patch(f"{BASE}/api/gifts/{gA['id']}", data={"action": "approve"})
        check("manager: approved order A", r.ok, f"{r.status} {await r.text()}")
        spawned = await creator_deliverables(page, cid, gA["id"])
        check("order A spawned deliverables", len(spawned) >= 1, f"{len(spawned)}")

        # ---- warehouse: dispatch + deliver A (posts +credit + notification) --
        ctxw = await browser.new_context(); wh = await ctxw.new_page()
        await login(wh, *WAREHOUSE)
        await wh.request.patch(f"{BASE}/api/gifts/{gA['id']}",
            data={"action": "dispatch", "trackingNumber": "P8TRK" + stamp.replace(":", "").replace("-", ""), "carrier": "Aramex"})
        r = await wh.request.patch(f"{BASE}/api/gifts/{gA['id']}", data={"action": "deliver"})
        check("warehouse: delivered order A", r.ok, f"{r.status} {await r.text()}")
        await ctxw.close()

        # ---- leader: GIFT_DELIVERED notification names the credit effect -----
        await page.goto(f"{BASE}/notifications", wait_until="networkidle")
        notifs = await (await page.request.get(f"{BASE}/api/notifications")).json()
        for n in notifs:
            n["createdAt"] = n.get("createdAt") or ""
        delivered = [n for n in notifs if n.get("type") == "GIFT_DELIVERED"]
        check("leader: has GIFT_DELIVERED notification", len(delivered) >= 1, f"{len(delivered)}")
        last = delivered[0] if delivered else {}
        body = last.get("body") or ""
        check("deliver notification mentions credit effect",
              "credited to your credit account" in body, body)
        check("deliver notification includes order amount",
              f"{gA['orderTotal']}".replace(".0", "") in body, body)

        # ---- admin: credit block reflects A's just-posted outstanding credit --
        ctxa = await browser.new_context(); adm = await ctxa.new_page()
        await login(adm, *ADMIN)
        r0 = await adm.request.put(f"{BASE}/api/settings", data={
            "creditEnabled": True, "deliverableApprovalRequired": True,
            "currencyCode": "EGP", "currencySymbol": "EGP"})
        check("admin: baseline settings", r0.ok, f"{r0.status} {await r0.text()}")
        dash_admin = await (await adm.request.get(f"{BASE}/api/dashboard")).json()
        cred = dash_admin.get("credit")
        check("admin dashboard: credit block present", cred is not None, json.dumps(cred, default=str))
        check("admin dashboard: credit enabled", bool(cred and cred["enabled"]), "")
        spenders = (cred or {}).get("topSpenders") or []
        check("admin dashboard: top spenders sorted desc",
              all(spenders[i]["balance"] >= spenders[i+1]["balance"] for i in range(len(spenders) - 1)),
              json.dumps(spenders, default=str))
        check("admin dashboard: outstanding = sum of balances",
              abs(round(cred["totalOutstanding"], 4) - round(sum(s["balance"] for s in spenders), 4)) < 1e-6,
              f"total={cred['totalOutstanding']}")
        check("admin dashboard: has a top spender with credit",
              len(spenders) >= 1 and spenders[0]["balance"] > 0 and
              any(s.get("name") == lead_me.get("displayName") for s in spenders),
              json.dumps(spenders, default=str))

        # ---- settle A's deliverables so a second order is allowed ------------
        reqA = required_of(dealA, spawned)
        for d in reqA:
            rr = await page.request.patch(f"{BASE}/api/deliverables/{d['id']}",
                data={"action": "submit", "postedUrl": f"https://tiktok.com/p8-{d['id']}", "postedDate": datetime.date.today().isoformat()})
            check(f"settle submit '{d['title']}'", rr.ok, f"{rr.status} {await rr.text()}")
        for d in reqA:
            ra = await mgr.request.patch(f"{BASE}/api/deliverables/{d['id']}", data={"action": "approve", "comment": "P8 settle"})
            check(f"settle approve '{d['title']}'", ra.ok, f"{ra.status} {await ra.text()}")

        # ---- leader: order B same month -> exception flag --------------------
        rb = await submit_order(page, cid, target["currentEngagementId"], stamp + "-B", "P8B")
        check("leader: created gift order B (2nd this month)", rb.status == 201, f"{rb.status} {await rb.text()}")
        gB, _ = await loose_gift(page, cid, "pending_manager")
        order_b = None
        if gB:
            d = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
            for e in d.get("engagements", []):
                for g in e.get("gifts", []):
                    if g.get("id") == gB["id"]:
                        order_b = g
        check("order B flagged as exception", bool(order_b and order_b.get("isException")), json.dumps(order_b, default=str))

        # ---- admin: exceptions + gift report reflects A and B ---------------
        dash_admin = await (await adm.request.get(f"{BASE}/api/dashboard")).json()
        excl = dash_admin.get("exceptions")
        active = (excl or {}).get("active") or []
        check("admin dashboard: exceptions block present", excl is not None, "")
        check("admin dashboard: exception order B listed",
              any(x.get("requesterName") == lead_me.get("displayName") and x.get("statusKey") == "pending_manager" for x in active),
              json.dumps(active, default=str))
        rep = (dash_admin.get("gifts") or {}).get("report")
        check("admin dashboard: gift report present", bool(rep and "totalOrders" in rep), json.dumps(rep, default=str))
        check("gift report: totalOrders == requestedThisMonth",
              rep["totalOrders"] == dash_admin["gifts"]["requestedThisMonth"],
              f"report={rep['totalOrders']} requested={dash_admin['gifts']['requestedThisMonth']}")
        avg_ok = rep["totalOrders"] == 0 or (
            rep["totalOrders"] > 0
            and abs(round(rep["orderValue"] / rep["totalOrders"], 6) - round(rep["averageOrderValue"], 6)) < 1e-6
        )
        check("gift report: average order value consistent", avg_ok, json.dumps(rep, default=str))
        check("gift report: order value > 0", rep["orderValue"] > 0, f"{rep['orderValue']}")
        await ctxa.close()

        # ---- manager: credit scoped to own team + exceptions -----------------
        dash_mgr = await (await mgr.request.get(f"{BASE}/api/dashboard")).json()
        mcred = dash_mgr.get("credit")
        check("manager dashboard: credit block present", mcred is not None, "")
        check("manager dashboard: credit scoped to team",
              bool(mcred) and all(s["team"] == mgr_me.get("teamName") for s in mcred["topSpenders"]),
              f"topSpenders={json.dumps((mcred or {}).get('topSpenders', []), default=str)}")
        mex = dash_mgr.get("exceptions")
        check("manager dashboard: exceptions block present", mex is not None, "")
        check("manager dashboard: exception order B visible",
              any(x.get("requesterName") == lead_me.get("displayName") for x in (mex or {}).get("active", []) or []),
              "")

        # ---- leader: credit/exceptions hidden, report still present ----------
        dash_lead = await (await page.request.get(f"{BASE}/api/dashboard")).json()
        check("leader dashboard: credit block hidden", dash_lead.get("credit") is None, "")
        check("leader dashboard: exceptions block hidden", dash_lead.get("exceptions") is None, "")
        check("leader dashboard: gift report present",
              bool((dash_lead.get("gifts") or {}).get("report")), "")

        # ---- warehouse: no credit/exceptions blocks --------------------------
        ctxw2 = await browser.new_context(); wh2 = await ctxw2.new_page()
        await login(wh2, *WAREHOUSE)
        dash_wh = await (await wh2.request.get(f"{BASE}/api/dashboard")).json()
        check("warehouse dashboard: credit block hidden", dash_wh.get("credit") is None, "")
        check("warehouse dashboard: exceptions block hidden", dash_wh.get("exceptions") is None, "")
        rw = await wh2.request.get(f"{BASE}/api/credit/users")
        check("warehouse still denied credit/users", rw.status == 403, f"{rw.status}")
        await ctxw2.close()

        # ---- reports page renders the new gifting insights -------------------
        await mgr.goto(f"{BASE}/reports", wait_until="networkidle")
        rbody = await mgr.content()
        check("reports: gifting report card", "Gifting report" in rbody and "Average order value" in rbody, "")
        check("reports: credit balances card", "Credit balances" in rbody and "Outstanding gifting spend" in rbody, "")
        check("reports: active exception orders list", "Active exception orders" in rbody, "")

        await browser.close()

    print(f"\n===== SUMMARY =====\nPASSED: {len(PASS)}  FAILED: {len(FAIL)}")
    for name, detail in FAIL:
        print(f"  - {name}: {detail}")
    return 1 if FAIL else 0

async def db_product():
    proc = await asyncio.create_subprocess_exec("node", "-e", """
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        (async () => {
          const prod = await p.product.findFirst({ where: { unitCost: { gt: 0 } }, orderBy: { name: "asc" } });
          console.log(JSON.stringify(prod ? { id: prod.id } : null));
          await p.$disconnect();
        })().catch(e => { console.error(e.message); process.exit(1); });
        """, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=".", env=__import__("os").environ.copy())
    out, err = await proc.communicate()
    return json.loads(out.decode())

if __name__ == "__main__":
    env = __import__("os")
    env.environ["DATABASE_URL"] = env.popen("grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '\"'").read().strip()
    sys.exit(asyncio.run(main()))