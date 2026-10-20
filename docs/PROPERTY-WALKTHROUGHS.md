# Adding a property with a room walkthrough

The landlord property form includes a guided 360° builder. No manual URL copying is required.

1. Fill in the property's basic information and pricing. Optional size and room specifications are collapsed.
2. In Property Media, upload one full spherical panorama per room. JPEG, PNG and WebP are supported, with a 20 MB limit per source file. Each must be approximately 2:1 and at least 1024 pixels wide. Uploads are prepared at up to 4096 × 2048 JPEG for mobile viewing; small JPEGs are retained. Ordinary photos and partial phone panoramas cannot provide a full spherical room view.
3. Name each room and choose the entrance.
4. Choose a destination room, click Place doorway arrow, then click the actual doorway on the panorama. Open the destination room and add its return arrow. The app does not infer door locations or invent room connections.
5. Test walkthrough switches to tenant-style hotspot navigation in the same viewer. Every included room must be reachable from the entrance and have a path back before publishing in the guided builder.
6. Publish and select tour saves it and selects the link in the property form. Save the property to attach it. Publishing makes an unlisted tour accessible to anyone with its link.

Save progress preserves the tour separately. Drafts remain accessible in My tours if the property form closes. Unsaved edits prompt before closing; property submission is disabled during uploads and while tour edits need saving. The full Tour Studio remains available for advanced settings. Published tours are also checked for reachable rooms and return paths by the shared client validator.

Existing published public/unlisted tours owned by the landlord can be selected directly. A saved TNP link can still be pasted manually. Private/password tours should be managed with the full studio.

Open How to capture room photos in the property form or Tour Library to check an image locally in the spherical viewer before uploading. The checker confirms image dimensions; it does not prove that a complete sphere or a real property was captured. TNP does not stitch ordinary phone photos into spherical images.

No new database migration is required for these 360° changes: this uses the tour tables, private panorama storage and virtual-tours function already deployed. Verification: TypeScript and regression checks; real upload/viewing should also be tested with the landlord and tenant accounts against the configured Supabase project.

Public Kuula share links and Matterport show links can also be attached. TNP validates the provider URL, and tenants choose whether to load the external embed. Provider privacy/access settings and availability still apply; TNP does not copy those tours or verify their location. This option needs migration 20261019130000_tnp_external_property_tours.sql.
