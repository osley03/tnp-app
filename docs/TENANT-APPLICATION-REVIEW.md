# Tenant rental application review — 16 October 2026

Reviewed the tenant property detail and Applications screens, landlord request decisions, database access rules and administrator lease conversion.

## Corrections
- Property detail now requires a current/future move-in date and limits the message to 2,000 characters, matching application-screen validation.
- Existing application lookup errors block submission instead of silently allowing another request.
- Approved applications are included in the application-screen duplicate precheck. The existing database guard remains authoritative for simultaneous submissions.
- Rental applications exclude sale-only listings; For Rent, For Lease and For Rent or Sale remain eligible.
- Withdrawal and landlord decision updates must return an actual record before showing success.
- Landlord request details read the actual rent_usd field.
- Approved applications explain that the administrator prepares the lease; the lease button appears only when a lease record exists.
- Pending review labels are consistent. Tenant application records reload when returning to the window.
- New migration validates dates/message length/listing purpose, requires rejection reasons, and prevents response-only updates from rewriting decision timestamps or reviewer identity.

## Validation
- 32 existing automated tests passed.
- Local PostgreSQL verification passed: 14 migrations, 14 workflow groups and 43 module schema contracts.
- Added database coverage for past dates, message length, sale/unavailable listings, duplicate requests, missing rejection reasons, immutable decision metadata and tenant-visible rejection details.
- Existing tests cover withdrawal, rejection of approval after withdrawal, landlord approval, idempotent administrator lease creation and tenant lease privacy.

Local database tests simulate authentication and storage. A signed-in live browser walkthrough and simultaneous multi-client test were not performed. No tenant or landlord production application was submitted by this review.

Supabase deployment: migration 20261016110000_tnp_application_validation.sql successfully applied to the linked development project. Final TypeScript check passed.
Production client/server build passed (exit 0). Existing bundle-size and AuthPage code-splitting warnings remain non-blocking.
