# Parishia Smart — System Specification

Hand-off document for building the Creator Outreach, Tracking, and Gifting workspace.

See `CONTEXT.md` for domain glossary and relationship rules.

---

## 1. Problem Statement

1. **Deal Collision:** Multiple internal teams outreach to the same creator simultaneously with conflicting offers.
2. **Unfulfilled Gifting:** Products are sent to creators but no system tracks whether agreed videos/content were delivered.
3. **Duplicate Gifting:** Marketers send multiple gifts per month to the same creator without oversight.
4. **Disorganized Tracking:** Spreadsheets fail to manage deadlines, metrics, and communication histories across teams.

## 2. Tech Stack

Full-stack Next.js monolith (App Router), TypeScript, Prisma + PostgreSQL, Tailwind CSS + shadcn/ui.
Kanban: `@hello-pangea/dnd`. Grid: TanStack Table. Auth: Auth.js (credentials provider, bcrypt, role in session).
See `docs/adr/0001-fullstack-nextjs-monolith.md` and `docs/adr/0002-creator-is-the-person.md` for architectural rationale.

## 3. Data Model (Prisma Schema)

### Entities

| Entity | Description |
|---|---|
| `User` | System user (login: email or phone + password hash, display name, avatar, roleId, teamId, archivedAt) |
| `Role` | Job-defined set of Permissions. Seeded with the four core roles; Admin may add/edit roles (Admin role is immutable). |
| `Permission` | Atomic capability token (e.g., `creator.create`, `gift.approve`). One User has exactly one Role. |
| `Team` | Named group of users (name, slug) |
| `TransactionLog` | Per-user system audit: every write operation (creator create, stage move, gift request/approval/dispatch, deliverable submission/approval, credential change, login/logout). Visible to Team Managers and Admin. |
| `Creator` | The person/entity being tracked. Primary Platform Profile chosen. Assigned owners + teams. |
| `PlatformProfile` | A social account link. Unique (platform, normalizedHandle). Belongs to one Creator. |
| `Engagement` | Agreed work between one Team and one Creator. Owns its deal type, amount/coupon, stage, and deliverables. |
| `Deliverable` | Agreed content piece under an Engagement. Owns its due date, status, posted URL + posted date. |
| `Gift` | Product item requested under an Engagement. Monthly cap, exception flag, warehouse status, tracking number. |
| `ActivityLog` | Manual entry or system audit entry on a Creator. Supports file attachment. |
| `Attachment` | File uploaded with an ActivityLog entry (filename, mime type, stored path/URL). |
| `Stage` | Named pipeline position, global catalog (name, default order). |
| `PipelineConfig` | Per-team mapping: which Stage IDs appear, their order, one marked as "completed". |
| `AvailabilityRequest` | Pending cross-team request for a Creator. Status: pending → approved / rejected. Two-level approval chain. |
| `WorkspaceSetting` | Key-value admin-controlled settings. |

### Core Relations

```
User        — belongs to one → Team
User        — belongs to one → Role
Role        — has many       → Permission
User        — has many       → TransactionLog
User        — has many       → AvailabilityRequest (as requester or approver)
Creator     — has one        → PlatformProfile (primary)
Creator     — has many       → PlatformProfile (additional)
PlatformProfile — unique (platform, normalizedHandle)
Creator     — has many       → Engagement
Engagement  — belongs to one → Team
Engagement  — belongs to one → Creator
Engagement  — has many       → Deliverable
Engagement  — has many       → Gift
Engagement  — has one        → Stage (current stage)
Creator     — has many       → Owner (via CreatorOwnership)
CreatorOwnership — (userId, teamId, createdAt)
CreatorOwnership — unique (userId, teamId, creatorId) when exclusive policy
Creator     — has many       → ActivityLog
ActivityLog — has many       → Attachment
Creator     — has many       → AvailabilityRequest
AvailabilityRequest — from (requestingTeamId, requestingUserId), to (owningTeamId), status
```

### Unique Constraints (Enforced by Prisma/DB)

| Constraint | Purpose |
|---|---|
| `PlatformProfile(platform, normalizedHandle)` | Prevent duplicate profiles across all Creators |
| `CreatorOwnership(creatorId, userId, teamId)` | Enforce uniqueness of assignment per policy |

## 4. URL Normalization & Deduplication

When adding a Platform Profile:

1. Strip protocol (`http://`, `https://`), `www.`, trailing slashes, query params.
2. Parse: extract the handle segment from the URL path (e.g., `instagram.com/user_handle/` → `user_handle`).
3. Store `normalizedHandle` lowercase + `platform`.
4. DB unique index on `(platform, normalizedHandle)` rejects duplicates at write time.
5. At UI level: show friendly error "This profile already exists — assigned to [Name] from [Team]".

## 5. Users, Roles & Permissions (RBAC)

### 5.1 Dynamic Roles & Permissions

Roles are **job-defined** and dynamic:

- A **Role** is a named set of **Permissions**. Each **User** has exactly **one Role**.
- **Four core roles are seeded** with sensible default permission sets:
  | Role | Default abilities |
  |---|---|
  | **Admin** | Every permission. **Immutable** — cannot be edited, archived, or deleted, and only another Admin can create/promote Admins. |
  | **Team Manager** | Approve exception gifts, approve availability requests, verify/approve deliverables, reassign creators, view team analytics, read user transaction logs within their team. Can also act as Team Leader. |
  | **Team Leader** | Create/own Creators, log activities, move pipeline stages, request gifts, submit deliverable links. Same-team broad-view; unassigned-team limited view (status, stage, dates, logs). |
  | **Warehouse** | View Approved gifts, log tracking number, mark Dispatched/Delivered. No access to Creators or pipeline. |
- The **Admin can create new Roles** (e.g., "Content Reviewer", "Supervisor") by selecting a permission set, and can **edit the permissions** of any role except Admin.
- Permission checks are atomic (`creator.create`, `creator.moveStage`, `gift.request`, `gift.approve`, `deliverable.approve`, `deliverable.verify`, `activity.log`, `user.manage`, `role.manage`, `team.manage`, `export.csv`, `import.csv`, `report.view`, `transactionLog.view`). "Highest privilege wins" is replaced by explicit permission checks per operation.

### 5.2 Users Module (Admin panel)

A dedicated **Users** module in Settings, used by Admin (and Team Managers for their own team, subject to their permissions):

- **Create user**: email or phone (unique per workspace) + initial password + role + team. The Admin sets the password; the user logs in with it (no self-signup).
- **Edit credentials**: change email/phone, reset password. Only Admin can reset a password — there is **no self-service / forgot-password flow in v1**.
- **Archive user**: soft state, hidden from search/selection, blocked from login. A user with **active owned Creators cannot be archived** — the Admin must **transfer ownership** to another user first (prompt shown). Archive implies releasing ownership and transfers responsibility.
- **Delete user**: **no delete option exists by default**. Only the Admin may delete a user, and deletion is allowed **only when no historical data depends on the user** (or after transfer). Archived users can be deleted by Admin.
- **Transaction Log per user**: a chronological record of that user's write operations on the system — creator created, stage moved, gift requested/approved/dispatched, deliverable submitted/approved, credential change, login/logout. Visible to Team Managers (their team) and Admin; filterable by time range and action type. Distinct from the per-Creator Activity Log.

### 5.4 Teams Management (Admin panel)

Teams are fully dynamic — created, renamed, and deleted by the Admin from Workspace Settings:

- **Create team**: name (unique, case-insensitive) plus auto-generated unique slug.
- **Rename team**: name + slug regenerated; duplicate names rejected.
- **Delete team**: blocked while the team still has members, creators assigned, engagements, pipeline configuration, or availability requests. The Admin cannot delete their own team. Delete is only possible once the team has no remaining work.
- A user can be created/edited into any existing team; a team with members cannot be deleted until members are moved or removed.

### 5.3 Authentication

- **Login page** shows the **company logo + company name**, both configurable in Workspace Settings. The logo is an **attached/uploaded image file** (stored under `public/uploads/`, served as a static asset) — not a URL text field. The **brand accent color** (a preset palette controlling the `primary`/`ring` CSS variables) is also set in Workspace Settings and applied across the app and the login screen, in both light and dark themes.
- Sign-in identifier: **email OR phone + password** (both accepted when both are set).
- **Password policy** is configurable in Settings (minimum length; optional complexity requirements).
- No registration, no password reset by the user in v1 (Admin resets from Users module).
- Session: JWT/session cookie with the user's role + team; permission checks enforced server-side on every mutation.

## 6. Ownership & Availability Rules

### Ownership Policy (Workspace Settings)

Admin toggles:
- **Single vs Multi Team** (default: exclusive — one team per Creator).
- **Single vs Multi Owner within a team** (default: single).

### Assignment

- Creating a Creator auto-assigns the creating user as Owner (and their Team).
- Assignment changes (Owner → another user, or Team A → Team B) require **Team Manager approval** via an Availability Request.

### Visibility

| Viewer | Can see |
|---|---|
| Same team, owner | Full profile, all engagement/gift/deliverable details, can log activity and move stages |
| Same team, not owner | Full profile (view only), can log activity but cannot move stages |
| Team Manager (same team) | Full profile, can log activity and move stages, approve exceptions |
| Unassigned team (multi-team policy) | Status, current stage, stage dates, activity logs. Cannot see deals, deliverables, or gifting. Availability Request button visible. |

### Availability Request Flow

1. Unassigned Team Leader creates Availability Request.
2. **Requesting Team's Team Manager** approves (pre-approval).
3. **Owning Team's Team Manager** approves (release).
4. Creator becomes available for the requesting team.

### Availability Pool (Inactivity)

Two configurable thresholds (Workspace Settings, in days):
1. **Same-team pool**: After no activity for threshold A days, Creator enters a pool visible to same-team users (can pick up without request).
2. **Company-wide pool**: After threshold B days (B > A), Creator opens to all Teams (can pick up without request).

An "activity" = any ActivityLog entry on the Creator's profile.

## 7. Pipeline & Stages

### Stage Catalog

Admin creates global Stage definitions (name only). One Stage is flagged as **"Completed"** (terminal success stage).

### Per-Team Pipeline

Each Team selects which Stage IDs appear and their order. "Declined" and "Completed" are regular stages that can be included/excluded per team.

### Stage Transitions

- Only the **Owner** or **Team Manager** may move an Engagement between stages.
- Every transition is logged in the ActivityLog as a system audit entry.
- Drag-and-drop on Kanban board; confirmation modal on manual transitions.

### Completion Auto-Move

When all Deliverables of an Engagement reach **Approved** status, the Engagement automatically moves to the "Completed" stage. Ownership of the Creator is released (Creator becomes claimable per availability rules).

## 8. Engagement & Deal Types

### Deal Types

| Type | Compensation | Gift fulfillment requires |
|---|---|---|
| **Fixed Budget** | Fixed amount (EGP/USD/EUR) | The agreed campaign deliverables (all deliverables of the engagement approved) |
| **Commission** | Coupon code + percentage per sale | A video deliverable (specific deliverable of type "video" marked approved) |
| **Barter / Gift** | Product gift in exchange for content | A video deliverable |

Fields per Engagement:
- `dealType`: Fixed Budget | Commission | Barter
- `amount` / `couponCode` / `commissionPercent` (nullable per type)
- `currency`: EGP | USD | EUR
- Current Stage (FK → Stage)
- Assigned Team (FK → Team)
- Creator (FK → Creator)

## 9. Deliverables & Verification

### Status Flow

```
Pending → Under Review → Approved
                      ↘ Revision Requested (back to Pending on re-submit)
```

- **Pending**: Created, not yet submitted.
- **Under Review**: Owner submitted a `postedURL` + `postedDate`. Team Manager must review.
- **Approved**: Team Manager verified the link is live and posted date is after engagement creation date. This is the only status that counts as "received" for the gifting lock.
- **Revision Requested**: Team Manager rejects the submitted link (e.g., old video, broken link). Owner must re-submit.

Verification is done exclusively by the **Team Manager** — not the Owner (prevents the "convenience acceptance" problem with old videos).

### Overdue Logic

A Deliverable is **Overdue** when: `dueDate < today` AND `status ≠ Approved`.

"Under Review" does NOT exempt from overdue — acts as a strict policy.

## 10. Gifting Rules & Workflow

### Monthly Cap

Maximum **1 Gift per Creator per calendar month**, counted globally across all Engagements/Teams. Anchor: `requestedAt` month.

### Exception (Second Gift Same Month)

When a Team Leader requests a second Gift for the same Creator in the same month:
1. System shows confirmation modal: "A gift was dispatched on [date]. Submit exception request?"
2. If confirmed, request status → `Requested (Pending Manager Approval)`.
3. **Team Manager** of the requesting team approves or rejects.
4. If approved → `Approved/Queued`. If rejected → `Rejected` (logged in ActivityLog).

### Mandatory Previous Deliverable (Hard Stop)

A new Gift **cannot be requested** for a Creator until the required deliverable from the most recent Gift is marked `Approved`:
- Commission/Barter engagement: video deliverable approved.
- Fixed Budget engagement: all campaign deliverables approved.

This rule is a hard stop — no override, no exception. Governed by a Workspace Setting toggle (enabled by default).

### Minimum Stage Gate

Gifts can only be requested for Engagements at **Agreed/Signed stage or later**. This is a Workspace Setting (configurable stage threshold).

### Warehouse Workflow

| Status | Meaning | Who sets |
|---|---|---|
| `Requested` | Awaiting Team Manager approval (exceptions only) or immediate queue | System |
| `Approved/Queued` | Ready for warehouse fulfillment | Team Manager or System (auto for first gift) |
| `Dispatched` | Warehouse prepared package, logged tracking number + carrier | Warehouse user |
| `Delivered` | Confirmed delivered (optional) | Warehouse user |

Gift fields: product name/description, engagement FK, requestedBy, approvedBy, exception flag + reason, trackingNumber, carrier, dispatchedAt, deliveredAt.

## 11. Activity Log & Audit Trail

Each Creator has a unified ActivityLog timeline:

**Manual entries** (written by Owner or Team Manager):
- `Call`, `DM`, `Email`, `Meeting`, `Note`
- Free-text summary
- Optional: attached file (screenshot) via Attachment entity
- Timestamp of the logged event (can differ from created-at if logging retrospectively)

**System audit entries** (auto-generated):
- Stage changed (from → to)
- Ownership changed (from → to, via Availability Request)
- Gift requested / approved / dispatched / rejected
- Deliverable submitted / approved / revision requested
- Engagement created / completed

ActivityLog is chronological. All users in the same team see the full log. Unassigned team sees it (as part of the limited view).

## 12. Global Search

Top navigation search bar and the Creators list search box: smart search accepts a Creator name, a bare handle, an `@`-handle, a pasted platform link, an email, or a phone number. Every field matches partially (contains). Pasted links and `@`-handles are parsed into a canonical **Platform Handle** before matching platform profiles (`normalizedHandle`), so `mohamedismail`, `@mohamedismail`, and `https://www.instagram.com/mohamedismail` all find the same Creator.

| Result | Behavior |
|---|---|
| Not found | Button: "+ Add Creator & Assign to Me". Clicking opens creation form and auto-assigns. |
| Found, owned by me | Full profile card with edit/stage-move permissions. |
| Found, same team, different owner | Full profile card, view-only (stage-move requires ownership or Team Manager). |
| Found, owned by another team (multi-team policy) | Status + Stage + Dates + Activity Logs. "Request Availability" button visible. |
| Found, in Availability Pool | Direct "Pick Up" button (same-team pool or company-wide pool). |

## 13. UI Views

### 13.1 Gallery View

Cards showing: Creator avatar, name, primary Platform handle + platform badges, current stage, assigned owner, follower count. Filterable by team, stage, platform, niche.

### 13.2 Grid / Table View

Spreadsheet-like dense table (TanStack Table). Columns: Name, Primary Platform, Niche, Followers, Engagement Rate, Current Stage, Assigned Owner, Team, Last Activity Date. Inline editing for key fields. Multi-column sorting and filtering. CSV Export button (admin-gated). CSV Import button.

### 13.3 Kanban View

Drag-and-drop board per Team (per-team Pipeline). Columns = Stages configured for that team. Card shows: Creator name, Platform badge, assigned owner, due date of next deliverable (if any). Stage counters and total active values shown at column headers.

### 13.4 Creator Profile Page (Drawer/Modal)

Full detail view opened by clicking any Creator card/link:
- Header: avatar, name, primary handle, platform badges, niche, follower/engagement stats.
- Ownership section: current owner(s), team, Availability Pool status if applicable.
- Engagement tabs: one tab per Engagement (team-named). Each shows: deal type, amount, current stage, deliverables list with status + due date + posted link, gift history.
- Activity Log timeline (unified, with filter by type).
- Gift Requests history.
- CSV / Notes section (optional future; v1: Activity Log with notes covers this).
- Actions: Log Activity, Move Stage, Request Gift (with pre-validation).

### 13.5 Operations / Gifting Queue (Warehouse view)

Filterable table of Gifts: columns: Creator name, Product, Engagement, Exception flag, Status, Requested Date, Tracking Number. Actions: Mark Dispatched (enter tracking number + carrier), Mark Delivered. Bulk actions future.

### 13.6 Dashboards

**General Pipeline Dashboard** (Team Leader / Team Manager / Admin):
- Creators by Stage (bar/column chart).
- Overdue Deliverables (count, list, filterable by owner/team).
- Upcoming Deadlines (next 7 days, list).
- Gifts Sent vs Videos Received (monthly bar chart).
- Team leaderboard: Creators added per user, Engagements opened, Deliverables approved.
- Pipeline value by Deal Type (total budget value, estimated commission value).

**Operations / Compliance Dashboard** (Team Manager / Warehouse / Admin):
- Gifts: Requested (pending) / Approved / Dispatched / Delivered counts.
- Exception gift requests pending approval (list).
- Overdue Deliverables flagged for manager attention.
- Marketer activity: activity count per user, overdue count per owner.
- Availability Pool: creators entering same-team and company-wide pools.

**Quick View / Command Palette:**
Keyboard shortcut (e.g., `Cmd+K`) opens a floating search/overview panel: shows current user's Overdue Deliverables, pending gift approvals, latest 5 Activity entries across owned Creators. No full dashboard needed for quick glance.

## 14. Notifications (In-App)

Notification Center (bell icon in top bar):
- Deliverable overdue (for Owner).
- Deliverable submitted (for Team Manager).
- Deliverable approved / revision requested (for Owner).
- Gift exception approval request (for Team Manager).
- Gift dispatched/delivered (for Owner).
- Availability Request received (for owning Team Manager).
- Availability Request approved/rejected (for requesting user).

Notifications are per-user, marked read/unread. No email or push in v1.

## 15. CSV Import & Export

### Export

- Available in Grid View.
- **Admin-only toggle in Workspace Settings**: Enable/Disable export per role. When disabled, the Export button is hidden.
- Exports currently filtered data (respects all active filters).
- Includes: Creator name, platform profiles, niche, followers, engagement rate, assigned owner, team, current stage, last activity date.

### Import

- Bulk import via CSV.
- Required columns: Name, Platform, Profile URL (handle extracted automatically).
- Optional: Niche, Followers, Engagement Rate, Email, Phone, City/Country, Creator Type.
- Import flow: Upload CSV → Preview table (showing extracted handles, warnings for duplicates/conflicts) → Confirm import.
- Duplicate detection: `(platform, normalizedHandle)` unique constraint. Duplicates are skipped with a report.
- All imported Creators auto-assigned to the importing user.

## 16. Reports

Reports are a dedicated section (separate from Dashboard). All reports filterable by: date range, team, owner, stage, deal type.

### Creator Reports
- Total Creators by Team / by Owner / by Niche / by Platform.
- New Creators added over time (line chart).
- Creators by Stage (stacked bar by team).

### Engagement Reports
- Open Engagements by Deal Type.
- Average time in each Stage (time-in-stage analysis).
- Closed vs Declined ratio.

### Deliverable Reports
- Overdue vs On-Time rate (overall, per owner, per team).
- Average time to approval after submission.
- Deliverables by type (Reel, Story, TikTok, etc.).

### Gift Reports
- Total Gifts sent by month, by team, by deal type.
- Exception requests: approved vs rejected.
- Gifts with approved deliverables vs pending (fulfillment rate).
- Gifting cost estimate per Creator.

### User Performance Reports
- Creators added per user (monthly).
- Engagements opened / completed per user.
- Deliverables submitted / approved per user.
- Activity count per user (calls, DMs, emails).

## 17. Workspace Settings (Admin Panel)

| Setting | Type | Default |
|---|---|---|
| Workspace Name | Text | — |
| Company Logo (login page + sidebar) | Attached image (upload, not URL) | None |
| Brand Accent Color | Preset picker (CSS variables: primary, ring) | Indigo |
| Teams — Manage | CRUD (create/rename/delete) | — |
| Ownership Policy — Multi Team | Boolean | Off (exclusive) |
| Ownership Policy — Multi Owner | Boolean | Off (single) |
| Inactivity Threshold — Same Team (days) | Number | 30 |
| Inactivity Threshold — Company-wide (days) | Number | 60 |
| Gift — Monthly Cap Enabled | Boolean | On |
| Gift — Required Previous Deliverable (Lock) | Boolean | On |
| Gift — Minimum Stage for Requesting | Stage FK | Agreed |
| Export — Enabled Roles | Multi-select (role) | None (admin must enable) |
| Password Policy — Min Length | Number | 8 |
| Password Policy — Complexity Required | Boolean | Off |
| Stage Catalog — Manage | CRUD | — |
| Roles — Manage (non-Admin) | CRUD | — |

## 18. Phase Plan

### v1 (MVP)

- Auth: email OR phone + password login with company logo; no self-service password reset; password policy from Settings.
- Users module: create user, assign one role + team, edit credentials, archive with ownership transfer, Admin-only delete.
- Dynamic Roles & Permissions: seeded four roles, Admin can create/edit roles and assign permissions; one role per user.
- Transaction Log: per-user system audit visible to Team Managers and Admin.
- Creator CRUD + URL dedup + global search.
- Team & User management (Admin).
- Ownership assignment + Availability Request (two-level approval).
- Per-team Pipeline (Admin configures Stages; Kanban drag-and-drop).
- Engagement CRUD (Deal Type, deliverables, amounts).
- Deliverable tracking + Team Manager verification.
- Gift workflow: monthly cap, exception approval, hard stop lock, warehouse queue.
- Activity Log (manual + system audit + file attachment).
- Views: Gallery, Grid (TanStack Table), Kanban.
- Dashboards: General Pipeline + Operations/Compliance.
- CSV Import + Export (admin-gated).
- In-app Notification Center.
- Command Palette (Quick View).
- Reports section (basic set).
- Workspace Settings panel (Admin).

### Future Phases (not v1)

- Email/push notifications.
- Platform API integration (Instagram/TikTok follower counts auto-fetch).
- Advanced analytics (AI-generated insights).
- Mobile app (React Native / Expo).
- Multi-workspace support.
- Audit log export.

## 19. Open Questions for Implementation

| # | Question | Recommendation |
|---|---|---|
| 1 | File upload storage in v1? | Local disk for dev; S3-compatible (Vercel Blob) for production. |
| 2 | Currency conversion for pipeline value totals? | Store per-deal currency; display totals per currency separately (no auto-conversion in v1). |
| 3 | Bulk stage-change (move multiple cards)? | Defer to v2; single-card drag-and-drop only in v1. |
| 4 | Creator merge (same person, different records)? | Manual in v1: delete duplicate, reassign ActivityLog. Auto-detect deferred. |
| 5 | Soft delete vs hard delete for Creators? | Soft delete (flag `deletedAt`). Search hides deleted by default; Admin can restore. |
