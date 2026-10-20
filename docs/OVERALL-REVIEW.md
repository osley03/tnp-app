# TNP overall review — 16 October 2026

Changes were applied directly to the working tnp-app folder.

## Verified results

- 35 regression tests passed: role routing, application statuses, property validation, PWA privacy/icons, tour navigation/sharing, payment signatures and checkout authorization, and hosting environment validation.
- Local PostgreSQL verification passed: all 15 migrations, 17 workflow groups, and 43 source modules checked against database contracts.
- TypeScript checking and the production client/server build passed.
- The production server started and its /health endpoint returned HTTP 200 with the expected TNP response.
- Read-only checks against the connected Supabase project passed: tour endpoint accessible, unknown tours denied, anonymous receipt reads denied, and unauthenticated checkout denied.
- Migration 20261016130000_tnp_portable_tour_links.sql was applied successfully to the connected development Supabase project.

## Corrections

- Added a required decline reason to the alternate applicant detail page.
- Confirmed actual affected rows for applicant decisions/replies and landlord property changes before reporting success.
- Refreshed both applicant and request lists after decisions.
- Updated application types to include the migrated review, rejection, lease and applicant fields.
- Stored attached tour links as portable TNP paths and normalized existing localhost links to owned, published tours.
- Repaired the damaged .gitignore and added explicit credential, dependency, generated-output and test-data exclusions.
- Aligned supabase/config.toml with the linked project.
- Added a Render Blueprint, Node version setting, public-key environment validation and a health endpoint.

## Workflow coverage

| Area | Checked behavior |
| --- | --- |
| Tenant | Role access, property/form contracts, favourites/privacy, application validation and withdrawal, lease access/renewal, payment requests/evidence, enquiries, review qualification/editing/reporting, scam reports and saved safety findings |
| Landlord | Own-property actions, applicant decisions and responses, related tenant profiles, enquiries, payment evidence, review replies, dispute responses, tour publication and listing attachment |
| Admin | Trust/listing verification, idempotent lease creation, lease/payment transitions, review moderation, dispute resolution and scam-case visibility |
| Shared | Auth role boundaries, account cache isolation, settings source contracts, PWA/icon/offline rules, tour sharing and hosting startup |

The source contract audit includes dashboards, portfolio, directory, integrity, matching and aggregate insight modules. Those computed views are not independent external AI or registry services.

## Test data and practical limits

The database tests create isolated synthetic users and module records. See test-data/README.md; the generated snapshot is .validation/fixtures/database.json. No fake users, listings or payments were inserted into the real Supabase project.

Automated screen checks encountered local browser/development-server timeouts. Desktop/mobile appearance and authenticated live end-to-end workflows must not be treated as verified by the database tests. Actual storage uploads, phone installation/motion controls, email delivery and provider settlement remain separate integration checks.

EcoCash/card checkout remains disabled until landlord merchant credentials are configured and provider testing is completed. Lease state changes are not electronic signatures. Notification preferences do not provide an email/SMS delivery service. Safety scores use TNP records, not a land-registry lookup.

## Hosting status

The project is prepared for Render hosting; no public service, account or domain has been created. Follow HOSTING.md after creating the hosting account. Supabase auth redirects and the payment app URL must use the final HTTPS address once assigned. A hosted signed-in walkthrough is required before public launch.
