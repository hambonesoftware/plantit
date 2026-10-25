# PlantIt Fresco Garden

The standalone site is in `fresco-garden/`. It uses three leafy Italian
botanical fresco backgrounds and a short gold sparkle only when changing
rooms. Plant views and the photo album open immediately.

The `Publish Fresco Garden to GitHub Pages` workflow checks the JavaScript
and publishes the static folder. There are no scene-generation dependencies
or model downloads. To enable publishing, set repository Settings → Pages →
Source to GitHub Actions, then run that workflow. Subsequent changes publish
automatically from main.

The previous Gaussian Garden source and workflow have been removed. Existing
backend/frontend folders are preserved. Browser-local records and photographs
use the same storage identities; cache migration does not clear those records.
This standalone edition remains separate from the production Flask backend.
