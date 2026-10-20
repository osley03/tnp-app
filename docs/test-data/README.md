# Isolated TNP functional test data

Run npm run test:database to create synthetic Tenant, Landlord, Admin and unrelated Tenant accounts, a Garden flat listing in Harare (USD 500 rent/deposit), applications, a lease, payments, reviews, enquiries, disputes, scam reports and tour records inside local PostgreSQL test storage.

The resulting snapshot is .validation/fixtures/database.json. It is recreated for each run, excluded from uploads and never inserted into your connected Supabase project. Test identities use example.test addresses and cannot sign into the real application. There are no shared demo passwords or privileged browser keys.

The automated browser harness uses these isolated fixtures and a synthetic panorama to check rendering. It does not establish real Supabase uploads, provider settlement, phone motion or authenticated end-to-end delivery.

To manually test the hosted app, use separate owner-created test Tenant/Landlord accounts and the existing authorized Admin. Prefix demo listings with TEST, apply as the tenant, review as the landlord and prepare the lease as admin. Do not enter real payment details until provider sandbox configuration is ready.
