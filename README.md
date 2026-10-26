# TNP — Tenant, Landlord and Admin platform

Latest visual changes: [shared design and search update](docs/DESIGN-UPDATE.md). The [overall review](docs/OVERALL-REVIEW.md), [verification record](docs/overall-verification-results.json), and [isolated test data](docs/test-data/scenarios.json) document the functional checks. Focused browser checks use synthetic data and do not establish live end-to-end readiness.

This is the reviewed TNP source project, including the 360° Tour Studio, installable PWA, housing icons, role-specific modules and the operational database migrations.

For public HTTPS hosting and phone installation, follow [hosting setup](docs/HOSTING.md). The included Render Blueprint uses the existing Supabase backend.

## Run locally

Use Node.js 24 (the version family used for validation).

1. Run `npm install` in this folder.
2. Copy `.env.example` to `.env` and supply your own Supabase project URL and public/publishable key.
3. Apply the pending Supabase migrations as described below.
4. Run `npm run dev` and open the address shown by Vite, normally http://localhost:3000.

For production, run `npm run build`, then `npm start`. Configure the public Supabase environment variables before building. Deploy behind HTTPS for phone installation and browser motion features. Add your deployment URL to your Supabase authentication redirect allowlist.

## Supabase setup

The working folder is linked to your development Supabase project. Migrations and the virtual-tours/payment-gateway functions have been deployed during development. Credentials are excluded from distributable packages; apply only migrations still pending in your own linked project.

- On a new database, apply all SQL files in `supabase/migrations` in filename order.
- On your existing database, apply only migrations not already recorded as applied. Compare the migration contracts with your existing custom schema in a staging copy first.
- The earlier ZIP contained a malformed deletion-trigger section in `20261013140000_tnp_tour_studio.sql`; this package corrects it. If that migration failed previously, apply the corrected file before the newer migrations. If you already installed a corrected version, keep its migration history and apply the later tour integrity migration.
- Deploy `supabase/functions/virtual-tours` to the same project. The function reads its service-role credential from Supabase's server environment; never put that credential in frontend variables.
- New public signups can choose Tenant or Landlord. An existing trusted administrator must assign Admin through an authorized server/database administration process. Existing administrator assignments are preserved.

The October 14 migrations supply the missing operational tables/functions, enforce application and review rules, provide enquiry inboxes, and record admin lease/payment changes in transactions with audit records.

## Modules

- **Tenant:** property search and favourites, property details/tours, applications, leases/documents/events, payment intents and ledger, landlord directory/enquiries, reviews, scam reporting, listing safety checks and preference-based matching.
- **Landlord:** property management, portfolio, 360° Tour Studio, application review and replies, applicant profiles, enquiry inbox, escrow ledger, reviews/responses, disputes and listing integrity.
- **Admin:** profiles/trust verification, property registry and creation, leases, payment ledger, review moderation, disputes, scam cases, aggregate insights and browser accessibility preferences.
- **Shared:** authentication, profile/settings, public tour sharing/gallery, PWA installation and offline fallback.

See [review and setup notes](docs/REVIEW-AND-SETUP.md) for the role flow, migration details and verification limits. The tour module is documented in [its README](src/modules/virtual-tours/README.md).

## Verification

`npm run typecheck` checks TypeScript. `npm test` runs the URL/PWA/tour/role/property validation regressions.

For local PostgreSQL migration and role tests:

`npm run setup:database-tests`

`npm run test:database`

The optional test engine is installed only under `.validation` and is not a production dependency. These tests simulate Supabase auth/storage schemas locally; they do not contact or modify your live Supabase project.

## Integration boundaries

Payment requests and admin actions maintain records. The Paynow integration supports direct landlord EcoCash/card checkout when merchant secrets are configured; checkout and live processing default to disabled. Lease approval creates/updates records; it does not provide an electronic-signature service. Matching, integrity checks and admin insights use application rules and database records, not an external AI or land-registry service. Notification preferences are browser-local; no email/SMS/USSD delivery service is included. The PWA shows an offline fallback and does not cache private account data. Headset/stereo VR is not included.


## EcoCash and Mastercard payments

The direct-to-landlord Paynow module is implemented. Apply migration `20261016090000_tnp_direct_landlord_payments.sql` and deploy `payment-gateway`. Each landlord needs their own USD merchant integration; checkout defaults to disabled until server secrets are configured. Read [payment setup and evidence](docs/PAYMENT-GATEWAY-SETUP.md) before enabling test or live payments. Test receipts never mark real rent as paid.

Tenant workflow and public reporting update: [details](docs/TENANT-MODULE-UPDATE.md).

Rental approval and payment walkthrough: [tenant and landlord pnayments](docs/PAYMENT-JOURNEY.md).

Manual direct-to-landlord payments: see [docs/MANUAL-PAYMENTS.md](docs/MANUAL-PAYMENTS.md). Capture and connect room tours using [docs/PROPERTY-WALKTHROUGHS.md](docs/PROPERTY-WALKTHROUGHS.md).
