# Consistent workspace design — 16 October 2026

Applied directly to the working tnp-app folder for Tenant, Landlord and Admin.

- Shared deep-navy canvas (#0b1628), glass-style panels, quieter borders and consistent header/sidebar surfaces.
- Workspace controls on every authenticated route: Back to dashboard points to the assigned role's home; Refresh reloads the current page and its records.
- Role-specific module finder with clear/no-results states, keyboard Escape and Settings access. Existing record searches remain in their modules.
- Brighter dashboard artwork and lighter image overlays preserve the original housing imagery.
- Soft primary/secondary text colours replace page-wide opacity. White property forms retain navy input text. Enhanced contrast, reduced motion and reduced transparency preferences remain supported.
- Tour Studio panels use the same theme; panorama images and hotspot rendering are preserved.
- Property, application and admin listing searches accept words spread across fields, casing differences, accents and extra spaces. Trust-profile search no longer fails on surrounding spaces.

Search source audit: 23 search inputs are connected to their state, and no missing search dependencies were found in memoized filters. 39 regression tests pass, including four search cases. TypeScript checks pass.

Browser screenshots and checks use isolated synthetic backend fixtures and cannot establish live Supabase upload/payment workflows. Navigation link targets are checked separately from browser click timing. The latest browser report is browser-check.json when generated.

Visual review also removed an old form-only class from the admin registry page and corrected its sticky-header scroll container. The white styling remains on the actual add/edit form. Canvas and panel rules are separated so all page backgrounds share the same exact base colour.

Final verification: TypeScript and production build passed; 39 regression tests passed; 25 focused browser checks passed across desktop/mobile viewports, including 16 screens, six module-search/dashboard-target checks, two navy-on-white form checks and one role redirect check. No horizontal page overflow was found on these sampled screens. See design-verification-results.json and previews/ for examples using test data.

Payment checkout and provider receipts retain light paper surfaces with navy text. They are excluded from shared dark-card overrides, like the white property form. Module canvases retain the shared navy background.
