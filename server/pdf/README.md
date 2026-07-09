# Server PDF

This directory is the versioned source for the central PDF endpoint.

Server target:

```text
/public_html/toolbox/3d-konfigurator/pdf/create.php
```

The endpoint is infrastructure next to `builds/`; it is not copied into individual release or development build folders.

FPDF is expected on the server at:

```text
/public_html/toolbox/3d-konfigurator/fpdf/1.9/fpdf.php
```

`create.php` includes it with:

```php
require_once __DIR__ . '/../fpdf/1.9/fpdf.php';
```

Runtime directories on the server:

```text
/public_html/toolbox/3d-konfigurator/pdf/tmp/
/public_html/toolbox/3d-konfigurator/pdf/logs/
/public_html/toolbox/3d-konfigurator/pdf/templates/
```

Phase 1 accepts the complete PDF payload from Angular: preset id, build metadata, AppData metadata, ring snapshots, detail rows, and canvas screenshots. PHP validates the request and renders the final PDF with FPDF.
