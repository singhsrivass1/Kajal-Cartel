# Kajal Cartel — Configuration added in the product completion sprint

All values are optional. Defaults apply when a variable is unset or invalid; an invalid value is logged once and ignored. Set them in the Vercel project's environment variables (Production and Preview) — never commit them.

## Booking policy

| Variable | Default | Allowed | Effect |
| --- | --- | --- | --- |
| `BOOKING_CANCELLATION_CUTOFF_HOURS` | `48` | 0–1440 | Confirmed bookings can be cancelled online until this many hours before the start time. Pending requests can always be withdrawn until the start time. |
| `BOOKING_RESCHEDULE_CUTOFF_HOURS` | `48` | 0–1440 | Pending or confirmed bookings can be rescheduled online until this many hours before the start time. |
| `BOOKING_MAX_RESCHEDULES` | `2` | 0–10 | Online reschedules allowed per booking. `0` disables online rescheduling. |
| `BOOKING_WINDOW_DAYS` | `365` | 1–1095 | How far ahead a date can be requested. |
| `REVIEW_WINDOW_DAYS` | `180` | 1–1095 | Days after completion during which a client can write or edit their review. |

Each artist's own minimum notice is the existing `businessMeta.bookingLeadTimeDays` field (edited in Admin → Vendors → Profile). It is now enforced on the server for new bookings and reschedules. All dates and times are India Standard Time.

The policy page (`/policies`), booking widget, booking detail page and help page read these same values, so the published rules always match what the server enforces.

## Contact details

| Variable | Effect |
| --- | --- |
| `SUPPORT_EMAIL` | Shown in the footer, Help, Booking policy and booking detail pages. Omitted entirely when unset. |
| `SUPPORT_PHONE` | Shown on the Help page when set. |

Only set verified business contact details. Nothing is displayed if these are not configured.

## Site URL (SEO)

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin used for canonical URLs, Open Graph, `robots.txt` and `sitemap.xml` (for example `https://kajal-cartel.vercel.app`). Falls back to `NEXTAUTH_URL`. Must be `https://` (or localhost). |

## Database requirement

Booking creation, rescheduling, blocked-date changes, working-hour changes and review submission now run in MongoDB multi-document transactions. Every Atlas cluster (including the free M0 tier) supports this. A standalone local `mongod` does not — run a single-node replica set for local development (`mongod --replSet rs0` followed by `rs.initiate()`). Without one, those actions return a 503 "temporarily unavailable" response and log `TransactionsUnavailableError`.
