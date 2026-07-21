# Rendering Calibration Reference

Ringconf 2.7.10 separates product state from presentation calibration.

## Product State Versus Presentation State

RingData stores the configured product. Calibration state never writes into RingData and never changes price, AppData, engravings, stones, or preset semantics.

Presentation calibration only targets Babylon presentation roots and camera values:

- ring root `position`
- ring root `rotationQuaternion`
- ring root visibility
- camera alpha, beta, target, radius, orthographic height, screen offsets
- startup camera sequence timing and easing

## Presentation Roots

`RingPresentationRegistry` creates handles for active ring roots:

- `ring0`: Damen-Trauring
- `ring1`: Herren-Trauring
- `ring2`: Verlobungsring
- `ring3`: Memoirering

Composition profiles describe which handles are active together, for example `wedding-pair`, `wedding-plus-engagement`, or `wedding-plus-both`.

The WebGL component stays mounted. Calibration applies transforms to existing Babylon `TransformNode` roots and then requests additional render frames. It does not create a new engine or scene.

## Camera Calibration

The camera model uses Babylon `ArcRotateCamera` terms:

- `alpha`: horizontal orbit angle around the target
- `beta`: vertical orbit angle
- `target`: look-at point, not camera position
- `radius`: perspective camera distance
- `orthoHeight`: visible orthographic height and primary zoom value in orthographic mode
- `screenOffsetX/Y`: frustum offset for composition framing

Do not treat `radius` as the visible zoom in orthographic mode.

## `ringRotationX` Caveat

Legacy Shopware values can contain names such as `ringRotationX` or `ringRotationY`. These are not the canonical visible root rotation in the current app. Current calibration exports the ring presentation root as a quaternion. Euler values may be UI helpers only.

