# Ring View Presentation State

Version 2.7.6 separates product state from presentation state.

Product state remains in `RingData`, presets, pricing payloads, PDF details, and WooCommerce transfer data. Camera view presets and temporary ring layouts are not written into those structures.

Presentation state is owned by the WebGL layer:

- camera alpha, beta, radius, target, and orthographic frustum,
- temporary presentation transforms on each ring pivot,
- the currently selected view preset,
- the currently selected temporary layout.

The runtime uses `cRing.pivot` as the presentation root. Ring body, stones, settings, pearling, and engraving move together. View changes must not set `RingData.isDirty`, call `cRing.compute()`, rebuild stones, or recalculate prices.

## AppData

AppData may define optional `viewPresets` and `layoutPresets`. Old AppData without those fields remains valid; the WebGL layer supplies fallback views.

`layoutPresets` store only validated numeric transforms:

- `position: [x, y, z]`,
- `rotationQuaternion: [x, y, z, w]`.

No OBJ content, customer data, or ring geometry is stored in AppData.

## Orthographic Auto-Fit

Production uses an orthographic `ArcRotateCamera`. In that mode `camera.radius` does not define the visible crop. The fit algorithm projects selected mesh bounding-box corners into camera space and sets `orthoLeft`, `orthoRight`, `orthoTop`, and `orthoBottom` with padding and canvas aspect ratio.

## Reset

Reset restores the current natural ring setup and the natural camera snapshot. It does not alter product configuration.
