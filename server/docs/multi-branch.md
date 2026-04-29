# Multi-branch (per-tenant campuses)

## Model

- **`Branch` collection**: `tenantId`, `name`, optional `code` (unique per tenant when set), optional `address`, timestamps.
- **Uniqueness**: `(tenantId, name)` and `(tenantId, code)` when `code` is set (sparse).
- **Scoped documents** (optional `branchId` string, backward compatible when unset):
  - `Student`, `Fee`, `Payment`, `FeeTemplate`, `Course`, `ManualPaymentCredit`
- **Users**: optional `branchIds[]` on `User` — if non-empty, JWT carries `branchIds` and list/detail APIs only return rows for those branches (unless a narrower `?branchId=` is used and allowed).

## Tenant creation with branches

`POST /auth/signup` accepts an optional `branches` array. After the tenant is created, branches are inserted in one batch. Omitted or empty = single-site behavior (no branch documents).

## Branch APIs (JWT, tenant from token)

| Method | Path | Role |
|--------|------|------|
| GET | `/branches` | STAFF+ |
| GET | `/branches/:branchId` | STAFF+ |
| POST | `/branches` | TENANT_ADMIN (`MULTI_BRANCH_ENABLED` must not be `false`) |
| PATCH | `/branches/:branchId` | TENANT_ADMIN |
| DELETE | `/branches/:branchId` | TENANT_ADMIN (blocked if students or team members still reference the branch) |

## List filters

These accept optional `?branchId=<24-char hex>` to narrow to one campus. Users with `branchIds` on the token cannot request a branch outside that set (403).

- `GET /students`, `GET /students/fee-overview`, `GET /fees`, `GET /fees/overdue`

## Invites and team

- `POST /auth/invite` — optional `branchIds: string[]` (must exist for the tenant).
- `PATCH /auth/team/:userId` — optional `branchIds` (use `null` or `[]` in validated body to clear and restore full-tenant access where applicable).

## Query impact

- **Legacy data**: `branchId` is omitted on old rows; they do not appear in branch-scoped aggregations that filter with `{ branchId: { $in: [...] } }`. Run a one-time backfill (assign students/fees) if you need historical rows under a new branch.
- **Fees** mirror the student’s `branchId` at creation; updating a student’s `branchId` updates all their fees in place.
- **Dashboard** — branch filters for analytics can be added by threading `BranchScope` into `dashboard.service` aggregations the same way as for `GET /fees` (not yet wired in the initial rollout).

## Environment

- `MULTI_BRANCH_ENABLED` — default enabled; set to `false` to forbid mutating branch CRUD (safe for staged rollout).

## Optional migration (mongosh)

Indexes are created by Mongoose at runtime. For optional backfill (example: one default branch per existing tenant and assign all students):

1. Create `Branch` documents per tenant.
2. `db.students.updateMany({ tenantId: "TENANT_ID" }, { $set: { branchId: "BRANCH_OBJECT_ID" } })`
3. `db.fees.updateMany({ tenantId: "TENANT_ID" }, { $set: { branchId: "BRANCH_OBJECT_ID" } })` (or recompute from students in a small script)

Use application validation (`assertBranchBelongsToTenant`) in normal operations; one-off scripts should keep `tenantId` and branch ids consistent.
