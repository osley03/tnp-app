# TNP role workflow review

Review date: 19 October 2026. Changes are in the working tnp-app folder.

## Role responsibilities

- Tenant: discover available properties, inspect tours and landlord history, send enquiries/applications, track landlord decisions, pay approved rent/deposit requests, manage tenancy documents and renewals, submit eligible reviews and raise reports/disputes.
- Landlord: maintain owned listings and tours, assess applicants, approve/reject applications, respond to enquiries and disputes, inspect tenant payment history and provider evidence.
- Admin: manage profiles/listings, administer formal lease activation and lifecycle, moderate reviews, investigate public reports, resolve disputes and inspect payment records. A tenant or landlord cannot enter another role's dashboard.

## Manual payment and 360° implementation

Manual wallet/bank payment is now the main tenant flow. Landlords save versioned USD EcoCash, OneMoney, InnBucks or bank details; approved tenants submit private receipt proof, and landlords confirm or dispute it. Admins can filter by lease/dispute and export CSV or print/save PDF with receipt images. The per-lease event chain supports integrity checking, and confirmed records are locked. Paynow remains an optional later upgrade. Details are in MANUAL-PAYMENTS.md.

The property form and Tour Library include a local spherical image checker and capture instructions. Uploads are prepared for mobile viewing at up to 4096 pixels wide, and published room tours need connected forward/return paths in the shared client validator. Source capture still requires a full spherical image; TNP does not stitch ordinary phone panoramas.

Both new migrations (20261019120000_tnp_manual_payment_trail.sql and 20261019130000_tnp_external_property_tours.sql) passed local database testing and were applied successfully to linked Supabase project kjtkwujuevbzcydbjscq on 20 October 2026. See supabase-manual-tour-deployment.json. No live money transfer was performed.

## Current follow-up

- Admin dashboard case shortcuts now open the private admin scam-case queue instead of the public submission form. Payment labels describe receipts and direct payments.
- Live checkout requires a public HTTPS origin; localhost remains available for test merchants. The private configuration validator checks merchant mapping, USD currency, distinct receivers and activation flags without printing/uploading keys.
- Returning tenants can verify an existing payment when new checkout has been paused.
- Current automated results are in current-workflow-verification.json. Merchant credentials and the public application address are still needed for real payment activation; code deployment alone is not activation.

## Corrections in this review

- Newly approved/pending-approval rentals appear under Upcoming until activated. Completed rentals appear under Past even when no end date was recorded.
- Tenant lease cards show the actual property's name, with an identifier fallback while loading.
- A scheduled rent date remains due today throughout that calendar day; future/end dates constrain the schedule. Outstanding invoices remain in Payments & Receipts.
- Lease payment summaries include paid/released records consistently. Processing requests remain pending, not paid. Admin payment lists support the processing state.
- Landlord Request Admin Review sends the escalated status and preserves the admin's resolution fields. The landlord view now labels escalated/awaiting-response states.
- Removed a render-blocking external Google Fonts stylesheet after requests timed out. The app now uses a consistent local system-font stack.
- Earlier payment portal work is retained: EcoCash/Mastercard details, secure hosted checkout and provider verification after return.

## Verification boundaries

Source/type checks, regression tests, an isolated PostgreSQL database and desktop/mobile browser fixtures are used. Database tests exercise ownership and cross-role access, approval/invoicing, gateway verification, reviews, enquiries, reports and administrative workflows. Browser fixtures are synthetic and do not create production tenants or charge accounts. Final results are recorded in verification-results.json, browser-check.json, payment-journey-browser-check.json and tenant-module-browser-check.json. Do not infer a pass from this document alone.

Real EcoCash/Mastercard payments remain unavailable until receiving landlords' Paynow merchant accounts are connected and enabled. No merchant account has been provided and no live transaction is claimed. Hosting/domain setup also remains separate; local checks do not establish a public deployment.

## Results from this review

- Current source passed 62 regression tests, 21 database workflow groups across 21 migrations, 49 source contracts, and TypeScript checking.
- The current production build and TypeScript checks passed. The focused desktop/mobile manual payment and panorama browser suite passed all 22 checks; see manual-payment-tour-browser-check.json.
- Full role-suite reruns remain incomplete due browser launch/resource stalls on this 4 GB machine. Tenant and landlord desktop screens rendered successfully in an earlier current-source run. Test harness fixes corrected a duplicate warm-up variable, waits for network idleness and selectors that matched hidden options. No full fresh browser pass is claimed. Optional hosted gateway simulation and the standalone tenant-module suite still need a completed repeat. See current-workflow-verification.json.
- Landlord portfolio loading, payment amount fields and sidebar context were corrected during the review.

## Repeat the checks

Use Node 24 and install the app dependencies first. On this Windows project, install Google Chrome and run `npm run setup:workflow-tests` once to install the isolated test tools. Keep your existing local Supabase environment values; no merchant keys are needed for synthetic tests. Then run `npm run test:workflows`. It checks source types, regressions, database workflows and the production build before running the browser suites sequentially. The `.validation` folder, credentials and generated build output are excluded from the source ZIP.
