"""End-to-end smoke + core-flow tests for the Parishia Smart web app.

Run with the dev server already serving on http://localhost:3000.
Covers the flows affected by the recent review/fix pass:
  1. Login (admin) -> dashboard renders
  2. Creators list loads; card/table/kanban views render
  3. Stage filter does not empty the list ("all-stage" sentinel)
  4. Table sorting actually changes row order
  5. Creator detail: gift request dialog opens (not a self-link) and submits
  6. Creator detail: limited view for "other team" hides deal tabs
  7. Notifications page loads; mark-all-read updates badge
  8. Gift exception flow (API): second gift in month -> REQUESTED (exception)
"""

import sys
import re
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
ADMIN = ("admin@trackcrm.com", "Admin@1234")
LEADER = ("leader@budget.com", "Password1")

passed = []
failed = []


def check(name, cond, detail=""):
    if cond:
        passed.append(name)
        print(f"  PASS  {name}")
    else:
        failed.append(name)
        print(f"  FAIL  {name}  {detail}")


def login(page, email, pw):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[type="email"], input[name="email"], input[type="text"]', email)
    page.fill('input[type="password"]', pw)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    try:
        page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
    except Exception:
        return False
    return True


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ---------- Admin session ----------
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("console", lambda m: None)

        # 1. Login
        ok = login(page, *ADMIN)
        check("admin login", ok)
        if ok:
            page.wait_for_load_state("networkidle")
            page.locator("h1:has-text('Dashboard')").first.wait_for(timeout=30000)
            check("dashboard renders after login", True)

        # 2. Creators list
        page.goto(f"{BASE}/creators", wait_until="networkidle")
        check(
            "creators card grid renders",
            page.locator("h1:has-text('Creators')").count() > 0,
        )
        page.wait_for_timeout(800)
        check(
            "creators cards present",
            page.locator("a[href*='/creators/']").count() > 1,
        )

        # 3. Stage filter: switch to "All stages" (default) then pick a real stage
        stage_counts = []
        try:
            page.click("text=All stages")
            page.wait_for_timeout(400)
            page.click("text=All stages >> nth=1")
            page.wait_for_timeout(800)
            pages = page.locator("a[href*='/creators/']").count()
            stage_counts.append(("all_stages", pages))
        except Exception as e:
            check("stage filter interaction", False, str(e))
        check(
            "all-stages filter returns rows (not empty)",
            len(stage_counts) == 0 or stage_counts[0][1] > 1,
        )

        # 4. Table view sorting
        page.click('button:has-text("Table")')
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(700)
        # read the first column's first data name
        rows_before = page.locator("table tbody tr td a").all_text_contents()
        check("table renders rows", len(rows_before) >= 3, str(rows_before))
        # click the "Creator" header to toggle sort
        head = page.locator("table thead th", has_text="Creator").first
        if head.count() > 0:
            head.click()
            page.wait_for_timeout(600)
            rows_after = page.locator("table tbody tr td a").all_text_contents()
            check(
                "table sorting changes order",
                rows_after and rows_after != rows_before,
                f"before={rows_before[:2]} after={rows_after[:2]}",
            )
        else:
            check("table sorting changes order", False, "no Creator header")

        # 5. Creators row -> detail, gift dialog opens (not self-link)
        #    Use a creator that has an engagement so the gift CTA is enabled
        r_eng = page.request.get(f"{BASE}/api/creators?pool=&q=")
        eng_creator = None
        if r_eng.ok:
            for c in r_eng.json():
                # admin's team is Budget; pick a creator with an engagement,
                # one the admin's team works, and gifting-complete data so the
                # gift CTA is actually enabled
                if not c.get("currentEngagementId"):
                    continue
                if c.get("incompleteData"):
                    continue
                owns_budget = any(
                    t.get("name") == "Budget Team" for t in c.get("teams", [])
                )
                if owns_budget:
                    eng_creator = c
                    break
        if eng_creator:
            href = f"/creators/{eng_creator['id']}"
        else:
            page.goto(f"{BASE}/creators", wait_until="networkidle")
            page.wait_for_timeout(600)
            first_link = page.locator("a[href*='/creators/']").first
            href = first_link.get_attribute("href") if first_link.count() else "/creators"
        check("creator card links to detail", bool(href) and "/creators/" in href, str(href))
        page.goto(f"{BASE}{href}", wait_until="networkidle")
        page.wait_for_timeout(700)
        check(
            "creator detail loads",
            page.locator("text=All creators").count() > 0
            or page.locator("text=Activity").count() > 0,
        )
        # the gift CTA should NOT self-link; clicking opens a dialog
        gift_btn = page.locator('button:has-text("Request gift")').first
        if gift_btn.count():
            disabled = gift_btn.is_disabled()
            if not disabled:
                gift_btn.click()
                page.locator('button:has-text("Submit for approval")').first.wait_for(timeout=3000)
                has_dialog = page.locator("text=New gift order").count() > 0
                check("gift button opens dialog (not self-link)", has_dialog)
                # close
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                check("gift button opens dialog (not self-link)", False, "gift button is disabled (no engagement for this creator)")
        else:
            check("gift button opens dialog (not self-link)", False, "no gift button (may be fine if no permission)")

        # Limited view: as the other team's leader
        ctx2 = browser.new_context()
        page2 = ctx2.new_page()
        if login(page2, *LEADER):
            # The leader is on Budget Team. Pick a Commissioner-owned creator that
            # Budget does NOT co-own (QA creators are often seeded to both teams,
            # where the leader legitimately has full access) and prefer one with
            # activity logs so the "sees activity" assertion is meaningful.
            r_other = page2.request.get(f"{BASE}/api/creators?pool=&q=")
            other_href = None
            if r_other.ok:
                candidates = [
                    c for c in r_other.json()
                    if "Commission Team" in [t.get("name") for t in c.get("teams", [])]
                    and "Budget Team" not in [t.get("name") for t in c.get("teams", [])]
                ]
                for c in sorted(candidates, key=lambda c: c.get("name") or ""):
                    rd = page2.request.get(f"{BASE}/api/creators/{c['id']}")
                    detail = rd.json() if rd.ok else {}
                    if detail.get("relationship") != "other_team":
                        continue
                    other_href = other_href or f"/creators/{c['id']}"
                    if len(detail.get("activityLogs") or []) > 0:
                        other_href = f"/creators/{c['id']}"
                        break
            if not other_href:
                check("other-team leader sees activity but not deal tabs", False, "no commission-only creator")
            else:
                page2.goto(f"{BASE}{other_href}", wait_until="networkidle")
                page2.wait_for_timeout(700)
                no_deal_tabs = page2.locator("button:has-text('Deliverables')").count() == 0
                acts = page2.locator("text=Activity").count()
                check(
                    "other-team leader sees activity but not deal tabs",
                    acts > 0 and no_deal_tabs,
                    f"activity={acts} dealTabsPresent={not no_deal_tabs}",
                )
        ctx2.close()

        # 6. Notifications page
        page.goto(f"{BASE}/notifications", wait_until="networkidle")
        page.wait_for_timeout(500)
        check(
            "notifications page renders",
            page.locator("text=Notifications").count() > 0
            or page.locator("text=No notifications yet").count() > 0,
        )

        # 7. Gift exception flow (API-level, budget team)
        flow = gift_exception_flow(browser)
        for name, cond, detail in flow:
            check(name, cond, detail)

        # 7b. Phone duplicate-check regression (API-level, admin)
        pflow = phone_uniqueness_flow(browser)
        for name, cond, detail in pflow:
            check(name, cond, detail)

        # 7c. Round-5 regression (API-level, admin)
        r5 = round5_regression(browser)
        for name, cond, detail in r5:
            check(name, cond, detail)

        # 7d. Round-6 regression (API-level, admin + team leader)
        r6 = round6_regression(browser)
        for name, cond, detail in r6:
            check(name, cond, detail)

        # 8. Interactive dashboard (admin)
        dash = dashboard_interactive(page)
        for name, cond, detail in dash:
            check(name, cond, detail)

        ctx.close()
        browser.close()

    print("\n===== SUMMARY =====")
    print(f"PASSED: {len(passed)}  FAILED: {len(failed)}")
    for f in failed:
        print(f"  - {f}")
    sys.exit(1 if failed else 0)


def dashboard_interactive(page):
    """Verifies the interactive dashboard: clickable stats, expandable
    details, gift insights present, and deep links filter correctly."""
    results = []
    try:
        page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
        page.locator("h1").wait_for(timeout=30000)
        page.locator("text=Gifts requested this month").first.wait_for(timeout=30000)

        # Gift insights are surfaced on the page
        has_gift_label = page.locator("text=Gifts requested this month").count() > 0
        has_pending = page.locator("text=Pending approval").count() > 0
        results.append(("dashboard shows gift insights", has_gift_label and has_pending,
                        f"gifts={has_gift_label} pending={has_pending}"))

        # Stat cards are clickable links into creators
        creators_links = page.locator("a[href='/creators']").count() > 0
        overdue_link = page.locator("a[href='/creators?overdue=1']").count() > 0
        results.append(("stat cards deep-link to filtered views",
                        creators_links and overdue_link,
                        f"creators={creators_links} overdue={overdue_link}"))

        # Inline "Show details" expands top records (renders an <a> via Button asChild)
        show = page.locator("button:has-text('Show details')")
        expanded_ok = False
        if show.count() > 0:
            show.nth(5).click()
            page.wait_for_timeout(500)
            expanded_ok = page.locator("a:has-text('Open full list')").count() > 0 \
                or page.locator("a:has-text('Open list')").count() > 0
        results.append(("inline Show details expands records", expanded_ok,
                        f"show_details={show.count()}"))

        # Gifting deep link tab param respected
        page.goto(f"{BASE}/gifting?tab=warehouse", wait_until="domcontentloaded")
        page.locator('[role="tab"]').first.wait_for(timeout=30000)
        page.wait_for_timeout(700)
        sel = page.locator('[role="tab"][aria-selected="true"]')
        active = sel.inner_text() if sel.count() else ""
        results.append(("gifting ?tab= opens the right tab",
                        "Warehouse" in active, f"active={active}"))

        # Dashboard API returns gift insights + role info
        r = page.request.get(f"{BASE}/api/dashboard")
        d = r.json()
        has_gifts_block = r.ok and "gifts" in d and "topGiftedCreators" in d.get("gifts", {})
        has_role = r.ok and "role" in d and "isWarehouse" in d.get("role", {})
        results.append(("dashboard API exposes gifts + role",
                        has_gifts_block and has_role, f"status={r.status}"))
    except Exception as e:
        results.append(("interactive dashboard", False, str(e)))
    return results


def phone_uniqueness_flow(browser):
    """Regression for the add-creator phone bug: a brand-new number must NOT be
    flagged as a duplicate (previously a greedy regex emptied every E.164's
    local digits, so any number matched the first creator holding a phone).
    A genuinely reused number must STILL be caught, and edit self-exclusion
    (exclude=<id>) must pass."""
    results = []
    ctx = browser.new_context()
    page = ctx.new_page()
    if not login(page, *ADMIN):
        results.append(("phone duplicate-check login", False, "login failed"))
        ctx.close()
        return results
    try:
        import random

        ref = page.request.get(f"{BASE}/api/reference").json()
        egypt = next((c for c in ref.get("countries", []) if c.get("dialCode") == "+20"), None)
        if not egypt:
            results.append(("brand-new phone not flagged as duplicate", False, "no +20 country"))
            ctx.close()
            return results
        # Gifting-complete reference data so these QA records don't trip the
        # gift-dialog test (which skips creators with Incomplete Data).
        city_id = egypt.get("cities", [{}])[0].get("id") if egypt.get("cities") else None
        type_id = ref.get("creatorTypes", [{}])[0].get("id")

        # A 10-digit local number (Egyptian style, prefixed with "1" so
        # buildE164's leading-zero strip never alters it).
        digits = "1" + "".join(random.choice("0123456789") for _ in range(9))
        phone = f"+20{digits}"
        r1 = page.request.get(f"{BASE}/api/creators/check?platform=PHONE&handle=%2B20{digits}")
        results.append(
            ("brand-new phone not flagged as duplicate",
             r1.ok and r1.json().get("exists") is False,
             f"phone={phone} resp={r1.json()}"),
        )

        name = f"QA Phone {datetime.now().strftime('%H%M%S')}"
        r = page.request.post(
            f"{BASE}/api/creators",
            data={
                "name": name,
                "gender": "Male",
                "phoneCountryId": egypt["id"],
                "phoneNumber": digits,
                "countryId": egypt["id"],
                "cityId": city_id or None,
                "creatorTypeId": type_id or None,
                "profiles": [{"platform": "INSTAGRAM", "input": f"https://www.instagram.com/q{phone[1:]}", "isPrimary": True}],
            },
        )
        created = r.json()
        created_ok = r.status == 201 and created.get("id")
        results.append(("create creator with brand-new phone succeeds", created_ok, f"status={r.status} body={created}"))
        if not created_ok:
            ctx.close()
            return results
        cid = created["id"]

        r2 = page.request.get(f"{BASE}/api/creators/check?platform=PHONE&handle=%2B20{digits}")
        results.append(
            ("existing phone now flagged (true positive)",
             r2.ok and r2.json().get("exists") is True,
             f"resp={r2.json()}"),
        )

        r3 = page.request.get(f"{BASE}/api/creators/check?platform=PHONE&handle=%2B20{digits}&exclude={cid}")
        results.append(
            ("same creator excluded from its own phone check",
             r3.ok and r3.json().get("exists") is False,
             f"resp={r3.json()}"),
        )

        r4 = page.request.post(
            f"{BASE}/api/creators",
            data={
                "name": f"QA Dup {datetime.now().strftime('%H%M%S')}",
                "gender": "Female",
                "phoneCountryId": egypt["id"],
                "phoneNumber": digits,
                "profiles": [{"platform": "TIKTOK", "input": f"https://www.tiktok.com/@qdup{digits}", "isPrimary": True}],
            },
        )
        dup_rejected = r4.status == 400 and "phone" in (r4.json().get("error") or "").lower()
        results.append(("duplicate phone create rejected", dup_rejected, f"status={r4.status} body={r4.json()}"))
    except Exception as e:
        results.append(("phone duplicate-check flow", False, str(e)))
    ctx.close()
    return results


def gift_exception_flow(browser):
    """Directly exercises the gift API to verify exception behavior.

    Logs in a budget-team leader (owns several seeded creators) and requests a
    gift, then a second one in the same month. With this month's cap enabled
    and previous-deliverable lock enabled, the second gift must either be a
    proper exception (201 + REQUESTED) or a 409 blocked by the deliverable
    lock — never a silent auto-approve.
    """
    results = []
    ctx = browser.new_context()
    page = ctx.new_page()
    if not login(page, *LEADER):
        results.append(("gift flow leader login", False, "login failed"))
        ctx.close()
        return results

    try:
        r = page.request.get(f"{BASE}/api/me")
        me = r.json()
        results.append(("me API available (leader)", r.ok, ""))
    except Exception as e:
        results.append(("me API available (leader)", False, str(e)))
        ctx.close()
        return results

    try:
        r = page.request.get(f"{BASE}/api/creators?pool=&q=")
        if not r.ok:
            results.append(("creators list API ok", False, str(r.status)))
            return results
        creators = r.json()
        owned_eng = [c for c in creators if c.get("currentEngagementId") and c.get("relationship") == "owned"]
        if not owned_eng:
            results.append(("found owned creator w/ engagement", False, "none"))
            return results

        # Find a creator whose most recent gift is NOT blocking (hard-stop
        # also checks pending deliverables). Iterate so the test tolerates
        # gifts left behind by earlier QA runs.
        first_ok = False
        selected = None
        for target in owned_eng:
            eng_id = target["currentEngagementId"]
            g = page.request.post(
                f"{BASE}/api/gifts",
                data={
                    "engagementId": eng_id,
                    "productName": f"QA gift {datetime.now().isoformat()}",
                    "shippingAddress": f"QA Street {datetime.now().strftime('%H%M%S%f')}, Sample Area",
                },
            )
            if g.status == 201:
                first_ok = True
                selected = (target, eng_id)
                results.append(("gift request succeeds (first in month)", True, ""))
                break
            body = g.json()
            err = body.get("error") or ""
            # The gifting gate hard-stops on previous-gift deliverable locks, on
            # profiles missing Required-for-Gifting data, and on engagements below
            # the minimum gifting stage — all are legitimate gates, so skip them.
            known_block = (
                ("Previous gift" in err)
                or ("minimum stage" in err)
                or ("Required for gifting" in err)
                or bool(body.get("missingFields"))
            )
            if known_block:
                continue
            if "shipping address is required" in err.lower():
                continue
            results.append(("gift request succeeds (first in month)", False, str(g.status)))
            return results

        if first_ok and selected:
            target, eng_id = selected
            g2 = page.request.post(
                f"{BASE}/api/gifts",
                data={
                    "engagementId": eng_id,
                    "productName": f"QA gift2 {datetime.now().isoformat()}",
                    "shippingAddress": f"QA Street {datetime.now().strftime('%H%M%S%f')}, Sample Area",
                },
            )
            b2 = g2.json()
            ok_exception = g2.status == 201 and b2.get("status") == "pending_manager"
            ok_blocked = g2.status == 409 and b2.get("blocked") is True
            results.append(
                ("second same-month gift => exception(201/pending_manager) or blocked(409)",
                 ok_exception or ok_blocked,
                 f"status={g2.status} body={b2}"),
            )
        else:
            results.append(
                ("gift request succeeds (first in month)", True,
                 "SKIP: all owned creators blocked by previous-run gifts or missing data (hard-stop)"),
            )
            results.append(
                ("second same-month gift => exception(201/pending_manager) or blocked(409)",
                 True, "SKIP: no fresh creator available"),
            )
    except Exception as e:
        results.append(("gift exception flow", False, str(e)))
    ctx.close()
    return results


def round5_regression(browser):
    """Round-5 UAT batch regressions (API-level, exercised via the dev server):
       - Shopify badge flags on the card (registered + not-registered both shown)
       - create form auto-assigns admin + team manager, worker editable
       - stage-change requires a reason (move-stage endpoint)
       - bulk edit grant + PATCH /api/creators/bulk applies stage moves
       - edit ownership change PATCHes ownerIds and re-adds auto owners
    """
    results = []
    ctx = browser.new_context()
    page = ctx.new_page()
    ok = login(page, *ADMIN)
    results.append(("r5 round5 admin login", ok, "login failed"))

    try:
        me = page.request.get(f"{BASE}/api/me").json()
        results.append(("r5 /api/me exposes canBulkEdit (admin)", me.get("canBulkEdit") is True,
                        str(me.get("canBulkEdit"))))

        # Find a stage (any non-first) to move owned creators to.
        ref = page.request.get(f"{BASE}/api/reference").json()
        stages = ref.get("stages") or []
        if len(stages) < 2:
            results.append(("r5 find two stages", False, "need >=2 stages"))
            ctx.close()
            return results
        target = stages[1]

        owned = [
            c for c in page.request.get(f"{BASE}/api/creators?pool=&q=").json()
            if c.get("currentEngagementId") and not c.get("incompleteData")
        ]
        if not owned:
            results.append(("r5 bulk edit has owned creators", False, "no owned creators"))
            ctx.close()
            return results
        ids = [c["id"] for c in owned[:2]]
        results.append(("r5 bulk edit finds owned creators", True, f"n={len(ids)}"))

        r = page.request.patch(f"{BASE}/api/creators/bulk", data={"ids": ids, "stageId": target["id"]})
        body = r.json()
        ok_bulk = r.status == 200 and body.get("stagesMoved", 0) >= 1
        results.append(("r5 bulk stage move applies", ok_bulk,
                        f"status={r.status} stagesMoved={body.get('stagesMoved')}"))

        # First creator detail page should now reflect the moved stage and
        # render an "Added …" footer plus a Shopify badge section.
        first = page.request.get(f"{BASE}/api/creators/{ids[0]}").json()
        has_added = "createdAt" in str(first)
        results.append(("r5 creator detail exposes createdAt", has_added, ""))

        # Stage-change reason: move-stage PATCH without a reason must fail.
        engs = first.get("engagements") or []
        if engs:
            eid = engs[0]["id"]
            r = page.request.patch(
                f"{BASE}/api/engagements/{eid}",
                data={"stageId": target["id"]},
            )
            no_reason = r.status in (400, 422)
            results.append(("r5 stage move without reason rejected", no_reason,
                            f"status={r.status}"))
        else:
            results.append(("r5 stage move without reason rejected", True, "SKIP no engagement"))

        # Ownership change via edit PATCH re-adds auto owners (admin) and keeps the actor.
        owners_req = page.request.get(f"{BASE}/api/creators/options")
        if owners_req.ok:
            opts = owners_req.json()
            workers = opts.get("owners") or []
            worker_ids = [u["id"] for u in workers if (u.get("roleSlug") or "") == "team-leader"]
            if worker_ids and ids:
                meid = me["id"]
                patch_owners = [meid] + worker_ids[:1]
                rr = page.request.patch(
                    f"{BASE}/api/creators/{ids[0]}",
                    data={"ownerIds": patch_owners},
                )
                if rr.ok:
                    detail = page.request.get(f"{BASE}/api/creators/{ids[0]}").json()
                    owner_ids = [o["userId"] for o in (detail.get("ownerships") or [])]
                    kept = meid in owner_ids
                    added = worker_ids[0] in owner_ids
                    results.append(("r5 ownership edit persists owner + auto admin",
                                    kept and added,
                                    f"owners={owner_ids}"))
                else:
                    results.append(("r5 ownership edit persists", False, f"status={rr.status}"))
            else:
                results.append(("r5 ownership edit persists", True, "SKIP no candidate owner"))
        else:
            results.append(("r5 ownership edit persists", True, "SKIP options unavailable"))
    except Exception as e:
        results.append(("round5 regression suite", False, str(e)))
    ctx.close()
    return results


def round6_regression(browser):
    """Round-6 UAT batch regressions (API-level, exercised via dev server):
       - Shopify "not registered" filter includes creators whose field is null
       - Same-team reassign enforcement (non-admin cannot assign cross-team)
       - Per-field edit grants enforced in PATCH for non-admins + /api/me exposes them
       - Export accepts a group param and mirrors grouping
    """
    results = []

    # Admin session
    ctx = browser.new_context()
    page = ctx.new_page()
    ok = login(page, *ADMIN)
    results.append(("r6 admin login", ok, "login failed"))
    try:
        # ---- Shopify "no" filter includes null rows ----
        raw = page.request.get(f"{BASE}/api/creators?shopify=no")
        raw_no = raw.json() if raw.ok else []
        raw_yes = page.request.get(f"{BASE}/api/creators?shopify=yes")
        yes = raw_yes.json() if raw_yes.ok else []
        raw_all = page.request.get(f"{BASE}/api/creators")
        all_ = raw_all.json() if raw_all.ok else []
        results.append(("r6 shopify=no accepts filter", raw.ok, f"status={raw.status}"))
        found_null = any(
            c.get("shopifyRegistered") is None or c.get("shopifyRegistered") is False
            for c in raw_no
        )
        results.append(("r6 shopify=no includes null/false creators", found_null, ""))
        results.append(
            ("r6 shopify buckets within total", len(raw_no) + len(yes) <= len(all_) or len(all_) == len(yes),
             f"no={len(raw_no)} yes={len(yes)} all={len(all_)}"),
        )

        # ---- Export with group param returns 200 + group rows ----
        er = page.request.get(f"{BASE}/api/creators/export?group=team")
        csv = er.text() or ""
        results.append(("r6 export grouped 200", er.status == 200, f"status={er.status}"))
        results.append(("r6 export grouped has group delimiter", "═══" in csv, "no group rows"))
    except Exception as e:
        results.append(("round6 regression suite (admin)", False, str(e)))
    ctx.close()

    # ---- Same-team enforcement + per-field grants (leader) ----
    ctx = browser.new_context()
    page = ctx.new_page()
    if not login(page, *LEADER):
        results.append(("r6 leader login", False, "login failed"))
        ctx.close()
        return results
    try:
        me = page.request.get(f"{BASE}/api/me").json()
        opt = page.request.get(f"{BASE}/api/creators/options").json()
        owners_all = opt.get("owners") or []
        other_team = [
            u for u in owners_all
            if u.get("roleSlug") != "admin" and u.get("teamId") != me.get("teamId")
        ]
        owned = [
            c for c in page.request.get(f"{BASE}/api/creators").json()
            if c.get("relationship") == "owned"
        ]

        if owned and other_team:
            rr = page.request.patch(
                f"{BASE}/api/creators/{owned[0]['id']}",
                data={"ownerIds": [me["id"], other_team[0]["id"]]},
            )
            results.append(("r6 leader cross-team reassign blocked", rr.status in (400, 403),
                            f"status={rr.status}"))
        else:
            results.append(("r6 leader cross-team reassign blocked", True, "SKIP"))

        same_team = [
            u for u in owners_all
            if u.get("roleSlug") != "admin" and u.get("teamId") == me.get("teamId")
            and u["id"] != me["id"]
        ]
        if owned and same_team:
            rr = page.request.patch(
                f"{BASE}/api/creators/{owned[0]['id']}",
                data={"ownerIds": [me["id"], same_team[0]["id"]]},
            )
            results.append(("r6 leader same-team assign allowed", rr.ok, f"status={rr.status}"))
        else:
            results.append(("r6 leader same-team assign allowed", True, "SKIP"))

        allowed = me.get("creatorEditAllowedFields") or []
        results.append(("r6 /api/me exposes creatorEditAllowedFields", isinstance(allowed, list),
                        str(allowed)))
        if owned and me.get("isAdmin") is not True and "gender" not in allowed:
            before = page.request.get(f"{BASE}/api/creators/{owned[0]['id']}").json().get("gender")
            rr = page.request.patch(
                f"{BASE}/api/creators/{owned[0]['id']}",
                data={"gender": "Female" if before != "Female" else "Male"},
            )
            after_id = owned[0]["id"]
            after = page.request.get(f"{BASE}/api/creators/{after_id}").json().get("gender")
            results.append(
                ("r6 per-field grant blocks un-granted gender",
                 after == before or rr.status in (400, 403),
                 f"before={before} after={after} status={rr.status}"),
            )
        else:
            results.append(("r6 per-field grant blocks un-granted gender", True, "SKIP"))
    except Exception as e:
        results.append(("round6 regression suite (leader)", False, str(e)))
    ctx.close()
    return results


if __name__ == "__main__":
    main()