# Responsive Layout Testing

Use this checklist for Ringconf 2.7.9 adaptive layout work.

## Automated Checks

```bash
npm run test:ci -- --include src/app/layout/configurator-layout.service.spec.ts
npm run stones:verify
npm run build:development
npm run build:production
npm run build:woocommerce
npm run check:admin-exclusion
```

The focused layout spec validates the required viewport matrix, breakpoint
hysteresis, pointer state and repeated identical measurements.

## Viewport Matrix

Check at DPR 1 and 2, and DPR 3 where available:

```text
320 x 568
360 x 800
390 x 844
568 x 320
667 x 375
844 x 390
768 x 1024
820 x 1180
1024 x 768
1180 x 820
1280 x 720
1366 x 768
1440 x 900
1920 x 1080
```

Expected modes:

- phone portrait: `320 x 568`, `360 x 800`, `390 x 844`
- phone landscape: `568 x 320`, `667 x 375`, `844 x 390`
- tablet portrait: `768 x 1024`, `820 x 1180`
- tablet landscape: `1024 x 768`, `1180 x 820`
- desktop compact: `1280 x 720`, `1366 x 768`
- desktop wide: `1440 x 900`, `1920 x 1080`

## Manual Portrait To Landscape Test

1. Open the stone step.
2. Select a generated colored stone preview.
3. Rotate the camera manually.
4. Switch portrait to landscape.

Expected:

- layout mode changes correctly;
- same canvas remains in place;
- development diagnostics keep the same WebGL, engine and scene IDs;
- selected stone color and RingData remain unchanged;
- camera angle and target remain visually continuous;
- no ring model or texture request repeats.

## Phone Landscape

At `844 x 390`:

- navigation is a narrow rail;
- active step is clear;
- panel can open and close by tapping the active step or close control;
- canvas remains the dominant area;
- view toolbar does not cover the ring;
- tap targets are about 48px.

## Tablet Landscape

At `1024 x 768` and `1180 x 820`:

- rail, canvas and panel are visible at once;
- panel stays usable and scrollable;
- canvas remains large enough for co-browsing;
- no mobile bottom navigation appears.

## Stone Icons

For green, pink, rose/light, black and colorless variants:

- previews stay SVG images;
- no circle placeholder returns;
- visible gem size follows `--stone-preview-size`;
- touch target follows `--stone-option-target-size`;
- labels and active state remain readable.

## WooCommerce Container Check

In a WordPress page or account endpoint, narrow the containing content area.
The mode should follow the configurator shell width, not only the browser
window. The development diagnostics are not shown in WooCommerce.
