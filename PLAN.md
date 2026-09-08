# PLAN — Full-Cycle Gift Order, Deliverables, Credit & Logistics

**Status: Pending approval. No code is written until you approve this plan.**

Refactors the current simple "Request Gift" (engagement + product-name string) into a full **Gift Order** lifecycle: multi-line product orders, agreement (budget/commission + deliverables), configurable approval chain, warehouse shipping labels, and a per-user **Credit Account** ledger.

---

## 1. Resolved decisions (from the design interview)

| Topic | Decision |
|---|---|
| Scope | **Gift Order fully replaces** the simple Gift request. One form, one model. |
| Product catalog | Admin-managed only (`Category` → `Product` → fixed `unitCost`). Unit cost **read-only** to all others, **snapshotted** onto each order line at request time. |
| Credit model | Per-user ledger, **order-driven** (no top-ups/allocations). **+credit** when the order reaches a status flagged `grantCredit` (default `Delivered`). **single −debit** when all of that order's required deliverables are **Approved**. **No penalty ever**; overdue = warning badge only. |
| Gift statuses | **Fully dynamic** DB rows (Admin-managed like pipeline stages). Semantic **flags** replace hardcoded transitions. |
| Approval chain | Configurable per status (`approvalRole`). "Manager only, no admin" = Admin simply omits the Pending-Admin status. |
| Purchase order form | `Engagement → Agreement → Product lines → Shipping → Submit`. |
| Agreement section | Saves agreed budget (Fixed Budget) or commission % (+ optional coupon) + deliverables (title, type, **mandatory due date**) on the order. |
| Deliverable spawn | On reaching the status flagged `spawnDeliverables` (seed: Approved), the order's deliverables are written as real **Deliverable** records on the engagement, tagged `giftId`, worked through the existing submit/approve flow. |
| Shipping address | Picked from the creator's prior order addresses or typed new; **snapshotted** on the order and printed on the label. |
| Warehouse | Ship = enter carrier + tracking → next status (Shipped). Deliver = mark creator-received → **+credit**. Browser-print label. |
| Credit visibility | Self + their Team Manager + Admin (Credit page, transaction history, small balance chip). Auto entries in Transaction Log. Admin+Managers see team/all lists. |
| Monthly cap | Every order goes through the approval chain (auto-approve-first-of-month **removed**). A 2nd order in the same month is additionally flagged **Exception** (badge; still normal approval). |

## 2. Data model changes (`apps/web/prisma/schema.prisma`)

**New models**

- `GiftStatus` — dynamic status rows, mirrors `Stage`:
  `id, key (unique, e.g. draft/pending_manager/approved/shipped/delivered), label, position, approvalRole? (none|manager|admin), isDraft, isRejection, grantCredit, spawnDeliverables, createdAt`
  Seeded rows (statuses the running code migrates to):
  `Draft(0, isDraft), Pending Manager(1, approvalRole=manager), Approved(2, spawnDeliverables), Shipped(3, warehouseStep), Delivered(4, grantCredit)`. `Rejected` is created only if a status carries `isRejection`.
  Admin can add/delete/reorder/rename free statuses and flip flags; core code never hardcodes status names — it reads flags.
- `ProductCategory` — `id, name, slug (unique), position, createdAt`.
- `Product` — `id, name, categoryId, unitCost (Decimal), description?, active (default true), createdAt`.
- `CreditAccount` — `id, userId (unique), balance (Decimal, default 0), updatedAt`.
- `CreditTransaction` — `id, accountId, amount (Decimal; +credit / −debit), type (CREDIT|DEBIT), reason, refType (Gift|Deliverable), refId, createdAt`. Indexed `[accountId, createdAt]`.

**Changed models**

- `Gift` becomes the **Gift Order**. Replaces `status` (enum) with `statusId` (FK `GiftStatus`). Replaces `productName/productDescription` with:
  - `shippingAddress (String)`, `currency (Currency)`, `orderTotal (Decimal)`,
  - `agreedBudget (Decimal?)`, `commissionRate (Decimal?)`, `couponCode (String?)`,
  - `orderNumber (Int, @default(autoincrement()))`,
  - keeps `requestedById, approvedById/At, trackingNumber, carrier, dispatchedAt, deliveredAt, isException, exceptionReason`.
- Add `GiftLine` — `id, giftId, productId?, productName (snapshot), unitCost (snapshot, Decimal), quantity (Int), lineTotal (Decimal)`. Cost snapshotted → later catalog edits never change historical orders.
- Add `Deliverable.giftId?` (nullable FK) — tags order-spawned deliverables.
- **Migration**: seed `GiftStatus` rows; map old enum values → rows (`REQUESTED`→Pending Manager, `APPROVED_QUEUED`→Approved, `DISPATCHED`→Shipped, `DELIVERED`→Delivered, `REJECTED`→`isRejection` row if it was used); drop the `GiftStatus` enum.

## 3. Request form (`creators/[id]` → full dialog)

Sections, top to bottom:
1. **Engagement** — picker (existing, defaults to first engagement, shows deal type).
2. **Agreement** — for `FIXED_BUDGET`: agreed budget + currency. For `COMMISSION`: commission % + optional coupon. For `BARTER`: no money fields. Then **deliverables** (add rows: title, type, due date — due date mandatory per row).
3. **Products** — `Category` dropdown → `Product` dropdown → **Auto-Cost** (read-only unit cost) → Qty → line total. Add multiple lines; running order total.
4. **Shipping** — address field fed by a datalist of the creator's prior order addresses + free text; required.
5. Buttons: **Save draft** (stays Draft, resumable via Gifting page) / **Submit** (moves to first status; if no pending status exists it goes straight to `spawnDeliverables` status).

Hard-stop checks run on submit (unchanged, in `lib/gifts.ts`):
- engagement of the user's team + ownership (`canRequestGift`),
- **Required-for-Gifting** block (Country, City, Creator Type, Phone) — hard stop naming missing fields,
- min-stage gate (`giftMinStageId`, per team pipeline order),
- previous-deliverable lock: the creator's **last active order** (`status` not in a `isRejection`/`isDraft` row, ordered by requestedAt desc) — all its required deliverables must be **Approved** (Commission/Barter → only video-type deliverables, as today),
- monthly cap → `isException` flag (exception shown as badge, still normal approval).

## 4. Approval chain

- Statuses advance **sequentially by `position`**.
- **Approve** is enabled when the current status `approvalRole` matches the actor (manager or admin; admin may approve any). Approve moves the order to the next position.
- **Reject** (manager/admin, with reason) moves it back to the row flagged `isDraft`.
- Entering a row with `spawnDeliverables` **creates** the order's Deliverable records (tagged `giftId`, status `PENDING`) — inside the same DB transaction as the status change, so an order can never be "approved" without its deliverables.
- Warehouse act only on rows whose next status is a `warehouseStep` (seed: Shipped).

## 5. Warehouse & shipping label (`/gifting` page + `DispatchCard`)

- Warehouse tab lists orders at `spawnDeliverables`/pre-ship rows.
- **DispatchCard gains a label panel** (from the order snapshot + creator profile):
  creator name · phone · **City** · shipping address · lines (product × qty, unit/line tot) · **order total** · order number.
- **Ship** — carrier + tracking (both required, as today) → moves to `warehouseStep` status, sets `dispatchedAt`.
- **Deliver** — marks creator-received → **+credit posts here** (same transaction as the status change).
- **Print label** — a print-only label view opened via the browser (window.print, print CSS; no barcode/PDF service in v1).

## 6. Credit ledger & transactional guarantees

- `CreditAccount.balance` is the running value of the user's **delivered-but-unfulfilled** orders.
- Every mutation runs inside **`prisma.$transaction`** so the ledger can never diverge from the order/deliverable state:
  - **+credit** (`CREDIT`, ref `Gift:<id>`, reason "Gift order #<n> delivered"): transition to a `grantCredit` status — in the deliver-mutation transaction.
  - **−debit** (`DEBIT`, ref `Deliverable:<id>`, reason "Deliverables approved for gift order #<n>"): on the **final** required deliverable reaching **Approved** in `reviewDeliverable`; posted exactly once — guarded by checking the trust (all required deliverables of that order Approved AND no prior DEBIT for that order). If the workspace's `deliverableApprovalRequired` setting is off, the debit posts at the last required submission instead.
  - Both actions also write an **Activity Log** entry (on the creator) and a **Transaction Log** entry (on the user).
- Guard: a single credit/debit pair per order — no re-posting on revision/re-approval (Debit guard above; credit posts once at first entry to `grantCredit`).

## 7. Settings & permissions

**New `WorkspaceSetting` keys (flat KV store, `lib/settings.ts`):**
- `deliverableApprovalRequired` (bool, default true) — whether deliverable links need manager approval before the debit posts.
- `currencyCode` + `currencySymbol` (single workspace currency; order displays in the engagement's `Currency`, labels/UI use the symbol).
- `creditEnabled` (bool, default true) — ledger on/off.
- Gift statuses: managed as rows (dedicated API + Settings card), not KV keys.

**Permissions:** add `credit.view` (seeded to `team-manager`, `admin`). Existing `gift.request / gift.approve / gift.fulfill` stay. `settings.manage` gates statuses, catalog, and the new keys.

**Settings UI additions** (mirror existing `StagesCard` pattern):
- **Gift statuses card** — add/delete/reorder/rename, flag toggles (approvalRole, isRejection, grantCredit, spawnDeliverables, warehouseStep, isDraft).
- **Catalog card** — categories + products (name, category, unit cost). Admin only.
- Toggles for the two new bool settings.

## 8. Notifications (in-app)

- Reuse `GIFT_APPROVED / GIFT_REJECTED / GIFT_DISPATCHED / GIFT_DELIVERED / GIFT_EXCEPTION_REQUESTED`.
- Generalize `GIFT_REQUESTED` (not only exceptions) → managers on submit (all orders now need approval).
- Credit post notifications ride existing delivery/approval notifications (body mentions balance effect). No new types unless needed.

## 9. Dashboard & reports

- Managers/Admin dashboard: credit outstanding per user (top spenders + balances) and active exception orders.
- Gifting report gains: order totals, per-user credit balances/transactions, average order value.

## 10. Delivery phases

1. **Schema + migration** — new models, `Gift` changes, status seed, enum removal.
2. **Status engine** — `GiftStatus` CRUD API + Settings card; replace enum reads with flag reads in `lib/gifts.ts`.
3. **Catalog** — models + Admin CRUD API + Settings card.
4. **Order form** — Agreement + product grid + shipping + draft/submit; rework `requestGift` (all orders → first status; exception flag).
5. **Approval + deliverable spawn** — approve/reject moves by `position`; transactional `spawnDeliverables`.
6. **Warehouse** — DispatchCard label panel + ship/deliver + print label; deliver posts credit.
7. **Credit ledger** — accounts, debit on final approval, transaction, `credit.view` routes, Credit page + chip + Settings toggles.
8. **Notifications + dashboard + reports** — wiring and new insights.

## 11. Explicitly out of scope (v1)

- Physical-receipt tracking beyond the `Delivered` mark (no courier APIs).
- Multi-currency product pricing.
- No penalty/surcharge on overdue deliverables.
- No barcode/label services.

---

**Awaiting your approval to proceed. Phases 1–2 land as one migration + seed.**