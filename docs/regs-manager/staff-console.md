# Regs Manager — staff console

The staff console is the `staff/` workspace: a React + Vite SPA where FWP staff
author, review, and publish regulations. It is built into static assets and
**served by the `server/` container at `/`** — it is not a separately deployed
service. In development it runs on its own Vite dev server and proxies `/api` to
the API on `:8080`:

```bash
npm run dev --workspace @engage-mt/regs-staff   # → http://localhost:5174
```

It talks only to the staff API (`/api/v1/staff/*`) over a cookie session.

## Roles

Four ranked roles (`shared/src/domain.ts`, enforced by `requireRole` in
`server/src/auth/rbac.ts`):

| Role | Rank | Can |
|---|---|---|
| `viewer` | 0 | Read every screen; run validation and diffs; export print. |
| `editor` | 1 | Everything a viewer can, plus create/edit/delete regulation content. |
| `approver` | 2 | Everything an editor can, plus **publish** a season year. |
| `admin` | 3 | Everything, plus user administration (create users, assign roles, reset passwords). |

Higher ranks inherit every lower rank's permissions. The first admin is created
at first boot from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; rotate that
password and create real per-person accounts from the Users screen immediately
after handover.

## Screens

| Screen | Purpose |
|---|---|
| **Login** / **Change Password** | Session auth; self-service password change. |
| **Dashboard** | Season status, outstanding validation, quick links. |
| **District Browser** / **District Detail** | Browse districts and edit per-district regulations, notes, and season windows. |
| **Portions** | Species-specific district portions (the sub-district geographies). |
| **Hunt Areas** | Hunt-area definitions and their district membership. |
| **Restricted Areas** | Restricted-area definitions and the districts they apply to. |
| **Fees** | License products and the fee schedule. |
| **Contacts** | The published contact directory. |
| **Important Dates** | Season and application dates. |
| **Content** / **Assets** | Editorial content sections (CMS) and uploaded assets. |
| **Review** | Pre-publish validation report — blocking vs advisory findings for a season year. |
| **Corrections** | Author + track mid-year correction publishes. |
| **Live Snapshot** | Inspect what is currently published (the public snapshot). |
| **Print** | Generate the regulation book — PDF, HTML proof, or InDesign ICML. |
| **Audit Log** | Immutable record of who changed what, when — filter by table, user, and date; load older pages; approvers can export CSV. |
| **Users** | Account + role administration (admin only). |

## The edit → review → publish workflow

1. **Start / clone a season year.** Create a new year, or clone the prior year
   (`POST /season-years/:year/clone-from/:prev`) to carry forward last season's
   data as the starting draft.
2. **Edit as draft.** Editors change districts, portions, opportunities,
   seasons, fees, dates, contacts, and content. All edits stay `DRAFT` and are
   invisible to the public app. Concurrent edits are coordinated by **edit
   locks** — acquiring an entity locks it for you; stale locks expire — so two
   editors can't silently overwrite each other.
3. **Review.** The Review screen runs `GET /season-years/:year/validation` and
   surfaces **blocking** findings (must fix before publish) and **advisory**
   findings. The `audit:book` coverage audit flags districts/species missing
   regulation rows. Use the **diff** (`/season-years/:year/diff`) to see exactly
   what changed vs the last publish.
4. **Publish.** An approver (or admin) publishes
   (`POST /season-years/:year/publish`). The server re-validates, flips draft
   rows to published, materializes the immutable snapshot, and records the
   publication with a version number stamped to their identity. The public API
   now serves the new data.
5. **Mid-year corrections.** Editing an already-published year and re-publishing
   creates version 2+, flagged `is_correction` with an optional summary and the
   affected species/districts. These surface on the Corrections screen and the
   public `/hunting/corrections` feed so the app can highlight what changed.

Every write is written to `audit_log`; the Audit Log screen is the accountability
record for the whole editorial process.
