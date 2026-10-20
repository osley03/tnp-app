# TNP Virtual Tours module

An independent TNP implementation of a create → connect → configure → publish/share workflow, using Photo Sphere Viewer and the project's existing Supabase client. Kuula's publicly documented workflow was used as a functional reference, not as a source of copied application code or assets.

## Folders

- `api/`: authenticated CRUD, uploads, signed editor media, transactional saves, membership management and shared-view requests.
- `components/`: tour library, hotspot inspector, media uploader and floor-plan navigation.
- `editor/`: visual studio, tour settings, sharing panel and undo/redo history.
- `viewer/`: panorama canvas, interactive player, public gallery and access/password page.
- `lib/`: navigation graph rules, safe link handling, walkthrough orientation and iframe generation.
- `types/`: typed tour documents and runtime validation schemas.
- `tour-studio.css`: responsive studio/player styles and hotspot appearance.

## Entry routes

- `/app/landlord/tours`: library and batch panorama upload.
- `/app/landlord/tours/$tourId`: editor.
- `/tours`: public gallery.
- `/tours/$id`: player; `?embed=1` uses the compact embedded layout.

The public player uses `supabase/functions/virtual-tours/index.ts`. The function verifies the viewer identity and uses service-only RPCs for access checking. It signs only paths beneath the tour owner's tour-specific folder. Browser code cannot supply a trusted viewer identity, access the password-hash table or sign another owner's media.

The two tour migrations create the module tables/storage first and then add studio/access features. Tour settings and hotspot documents live in JSONB; scene ordering and names remain queryable columns. `tnp_save_tour` commits the tour/scenes in one transaction and rejects stale revisions. Password hashes are stored separately from public metadata. The media bucket is private.

## Functional references

- [Kuula virtual-tour workflow](https://kuula.co/help/virtual-tours)
- [Hotspots and actions](https://kuula.co/help/hotspots)
- [Walkthrough orientation](https://kuula.co/help/sha)
- [Privacy settings](https://kuula.co/help/privacy)
- [Floor plans](https://kuula.co/help/floor-plan)
- [Photo Sphere Viewer markers](https://photo-sphere-viewer.js.org/plugins/markers)

This module implements the TNP tour workflow described in the root README. It does not reproduce Kuula's subscription system, social network, custom-domain hosting service, billing, proprietary rendering engine or entire commercial feature catalogue.
