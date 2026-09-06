# 0004: Creator record data model

The Creator existed as a flat record with free-text `country`, `city`, and `creatorType` strings, while all workspace configuration lived in a single `WorkspaceSetting` `key→value` table. The "add creator" redesign demanded admin-managed location/type dropdowns, per-creator custom fields, a mandatory gender, gifting-gating fields, and unique phone/email — none of which fit the flat-string or JSON-in-settings shapes cleanly.

**Decision:**
- **Reference data (Country, City, Creator Type) is stored as real tables**, not JSON in workspace settings. `Country` carries `name` and `dialCode`; `City` belongs to exactly one `Country`; `CreatorType` is a flat admin list. Creators reference these rows by FK. Rows in use cannot be deleted (rename always allowed), matching the existing Teams/Stages rule.
- **Custom fields are stored as a JSON column on Creator** (`customFields`), with the field *definitions* (label, type, required, order) maintained by the Admin separately. Supported types: short text, long text, number, date, single-select, yes/no.
- **Built-in gating fields are first-class columns, not custom fields.** Country, City, Creator Type, and Phone form the **Required for Gifting** set: a Creator missing any of them is in an **Incomplete Data** state (badge on card/row/profile) and Gift requests hard-stop naming the missing fields. **Registered on Shopify?** is a built-in boolean column so the list filter is always reliable.
- **Gender is a built-in single-select column**, mandatory when a Creator is added, with its option list editable in Settings.
- **Phone is normalized to E.164** (`+201001234567`, derived from the dial code + digits-only input) and **unique** across creators; email is format-validated and unique.
- **Creator Approval** (optional, admin-toggled) gates newly created Creators into a PENDING state reviewable only by the requester, their Team Manager, and the Admin, with no work possible until approved.

**Considered Options:**
- Reference data as JSON in `WorkspaceSetting`, reusing the existing store. Rejected: country→city cascades, dial-code coupling, delete-in-use integrity, and list filters all need relational shape; JSON would push data wrangling into application code.
- One DB column per custom field, or an EAV (`CreatorFieldValue`) table. Rejected: admin-driven dynamism plus filtering and display favor a validated JSON column; EAV adds join complexity without a filtering win.
- Gifting gating and Shopify as admin-configured custom fields. Rejected: the gift hard-stop and the "not registered on Shopify" filter must not depend on admin configuration that can rename or delete a field.

**Consequences:**
- New admin APIs + Settings sections for reference data and field definitions; the Creator create/edit form is driven by these definitions (country→city cascade, type/gender dropdowns, custom fields appended).
- A one-time migration is required: back-fill reference rows from existing free-text values, normalize/dedupe phone and email, default the new columns, then drop the free-text columns.
- Creator-list filtering must span reference FKs, the Shopify boolean, and JSON custom-field values.