# TNP roadmap

## Done — TNP web application
- Sign up / sign in with role selection (tenant, landlord, admin), role stored securely in a separate roles table
- Role-based routing: each account lands on its own dashboard after sign up
- Tenant: search bar (suburb/city/listing, max rent, type), verified listings, property detail with landlord trust profile, verified reviews, tamper-evident property history, lease request
- Landlord: publish/manage listings, occupancy toggle, incoming lease requests, applicant trust profile with references, approve & e-sign / decline
- Admin: listing verification queue, account KYC & trust scoring, lease activity oversight
- Public: landing page, scam report form, architecture map
- Row-level security on every table; email confirmation auto-confirmed so sign-up lands straight in the app

## Next
- Photo uploads to cloud storage (currently a photo URL field)
- Publish and apply the panorama storage and tour migrations
- Escrow payment gateway (EcoCash/OneMoney) and USSD fallback
- Automated fraud/image-match scoring feeding the fraud flags field
