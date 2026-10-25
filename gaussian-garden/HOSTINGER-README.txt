PLANTIT — GAUSSIAN GARDEN, HOSTINGER EDITION
Version 2.0.0 | October 25, 2026

INSTALLATION
1. In Hostinger hPanel, open File Manager for your domain.
2. Create public_html/plantit-gaussian and upload this ZIP there.
3. Extract it. index.html, style.css, app.js, gaussian-world.js and assets/
   must be directly inside plantit-gaussian, without another nested folder.
4. Visit your domain followed by /plantit-gaussian/ using HTTPS.
5. For a blank domain, the same files can instead go directly in public_html.

No build command, npm dependencies, CDN, API key, Python server or database
server is needed to serve the app. Every runtime asset is included.
Keep this edition separate from your existing /plantit until you have chosen
how to integrate its existing backend and records. It does not migrate them.

WHAT IS ACTUALLY 3D
The three built-in rooms contain 349,029 anisotropic 3D Gaussian primitives
stored in standard .splat files. A WebGL2 renderer projects their covariance
ellipsoids into screen-space ellipses, evaluates Gaussian opacity, and blends
them in depth order. This is real Gaussian splat rendering with a moving
perspective camera. It is not a CSS zoom or a screen-space particle dissolve.

The conservatory is an AUTHORED 3D environment: physical Gaussian walls,
floors, open doorways, beams, pots, stems, leaves, and image-colored rear walls.
The generated artwork provides decorative wall color and authored depth.
It is NOT a measured reconstruction, an image-pair-trained radiance field,
or a photogrammetric scan of a real room. Decorative plant geometry is
illustrative; the framed Wikimedia photos are species reference images.

WALK THROUGH THE GARDEN
- Choose Sunroom, Vine House or Fern Alcove. The camera moves through the
  connecting doorway(s) and turns to the new room overview.
- Select a plant. The camera approaches its plant viewing position, then the
  care panel opens. Previous/Next plant moves to another plant position.
- Close the care panel to return to the current room overview.
- Explore space hides the main application panels. Drag the scene to look
  around; choose a room or a plant from the bottom controls.
- Return to my garden restores the application interface.
- Room view restores the camera overview.
- The sun icon opens rendering quality and motion settings.
- Reduced-motion devices use direct camera changes instead of animated walks.

YOUR OWN ROOM MODELS
The sun-icon settings panel accepts a standard 32-byte-per-Gaussian .splat
file up to 48 MiB / 1.5 million Gaussians. It normalizes the model into the
current room. Models should use Y-up coordinates. Imported models remain in
the current tab; reload restores the bundled room. Restore original room
also restores its bundled model. The built-in plant viewing positions remain
in effect: editing assets/scenes/manifest.json lets a developer align these
anchors with a replacement scan.

A .ply, .spz, .ksplat or compressed .splat file is not the same binary format
and must be exported as standard .splat before import. Room photographs alone
are not reconstructed by this static package. Creating a scan from photos or
video requires a separate reconstruction process. The ordinary photo album
is intentionally separate from 3D room models.

PLANTS, CARE, JOURNAL AND PHOTOS
- Three example plant records are supplied: Monstera, golden pothos, fern.
- Log watering updates the displayed last-watered field and event total.
- The care checklist records watering; unticking removes that review event.
- Write, search and filter journal notes.
- Personal notes and care state persist in local storage in this browser.
- Add room photos in each room's photo album. These original files persist
  in this browser's IndexedDB when storage is available; they are not uploaded.
- Photo-album arrows use the separately labeled 2D Gaussian-style dissolve.
  This album effect is not the 3D room navigation renderer.
- Sample dates, purchase information, notes and starting event totals are
  examples, not data imported from your production PlantIt installation.
- Species summaries are bundled text linking to Wikipedia, not live lookups.

STORAGE AND OFFLINE USE
The site includes a service worker and install manifest. After successful
initial loading and asset caching over HTTPS, the bundled garden can reopen
offline. Notes, care and photos are local to this browser and origin; they do
not sync between devices and clearing website data removes them. There are
no accounts, production backend, import pipeline or remote photo storage in
this standalone edition. Your existing application remains separate.

COMPATIBILITY AND PERFORMANCE
WebGL2 and Web Workers are needed for 3D. When WebGL2 is unavailable, still
artwork and care/journal pages remain available. A graphics-context loss tries
to restore the renderer. Use Balanced or Low quality on a phone. High quality
raises rendering resolution. No third-party network service is required.

VALIDATION PERFORMED
- JavaScript syntax checks for all application scripts.
- All 349,029 Gaussian coordinates, scales and covariance matrices validated.
- All nine room-to-room routes and all nine plant camera anchors checked.
- Depth sorter checked for far-to-near order and behind-camera rejection.
- Standard .splat parsing, model normalization, malformed file rejection tested.
- Exact GLSL ES 3.00 vertex and fragment shaders compiled and linked in a
  native offscreen Mesa context; a 113,740-instance frame rendered without
  GL errors. This is shader/render validation, not a browser preview.
- Archive and local runtime asset references checked.
No online preview was published. Safari/iPhone and your actual Hostinger
installation have not been exercised in this build environment.

PACKAGE CONTENTS
index.html / style.css / app.js       PlantIt interface and local records
splat-math.js                        Model decoding, covariance, camera math
gaussian-world.js                    WebGL2 renderer and camera navigation
splat-sort-worker.js                 Worker-based depth ordering
local-media.js                       Browser-local photo storage
service-worker.js                    Offline asset cache
manifest.webmanifest                 Install metadata
assets/scenes/*.splat                Three complete Gaussian room models
assets/scenes/manifest.json           Room paths and plant viewing positions
assets/                             Local artwork, photos, fonts, licenses
source/                             Scene generator and validation source
CREDITS.txt                          Asset attribution

For an update, upload the new files to the same folder and reload. If you
modify the app yourself, update the cache version in service-worker.js so an
old cached version is replaced. Never delete browser website data unless you
intend to remove its locally saved plant notes, care state and photos.

Hostinger reference:
https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/
