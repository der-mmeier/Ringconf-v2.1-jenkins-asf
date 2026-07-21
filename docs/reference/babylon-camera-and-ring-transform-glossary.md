# Babylon Camera And Ring Transform Glossary

## ArcRotateCamera

`alpha` is the horizontal orbit angle around the target.

`beta` is the vertical orbit angle. Values too close to `0` or `PI` are clamped by camera limits.

`target` is the point the camera looks at. It is not the camera position.

`radius` is the orbit distance in perspective projection. In orthographic projection it is not the visible zoom.

`orthoHeight` is the current visible height used for orthographic framing.

`screenOffsetX` and `screenOffsetY` shift the orthographic frustum without changing the product model.

## Ring Presentation Root

Each visible ring has a Babylon presentation root. In current code this is a `TransformNode` exposed through `RingPresentationHandle.root`.

`position` moves that presentation root in world units.

`rotationQuaternion` is the canonical visible rotation for export. Euler values are only helper representations.

`visible` enables or disables the presentation root. It does not delete a configured ring or modify preset data.

## Current Roles

`ring0` is the female wedding ring, `ring1` is the male wedding ring, `ring2` is the engagement ring, and `ring3` is the memoire ring.

