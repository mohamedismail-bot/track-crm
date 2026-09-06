# Parishia Smart

A system for tracking and managing outreach to influencers/content creators on behalf of a company: who owns each creator, which stage they are in, what content was agreed, and how product gifting is controlled.

## Language

**Creator**:
A content creator, influencer, or blogger that the company reaches out to. The unit of tracking is the *person/entity*, not a single social account.
_Avoid_: Influencer profile, account, contact

**Platform Profile**:
A social account belonging to a **Creator** on a specific platform (e.g., Instagram, TikTok). A **Creator** has one **Primary Platform Profile** and may have additional linked profiles.
_Avoid_: Channel, page, account

**Platform Handle**:
The canonical username extracted from a **Platform Profile** link after normalizing the URL (stripping protocol, `www.`, trailing slashes, and query parameters).
_Avoid_: URL, link, username

**Primary Platform Profile**:
The **Platform Profile** chosen as the main identity for a **Creator**, shown on their card.

**Owner**:
The system user(s) currently responsible for a **Creator**. The number of **Owners** per **Creator** is governed by the **Ownership Policy**.
_Avoid_: Assignee, handler

**Team**:
A group of system users within the company working with creators in a shared way (e.g., Budget team, Commission/Affiliate team). Teams are dynamic: the **Admin** creates, renames, and deletes them from **Workspace Settings**. A **Team** with members, engagements, pipeline configuration, or assigned **Creators** cannot be deleted.
_Avoid_: Department

**Team Leader**:
The system user who works a **Creator** directly on a daily basis — the front-line outreach specialist / account manager. A **Team Leader** belongs to one **Team** and is typically the **Owner** of the **Creators** they work.
_Avoid_: Marketer, account manager (prefer the role name)

**Team Manager**:
The system user who oversees a group of **Team Leaders**, and approves exception requests (e.g., a second **Gift** in a month, reassignment of a **Creator**) and verifies **Deliverables**. Can approve any pending request within their scope.
_Avoid_: Leader, supervisor, manager of creators

**Availability Request**:
A request by an unassigned **Team** to engage a **Creator** currently owned by another **Team**. It must be approved first by the requesting team's **Team Manager**, then by the owning team's **Team Manager**, before the **Creator** becomes available.
_Avoid_: Claim, handover, takeover

**Inactivity Threshold**:
A workspace setting (in days). If no **Activity Log** has been recorded against a **Creator** within this period, the **Creator** is considered inactive and released into an **Availability Pool** — first to the same **Team's** users, and after a longer configured period, to all **Teams**.

**Availability Pool**:
The set of inactive **Creators** that users may pick up without an **Availability Request**. A **Creator** with no recent **Activity** enters the pool after the **Inactivity Threshold**; users of the same **Team** may work it first, and once a second (longer) threshold passes, it opens to every **Team**.

**Warehouse**:
The system user who fulfills approved **Gift** requests: prepares the package, logs the tracking number, and marks the **Gift** as dispatched. Dedicated **Warehouse** users do not work **Creators**.
_Avoid_: Operations, inventory user

**Ownership Policy**:
A workspace-level setting controlling whether a **Creator** may be worked by one **Team** or multiple **Teams**, and whether one or multiple **Owners** may be assigned to a **Creator** (including **multiple Owners within the same Team**, when enabled). Default is exclusive: one **Team** and one **Owner**. Any of the assigned **Owners** may log activity and move the **Creator** through the pipeline. Even when multiple teams/owners are enabled, all work on a **Creator** is visible in one shared profile and activity log. Within a **Team**, everyone may view a **Creator's** full profile, but only an **Owner** may log activity and move stages (the **Team Manager** may do so as well). A user whose perspective is an unassigned **Team** may only view a **Creator's** status, stage with dates, and activity logs — never another team's full deal, deliverable, or gifting details.

**Engagement**:
A piece of agreed work between one **Team** and one **Creator** under a specific **Deal Type**. The outreach stage, agreed deliverables, and gift requests all belong to an **Engagement**. A **Creator** may have multiple **Engagements**, typically one per **Team**.
_Avoid_: Deal, campaign

**Activity Log**:
A chronological, per-**Creator** record of interactions and system events. It includes manual entries (a Team Leader logging a call, DM, email, meeting, or note, optionally with an attached file) and automatic audit entries (stage changes, ownership changes, gift requests and fulfillments, deliverable submissions and approvals).

**Transaction Log**:
A per-**User** system audit of that user's write operations across the system (creator created, stage moved, gift requested/approved/dispatched, deliverable submitted/approved, credential changes, login/logout). Distinct from the per-**Creator** **Activity Log**. Visible to **Team Managers** and the **Admin**.

**Deal Type**:
The compensation model of an **Engagement**: **Fixed Budget** (a fixed amount for the agreed content), **Commission** (a coupon code plus a per-sale commission), or **Barter / Gift** (a product gift given in exchange for content).

**Deliverable**:
An agreed piece of content (e.g., 1 Reel, 1 TikTok video, 1 Story) that a **Creator** must produce and submit under an **Engagement**. Each **Deliverable** has its own due date and delivery status.
_Avoid_: Content, video (when the type is not a video)

**Stage**:
A named position in the outreach pipeline (e.g., Prospecting, Negotiation, Agreed). **Stages** are created and maintained by the **Admin** with globally shared names; each **Team** customizes which **Stages** appear in its **Pipeline** and in what order. **Declined** is an ordinary **Stage** that may be reopened. One **Stage** per **Team** may be flagged as the success/Completed **Stage** where finished **Engagements** are moved automatically.

**Pipeline**:
The ordered set of **Stages** that an **Engagement** passes through, as configured for a **Team**. Each **Team** has its own **Pipeline** view of the **Creators** it works.

**Gift**:
A product item sent to a **Creator** as part of an **Engagement**. A **Creator** may receive at most one **Gift** per calendar month across all **Engagements**; a second one in the same month may be **Requested** as an exception pending **Team Manager** approval. A **Gift** under a **Commission** or **Barter** engagement requires a **video** deliverable to be fulfilled; a **Gift** under a **Fixed Budget** engagement requires the agreed campaign deliverables. No new **Gift** may be requested for a **Creator** until the deliverables required by the previous **Gift** are marked as received — a hard stop with no override.

**Workspace Settings**:
Configurable workspace-level rules controlled by the **Admin**, including the brand identity (workspace **name**, an attached/uploaded **logo file** — not a URL — and an **accent color** from a preset palette applied across the app and login screen), dynamic **Team** management (create/rename/delete), the **Ownership Policy**, the **Inactivity Threshold**, the one-**Gift**-per-month limit, the minimum **Stage** for sending a **Gift**, and the requirement that an approved **Deliverable** with a recorded posted video/link is needed before the next **Gift** may be requested.

**Dashboard**:
The role-aware landing page for a **User** after login. Every numbered insight is an interactive element: clicking a stat navigates to the relevant page pre-filtered via URL parameters (e.g., **Creators** filtered by **Stage**, **Owner**, or **Availability Pool**), and an inline "Show details" toggle expands the top records without leaving the page. **Warehouse** users see a fulfillment-oriented view focused on gifting throughput; all other roles see creator workload, pipeline, and gifting summaries (including gifts requested, pending approvals, exception requests, and top gifted creators for the last 90 days).
_Avoid_: static, non-clickable metrics

**Deep Link**:
A URL that opens a list page with filters applied, used by the **Dashboard** to let a user drill into an insight in one click. **Creators** respects `stage`, `owner`, `pool`, `q`, `team`, `overdue=1`, and `upcoming=1`; **Gifting** respects `tab=pending|warehouse|history`. Filters initialize from the URL so the link produces the matching list.
_Avoid_: query string that the page ignores

## Relationships

- A **Creator** has one **Primary Platform Profile** and zero or more additional **Platform Profiles**
- A **Platform Profile** belongs to exactly one **Creator**
- A **Platform Handle** is unique per platform across all **Creators**
- A **Creator** is assigned to one or more **Owners** and belongs to one or more **Teams**, governed by the **Ownership Policy**
- A **Team** has one or more system users
- A **Dashboard** is role-aware: **Warehouse** sees gifting throughput; other roles see creator workload plus gifting
- A **Dashboard** insight is a **Deep Link**-driven interaction: click to navigate to a pre-filtered list, or expand inline details

## Example dialogue

> **Dev:** "If a creator has Instagram and TikTok, is that one Creator record or two?"
> **Domain expert:** "One Creator. The person is who we track — the Instagram and TikTok links are just Platform Profiles on that one record."

## Flagged ambiguities

- "profile" was used to mean both the **Creator** (the person) and a single social account — resolved: these are distinct concepts.
- "log" was used to mean both the per-**Creator** **Activity Log** and the per-**User** **Transaction Log** — resolved: these are distinct records.