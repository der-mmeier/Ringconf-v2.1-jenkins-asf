export interface OrthoFitInput {
  points: Array<[number, number]>;
  aspect: number;
  padding: number;
  minHeight?: number;
}

export interface OrthoFitResult {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface RingViewSafetyLike {
  fitMode: "auto" | "fixed" | "zoom-out-only";
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  includeShadowEnvelope: boolean;
  shadowExtraBottom?: number;
  shadowExtraLeft?: number;
  shadowExtraRight?: number;
}

export interface CameraSpaceBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface OrthoFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
  height: number;
  width: number;
}

export function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function computeOrthographicFit(input: OrthoFitInput): OrthoFitResult | null {
  const points = input.points.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!points.length) return null;
  const aspect = Number.isFinite(input.aspect) && input.aspect > 0 ? input.aspect : 1;
  const padding = Math.max(0, Number.isFinite(input.padding) ? input.padding : 0.12);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  let width = Math.max(maxX - minX, 0.001) * (1 + padding * 2);
  let height = Math.max(maxY - minY, 0.001) * (1 + padding * 2);
  const minHeight = Number.isFinite(input.minHeight) && input.minHeight! > 0 ? input.minHeight! : 0;
  height = Math.max(height, minHeight);

  if (width / height < aspect) {
    width = height * aspect;
  } else {
    height = width / aspect;
  }

  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY + height / 2,
    bottom: centerY - height / 2,
    width,
    height,
    centerX,
    centerY,
  };
}

export function frustumFromOrthoHeight(orthoHeight: number, aspect: number, screenOffsetX = 0, screenOffsetY = 0): OrthoFrustum {
  const height = Math.max(0.001, Number.isFinite(orthoHeight) ? orthoHeight : 1);
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const width = height * safeAspect;
  const offsetX = width * clampFinite(screenOffsetX, -1, 1);
  const offsetY = height * clampFinite(screenOffsetY, -1, 1);
  return {
    left: -width / 2 + offsetX,
    right: width / 2 + offsetX,
    top: height / 2 + offsetY,
    bottom: -height / 2 + offsetY,
    height,
    width,
  };
}

export function cameraSpaceBounds(points: Array<[number, number]>): CameraSpaceBounds | null {
  const finite = points.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!finite.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of finite) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return {minX, maxX, minY, maxY};
}

export function requiredOrthoHeight(bounds: CameraSpaceBounds, aspect: number, safety: RingViewSafetyLike): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const rawWidth = Math.max(0.001, bounds.maxX - bounds.minX);
  const rawHeight = Math.max(0.001, bounds.maxY - bounds.minY);
  const left = Math.max(0, finiteOr(safety.paddingLeft, 0));
  const right = Math.max(0, finiteOr(safety.paddingRight, 0));
  const top = Math.max(0, finiteOr(safety.paddingTop, 0));
  const bottom = Math.max(0, finiteOr(safety.paddingBottom, 0));
  const shadowLeft = safety.includeShadowEnvelope ? Math.max(0, finiteOr(safety.shadowExtraLeft, 0)) : 0;
  const shadowRight = safety.includeShadowEnvelope ? Math.max(0, finiteOr(safety.shadowExtraRight, 0)) : 0;
  const shadowBottom = safety.includeShadowEnvelope ? Math.max(0, finiteOr(safety.shadowExtraBottom, 0)) : 0;
  const width = rawWidth * (1 + left + right + shadowLeft + shadowRight);
  const height = rawHeight * (1 + top + bottom + shadowBottom);
  return Math.max(height, width / safeAspect);
}

export function effectiveOrthoHeight(authoredHeight: number, requiredHeight: number, fitMode: "auto" | "fixed" | "zoom-out-only"): number {
  const authored = Math.max(0.001, finiteOr(authoredHeight, 1));
  const required = Math.max(0.001, finiteOr(requiredHeight, authored));
  if (fitMode === "fixed") return authored;
  if (fitMode === "zoom-out-only") return Math.max(authored, required);
  return required;
}

export function unionBounds(a: CameraSpaceBounds | null, b: CameraSpaceBounds | null): CameraSpaceBounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clampFinite(value: number | undefined, min: number, max: number): number {
  const n = finiteOr(value, 0);
  return Math.max(min, Math.min(max, n));
}
