# Adaptive Configurator Layout

Ringconf 2.7.9 introduces an adaptive layout layer for the configurator shell.
The goal is UI reflow without recreating Babylon canvas, engine, scene, meshes,
textures, `RingData`, or camera state.

## Inventory

- Canvas host: `src/app/webgl/webgl.component.html` renders the stable
  `<canvas id="webgl">`.
- Engine and scene owner: `WebglComponent.InitAfterAppReady()` creates the
  Babylon `Engine`, `Scene`, `ArcRotateCamera`, environment texture, materials
  and `cRing` instances.
- Previous destroy risk: `app.component.html` rendered separate desktop and
  mobile `x-config` instances. The WebGL component was already single-instance,
  but the UI state had duplicated component trees.
- Navigation state: `src/app/menu/menu.component.ts` owns one shared
  `navigation.currentHash` and step list.
- View navbar: `WebglComponent` renders `.ring-view-toolbar` inside the WebGL
  host and delegates camera presets to `RingViewService`.
- Old breakpoints: `$breakpoint-mobile: 768px` and
  `$breakpoint-footer-split: 1000px` in `src/default.scss`; several media rules
  were browser-width based.
- New measurement: `ConfiguratorLayoutService` measures the actual
  `.configurator-shell` width with `ResizeObserver`; `visualViewport` only
  stabilizes available height.
- Existing resize/frustum: `WebglComponent.resizeViewport()` calls
  `engine.resize()` and uses either `zoomExtends()` or `RingViewService` fitting.
- Free camera detection: `RingViewService.handleManualCameraInput()` clears the
  active preset and sets `suspendNaturalTarget`.
- UI state to preserve: active navigation hash, ring type, active ring tab,
  `RingData`, engravings, stone colors, view preset/manual camera and tool
  overlays remain outside layout classification.

## Modes

The six supported layout modes are:

- `phone-portrait`
- `phone-landscape`
- `tablet-portrait`
- `tablet-landscape`
- `desktop-compact`
- `desktop-wide`

Breakpoints are centralized in
`src/app/layout/configurator-layout.breakpoints.ts`:

- `phoneMaxWidth: 767`
- `tabletMaxWidth: 1199`
- `compactLandscapeMaxHeight: 540`
- `desktopWideMinWidth: 1440`
- `hysteresis: 24`

Classification uses measured width, measured height, aspect/orientation and
pointer capability. It does not use user-agent sniffing.

## Composition

Desktop wide and compact keep a top step navigation, a persistent panel, a large
canvas and visible action area. Tablet landscape uses a vertical rail, canvas and
panel side by side for co-browsing. Tablet portrait uses a horizontal stepper,
prominent canvas and panel below. Phone portrait keeps canvas first, horizontal
stepper second and single-column settings below. Phone landscape uses a narrow
rail, maximized canvas and a dismissible side panel.

All modes render the same `x-menu`, one `x-webgl`, one `x-config` and one
`x-tools` instance. Layout changes move these through CSS grid areas only.

## WebGL Stability

`x-webgl` is never wrapped in a mode-specific conditional. `WebglComponent`
keeps its singleton guard and exposes diagnostics:

- WebGL component instance ID;
- engine instance ID;
- scene instance ID;
- canvas client size.

The development overlay shows these values when `debug` is active in a
development runtime. Production and WooCommerce do not show the overlay.

## Resize Sequence

For adaptive reflow:

1. `ConfiguratorLayoutService` observes the shell and emits only real state
   changes.
2. `AppComponent` updates `layout` and navigation layout mode.
3. `AppComponent` requests `WebglComponent.resizeForLayoutChange()`.
4. WebGL waits two `requestAnimationFrame` cycles.
5. `resizeViewport()` applies render quality, calls `engine.resize()`, refits
   active named camera views or preserves free camera orientation/target.
6. Forced frames render the new viewport without reloading assets.

Window resize and orientation listeners are disposed in `ngOnDestroy()`.

## Camera Behavior

Named view presets keep their authored angle and target and are refit for the new
canvas aspect through `RingViewService.refitActiveView()`.

Manual/free camera input clears the active preset and sets `suspendNaturalTarget`.
During layout resize, the service requests render frames without resetting the
target to the default pair fit. This keeps alpha, beta and target stable.

## Touch And Safe Areas

The adaptive shell defines:

- `--stone-option-target-size`
- `--stone-preview-size`
- `--config-nav-target-size`

Phone and tablet modes keep interactive targets around 48px or larger. The rail,
panel, canvas, action area and diagnostics use `env(safe-area-inset-*)`.

Canvas touch handling is scoped to the canvas; form and panel areas stay
scrollable.
