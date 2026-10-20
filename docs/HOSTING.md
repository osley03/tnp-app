# Put TNP online

The working application remains in this tnp-app folder. render.yaml deploys its Node server; do not deploy it as a static site.

## First deployment
1. Create a Render account at https://dashboard.render.com/register and a GitHub account if needed. These account steps must be completed by the owner.
2. Put this tnp-app folder in a private GitHub repository. Its root should contain package.json and render.yaml. Keep .env, node_modules, .validation and .output out of Git; .gitignore excludes them.
3. In Render choose New > Blueprint, connect that repository and select render.yaml. Choose the free plan for testing.
4. Supply VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY using the public project values already in the local .env. Never enter a service-role or secret key as a VITE variable.
5. Render installs dependencies, validates environment settings, builds and starts the app. It supplies a public HTTPS address; the actual name is assigned when the service is created. No hosting service has been created by these local preparations.
6. Confirm the deployed /health address returns status ok, then open the home page and sign in with each existing role.

The free Render service sleeps after inactivity, causing a delayed first visit. Use an always-on plan when ready for a public launch. Supabase remains the database/storage/auth provider; no replacement database is needed.

## Connect the final address
- Supabase > Authentication > URL Configuration: set Site URL to the new HTTPS origin and add the exact /auth redirect URL. Keep the localhost /auth redirect only if still developing locally.
- If payment checkout is enabled later, set the payment-gateway TNP_APP_URL secret to this HTTPS origin. Merchant credentials remain only in Supabase function secrets. Live payments remain disabled until real provider setup/testing.
- New and attached tour links are stored as relative TNP paths, so moving between localhost and hosting does not strand property tours. Old localhost property links are normalized by migration 20261016130000_tnp_portable_tour_links.sql. Previously copied external share links must be recopied from the hosted app.
- Public environment changes require a new build because Vite embeds public values at build time.

## Install on a phone
Open the HTTPS address in Android Chrome and choose Install app/Add to Home screen. On iPhone use Safari > Share > Add to Home Screen. The existing PWA manifest, housing icons and service worker are included. Private account records are not cached for offline use; the offline screen explains connectivity is needed. This is an installable web app, not an app-store binary.

## Checks
npm run check:hosting
npm run typecheck
npm test
npm run test:database
npm run build
npm start

Hosting uses HOST=0.0.0.0 and the PORT provided by Render. /health is a process liveness check; database and payment readiness are checked separately.

References: https://render.com/docs/web-services , https://render.com/docs/free , https://render.com/docs/blueprint-spec , https://supabase.com/docs/guides/auth/redirect-urls .
