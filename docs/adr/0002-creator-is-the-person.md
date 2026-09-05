# 0002: Creator is the person — not a per-platform profile

The tracking unit is the Creator (the person or entity), not the social media profile. One Creator can have multiple Platform Profiles (Instagram, TikTok, YouTube, etc.). Ownership, pipeline stages, engagements, deliverables, gifting, and activity logs all attach to the Creator entity — never to a single Platform Profile.

**Considered Options:**
- Per-platform profile as the tracking unit (each IG account = one record, same person with IG + TikTok = two records)
- Person-level Creator with multiple Platform Profiles (one record per person)

**Why person-level:**
- The collision problem (two teams contacting the same influencer) is about the *person*, not the platform account. If tracking is per-profile, the same person with two accounts becomes two independent leads — the collision detection fails.
- Gifting rules (1 per month, video lock) are person-level constraints. Splitting a person across profiles makes these rules either unenforceable or require complex cross-record joins.
- Activity logs and deal history belong to the working relationship with the person, not to a single social account.
- The canonical handle is extracted via URL normalization (strip protocol, www, query params, trailing slashes; take path segment). A unique constraint on `(platform, normalizedHandle)` prevents the same account from being entered twice under any Creator.

**Consequences:**
- When adding a Platform Profile, the system must normalize the URL and enforce a unique constraint on `(platform, normalizedHandle)` at the database level (Prisma unique index).
- A "primary" Platform Profile must be designated per Creator (the one shown on cards and in search results).
- Merging duplicate Creator records (same person entered twice) requires a manual or future automated process; v1 handles this via Admin deletion + reassignment of Activity Logs.
