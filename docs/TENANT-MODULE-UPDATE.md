# Tenant workflows and public reporting

Changes are made directly in tnp-app.

- Payments: checkout and provider receipts use navy text on light paper backgrounds. Exported provider verification records remain available to the tenant, landlord and administrator.
- Landlord directory: open View trust profile to see biography, trust and verification, connected properties, approved reviews and property history. The history uses the actual occurred_at field. New listings and changes to landlord, rent, verification, availability and linked tours create history entries automatically. Existing listings receive a clearly labelled snapshot, not a fabricated historical event.
- Reviews: an active, completed or terminated lease qualifies, once per property/landlord. Drafts and applications do not qualify. Review text accepts 10–10000 characters, matching the database. The composer preselects the clicked rental and shows meaningful server rejection messages. Submitted reviews await admin moderation. The empty state explains the lease requirement.
- Public report: /report is accessible without login, with entry links on welcome and account access pages. Collects contact details, category, incident description, location, involved person, loss amount, payment reference and up to ten HTTPS evidence links. Direct public file uploads and automatic email delivery are not implemented.
- The same scam_cases queue receives account and public reports. Admins can investigate, set priority, add private notes and resolve. The application uses one atomic database function to save each action and its audit entry. Closing requires a recorded resolution.
- Anonymous reporters receive a downloadable case reference and random private tracking code. Only the hash is stored. Tracking exposes status, outcome and dates; it never exposes admin notes, evidence or reporter contact details. Receipt codes must be saved by the reporter.
- Public submissions are validated on the database, with a honeypot and limits of three reports per email per hour and 100 total public reports per hour. These are initial abuse controls, not verified email identity or a CAPTCHA service.
- Property matching now reads rent_usd, beds, baths, suburb/city and real verification/availability. It compares annual rental budgets correctly, filters strict requirements and known incompatible occupancy/lease terms, handles required amenities and furnishing, and warns when information is missing. Matched property details link directly to the real listing and its rental application flow. It is an explainable preference scoring engine, not an external AI service or a probability of rental success.

Database changes: 20261016150000_tnp_public_reporting.sql and 20261016151000_tnp_listing_history.sql. Apply with the linked Supabase migration workflow. Deployment and browser outcomes are reported separately; local database checks simulate authentication and storage and do not prove a live user session.

## Verification

Both migrations were deployed to the linked Supabase project kjtkwujuevbzcydbjscq. A single labelled TEST case was submitted and tracked through the live public RPC; its private code is excluded from exports. Local verification passed 45 regression tests and 18 database workflow groups across 17 migrations and 45 source contracts. Browser interaction checks use synthetic API fixtures; they do not sign into real tenant, landlord or administrator accounts. See tenant-module-browser-check.json and live-public-report-check.json for scope and results.
