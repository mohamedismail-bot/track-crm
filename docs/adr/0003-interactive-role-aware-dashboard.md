# 0003: Interactive role-aware dashboard with deep-linked insights

The dashboard was originally a read-only landing page: static stat cards with no navigation, no gift-related insights surfaced in the UI, and the Gift counts computed by the API unused by the page. Users could not click any number to inspect the underlying records.

**Decision:**
- Every dashboard insight is **clickable** and performs one of two actions:
  1. **Primary click** navigates to the relevant page **pre-filtered** via URL query params (e.g. `/creators?overdue=1`, `/creators?stage=<id>`, `/creators?owner=<userId>`, `/gifting?tab=pending`).
  2. An inline **"Show details"** toggle expands the top records directly on the dashboard, with a link out to the full list.
- Creator-list and gifting pages accept URL search params to honor these deep links:
  - `/creators` supports `stage`, `owner`, `pool`, `q`, `team`, `overdue=1`, `upcoming=1`.
  - `/gifting` supports `tab=pending|warehouse|history`.
- **Gifting insights are now surfaced** and the dashboard is **role-aware**:
  - Warehouse (fulfillment) users get a gifting-throughput view: pending approval, queued for dispatch, dispatched this month, delivered this month, plus top gifted creators.
  - Team Leaders / Managers / Admin get creator workload stats (total, owned by me, overdue, pipeline), gift requests this month, pending approvals, exception requests, queued/dispatched/delivered counts, and a "top gifted creators" card (last 90 days).
- The `/api/dashboard` payload now includes a `role` block (`roleSlug`, `isWarehouse`, `canApprove`, `canFulfill`), a `gifts` block (requested/pending/exception/queued/dispatched/delivered counts + recent gifts + top gifted creators), and scopes gift data to all teams for warehouse/admin, otherwise the user's own team.

**Considered Options:**
- Modal/sidebar inspection on the dashboard instead of navigation. Rejected: navigation preserves browser back/forward, keeps dashboard state simple, and reuses existing list pages rather than duplicating list UIs.
- Dedicated deliverables page. Deferred: overdue/upcoming deep-link to filtered `/creators` views, keeping the page surface small; can be revisited if deliverable-centric reporting is needed.

**Consequences:**
- `/creators` and `/gifting` must keep supporting URL params going forward; filters should initialize from the URL so links remain stable.
- The dashboard should never assume a role's permission set; it keys warehouse off `roleSlug` while gift **scoping** keys off `gift.fulfill`/admin so an admin with fulfillment grants does not get the warehouse-only layout.
- New insight metrics must be modeled in `/api/dashboard` first; the UI colors/deep-links follow the payload, keeping dashboard rendering dumb.