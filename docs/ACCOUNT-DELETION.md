# Account closure

Tenant and landlord dashboards and Settings expose a password-confirmed Delete account action. Administrators cannot delete themselves through it.

The separate admin-readable tnp_deleted_accounts table retains only UUID, role, legal name, original creation time, closure time and Auth cleanup status. No email, phone, biography, password or profile snapshot is archived. Existing leases, applications, payments, receipts, disputes and property history remain under their existing access rules. The active profile becomes Deleted account, personal contact/bio fields are cleared, favourites removed and listings/tours unpublished. Existing immutable payment evidence is deliberately preserved.

Auth retains an unusable UUID tombstone because deleting auth.users would cascade into business records. The Edge Function calls Supabase Admin deleteUser with shouldSoftDelete=true. Supabase marks the identity deleted, obfuscates email/phone, clears credentials, personal metadata and identity data, and ends sessions while preserving the UUID. A failed Auth cleanup leaves an admin-visible pending flag; application access is already denied. An administrator may retry account-deletion with accountId and confirmation DELETE. Never hard-delete the Auth user from the dashboard.

Restrictive RLS denies closed identities on all current public tables and storage objects; PostgREST pre-request guard also blocks SECURITY DEFINER RPC calls with old JWTs. Migration refuses to overwrite an existing unrelated pre-request hook. Future tables must include an equivalent restrictive policy. Anonymous public access remains public. Existing signed media URLs expire according to their original lifetime.

Deploy the migration and account-deletion Edge Function together. Retention duration requires an explicit project policy: there is no automatic expiry or promise of erasing contractual evidence. Access is administrator-only for the archive, with existing party/admin permissions for evidence. No real user is deleted by tests.

Verified 26 October 2026: migration applied to kjtkwujuevbzcydbjscq and all three Edge Functions deployed. Live synthetic tenant/landlord closures passed, including password checks, minimal archive/profile redaction, Auth soft deletion, old-JWT table/RPC rejection and blocked subsequent login. Existing user accounts were untouched. Local validation: 70 regressions, 22 database workflow groups and TypeScript passed. Production build status is recorded separately.
