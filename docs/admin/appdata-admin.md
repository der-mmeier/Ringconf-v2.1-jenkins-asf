# Development AppData And WebGL Admin

The AppData/WebGL admin is available only in the Angular `development` configuration. `src/main.ts` calls `bootstrapDevelopmentAdmin(...)`; `angular.json` replaces the real entry with `src/app/development-admin/admin-entry.disabled.ts` for `production` and `woocommerce`.

The visible panel is implemented by `src/app/development-admin/development-admin.component.ts`. It mounts a fixed gear control and the category `AppData und WebGL-Settings`. It never changes the normal Angular root template and does not affect WooCommerce output because the production entry replacement prevents the component from being imported.

The editor clones the complete loaded AppData snapshot, updates only selected JSON paths, and preserves unknown fields. Dynamic sections are built from keys such as `profile`, `material`, `materialExclude`, `surface`, `gapMode`, `stepMode`, `stoneMode`, `stoneType`, `stoneQuality`, `stoneDistribution`, `stonePosition`, `ringModes`, `engagementHeadLibrary`, and `webglSettings`.

WebGL changes are applied through the existing runtime objects in `AppComponent` and `WebglComponent`: scene exposure/contrast, environment reflection matrix, and camera alpha/beta/radius are updated live when the Babylon scene is available. Changes that cannot be safely applied live are marked as requiring reload rather than silently rebuilding renderer state.

The visible build label comes from `WebglComponent.getBuildString()` and now has separate build and AppData parts:

```text
Build 2.6.6 · AppData 3.0.216.5
```

Production and WooCommerce exclusion is checked by:

```bash
npm run check:admin-exclusion
```

The scanner fails if admin labels, the verification script marker, or `appdata-admin.php` are present in `dist/ringconf-v2.1` or `_shop/woocommerce/OneRingconf/dist`.
