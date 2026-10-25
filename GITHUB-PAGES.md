# PlantIt Gaussian Garden on GitHub Pages

The standalone Gaussian Garden lives in `gaussian-garden/`. The existing
backend, frontend and application directories are preserved.

The `Publish Gaussian Garden to GitHub Pages` workflow regenerates all three
standard `.splat` room models from the checked-in artwork and scene generator,
validates the Gaussian geometry and camera routes, then publishes this static
edition to the repository's GitHub Pages address. Scene binaries are build
artifacts rather than committed files. No runtime CDN or AI service is needed.

## One-time Pages setting

Open repository **Settings → Pages** and set **Build and deployment → Source**
to **GitHub Actions**. Then open **Actions → Publish Gaussian Garden to GitHub
Pages → Run workflow** if an initial deployment has not already succeeded.
Subsequent changes under `gaussian-garden/` publish automatically from `main`.

This edition uses authored 3D Gaussian rooms, local browser care/journal data,
and browser-local photo albums. It does not connect to the production Flask
backend or migrate existing records. The existing Hostinger installation is
unaffected. Uploaded user photographs never enter this public repository.
