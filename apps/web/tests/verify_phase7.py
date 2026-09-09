# Phase 7 verify: Credit ledger — single −debit on final required deliverable
# approval (and on last submission when deliverable approval is off), /api/credit
# own account + /api/credit/users (credit.view), settings toggles round-trip.
# Phase A settles EVERY delivered-but-unfulfilled order so concurrent runs and
# the phase-6 regression script never trip the previous-deliverable hard stop.
import asyncio, datetime, json, sys
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
    await page.goto(f"{BASE}/login", wait_until="networkidle")
    await page.fill('input[type="email"], input[name="email"], input[type="text"]', email)
    await page.fill('input[type="password"]', pw)
    await page.click('button[type="submit"]')
    try:
        await page.wait_for_url(lambda u: "/login" not in u, timeout=10000)
        return True
    except Exception:
        return False

def required_of(deal_type, dels):
    if deal_type in ("COMMISSION", "BARTER"):
        return [d for d in dels if any(k in (d.get("type") or "").lower() for k in ("video", "tiktok", "reel"))]
    return dels

async def own_creators(page):
    creators = await (await page.request.get(f"{BASE}/api/creators?pool=&q=")).json()
    return [c for c in creators if c.get("currentEngagementId") and c.get("relationship") == "owned"]

async def delivered_gift(page, cid):
    d = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
    for e in d.get("engagements", []):
        for g in e.get("gifts", []):
            if g.get("status") == "delivered":
                dels = [x for x in e.get("deliverables", []) if x.get("giftId") == g.get("id")]
                yield g, e.get("dealType"), dels

async def collect_targets(page, browser):
    targets = []
    for co in await own_creators(page):
        async for g, deal, dels in delivered_gift(page, co["id"]):
            req = required_of(deal, dels)
            pend = [d for d in req if d.get("status") not in ("APPROVED",)]
            if pend:
                targets.append((g, deal, req, pend, co["id"]))
    if targets:
        return targets
    # No unsettled delivered order anywhere: create one via the phase-6 lifecycle.
    creators = await own_creators(page)
    if not creators:
        return []
    stamp = datetime.datetime.now().isoformat(timespec="seconds")
    prod = await db_product()
    target = None
    for cand in creators:
        r = await page.request.post(f"{BASE}/api/gifts", data={
            "engagementId": cand["currentEngagementId"], "action": "submit",
            "lines": [{"productId": prod["id"], "quantity": 1}] if prod else
                     [{"productName": f"P7 {stamp}", "unitCost": 320, "quantity": 1}],
            "shippingAddress": f"P7 Street {stamp}",
            "deliverables": [{"title": f"P7 Reel {stamp}", "type": "Reel",
                              "dueDate": (datetime.date.today() + datetime.timedelta(days=14)).isoformat()}],
        })
        if r.status == 201:
            target = cand; break
    if not target:
        return []
    cid = target["id"]
    d = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
    gid = [g for e in d.get("engagements", []) for g in e.get("gifts", []) if g.get("status") == "pending_manager"][0]["id"]
    ctx2 = await browser.new_context(); mgr = await ctx2.new_page()
    await login(mgr, *MANAGER)
    await mgr.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "approve"})
    ctx3 = await browser.new_context(); wh = await ctx3.new_page()
    await login(wh, *WAREHOUSE)
    await wh.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "dispatch", "trackingNumber": "P7TRK" + stamp.replace(":", "").replace("-", ""), "carrier": "Aramex"})
    await wh.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "deliver"})
    await ctx2.close(); await ctx3.close()
    for co in await own_creators(page):
        async for g, deal, dels in delivered_gift(page, co["id"]):
            req = required_of(deal, dels)
            pend = [d for d in req if d.get("status") not in ("APPROVED",)]
            if pend:
                targets.append((g, deal, req, pend, co["id"]))
    return targets

async def submit_del(page, did):
    r = await page.request.patch(f"{BASE}/api/deliverables/{did}",
        data={"action": "submit", "postedUrl": f"https://tiktok.com/test-{did}", "postedDate": datetime.date.today().isoformat()})
    return r

async def approve_del(page, did, comment="LGTM"):
    r = await page.request.patch(f"{BASE}/api/deliverables/{did}", data={"action": "approve", "comment": comment})
    return r

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context()
        page = await ctx.new_page()

        # --- admin: baseline settings round-trip ----------------------------
        ctxa = await browser.new_context(); adm = await ctxa.new_page()
        if not await login(adm, *ADMIN):
            print("admin login failed"); return 1
        rb = await adm.request.put(f"{BASE}/api/settings", data={
            "creditEnabled": True, "deliverableApprovalRequired": True,
            "currencyCode": "EGP", "currencySymbol": "EGP"})
        check("admin: set credit settings", rb.ok, f"{rb.status} {await rb.text()}")
        rs = await (await adm.request.get(f"{BASE}/api/settings")).json()
        check("settings persisted (creditEnabled)", rs.get("creditEnabled") is True, json.dumps(rs, default=str))
        check("settings persisted (approvalRequired)", rs.get("deliverableApprovalRequired") is True, "")
        check("settings persisted (currency)", rs.get("currencyCode") == "EGP" and rs.get("currencySymbol") == "EGP", "")
        await ctxa.close()

        # --- non-managers cannot read credit/users --------------------------
        ctxw = await browser.new_context(); wh_page = await ctxw.new_page()
        await login(wh_page, *WAREHOUSE)
        ru = await wh_page.request.get(f"{BASE}/api/credit/users")
        check("warehouse denied credit/users (403)", ru.status == 403, f"{ru.status}")
        await ctxw.close()

        # --- leader: find every delivered-but-unfulfilled order --------------
        if not await login(page, *LEADER):
            print("leader login failed"); return 1
        targets = await collect_targets(page, browser)
        check("found unsettled delivered orders", len(targets) >= 1, f"{len(targets)}")
        if not targets:
            print("no delivered gift available; skipping"); return 1

        # --- auto-approval path: deliverable approval off, first order -------
        ctxa = await browser.new_context(); adm = await ctxa.new_page()
        await login(adm, *ADMIN)
        r = await adm.request.put(f"{BASE}/api/settings", data={"deliverableApprovalRequired": False})
        check("admin: disable deliverable verification", r.ok, f"{r.status} {await r.text()}")

        g0, deal0, req0, pend0, cid0 = targets[0]
        snap = await (await page.request.get(f"{BASE}/api/credit")).json()
        for i, d in enumerate(pend0):
            r = await submit_del(page, d["id"])
            check(f"auto-approve submit '{d['title']}'", r.ok, f"{r.status} {await r.text()}")
            st = await (await page.request.get(f"{BASE}/api/creators/{cid0}")).json()
            cur = [x for e in st.get("engagements", []) for x in e.get("deliverables", []) if x.get("id") == d["id"]]
            check(f"submitted deliverable auto-approved (#{i+1}/{len(pend0)})",
                  cur and cur[0].get("status") == "APPROVED", json.dumps(cur[0] if cur else None, default=str))
        snap2 = await (await page.request.get(f"{BASE}/api/credit")).json()
        debitb = [t for t in snap2["transactions"] if t["type"] == "DEBIT" and f"#{g0['orderNumber']}" in t["reason"]]
        check("auto path settles ledger on last submission",
              len(debitb) == 1 and abs(snap2["balance"] - (snap["balance"] - g0["orderTotal"])) < 1e-6,
              json.dumps(debitb))

        rr = await adm.request.put(f"{BASE}/api/settings", data={"deliverableApprovalRequired": True})
        check("admin: restore deliverable verification", rr.ok, f"{rr.status} {await rr.text()}")
        await ctxa.close()

        # --- manager-driven flow: settle every remaining order ---------------
        ctxm = await browser.new_context(); mgr = await ctxm.new_page()
        await login(mgr, *MANAGER)
        first = None
        for g, deal, req, pend, cid in targets:
            po = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
            live = [x for e in po.get("engagements", []) for x in e.get("deliverables", []) if x.get("giftId") == g["id"]]
            req_live = required_of(deal, live)
            pend_live = [d for d in req_live if d.get("status") not in ("APPROVED",)]
            if not pend_live:
                continue
            gid, order_total = g["id"], g["orderTotal"]
            before = await (await page.request.get(f"{BASE}/api/credit")).json()
            before_debits = len([t for t in before["transactions"] if t["type"] == "DEBIT"])

            for d in pend_live:
                r = await submit_del(page, d["id"])
                check(f"submit '{d['title']}' (order #{g['orderNumber']})", r.ok, f"{r.status} {await r.text()}")

            after_submit = await (await page.request.get(f"{BASE}/api/credit")).json()
            check(f"no debit before verification (order #{g['orderNumber']})",
                  len([t for t in after_submit["transactions"] if t["type"] == "DEBIT"]) == before_debits
                  and abs(after_submit["balance"] - before["balance"]) < 1e-9,
                  f"balance={after_submit['balance']}")

            submitted = [d["id"] for d in pend_live]
            for did in submitted[:-1]:
                r = await approve_del(mgr, did)
                check(f"approve '#{did[-4:]}'", r.ok, f"{r.status} {await r.text()}")
            mid = await (await page.request.get(f"{BASE}/api/credit")).json()
            check(f"no debit until ALL required approved (order #{g['orderNumber']})",
                  mid["balance"] == after_submit["balance"], f"balance={mid['balance']}")

            final_id = submitted[-1]
            r = await approve_del(mgr, final_id, "Approved — deliverables received")
            check(f"final approval (order #{g['orderNumber']})", r.ok, f"{r.status} {await r.text()}")
            after = await (await page.request.get(f"{BASE}/api/credit")).json()
            debit = [t for t in after["transactions"] if t["type"] == "DEBIT" and f"#{g['orderNumber']}" in t["reason"]]
            check(f"single debit on final approval (order #{g['orderNumber']})", len(debit) == 1, json.dumps(debit))
            check(f"debit amount = order total (order #{g['orderNumber']})",
                  len(debit) == 1 and abs(debit[0]["amount"] - order_total) < 1e-9,
                  f"amount={debit[0]['amount'] if debit else None}")
            check(f"balance drops by order total (order #{g['orderNumber']})",
                  abs(after["balance"] - (after_submit["balance"] - order_total)) < 1e-6,
                  f"before={after_submit['balance']} after={after['balance']}")

            if first is None:
                first = (g, req_live, final_id, cid, order_total, after)

        if first is None:
            first = (g0, req0, pend0[-1]["id"], cid0, g0["orderTotal"], snap2)
        g, req, final_id, cid, order_total, after = first

        # idempotency: resubmit + reapprove a settled deliverable -> no new debit
        rr = await submit_del(page, final_id)
        check("resubmit settled deliverable accepted", rr.ok, f"{rr.status} {await rr.text()}")
        ra = await approve_del(mgr, final_id, "re-approve")
        check("re-approve settled deliverable accepted", ra.ok, f"{ra.status} {await ra.text()}")
        after2 = await (await page.request.get(f"{BASE}/api/credit")).json()
        debit2 = [t for t in after2["transactions"] if t["type"] == "DEBIT" and f"#{g['orderNumber']}" in t["reason"]]
        check("no double debit (idempotent)", len(debit2) == 1 and abs(after2["balance"] - after["balance"]) < 1e-9,
              json.dumps(debit2))

        # activity log on the creator
        d2 = await (await page.request.get(f"{BASE}/api/creators/{cid}")).json()
        act = [a for a in d2.get("activityLogs", []) if a.get("type") == "GIFT_DEBIT_POSTED" and f"#{g['orderNumber']}" in (a.get("description") or "")]
        check("GIFT_DEBIT_POSTED activity logged", len(act) >= 1, json.dumps(act, default=str))

        # /credit page renders own ledger
        await page.goto(f"{BASE}/credit", wait_until="networkidle")
        body = await page.content()
        check("credit page renders balance card", "Credit account" in body and "Running balance" in body, "")
        check("credit page lists transactions", "Transactions" in body, "")

        # DB: debit row references the final deliverable, exactly one
        db = await db_debit_check(g["id"], [d["id"] for d in req], final_id, order_total)
        for name, ok, detail in db:
            check(name, ok, detail)
        await ctxm.close()

        # --- managers/admins can list credit accounts, scope respects role ----
        ctxm = await browser.new_context(); mgr = await ctxm.new_page()
        await login(mgr, *MANAGER)
        ru = await mgr.request.get(f"{BASE}/api/credit/users")
        rows = (await ru.json()).get("users", [])
        check("manager can list team credit accounts", ru.ok and len(rows) >= 1, f"{ru.status} {len(rows)}")
        manager_scope = len(rows)
        await mgr.goto(f"{BASE}/credit", wait_until="networkidle")
        mb = await mgr.content()
        check("manager sees team credit table", "Team credit balances" in mb, "")
        await ctxm.close()

        ctxa = await browser.new_context(); adm = await ctxa.new_page()
        await login(adm, *ADMIN)
        rau = await adm.request.get(f"{BASE}/api/credit/users")
        arows = (await rau.json()).get("users", [])
        check("admin sees all teams (broader than manager)", rau.ok and len(arows) > manager_scope,
              f"manager={manager_scope} admin={len(arows)}")
        await ctxa.close()

        await browser.close()

    print(f"\n===== SUMMARY =====\nPASSED: {len(PASS)}  FAILED: {len(FAIL)}")
    for name, detail in FAIL:
        print(f"  - {name}: {detail}")
    return 1 if FAIL else 0

async def db_product():
    import asyncio as aio, os
    proc = await aio.create_subprocess_exec("node", "-e", """
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        (async () => {
          const prod = await p.product.findFirst({ where: { unitCost: { gt: 0 } }, orderBy: { name: "asc" } });
          console.log(JSON.stringify(prod ? { id: prod.id } : null));
          await p.$disconnect();
        })().catch(e => { console.error(e.message); process.exit(1); });
        """, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=".", env=os.environ.copy())
    out, err = await proc.communicate()
    return json.loads(out.decode())

async def db_debit_check(gid, del_ids, final_id, expected_total):
    import asyncio as aio, os
    arg = json.dumps(del_ids)
    proc = await aio.create_subprocess_exec("node", "-e", """
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        const ids = JSON.parse(process.argv[1]);
        const g = process.argv[2];
        const finalId = process.argv[3];
        const expected = Number(process.argv[4]);
        (async () => {
          const txs = await p.creditTransaction.findMany({ where: { type: "DEBIT", refType: "Deliverable", refId: { in: ids } } });
          const acct = txs[0] ? await p.creditAccount.findUnique({ where: { id: txs[0].accountId } }) : null;
          const gift = await p.gift.findUnique({ where: { id: g } });
          console.log(JSON.stringify({
            debits: txs.map(t => ({ refId: t.refId, amount: t.amount })),
            refsFinal: txs.map(t => t.refId === finalId),
            balance: acct?.balance, giftTotal: gift?.orderTotal, expected }));
          await p.$disconnect();
        })().catch(e => { console.error(e.message); process.exit(1); });
        """, arg, gid, final_id, str(expected_total),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=".", env=os.environ.copy())
    out, err = await proc.communicate()
    data = json.loads(out.decode())
    once = len(data["debits"]) == 1
    return [
        ("db: exactly one DEBIT references order deliverables", once, json.dumps(data)),
        ("db: debit amount = order total", once and data["debits"][0]["amount"] == expected_total, json.dumps(data)),
        ("db: debit references final approved deliverable", once and data["refsFinal"][0], json.dumps(data)),
    ]

if __name__ == "__main__":
    env = __import__("os")
    env.environ["DATABASE_URL"] = env.popen("grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '\"'").read().strip()
    sys.exit(asyncio.run(main()))