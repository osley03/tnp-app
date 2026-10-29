# Secure administrator onboarding — proposed future phase

This document is a design for later implementation. It does not create an administrator, promote an account, send an invitation, or change today's access rules.

Only a designated platform owner may request an administrator invitation. Require recent password reauthentication and verified MFA (AAL2) on the server. Ordinary admins may not grant roles unless explicitly assigned that capability. Tenant and landlord accounts cannot invite admins, approve invitations, or choose an admin role during signup.

Use dedicated administrator email identities, separate from tenant and landlord identities. Reject an invitation targeting an existing ordinary-role account rather than silently promoting it. Create a restricted pending identity that has no administrator access. The Auth signup trigger must recognize only server-controlled pending state; public user metadata must never grant privileged roles.

Bind each invitation to its intended email and issuer. Store a hash of a cryptographically random, single-use token, with a short expiry (for example 24 hours). Require the intended email to be verified, a password to be set, and MFA to be enrolled and proved before activation. Lock and consume the invitation transactionally to prevent replay. Rate-limit requests and acceptance attempts.

Require a second owner approval for sensitive grants once multiple owners exist. Bootstrap the first owner through a trusted server/database operation and record that action; do not expose an unrestricted first-admin endpoint. Prevent removal of the last active owner.

Record invite creation, approval, acceptance, capability changes, failed attempts, revocation and recovery actions in an append-only audit trail. Keep business evidence linked to the original actor IDs. Revoke membership server-side so old JWTs cannot retain privileged access.

Enforce every decision in Edge Functions, database functions and RLS, not only in UI routing. The present app_role=admin permission is broad: all existing admin policies and RPC checks must be reviewed before introducing limited finance/support/moderation capabilities. A hidden admin URL alone does not protect data.

Before release, verify anonymous, tenant, landlord, ordinary-admin and revoked-admin denial; valid owner acceptance; expired, reused and altered tokens; concurrent acceptance; MFA requirements; and last-owner protection. Configure a production email provider and an owner recovery procedure before enabling invitations.
