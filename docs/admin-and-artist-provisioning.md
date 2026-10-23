# Admin and artist account provisioning

There is no public way to become an admin or an artist, and no account is ever elevated automatically.

## Roles

| Role | How it is granted | What it allows |
| --- | --- | --- |
| `customer` | Default for every account | Book, manage own bookings, review own completed bookings, moodboards, profile |
| `artist` | An admin links an existing account to one vendor (Admin → Vendors → *vendor* → Artist Accounts) | Read-only artist portal at `/artist` for that one vendor: appointments, working hours, time off. Client phone/email are shown only for confirmed bookings. No admin access. |
| `admin` | Manual database change by an operator (below) | Everything under `/admin` and `/api/admin/*` |

Every protected page and API re-checks the role in the database on each request. Roles in the session token or sent by the browser are never trusted.

## Provisioning an admin (operator procedure)

Admin access requires all three of: `users.role === "admin"`, a linked Google account in the `accounts` collection, and a session that was signed in with Google.

1. The person signs in to the site once with the Google account that will administer it. This creates their `users` and `accounts` documents.
2. An operator with write access to the production database, working from a trusted machine, finds the user by email and confirms the account is the intended person:
   ```js
   db.users.findOne({ email: "owner@example.com" }, { _id: 1, email: 1, role: 1 })
   db.accounts.findOne({ userId: <that _id>, provider: "google" }, { _id: 1 })
   ```
   Both must exist. Do not proceed if the `accounts` document is missing.
3. Set the role on that one document only:
   ```js
   db.users.updateOne({ _id: <that _id>, role: { $ne: "admin" } }, { $set: { role: "admin" } })
   ```
   Confirm `matchedCount: 1`.
4. The person signs out and signs in again with Google, then opens `/admin`.

To revoke: `db.users.updateOne({ _id: <id> }, { $set: { role: "customer" } })`. Access ends on the next request.

Never set roles in bulk, never derive admin status from an email address, and never add a sign-up path that sets `role`.

## Linking an artist account

1. The artist signs in to the site once (any supported sign-in method) so their account exists.
2. An admin opens Admin → Vendors → the vendor → **Artist Accounts**, enters the artist's email, and selects **Link account**.
3. The artist opens `/artist`.

Safeguards enforced by the server: admin accounts cannot be linked; an account can be linked to only one vendor; unknown emails are rejected; unlinking returns the account to `customer`. Link and unlink actions are logged with the acting admin's user id.
