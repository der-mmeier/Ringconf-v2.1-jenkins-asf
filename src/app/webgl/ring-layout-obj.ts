import {iRingLayoutPreset, iRingPresentationTransform} from "../app.interfaces";

export interface ParsedRingLayout {
  ring0?: iRingPresentationTransform;
  ring1?: iRingPresentationTransform;
}

export interface ObjMarkerLayoutResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  layout?: ParsedRingLayout;
}

type MarkerKind = "ORIGIN" | "X" | "Y" | "Z";
type RingKey = "ring0" | "ring1";
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

const MARKER_RE = /^RCFG_RING([01])_(ORIGIN|X|Y|Z)$/;
const MIN_AXIS_LENGTH = 0.000001;
const MIN_Z_ALIGNMENT = 0.2;

export function parseObjMarkerLayout(text: string, scale = 1): ObjMarkerLayoutResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const factor = Number(scale);
  if (!Number.isFinite(factor) || factor <= 0) {
    return {ok: false, errors: ["Der Positions-Maßstabsfaktor muss größer als 0 sein."], warnings};
  }

  const markers = parseMarkerCentroids(text, errors);
  if (errors.length) return {ok: false, errors, warnings};

  const layout: ParsedRingLayout = {};
  for (const ring of ["ring0", "ring1"] as RingKey[]) {
    const prefix = ring === "ring0" ? "RCFG_RING0" : "RCFG_RING1";
    const present = (["ORIGIN", "X", "Y", "Z"] as MarkerKind[]).filter(kind => markers.has(`${prefix}_${kind}`));
    if (!present.length) continue;
    if (present.length !== 4) {
      for (const kind of ["ORIGIN", "X", "Y", "Z"] as MarkerKind[]) {
        if (!markers.has(`${prefix}_${kind}`)) {
          errors.push(`Marker ${prefix}_${kind} fehlt.`);
        }
      }
      continue;
    }

    const transform = buildTransformFromMarkers(
      markers.get(`${prefix}_ORIGIN`)!,
      markers.get(`${prefix}_X`)!,
      markers.get(`${prefix}_Y`)!,
      markers.get(`${prefix}_Z`)!,
      factor,
      ring === "ring0" ? 0 : 1,
      errors
    );
    if (transform) layout[ring] = transform;
  }

  if (!layout.ring0 && !layout.ring1 && !errors.length) {
    errors.push("Die OBJ-Datei enthält keinen vollständigen Ringsatz.");
  }

  return {ok: errors.length === 0, errors, warnings, layout: errors.length ? undefined : layout};
}

export function layoutPresetFromParsed(id: string, label: string, parsed: ParsedRingLayout): iRingLayoutPreset {
  return {
    id,
    label,
    enabled: true,
    source: "obj-markers",
    ringTransforms: parsed,
  };
}

function parseMarkerCentroids(text: string, errors: string[]): Map<string, Vec3> {
  const markerVertices = new Map<string, Vec3[]>();
  let currentName: string | null = null;
  const lines = String(text || "").split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("o ") || line.startsWith("g ")) {
      const name = line.slice(2).trim().split(/\s+/)[0];
      const marker = MARKER_RE.exec(name);
      currentName = marker ? name : null;
      if (currentName) {
        if (markerVertices.has(currentName)) {
          errors.push(`Marker ${currentName} ist mehrfach vorhanden.`);
        } else {
          markerVertices.set(currentName, []);
        }
      }
      continue;
    }
    if (!currentName || !line.startsWith("v ")) continue;
    const parts = line.split(/\s+/).slice(1, 4).map(Number);
    if (parts.length !== 3 || parts.some(value => !Number.isFinite(value))) {
      errors.push(`Marker ${currentName} enthält ungültige Vertex-Koordinaten.`);
      continue;
    }
    markerVertices.get(currentName)!.push(parts as Vec3);
  }

  const centroids = new Map<string, Vec3>();
  markerVertices.forEach((vertices, name) => {
    if (!vertices.length) {
      errors.push(`Marker ${name} enthält keine Vertices.`);
      return;
    }
    centroids.set(name, centroid(vertices));
  });
  return centroids;
}

function buildTransformFromMarkers(origin: Vec3, xPoint: Vec3, yPoint: Vec3, zPoint: Vec3, scale: number, ringIndex: number, errors: string[]): iRingPresentationTransform | null {
  const x = normalize(sub(xPoint, origin));
  const yRaw = sub(yPoint, origin);
  const zImported = normalize(sub(zPoint, origin));

  if (!x || !zImported || length(yRaw) < MIN_AXIS_LENGTH) {
    errors.push(`Die Achsenmarker für Ring ${ringIndex} sind zu nah am Ursprung.`);
    return null;
  }

  const yOrthogonal = sub(yRaw, scaleVec(x, dot(yRaw, x)));
  const y = normalize(yOrthogonal);
  if (!y) {
    errors.push(`Die Achsenmarker für Ring ${ringIndex} sind nahezu kollinear.`);
    return null;
  }

  const z = normalize(cross(x, y));
  if (!z) {
    errors.push(`Die Achsenmarker für Ring ${ringIndex} ergeben keine gültige Basis.`);
    return null;
  }
  if (dot(z, zImported) < MIN_Z_ALIGNMENT) {
    errors.push(`Die Achsenmarker für Ring ${ringIndex} haben eine falsche Händigkeit oder ein unplausibles Z.`);
    return null;
  }

  return {
    position: [origin[0] * scale, origin[1] * scale, origin[2] * scale],
    rotationQuaternion: quaternionFromBasis(x, y, z),
  };
}

function centroid(vertices: Vec3[]): Vec3 {
  const sum = vertices.reduce<Vec3>((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]], [0, 0, 0]);
  return [sum[0] / vertices.length, sum[1] / vertices.length, sum[2] / vertices.length];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVec(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

function normalize(v: Vec3): Vec3 | null {
  const len = length(v);
  return len > MIN_AXIS_LENGTH ? [v[0] / len, v[1] / len, v[2] / len] : null;
}

function quaternionFromBasis(x: Vec3, y: Vec3, z: Vec3): Quat {
  const m00 = x[0], m01 = y[0], m02 = z[0];
  const m10 = x[1], m11 = y[1], m12 = z[1];
  const m20 = x[2], m21 = y[2], m22 = z[2];
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}
