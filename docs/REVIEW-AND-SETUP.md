# TNP module review — 14 October 2026

## Role flow

1. A landlord creates a property listing and optionally creates, publishes and attaches a TNP panorama tour.
2. A tenant discovers the listing, saves it, views the tour and submits an application or landlord enquiry.
3. The landlord receives the application/enquiry and replies without changing the tenant's message. Pending applications can be approved/rejected; tenants can withdraw pending requests.
4. Administrators convert eligible applications into lease records and manage lease states. A repeated conversion returns the existing lease.
5. Tenants with active leases create payment intents, request renewal, submit qualifying reviews or open disputes. Payment records remain private to the relevant parties and administrators.
6. Landlords respond to reviews and disputes; administrators moderate reviews, record final dispute outcomes and manage scam cases.

Application approval does not sign a lease, collect a deposit or mark a payment funded.

## Amendments

- Centralized route access using assigned database roles; removed editable metadata as a permission source and removed public admin signup.
- Protected administrator-only profile trust and property verification fields.
- Restricted tenant profile reads to the account holder, administrators and related landlords; protected private leases, payments, enquiries and reports.
- Preserved tenant messages when landlords reply; aligned legacy/current application statuses and withdrawal permissions.
- Added missing operational tables, directory views, favourites, legacy-tour columns and authenticated workflow functions.
- Added enquiry inboxes for both tenant and landlord; forwarded landlord reports into admin scam cases.
- Made admin lease creation/status changes and payment ledger transitions transactional and auditable.
- Added review qualification, moderation and response boundaries; prevented direct duplicate reviews.
- Corrected malformed SQL in the previous tour deletion trigger and protected linked tours from being unpublished, made private or deleted until unlinked.
- Rendered the PWA installation component; handled unavailable browser storage and cleared query caches when accounts change.
- Added consistent light/dark background gradients, readable form controls, responsive spacing, keyboard focus and reduced-motion styles. Preserved existing housing artwork and the tour viewer.
- Added keyboard focus handling to the shared property form and limited verification controls to administrators.
- Replaced ineffective local privacy switches with an explanation of actual data-access rules. Existing notification/presentation preferences remain browser-local.

## Module coverage

| Area | Modules inspected |
| --- | --- |
| Tenant | Dashboard, properties/favourites/tours, property details, applications, leases, payments, landlord directory, enquiries, reviews, scam reporting, listing safety checks, matching |
| Landlord | Dashboard, properties, portfolio, requests, applicants, applicant detail, trust profiles, enquiries, escrow, reviews, disputes, integrity, Tour Studio |
| Admin | Dashboard, profiles, property registry/add form, leases, payments, reviews, disputes, scam cases, insights, accessibility |
| Shared | Authentication, settings/profile, reporting entry, public gallery/shared tours, mobile installation, offline fallback |

## Verification scope

The local database verification applies the complete migration sequence to PostgreSQL through PGlite, audits source table/column/function contracts, and exercises role/workflow assertions with simulated Supabase auth/storage schemas. The JSON contract audit records which source modules reference which tables/functions.

The production build and TypeScript checks validate compiled code. Regression tests cover PWA cache boundaries, icons, URL handling, tour graph navigation, sharing-service authorization, role routing, application statuses and property validation.

The Windows visual-testing helper repeatedly timed out. Screen appearance, actual phone installation/gyroscope interaction, live storage uploads and deployment against your existing Supabase schema are not visually or live-environment verified. No migrations or functions were deployed to your account.

## Apply to your existing Supabase

Keep a backup and use a staging copy to compare your existing custom table/function definitions with these migrations. The package has no snapshot of your live schema. Existing objects may use different types or constraints even though these migrations use additive table/column definitions.

Apply only pending migrations in filename order, then deploy the virtual-tours Edge Function, set frontend public credentials and configure authentication redirects for your deployed URL. Retest with disposable Tenant, Landlord and Admin accounts.

## Remaining external integrations

- Financial settlement needs a payment provider. The current payment module records requests and external settlement states; it transfers no money.
- Electronic signatures need a signature provider. Lease state changes alone are not signatures.
- Email/SMS/USSD delivery, land-registry verification and external AI services are not connected.
- Kuula-style tours include uploaded panoramas, hotspots, floor plans, sharing/access controls and mobile motion viewing; headset/stereo VR is excluded.
