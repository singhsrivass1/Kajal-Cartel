# Kajal Cartel — Database Operations Runbook

Scope: MongoDB indexes required by the application (auth, signup verification, bookings, vendor administration).
Order: **staging first, production only after the staging run is complete and approved.**

This runbook has two phases that must not be mixed:

| Phase | Purpose | Database permissions | Writes allowed |
| --- | --- | --- | --- |
| **Part 1 — Read-only audit** | Identify the database, inspect indexes, find duplicates | Read-only user | **None** |
| **Part 2 — Approved migration** | Back up, fix duplicates, create missing indexes | Short-lived write user | Only the steps listed, after written approval |

Nothing in this document claims that any index currently exists. Every index must be confirmed with `getIndexes()` in the target environment.

---

## Ground rules (both phases)

- Never run `syncIndexes()`, `dropIndexes()`, `db.collection.reIndex()`, or any script that "recreates all indexes". `syncIndexes()` drops indexes that are not declared in a Mongoose schema.
- Never drop or recreate an index that existed before the current run.
- Never rely on Mongoose `autoIndex` to create production indexes. In this codebase index-build failures are swallowed silently (Mongoose 8.24 `model.init().catch(noop)`), so a missing unique index produces no error or log.
- Keep connection strings in an environment variable (for example `$STAGING_MONGODB_URI`); never paste them into commands, tickets, chat, or shell history.
- Queries in this runbook return **counts or index metadata only**. Do not print customer documents.
- Record every output in the audit record (template at the end).

---

## Required index inventory

Collection names come from the Mongoose schemas (`src/lib/db/models`) and the NextAuth MongoDB adapter defaults. Index names are the names Mongoose would generate, so explicitly created indexes do not conflict with them later.

| # | Collection | Keys | Options | Needed for | Risk if missing |
| --- | --- | --- | --- | --- | --- |
| I1 | `users` | `{ email: 1 }` | unique, name `email_1` | Password-signup duplicate-key fallback; NextAuth `getUserByEmail`; credentials `authorize` | Duplicate users per email |
| I2 | `pendingsignups` | `{ email: 1 }` | unique, name `email_1` | One pending signup per email | Multiple live tokens per email |
| I3 | `pendingsignups` | `{ tokenHash: 1 }` | unique, name `tokenHash_1` | Token lookup | Negligible (256-bit tokens) |
| I4 | `pendingsignups` | `{ expiresAt: 1 }` | TTL `expireAfterSeconds: 0`, name `expiresAt_1` | Removal of abandoned signups | Password hashes of abandoned signups retained indefinitely |
| I5 | `bookings` | `{ customer: 1, idempotencyKey: 1 }` | unique, name `customer_1_idempotencyKey_1` | Idempotent booking creation | Duplicate bookings from repeated submissions |
| I6 | `bookings` | `{ vendor: 1, service: 1, date: 1, startTime: 1 }` | unique, partial `{ status: { $in: ["PENDING", "CONFIRMED"] } }`, name `vendor_1_service_1_date_1_startTime_1` | Double-booking backstop | Concurrent double-booking of a slot |
| I7 | `vendors` | `{ slug: 1 }` | unique, name `slug_1` | Vendor lookup by slug | Ambiguous artist pages and bookings |
| I8 | `services` | `{ vendor: 1, slug: 1 }` | unique, name `vendor_1_slug_1` | Service uniqueness per vendor | Duplicate services |
| I9 | `vendoravailabilities` | `{ vendor: 1 }` | unique, name `vendor_1` | One availability record per vendor | Availability read from an arbitrary record |
| I10 | `accounts` | `{ provider: 1, providerAccountId: 1 }` | unique, name `provider_1_providerAccountId_1` | NextAuth `getUserByAccount` / `linkAccount` | Duplicate Google links on concurrent first sign-in |
| I11 | `accounts` | `{ userId: 1, provider: 1 }` | non-unique, name `userId_1_provider_1` | Admin authorization lookup | Collection scan per admin request |

Performance-only indexes declared in the schemas (`bookings {vendor,date,status}`, `bookings {customer,createdAt}`, `savedmoodboards {user,createdAt}`, `blockeddates {vendor,startDate,endDate}`, `portfolioimages {vendor,createdAt}`, and the `services`, `vendors`, and `users.savedArtists` filter indexes) are lower priority and follow the same procedure. The `vendors` 2dsphere and text indexes are not used by any current query.

---

## Part 1 — Read-only audit

Use a **read-only** database user. Connect with:

```sh
mongosh "$STAGING_MONGODB_URI" --quiet
```

### 1.1 Identify the database (no credentials printed)

```js
db.getName()
db.getCollectionNames().sort()
```

- Confirm the database name matches the one the application uses. The application uses the database in the URI path; if the path is empty, the driver default applies. Do not assume a name — record what `db.getName()` returns.
- Confirm `users` and `accounts` are present. Collections such as `pendingsignups`, `bookings`, or `vendoravailabilities` may not exist yet; record "absent" rather than creating them.

### 1.2 Server version and partial-index compatibility

```js
db.version()
```

- Record the version. It is required for two decisions:
  - **I6 (partial booking index):** the filter uses `$in`. Before Part 2, confirm in the official MongoDB documentation for the recorded server version that `$in` is supported inside `partialFilterExpression` (documented as supported from MongoDB 6.0). If it is not supported, **do not create I6**; stop and redesign the booking backstop.
  - **Driver choice:** any proposal to change the `mongodb` driver version must be checked against this server version.

### 1.3 Inspect existing indexes

Run for every collection that exists:

```js
for (const name of ["users","accounts","pendingsignups","bookings","vendors","services","vendoravailabilities","blockeddates","savedmoodboards","portfolioimages"]) {
  if (db.getCollectionNames().includes(name)) {
    print(`== ${name}`);
    printjson(db.getCollection(name).getIndexes().map(i => ({ name: i.name, key: i.key, unique: !!i.unique, partialFilterExpression: i.partialFilterExpression, expireAfterSeconds: i.expireAfterSeconds })));
  } else {
    print(`== ${name}: collection absent`);
  }
}
```

For each row of the inventory, record one of: **present and matching**, **present with different keys/options**, or **missing**. An index with the same name but different keys or options is a conflict that must be resolved in Part 2 — never "fixed" by dropping it during the audit.

### 1.4 Duplicate checks before any unique index

Every result must be no output or `0` before the matching unique index may be created.

```js
db.users.aggregate([{ $group: { _id: "$email", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I1_duplicateEmails" }])
db.users.aggregate([{ $group: { _id: { $toLower: "$email" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I1_caseInsensitiveDuplicates" }])
db.users.countDocuments({ $expr: { $ne: ["$email", { $toLower: "$email" }] } })
db.users.countDocuments({ email: { $in: [null, ""] } })
db.accounts.aggregate([{ $group: { _id: { p: "$provider", a: "$providerAccountId" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I10_duplicateAccounts" }])
db.accounts.countDocuments({ userId: { $not: { $type: "objectId" } } })
db.vendors.aggregate([{ $group: { _id: "$slug", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I7_duplicateSlugs" }])
db.services.aggregate([{ $group: { _id: { v: "$vendor", s: "$slug" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I8_duplicateServices" }])
db.vendoravailabilities.aggregate([{ $group: { _id: "$vendor", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I9_duplicateAvailability" }])
db.bookings.aggregate([{ $group: { _id: { c: "$customer", k: "$idempotencyKey" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I5_duplicateIdempotency" }])
db.bookings.aggregate([{ $match: { status: { $in: ["PENDING", "CONFIRMED"] } } }, { $group: { _id: { v: "$vendor", s: "$service", d: "$date", t: "$startTime" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I6_duplicateActiveSlots" }])
db.pendingsignups.aggregate([{ $group: { _id: "$email", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I2_duplicatePending" }])
db.pendingsignups.aggregate([{ $group: { _id: "$tokenHash", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "I3_duplicateTokenHash" }])
```

Notes:
- The two `users.email` checks and the mixed-case count matter because the index is case-sensitive while the NextAuth adapter stores the Google profile email exactly as received.
- `null` or empty emails collide under a unique index.
- Skip checks for absent collections and record "absent".

### 1.5 Audit outcome

The audit ends here. Produce the audit record and a written list of proposed actions (which indexes to create, which duplicates need remediation). **No write may be performed until Part 2 is explicitly approved.**

---

## Part 2 — Approved migration

### 2.0 Approval gate (all required, in writing)

- [ ] The Part 1 audit record for **this** environment is complete and reviewed.
- [ ] Every duplicate count for each index to be created is `0`, or a remediation plan for each non-zero count has been approved by the data owner.
- [ ] Server version recorded and the I6 compatibility check completed.
- [ ] Backup taken and restore verified (2.1).
- [ ] Maintenance window agreed; application owner available.
- [ ] Named approver has signed off on the exact list of indexes to create.

### 2.1 Backup and restore verification

1. Take an Atlas on-demand snapshot of the cluster, or a `mongodump` of the affected collections to encrypted storage:
   ```sh
   mongodump --uri="$STAGING_MONGODB_URI" --db=<DATABASE_NAME_FROM_1.1> --collection=<COLLECTION> --out=<ENCRYPTED_BACKUP_PATH>
   ```
2. Record document counts per collection at backup time (`db.<collection>.estimatedDocumentCount()`).
3. Verify the backup is restorable **without touching the source database**:
   ```sh
   mongorestore --dryRun --uri="$SCRATCH_RESTORE_URI" <ENCRYPTED_BACKUP_PATH>
   ```
   Preferably restore into a separate scratch database and compare document counts.
4. Do not proceed if the restore verification fails.

### 2.2 Duplicate remediation (only if approved)

- Resolve each duplicate group manually with the data owner. Never bulk-delete.
- For users or accounts, decide which record is canonical by checking references (`accounts.userId`, `bookings.customer`, `savedmoodboards.user`).
- For bookings, cancel or merge through the application's status rules rather than deleting.
- Re-run the relevant 1.4 check after remediation; it must return `0`.

### 2.3 Create indexes one at a time

Use a short-lived **write-capable** user. Create **one** index, verify, then continue. Example commands (only for indexes recorded as **missing** in Part 1):

```js
db.users.createIndex({ email: 1 }, { unique: true, name: "email_1" })
db.accounts.createIndex({ provider: 1, providerAccountId: 1 }, { unique: true, name: "provider_1_providerAccountId_1" })
db.accounts.createIndex({ userId: 1, provider: 1 }, { name: "userId_1_provider_1" })
db.bookings.createIndex({ customer: 1, idempotencyKey: 1 }, { unique: true, name: "customer_1_idempotencyKey_1" })
db.bookings.createIndex({ vendor: 1, service: 1, date: 1, startTime: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["PENDING", "CONFIRMED"] } }, name: "vendor_1_service_1_date_1_startTime_1" })
db.vendors.createIndex({ slug: 1 }, { unique: true, name: "slug_1" })
db.services.createIndex({ vendor: 1, slug: 1 }, { unique: true, name: "vendor_1_slug_1" })
db.vendoravailabilities.createIndex({ vendor: 1 }, { unique: true, name: "vendor_1" })
db.pendingsignups.createIndex({ email: 1 }, { unique: true, name: "email_1" })
db.pendingsignups.createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_1" })
db.pendingsignups.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_1" })
```

After **each** creation:

```js
db.<collection>.getIndexes().filter(i => i.name === "<INDEX_NAME>")
```

Confirm keys and options exactly match the inventory, record the result, and only then create the next index. If a creation fails (for example a duplicate-key error), stop: do not retry with different options and do not drop anything; return to 2.2.

### 2.4 Post-migration verification

1. Re-run 1.3 and confirm every intended index is present and matching.
2. Re-run 1.4; all counts remain `0`.
3. Application smoke tests on staging: Google sign-in, admin access, booking creation (including a repeated submission), vendor creation with a duplicate slug (expect a 409).

### 2.5 Rollback

- Roll back **only indexes created in this run**, by name:
  ```js
  db.<collection>.dropIndex("<INDEX_NAME_CREATED_IN_THIS_RUN>")
  ```
- Dropping a newly created index does not change data.
- Never drop an index that existed before this run.
- If data remediation in 2.2 caused a problem, restore only the affected collection from the 2.1 backup into a scratch database first, compare, and then restore with the data owner's approval.

### 2.6 Production

Repeat Part 1 in production with a read-only user, then Part 2 only after the staging run is complete, its audit record is reviewed, and production approval is given. Take a fresh production backup; staging backups are not substitutes.

---

## Audit record template

| Environment | Database name (from 1.1) | Server version (1.2) | Date | Operator | Approver |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

| Index | Collection present? | Index state (present / different / missing) | Duplicate count | Action proposed | Action taken | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | | | | | | |
| I2 | | | | | | |
| I3 | | | | | | |
| I4 | | | | | | |
| I5 | | | | | | |
| I6 | | | | | | |
| I7 | | | | | | |
| I8 | | | | | | |
| I9 | | | | | | |
| I10 | | | | | | |
| I11 | | | | | | |
