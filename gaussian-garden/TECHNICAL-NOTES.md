# PlantIt Gaussian Garden 2.0.0

The supplied rooms are authored Gaussian scenes, not learned radiance fields.
Every point is stored as a mean, positive scale, orientation quaternion, RGB,
and opacity. There is no differentiation or training at runtime. The rear
walls use colors sampled from the generated botanical images; the remaining
geometry is authored. The model has view-independent colors (no spherical
harmonics). Thus the renderer is a real 3D Gaussian splat renderer, while the
asset construction is a deliberate artistic approximation.

The 32-byte `.splat` layout is 3 little-endian float32 position values, 3
float32 scales, RGBA bytes, and WXYZ quaternion bytes mapped around 128.
The loader computes world covariance R diag(s²) Rᵀ. The vertex shader rotates
it into camera space, projects it using the perspective Jacobian, adds a
small pixel footprint, and diagonalizes the 2×2 screen covariance. Each
instance emits a quad enclosing a three-sigma ellipse. The fragment shader
uses opacity × exp(-r²/2), with premultiplied alpha. A worker counts depth
bins from far to near and returns sorted point indices. Model data stays in
a float texture so camera animation does not transfer full point data each
frame. Hardware rendering is WebGL2; unsupported contexts retain still art.

Rooms are placed at world X = 0, 10, and 20. Rear walls are at Z ≈ -6. The
side-wall doorway opening spans Z = -0.25 to 2.25 below Y = 3.2. Camera routes
cross these boundaries at Y = 2, Z = 1. Plant camera anchors are recorded in
the manifest. Far-to-near depth ordering is approximate within each of 8,192
bins and does not implement per-pixel sorting or a visibility hierarchy.

On each movement the path is an eased sequence of camera positions and look
targets. This is guided navigation, not collision-based free walking. Drag
in Explore mode rotates the view at the current camera location. Reduced
motion jumps to the requested camera position. A later real-world scan can
replace a room model, but its camera anchors must be aligned to that scan.

Reconstruction from images, user account authentication, production database
integration, automatic Wikipedia retrieval, Notion import and server uploads
are not present in this standalone package. No credentials are embedded.

## Rebuild and check

The optional scene generator needs Python 3, Pillow, and NumPy. From the
unpacked site root run `python source/build-scenes.py`. Serve the site from
HTTP/HTTPS rather than opening index.html using file://. Hostinger requires
only the generated static files; none of the Python tooling runs on the host.

Run `node source/test-scene.cjs` for source-data, covariance, camera-route,
parser and worker ordering validation. The application has no npm dependency.
