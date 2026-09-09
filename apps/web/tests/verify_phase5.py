import asyncio, datetime, json, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
LEADER = ("leader@budget.com", "Password1")
MANAGER = ("manager@budget.com", "Password1")

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

        # 1) find an owned creator with an engagement
        me = await page.request.get(f"{BASE}/api/me")
        creators = (await (await page.request.get(f"{BASE}/api/creators?pool=&q=")).json())
        owned = [c for c in creators if c.get("currentEngagementId") and c.get("relationship") == "owned"]
        if not owned:
            print("no owned creator w/ engagement; skipping"); return 0

        async def pick(stamp, deliverables=None, used=set()):
            """Return (creator, eng) of an owned creator NOT hard-blocked by a
            previous-run gift, else None."""
            for cand in owned:
                if cand["id"] in used: continue
                r = await page.request.post(f"{BASE}/api/gifts", data={
                    "engagementId": cand["currentEngagementId"],
                    "action": "submit",
                    "lines": [{"productName": f"Phase5 lip tint {stamp}", "productDescription": "QA", "unitCost": 0, "quantity": 2}],
                    "shippingAddress": f"P5 Street {stamp}",
                    "deliverables": deliverables or [],
                })
                if r.status == 201:
                    return cand, r
                try:
                    b = await r.json()
                except Exception:
                    b = {}
                err = b.get("error", "")
                if b.get("blocked") and ("Previous gift" in err or "missing required data" in err):
                    continue
            return None, None

        stamp = datetime.datetime.now().isoformat(timespec="seconds")
        target, r1 = await pick(stamp, deliverables=[{
            "title": f"Phase5 Reel {stamp}", "type": "Reel",
            "dueDate": (datetime.date.today() + datetime.timedelta(days=14)).isoformat()}])
        if not target:
            print("all owned creators blocked; nothing to verify"); return 0

        cid, eng_id, cname = target["id"], target["currentEngagementId"], target.get("name", target["id"])
        b1 = await r1.json()
        check("submit order lands pending_manager", r1.status == 201 and b1.get("status") == "pending_manager",
              f"{r1.status} {b1}")
        if r1.status != 201:
            await browser.close(); return 1
        gid = b1.get("giftId") or b1.get("id")

        # need the created gift id
        gifts = (await (await page.request.get(f"{BASE}/api/creators/{cid}")).json())
        found = [g for e in gifts.get("engagements", []) for g in e.get("gifts", []) if g.get("status") == "pending_manager"
                 and (g.get("lines") or [{}])[0].get("productName", "").startswith("Phase5 lip tint")]
        if not found:
            check("locate created gift id", False, "not in creator gifts list")
            await browser.close(); return 1
        gid = found[0]["id"]
        check("created gift carries agreement + order + lines", bool(found[0].get("agreement"))
              and found[0].get("orderTotal") == 0 and len(found[0].get("lines", [])) == 1,
              json.dumps({k: found[0].get(k) for k in ("agreement", "orderTotal", "status", "statusLabel", "lines")}, default=str))

        # 3) approve as manager
        ctx2 = await browser.new_context()
        mgr = await ctx2.new_page()
        check("manager login", await login(mgr, *MANAGER))
        ra = await mgr.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "approve"})
        check("manager approve ok", ra.ok, f"{ra.status} {await ra.text()}")
        # also verify manager can't approve a non-pending order again
        ra2 = await mgr.request.patch(f"{BASE}/api/gifts/{gid}", data={"action": "approve"})
        check("re-approve refused (not pending)", not ra2.ok, f"{ra2.status} {await ra2.text()}")

        # gift now approved with delivery status key
        g2 = (await (await page.request.get(f"{BASE}/api/creators/{cid}")).json())
        cur = [g for e in g2.get("engagements", []) for g in e.get("gifts", []) if g.get("id") == gid]
        check("gift moved to approved", cur and cur[0].get("status") == "approved", json.dumps(cur[0].get("status") if cur else None))

        # deliverables spawned + tagged giftId
        dels = [d for e in g2.get("engagements", []) for d in e.get("deliverables", []) if d.get("giftId") == gid]
        check("agreement deliverable spawned & tagged", len(dels) == 1 and dels[0].get("title", "").startswith("Phase5 Reel"),
              json.dumps(dels, default=str))
        if dels:
            check("spawned deliverable starts PENDING + dueDate set", dels[0].get("status") == "PENDING" and bool(dels[0].get("dueDate")),
                  json.dumps(dels[0], default=str))
        await ctx2.close()

        # 4) reject path: submit an order for a different, unblocked creator then
        # reject -> back to draft (the approved order above now hard-blocks its
        # own creator via the spawned PENDING deliverable — verifies the lock too)
        ct3 = await browser.new_context()
        mgr3 = await ct3.new_page()
        await login(mgr3, *MANAGER)
        others = [c for c in owned if c["id"] != cid]
        other_target = None
        stamp2 = datetime.datetime.now().isoformat(timespec="seconds")
        for cand in others:
            rr2 = await page.request.post(f"{BASE}/api/gifts", data={
                "engagementId": cand["currentEngagementId"],
                "action": "submit",
                "lines": [{"productName": f"Phase5 serum {stamp2}", "unitCost": 0, "quantity": 1}],
                "shippingAddress": f"P5 Street {stamp2}",
            })
            if rr2.status == 201 and (await rr2.json()).get("status") == "pending_manager":
                other_target = cand
                check("2nd (submit on fresh creator) landed pending", True)
                break
        check("2nd (submit on fresh creator) landed pending", other_target is not None,
              "all other owned creators blocked")
        if other_target:
            g3 = (await (await page.request.get(f"{BASE}/api/creators/{other_target['id']}")).json())
            f3 = [g for e in g3.get("engagements", []) for g in e.get("gifts", [])
                  if (g.get("lines") or [{}])[0].get("productName", "").startswith("Phase5 serum")]
            if f3:
                rr = await mgr3.request.patch(f"{BASE}/api/gifts/{f3[0]['id']}", data={
                    "action": "reject", "reason": "not on brand"})
                check("manager reject ok", rr.ok, f"{rr.status} {await rr.text()}")
                g4 = (await (await page.request.get(f"{BASE}/api/creators/{other_target['id']}")).json())
                f4 = [g for e in g4.get("engagements", []) for g in e.get("gifts", []) if g.get("id") == f3[0]["id"]]
                check("rejected order returned to draft (resumable)", f4 and f4[0].get("status") == "draft",
                      json.dumps(f4[0] if f4 else None, default=str))
                check("reject reason recorded", f4 and f4[0].get("exceptionReason") == "not on brand",
                      json.dumps(f4[0].get("exceptionReason") if f4 else None))
            else:
                print("!! could not locate fresh creator gift")
        await ct3.close()

        await browser.close()

    print(f"\n===== SUMMARY =====\nPASSED: {len(PASS)}  FAILED: {len(FAIL)}")
    for name, detail in FAIL:
        print(f"  - {name}: {detail}")
    return 1 if FAIL else 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))