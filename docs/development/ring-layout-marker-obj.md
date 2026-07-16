# Ring Layout Marker OBJ Workflow

2.7.6 supports development-only import of marker OBJ files for temporary ring presentation layouts.

Wavefront OBJ does not preserve reliable node transforms. For that reason arbitrary ring OBJ files are not parsed. A layout OBJ must contain marker objects named:

- `RCFG_RING0_ORIGIN`, `RCFG_RING0_X`, `RCFG_RING0_Y`, `RCFG_RING0_Z`
- `RCFG_RING1_ORIGIN`, `RCFG_RING1_X`, `RCFG_RING1_Y`, `RCFG_RING1_Z`

At least one complete ring set is required. Partial sets are rejected.

The importer calculates each marker centroid, derives X/Y/Z axes, orthogonalizes the basis, validates handedness against the imported Z marker, and stores only a position and normalized quaternion in AppData.

Development Admin only:

- OBJ is read locally in the browser.
- No OBJ upload route exists.
- Marker meshes are never added to the production scene.
- File contents are never stored in AppData.

Production and WooCommerce builds can use saved numeric layout presets but do not expose file inputs or import UI.
