import {Vector3} from "@babylonjs/core/Maths/math.vector";
import {Quaternion} from "@babylonjs/core";
import {cRing, iInterpolateResult} from "./cRing";

export class CVertex {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  u: number = 0;
  v: number = 0;
  l: number = 0;
  i: number = -1; // index
  a?: number;

  constructor(x: number = 0.0, y: number = 0.0, z: number = 0) {

    this.x = x;
    this.y = y;
    this.z = z;

    this.u = x;
    this.v = y;
  }

  assign(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static fromVertex(v: CVertex): CVertex {
    let R = new CVertex(v.x, v.y, v.z);
    R.u = v.u;
    R.v = v.v;
    R.i = v.i;
    return R;
  }

  // TODO: hier ist ein Fehler drin!!!!!  ==> v1.y * v1.y muss sein: v1.y * v2.y
  static dot(v1: CVertex, v2: CVertex): number {
    // Skalarprodukt
    return v1.x * v2.x + v1.y * v1.y + v1.z * v2.z;
  }

  static cross(v1: CVertex, v2: CVertex): CVertex {
    // Kreuzprodukt -> Normale
    let R = new CVertex();
    return CVertex.crossToRef(v1, v2, R);
  }

  static crossToRef(v1: CVertex, v2: CVertex, ref: CVertex): CVertex {
    // Kreuzprodukt -> Normale
    ref.x = v1.y * v2.z - v1.z * v2.y;
    ref.y = v1.z * v2.x - v1.x * v2.z;
    ref.z = v1.x * v2.y - v1.y * v2.x;
    return ref;
  }

  static angle(vertex0: CVertex, vertex1: CVertex, normal: CVertex): number {
    let v0 = TEMP.Vertex_1, v1 = TEMP.Vertex_2;
    vertex0.toRef(v0).normalize();
    vertex1.toRef(v1).normalize();
    let dot = CVertex.dot(v0, v1);
    let angle = Math.acos(dot);
    let n = TEMP.Vertex_3;
    CVertex.crossToRef(v0, v1, n);
    if (CVertex.dot(n, normal) > 0)
      return isNaN(angle) ? 0 : angle;
    return isNaN(angle) ? -Math.PI : -Math.acos(dot);
  }

  static angleXY(v1: CVertex, v2: CVertex): number {
    // cos(alpha) = dot(a,b) / (abs(a) * abs(b))
    let a = v1.x * v2.x + v1.y * v2.y;
    let b = Math.sqrt(v1.x * v1.x + v1.y * v1.y) * Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (a == 0 || b == 0) return 0.0;
    return Math.acos(a / b);
  }

  static angleXZ(v1: CVertex, v2: CVertex): number {
    // cos(alpha) = dot(a,b) / (abs(a) * abs(b))
    let a = v1.x * v2.x + v1.z * v2.z;
    let b = Math.sqrt(v1.x * v1.x + v1.z * v1.z) * Math.sqrt(v2.x * v2.x + v2.z * v2.z);
    if (a == 0 || b == 0) return 0.0;
    return Math.acos(a / b);
  }

  static angleYZ(v1: CVertex, v2: CVertex): number {
    // cos(alpha) = dot(a,b) / (abs(a) * abs(b))
    let a = v1.y * v2.y + v1.z * v2.z;
    let b = Math.sqrt(v1.y * v1.y + v1.z * v1.z) * Math.sqrt(v2.y * v2.y + v2.z * v2.z);
    if (a == 0 || b == 0) return 0.0;
    return Math.acos(a / b);
  }

  static rotationFromAxisToRef(axis1: CVertex, axis2: CVertex, axis3: CVertex, ref: CVertex): CVertex {
    let quaternion = TEMP.Quaternion_1;
    CQuaternion.rotationQuaternionFromAxisToRef(axis1, axis2, axis3, quaternion);
    quaternion.toEulerAnglesToRef(ref);
    return ref;
  }

  static getVerticesDimensions(vertices: CVertex[]): object {
    let minX = 99999.0, minY = 99999.0, minZ = 99999.0, maxX = -99999.0, maxY = -99999.0, maxZ = -99999.0, i,
      l = vertices.length, v: CVertex;

    for (i = 0; i < l; i++) {
      v = vertices[i];
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
      if (v.z > maxZ) maxZ = v.z;
    }

    return {
      cx: maxX - minX,
      xy: maxY - minY,
      cz: maxZ - minZ
    }
  }

  static getVerticesLength(vertices: CVertex[]): number {
    let R = 0.0, i, l = vertices.length, A = vertices[0], B;

    for (i = 1; i < l; i++) {
      B = vertices[i];
      R += A.distance(B);
      A = B;
    }

    return R;
  }

  static lerpToRef(start: CVertex, end: CVertex, amount: number, ref: CVertex): CVertex {
    ref.x = start.x + ((end.x - start.x) * amount);
    ref.y = start.y + ((end.y - start.y) * amount);
    ref.z = start.z + ((end.z - start.z) * amount);
    ref.u = start.u + ((end.u - start.u) * amount);
    ref.v = start.v + ((end.v - start.v) * amount);
    return ref;
  };

  static midpoint(v1: CVertex, v2: CVertex): CVertex {
    let result = new CVertex;
    result.x = (v1.x + v2.x) / 2;
    result.y = (v1.y + v2.y) / 2;
    result.z = (v1.z + v2.z) / 2;
    return result;
  }

  toVector3(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  toRef(ref: CVertex): CVertex {
    ref.x = this.x;
    ref.y = this.y;
    ref.z = this.z;
    ref.u = this.u;
    ref.v = this.v;
    ref.i = this.i;
    return ref;
  }

  add(v: CVertex): CVertex {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.u += v.u;
    this.v += v.v;
    return this;
  }

  addToRef(v: CVertex, ref: CVertex): CVertex {
    ref.x = this.x + v.x;
    ref.y = this.y + v.y;
    ref.z = this.z + v.z;
    ref.u = this.u + v.u;
    ref.v = this.v + v.v;
    return ref;
  }

  addToNew(v: CVertex): CVertex {
    let r = CVertex.fromVertex(this);
    r.add(v);
    return r;
  }

  sub(v: CVertex): CVertex {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.u -= v.u;
    this.v -= v.v;
    return this;
  }

  subToRef(v: CVertex, ref: CVertex): CVertex {
    ref.x = this.x - v.x;
    ref.y = this.y - v.y;
    ref.z = this.z - v.z;
    ref.u = this.u - v.u;
    ref.v = this.v - v.v;
    return ref;
  }

  subToNew(v: CVertex): CVertex {
    let r = CVertex.fromVertex(this);
    r.sub(v);
    return r;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  distance(v: CVertex): number {
    let x = this.x - v.x;
    let y = this.y - v.y;
    let z = this.z - v.z;
    return Math.sqrt(x * x + y * y + z * z);
  }

  scale(s: number | number[]): CVertex {
    if (Array.isArray(s) && s.length == 3) {
      this.x *= s[0];
      this.y *= s[1];
      this.z *= s[2];
    } else {
      this.x *= <number>s;
      this.y *= <number>s;
      this.z *= <number>s;
      this.u *= <number>s;
      this.v *= <number>s;
    }
    return this;
  }

  scaleToRef(s: number, ref: CVertex): CVertex {
    ref.x = this.x * s;
    ref.y = this.y * s;
    ref.z = this.z * s;
    ref.u = this.u * s;
    ref.v = this.v * s;
    return ref;
  }

  normalize(): CVertex {
    let s = this.length();
    s = s == 0.0 ? 1.0 : s;
    this.scale(1.0 / s);
    return this;
  }

  rotateX(rad: number, origin: CVertex | null = null): CVertex {
    if (origin) {
      this.y -= origin.y;
      this.z -= origin.z;
    }

    let y = this.y * Math.cos(rad) - this.z * Math.sin(rad);
    let z = this.y * Math.sin(rad) + this.z * Math.cos(rad);
    this.y = y;
    this.z = z;

    if (origin) {
      this.y += origin.y;
      this.z += origin.z;
    }

    return this;
  }

  rotateY(rad: number, origin: CVertex | null = null): CVertex {
    if (origin) {
      this.x -= origin.x;
      this.z -= origin.z;
    }

    let x = this.x * Math.cos(rad) + this.z * Math.sin(rad);
    let z = -this.x * Math.sin(rad) + this.z * Math.cos(rad);
    this.x = x;
    this.z = z;

    if (origin) {
      this.x += origin.x;
      this.z += origin.z;
    }
    return this;
  }

  rotateZ(rad: number, origin: CVertex | null = null): CVertex {
    if (origin) {
      this.x -= origin.x;
      this.y -= origin.y;
    }

    let x = this.x * Math.cos(rad) - this.y * Math.sin(rad);
    let y = this.x * Math.sin(rad) + this.y * Math.cos(rad);
    this.x = x;
    this.y = y;

    if (origin) {
      this.x += origin.x;
      this.y += origin.y;
    }
    return this;
  }

  rotateAroundAxis(axis: CVertex, angleInRadians: number): CVertex {
    const cosTheta = Math.cos(angleInRadians);
    const sinTheta = Math.sin(angleInRadians);

    // Normalisiere den Achsenvektor
    const normalizedAxis = axis.normalize();

    // Berechne die Bestandteile der Rotationsformel
    const term1 = new CVertex();
    this.scaleToRef(cosTheta, term1);
    const term2 = CVertex.cross(normalizedAxis, this).scale(sinTheta);
    const term3 = normalizedAxis.scale(CVertex.dot(normalizedAxis, this) * (1 - cosTheta));

    // Addiere die Bestandteile, um den neuen Vektor zu erhalten
    const rotatedVector = term1.add(term2).add(term3);

    return rotatedVector;
  }

  lerpToRef(v: CVertex, amount: number, ref: CVertex): CVertex {
    ref.x = this.x + ((v.x - this.x) * amount);
    ref.y = this.y + ((v.y - this.y) * amount);
    ref.z = this.z + ((v.z - this.z) * amount);
    ref.u = this.u + ((v.u - this.u) * amount);
    ref.v = this.v + ((v.v - this.v) * amount);
    return ref;
  }
}

/*
export class MathUtility {
    static MinAngle(a:CVertex, b:CVertex, c:CVertex):number {

    }
}
export class CVertexPath {
    internal = {
        path: [] as CVertex[],
        tangents:[] as CVertex[],
        normals:[] as CVertex[],
        len: 0,
    }

    constructor(path: CVertex[]) {
        this.internal.path = path;
        let l = 0, i, i_l = path.length, A, B, localAngle, angleFromPrevVertex, angleError;

        for (i = 1; i < i_l; i++) {
            l += path[i - 1].distance(path[i]);

            A = path[i-1];
            B = path[i];

            // angle at current point on path
            localAngle = 180 - MathUtility.MinAngle(prevPointOnPath, pointOnPath, nextPointOnPath);
            // angle between the last added vertex, the current point on the path, and the next point on the path
            angleFromPrevVertex = 180 - MathUtility.MinAngle(lastAddedPoint, pointOnPath, nextPointOnPath);
            angleError = Mathf.Max(localAngle, angleFromPrevVertex);


            if ((angleError > maxAngleError && dstSinceLastVertex >= minVertexDst) || isLastPointOnPath)
            {

                currentPathLength += (lastAddedPoint - pointOnPath).magnitude;
                splitData.cumulativeLength.Add(currentPathLength);
                splitData.vertices.Add(pointOnPath);
                splitData.tangents.Add(CubicBezierUtility.EvaluateCurveDerivative(segmentPoints, t).normalized);
                splitData.minMax.AddValue(pointOnPath);
                dstSinceLastVertex = 0;
                lastAddedPoint = pointOnPath;
            }
        }

        this.internal.len = l;
    }

    /!*
    distance: 0.0 = begin of path, 1.0 = end of path
     *!/
    getDirection(distance: number) {

        let that = this;

        /// For a given value 't', calculate the indices of the two vertices before and after t.
        /// Also calculate how far t is between those two vertices as a percentage between 0 and 1.
        let calcPercentOnPathData = function (t: number) {
            let i, i_l = that.internal.len, posA = 0.0, posB = 0.0, path = that.internal.path,
                prevIndex = 0, nextIndex = 1, abPercent = 0;
            for (i = 1; i < i_l; i++) {
                posB = posA + path[i - 1].distance(path[i]);

                if (posA <= t && posB >= t) {
                    prevIndex = i - 1;
                    nextIndex = i;
                    abPercent = (t - posA) / (posB - posA);
                    break;
                }

                posA = posB;
            }

            return {
                prevIndex,
                nextIndex,
                abPercent
            };
        }

        let data = calcPercentOnPathData(distance * this.internal.len);
        let dir = new CVertex;
        CVertex.lerpToRef(this.internal.tangents[data.prevIndex], this.internal.tangents[data.nextIndex], data.abPercent, ref);
        // var data = CalculatePercentOnPathData (t, endOfPathInstruction);
        // Vector3 dir = Vector3.Lerp (localTangents[data.previousIndex], localTangents[data.nextIndex], data.percentBetweenIndices);
        // return MathUtility.TransformDirection (dir, transform, space);

    }

    getNormal(distance: number) {

        let t = distance / this.internal.len;
    }

    getRotation(distance: number) {

        let t = distance / this.internal.len;
    }


}

*/
export class CMatrix {
  m: number[];

  constructor() {
    this.m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  reset(): CMatrix {
    CMatrix.fromValuesToRef(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, this);
    return this;
  }

  static fromValuesToRef(initialM11: number, initialM12: number, initialM13: number, initialM14: number, initialM21: number, initialM22: number, initialM23: number, initialM24: number, initialM31: number, initialM32: number, initialM33: number, initialM34: number, initialM41: number, initialM42: number, initialM43: number, initialM44: number, ref: CMatrix) {
    ref.m[0] = initialM11;
    ref.m[1] = initialM12;
    ref.m[2] = initialM13;
    ref.m[3] = initialM14;
    ref.m[4] = initialM21;
    ref.m[5] = initialM22;
    ref.m[6] = initialM23;
    ref.m[7] = initialM24;
    ref.m[8] = initialM31;
    ref.m[9] = initialM32;
    ref.m[10] = initialM33;
    ref.m[11] = initialM34;
    ref.m[12] = initialM41;
    ref.m[13] = initialM42;
    ref.m[14] = initialM43;
    ref.m[15] = initialM44;
  }

  static fromXYZAxesToRef(xAxis: CVertex, yAxis: CVertex, zAxis: CVertex, ref: CMatrix) {
    CMatrix.fromValuesToRef(xAxis.x, xAxis.y, xAxis.z, 0.0, yAxis.x, yAxis.y, yAxis.z, 0.0, zAxis.x, zAxis.y, zAxis.z, 0.0, 0.0, 0.0, 0.0, 1.0, ref);
  }
}

export class CQuaternion {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  w: number = 0;

  constructor(x: number, y: number, z: number, w: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
//            this.x = w == 0 ? 1.0 : w; // aus Version 1: hat sich hier ein Fehler eingeschlichen ?
  }

  toEulerAnglesToRef(ref: CVertex): CVertex {
    let qz = this.z, qx = this.x, qy = this.y, qw = this.w, sqw = qw * qw, sqz = qz * qz, sqx = qx * qx,
      sqy = qy * qy, zAxisY = qy * qz - qx * qw, limit = .4999999;

    if (zAxisY < -limit) {
      ref.y = 2 * Math.atan2(qy, qw);
      ref.x = Math.PI / 2;
      ref.z = 0;
    } else if (zAxisY > limit) {
      ref.y = 2 * Math.atan2(qy, qw);
      ref.x = -Math.PI / 2;
      ref.z = 0;
    } else {
      ref.z = Math.atan2(2.0 * (qx * qy + qz * qw), (-sqz - sqx + sqy + sqw));
      ref.x = Math.asin(-2.0 * (qz * qy - qx * qw));
      ref.y = Math.atan2(2.0 * (qz * qx + qy * qw), (sqz - sqx - sqy + sqw));
    }

    return ref;
  }

  static fromRotationMatrixToRef(matrix: CMatrix, ref: CQuaternion): CQuaternion {
    let data = matrix.m, m11 = data[0], m12 = data[4], m13 = data[8], m21 = data[1], m22 = data[5], m23 = data[9],
      m31 = data[2], m32 = data[6], m33 = data[10], trace = m11 + m22 + m33, s;
    if (trace > 0) {
      s = 0.5 / Math.sqrt(trace + 1.0);
      ref.w = 0.25 / s;
      ref.x = (m32 - m23) * s;
      ref.y = (m13 - m31) * s;
      ref.z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      ref.w = (m32 - m23) / s;
      ref.x = 0.25 * s;
      ref.y = (m12 + m21) / s;
      ref.z = (m13 + m31) / s;
    } else if (m22 > m33) {
      s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      ref.w = (m13 - m31) / s;
      ref.x = (m12 + m21) / s;
      ref.y = 0.25 * s;
      ref.z = (m23 + m32) / s;
    } else {
      s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      ref.w = (m21 - m12) / s;
      ref.x = (m13 + m31) / s;
      ref.y = (m23 + m32) / s;
      ref.z = 0.25 * s;
    }

    return ref;
  }

  static rotationQuaternionFromAxisToRef(axis1: CVertex, axis2: CVertex, axis3: CVertex, ref: CQuaternion): CQuaternion {
    let rotMat = TEMP.Matrix_1;
    CMatrix.fromXYZAxesToRef(axis1.normalize(), axis2.normalize(), axis3.normalize(), rotMat);
    return CQuaternion.fromRotationMatrixToRef(rotMat, ref);
  }
}

export interface iMeshData {
  // extra: any;
  indices: number[];
  normals: number[];
  positions: number[];
  uvs: number[];
  index: number;
  type: string;
  outline?: CVertex[];
  rows?: CVertex[][];
}

export interface iPathVectors {
  distances: number[];
  positions: CVertex[];
  normals: CVertex[];
  binormals: CVertex[];
  tangents: CVertex[];
}

export class CMesh {
  rows: CVertex[][] = [] as CVertex[][];
  indices: number[] = [] as number[];
  normals: number[] = [] as number[];

  constructor() {
  }

  triangulate(isFrontFace: boolean = true, useVectorDist: boolean = true): void {
    let obj = {useVectorDist: useVectorDist};

    let rows = this.rows, len = rows.length,
      i: number, nA: number, nB: number, iA: number, iB: number, distAD: number, distBC: number,
      vecCnull: CVertex, vecDnull: CVertex, A: CVertex, B: CVertex, C: CVertex | null, D: CVertex | null;
    this.indices = [];

    let iC, iD;

    for (i = 0; i < len - 1; i++) {
      nA = rows[i].length;
      nB = rows[i + 1].length;
      iA = 0;
      iB = 0;

      while (1) {

        A = rows[i][iA];
        B = rows[i + 1][iB];

        iC = iA + 1;
        iD = iB + 1;

        if (iC < nA)
          C = rows[i][iC];
        else
          C = null;

        if (iD < nB)
          D = rows[i + 1][iD];
        else
          D = null;

        if (useVectorDist) {
          if (C && D) {
            distAD = A.distance(D);
            distBC = B.distance(C);

            if (distAD < distBC) {
              if (isFrontFace) {
                this.indices.push(B.i, A.i, D.i);
                // this.indices.push(A.i, C.i, D.i);
              } else {
                this.indices.push(D.i, A.i, B.i);
                // this.indices.push(D.i, C.i, A.i);
              }
              if (iB < nB - 1)
                iB++;
            } else {
              if (isFrontFace) {
                this.indices.push(B.i, A.i, C.i);
                // this.indices.push(B.i, A.i, C.i);
              } else {
                this.indices.push(C.i, A.i, B.i);
                // this.indices.push(C.i, A.i, B.i);
              }

              if (iA < nA - 1)
                iA++;
            }
          } else if (C) {
            if (isFrontFace)
              this.indices.push(B.i, A.i, C.i);
            else
              this.indices.push(C.i, A.i, B.i);
            if (iA < nA - 1)
              iA++;
          } else if (D) {
            if (isFrontFace)
              this.indices.push(B.i, A.i, D.i);
            else
              this.indices.push(D.i, A.i, B.i);
            if (iB < nB - 1)
              iB++;
          } else break;
        } else {
          if (C && D) {
            if (isFrontFace) {
              this.indices.push(B.i, A.i, D.i);
              this.indices.push(A.i, C.i, D.i);
            } else {
              this.indices.push(D.i, A.i, B.i);
              this.indices.push(D.i, C.i, A.i);
            }
            if (iA < nA - 1)
              iA++;
            if (iB < nB - 1)
              iB++;
          } else if (C) {
            if (isFrontFace)
              this.indices.push(B.i, A.i, C.i);
            else
              this.indices.push(C.i, A.i, B.i);
            if (iA < nA - 1)
              iA++;
          } else if (D) {
            if (isFrontFace)
              this.indices.push(B.i, A.i, D.i);
            else
              this.indices.push(D.i, A.i, B.i);
            if (iB < nB - 1)
              iB++;
          } else break;

        }


        // if (iA >= nA - 1 && iB >= nB - 1) break;

      }
    }
  }

  /*
      triangulate(isFrontFace: boolean = true, useVectorDist: boolean = true): void {
          let obj = {useVectorDist: useVectorDist};

          let rows = this.rows, len = rows.length,
              i: number, nA: number, nB: number, iA: number, iB: number, distAD: number, distBC: number,
              vecCnull: CVertex, vecDnull: CVertex, A: CVertex, B: CVertex, C: CVertex | null, D: CVertex | null;
          this.indices = [];

          let iC, iD;

          for (i = 0; i < len - 1; i++) {
              nA = rows[i].length;
              nB = rows[i + 1].length;
              iA = 0;
              iB = 0;

              while (1) {

                  A = rows[i][iA];
                  B = rows[i + 1][iB];

                  iC = iA + 1;
                  iD = iB + 1;

                  if (iC < nA)
                      C = rows[i][iC];
                  else
                      C = null;

                  if (iD < nB)
                      D = rows[i + 1][iD];
                  else
                      D = null;

                  if (C && D) {
                      distAD = A.distance(D);
                      distBC = B.distance(C);

                      if (distAD < distBC) {
                          if (isFrontFace) {
                              this.indices.push(B.i, A.i, D.i);
                              this.indices.push(A.i, C.i, D.i);
                          } else {
                              this.indices.push(D.i, A.i, B.i);
                              this.indices.push(D.i, C.i, A.i);
                          }
                      } else {
                          if (isFrontFace) {
                              this.indices.push(B.i, C.i, D.i);
                              this.indices.push(B.i, A.i, C.i);
                          } else {
                              this.indices.push(D.i, C.i, B.i);
                              this.indices.push(C.i, A.i, B.i);
                          }
                      }
                  } else if (C) {
                      if (isFrontFace)
                          this.indices.push(B.i, A.i, C.i);
                      else
                          this.indices.push(C.i, A.i, B.i);
                  } else if (D) {
                      if (isFrontFace)
                          this.indices.push(B.i, A.i, D.i);
                      else
                          this.indices.push(D.i, A.i, B.i);
                  } else break;

                  if (iA < nA - 1)
                      iA++;
                  if (iB < nB - 1)
                      iB++;

                  // if (iA >= nA - 1 && iB >= nB - 1) break;

              }
          }
      }
  */

  /*
      triangulate(isFrontFace: boolean = true, useVectorDist: boolean = true): void {

          let rows = this.rows, len = rows.length,
              i: number, nA: number, nB: number, iA: number, iB: number, distAD: number, distBC: number,
              vecCnull: CVertex, vecDnull: CVertex, A: CVertex, B: CVertex, C: CVertex, D: CVertex;
          this.indices = [];

          for (i = 0; i < len - 1; i++) {
              nA = rows[i].length;
              nB = rows[i + 1].length;
              iA = 0;
              iB = 0;
              if (0) {
                  // 210628: erzeugte Fehler in der Materialteilung am Rand unter 0.5mm
                  vecCnull = new CVertex();
                  vecDnull = new CVertex();
              } else {
                  vecCnull = new CVertex(999999.0, -999999.0, 999999.0);
                  vecDnull = new CVertex(999999.0, -999999.0, 999999.0);
              }

              while (1) {
                  A = rows[i][iA];
                  B = rows[i + 1][iB];
                  // C = (iA < nA - 1 ? rows[i][iA + 1] : rows[i][iA - 1]);
                  // D = (iB < nB - 1 ? rows[i + 1][iB + 1] : rows[i + 1][iB - 1]);
                  C = (iA < nA - 1 ? rows[i][iA + 1] : vecCnull);
                  D = (iB < nB - 1 ? rows[i + 1][iB + 1] : vecDnull);

                  /!*
                                  if (A == NULL) {
                                      echo
                                      i.
                                      " ".iA.
                                      " ".nA;
                                      print_r(rows);
                                      exit;
                                  }
                  *!/
                  if (useVectorDist) {
                      distAD = A.distance(D);
                      distBC = B.distance(C);

                      if (distAD <= distBC) {
                          if (isFrontFace)
                              this.indices.push(B.i, A.i, D.i);
                          else
                              this.indices.push(B.i, D.i, A.i);
                          if (iB < nB - 1) // neu 210628: testen
                              iB++;
                      } else {
                          if (isFrontFace)
                              this.indices.push(B.i, A.i, C.i);
                          else
                              this.indices.push(B.i, C.i, A.i);
                          if (iA < nA - 1) // neu 210628: testen
                              iA++;
                      }
                  } else {
                      if (B.i > -1 && A.i > -1 && D.i > -1) {
                          if (isFrontFace)
                              this.indices.push(B.i, A.i, D.i);
                          else
                              this.indices.push(B.i, D.i, A.i);
                      }

                      if (D.i > -1 && A.i > -1 && C.i > -1) {
                          if (isFrontFace)
                              this.indices.push(D.i, A.i, C.i);
                          else
                              this.indices.push(D.i, C.i, A.i);
                      }

                      if (iB < nB - 1)
                          iB++;
                      if (iA < nA - 1)
                          iA++;
                  }

                  if (iA >= nA - 1 && iB >= nB - 1) break;
              }
          }
      }
  */

  test_triangulate3D() {

    /*
    - ermittle von jedem Punkt den Abstand zum Nullpunkt und füge die Punkte entsprechend dem Abstand in eine geordnete Liste ein
    - trianguliere immer die 3 kleinsten Abstände bis die liste leer ist
     */

    let points = [];
    let i, i_l = this.rows.length, j, j_l, rows = this.rows, row;

    for (i = 0; i < i_l; i++) {
      row = rows[i];
      j_l = row.length;
      for (j = 0; j < j_l; j++) {
        points.push(row[j]);
      }
    }

    let p0 = new CVertex(0, 0, 0);

    points.sort(function (a, b) {
      return a.distance(p0) - b.distance(p0);
    })

    console.log("triangulate3D result:", points);
  }

  rotateRows(radius: number, thetaExtra: number = 0.0) {
    /*
     * Vertex->x:
     * Vertex->y: definiert den Winkel in Rad (0.0-1.0) zum Vollkreis
     * Vertex->z:
     *
     * - berechne aus Y den Drehwinkel
     * - setze Y auf 0.0
     * - verschiebe den Vector in -Z um den angegebenen Radius
     * - drehe den Vector und schreibe die neuen Werte zurück in den Vector
     */

    let circumference = radius * 2.0 * Math.PI, row: number, i: number, theta: number, v: CVertex,
      l_rows = this.rows.length, l_i: number;

    for (row = 0; row < l_rows; row++) {
      l_i = this.rows[row].length;
      for (i = 0; i < l_i; i++) {
        v = this.rows[row][i];

        theta = (v.y / circumference) * Math.PI * 2;
        theta += thetaExtra;
        // v.origY = v.y;
        v.y = 0.0;
        v.z -= radius;
        // v.radius = radius;
        v.rotateX(theta);
      }
    }
  }

  /*
  gleicht die Normalen der beiden Meshes an.
  letzter Vertice der Reihe aus Mesh A mit ersten Vertice der Reihe aus Mesh B
   */
  static equalNormals(A: iMeshData, B: iMeshData) {
    if (!A.rows || !B.rows || A.rows.length != B.rows.length) return;
    if (A.rows.length < 2 || B.rows.length < 2) return;
    if (A.indices.length == 0) return;
    if (B.indices.length == 0) return;

    let pa: CVertex, pb: CVertex;
    let i, row;

    for (i = 0; i < A.rows.length; i++) {
      row = A.rows[i];
      pa = row[row.length - 1];
      row = B.rows[i];
      pb = row[0];

      A.normals[pa.i * 3] = (A.normals[pa.i * 3] + B.normals[pb.i * 3]) * 0.5;
      A.normals[pa.i * 3 + 1] = (A.normals[pa.i * 3 + 1] + B.normals[pb.i * 3 + 1]) * 0.5;
      A.normals[pa.i * 3 + 2] = (A.normals[pa.i * 3 + 2] + B.normals[pb.i * 3 + 2]) * 0.5;
      B.normals[pb.i * 3] = A.normals[pa.i * 3];
      B.normals[pb.i * 3 + 1] = A.normals[pa.i * 3 + 1];
      B.normals[pb.i * 3 + 2] = A.normals[pa.i * 3 + 2];
    }

    //Normalize all the normals
    /*
            let x, y, z, l;
            for (let i = 0; i < A.normals.length; i += 3) {
                x = A.normals[i];
                y = A.normals[i + 1];
                z = A.normals[i + 2];
                l = Math.sqrt(x * x + y * y + z * z);
                if (l < 1e-8) {
                    A.normals[i] = 1;
                    A.normals[i + 1] = 0;
                    A.normals[i + 2] = 0;
                    continue
                }

                A.normals[i] /= -l;
                A.normals[i + 1] /= -l;
                A.normals[i + 2] /= -l;
            }

            for (let i = 0; i < B.normals.length; i += 3) {
                x = B.normals[i];
                y = B.normals[i + 1];
                z = B.normals[i + 2];
                l = Math.sqrt(x * x + y * y + z * z);
                if (l < 1e-8) {
                    B.normals[i] = 1;
                    B.normals[i + 1] = 0;
                    B.normals[i + 2] = 0;
                    continue
                }

                B.normals[i] /= -l;
                B.normals[i + 1] /= -l;
                B.normals[i + 2] /= -l;
            }
    */

  }

  /*
      static equalNormals(A: CMesh, B: CMesh) {
          if (A.rows.length != B.rows.length) return;
          if (A.rows.length < 2 || B.rows.length < 2) return;
          if (A.indices.length == 0) A.triangulate();
          if (B.indices.length == 0) B.triangulate();

          let pa: CVertex, pb: CVertex;
          let i, row;

          for (i = 0; i < A.rows.length; i++) {
              row = A.rows[i];
              pa = row[row.length - 1];
              row = B.rows[i];
              pb = row[0];

              A.normals[pa.i*3] = (A.normals[pa.i*3] + B.normals[pb.i*3])*0.5;
              A.normals[pa.i*3+1] = (A.normals[pa.i*3+1] + B.normals[pb.i*3+1])*0.5;
              A.normals[pa.i*3+2] = (A.normals[pa.i*3+2] + B.normals[pb.i*3+2])*0.5;
              B.normals[pb.i*3]=A.normals[pa.i*3];
              B.normals[pb.i*3+1]=A.normals[pa.i*3+1];
              B.normals[pb.i*3+2]=A.normals[pa.i*3+2];
          }

          //Normalize all the normals
          /!*
                  let x, y, z, l;
                  for (let i = 0; i < A.normals.length; i += 3) {
                      x = A.normals[i];
                      y = A.normals[i + 1];
                      z = A.normals[i + 2];
                      l = Math.sqrt(x * x + y * y + z * z);
                      if (l < 1e-8) {
                          A.normals[i] = 1;
                          A.normals[i + 1] = 0;
                          A.normals[i + 2] = 0;
                          continue
                      }

                      A.normals[i] /= -l;
                      A.normals[i + 1] /= -l;
                      A.normals[i + 2] /= -l;
                  }

                  for (let i = 0; i < B.normals.length; i += 3) {
                      x = B.normals[i];
                      y = B.normals[i + 1];
                      z = B.normals[i + 2];
                      l = Math.sqrt(x * x + y * y + z * z);
                      if (l < 1e-8) {
                          B.normals[i] = 1;
                          B.normals[i + 1] = 0;
                          B.normals[i + 2] = 0;
                          continue
                      }

                      B.normals[i] /= -l;
                      B.normals[i + 1] /= -l;
                      B.normals[i + 2] /= -l;
                  }
          *!/

      }
  */

  computeWeightedAngleNormals(close: boolean = false): boolean {
    if (this.rows.length < 2)
      return false;
    if (this.indices.length == 0)
      this.triangulate();

    let numFaces = this.indices.length / 3,
      normals: number[][] = [],
      nA: number[], nB: number[],
      positions: CVertex[] = [],
      row, l_rows = this.rows.length,
      i, l_i, l,
      p1, p2, p3, n, e1 = new CVertex(), e2 = new CVertex(),
      N = new CVertex(1.0, 0, 0);

    for (row = 0; row < l_rows; row++) {
      for (i = 0, l_i = this.rows[row].length; i < l_i; i++) {
        normals.push([0.0, 0.0, 0.0]);
        positions.push(this.rows[row][i]);
      }
    }

    let angle, f;

    let calcAngleNormal = function (p1: CVertex, p2: CVertex, p3: CVertex, N: CVertex, normalIndex: number) {

      p2.subToRef(p1, e1);
      p2.subToRef(p3, e2);
      e1.normalize();
      e2.normalize();

      angle = 0.0;

      if (CVertex.dot(e1, e2) < 0.0) {
        e2.x = -e2.x;
        e2.y = -e2.y;
        e2.z = -e2.z;
      }

      angle = 2.0 * Math.asin(e1.distance(e2) / 2.0);

      f = angle / Math.PI;

      normals[normalIndex][0] += N.x * f;
      normals[normalIndex][1] += N.y * f;
      normals[normalIndex][2] += N.z * f;
    }

    for (i = 0; i < numFaces; i++) {
      // p1, p2 and p3 are the points in the face (f)
      p1 = positions[this.indices[i * 3]];
      p2 = positions[this.indices[i * 3 + 1]];
      p3 = positions[this.indices[i * 3 + 2]];

      try {
        p2.subToRef(p1, e1);
        p3.subToRef(p1, e2);
      } catch (e) {
        console.log(this)
      }
      CVertex.crossToRef(e1, e2, N);
      N.normalize();

      calcAngleNormal(p3, p1, p2, N, this.indices[i * 3]);
      calcAngleNormal(p1, p2, p3, N, this.indices[i * 3 + 1]);
      calcAngleNormal(p1, p3, p2, N, this.indices[i * 3 + 2]);
    }


    if (close) {
      // 1. und letzte Reihe angleichen
      let len = this.rows[0].length, iA = [], i, last, iB = [];
      for (i = 0; i < len; i++)
        iA.push(this.rows[0][i].i);

      last = this.rows.length - 1;
      len = this.rows[last].length;
      for (i = 0; i < len; i++)
        iB.push(this.rows[last][i].i);

      len = iA.length;

      for (i = 0; i < len; i++) {
        nA = normals[iA[i]];
        nB = normals[iB[i]];
        nA[0] = (nA[0] + nB[0]) * 0.5;
        nA[1] = (nA[1] + nB[1]) * 0.5;
        nA[2] = (nA[2] + nB[2]) * 0.5;
        nB[0] = nA[0];
        nB[1] = nA[1];
        nB[2] = nA[2];
      }
    }

    //Normalize all the normals
    for (let i = 0; i < normals.length; i++) {
      n = normals[i];
      l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
      if (l < 1e-8) {
        n[0] = 1;
        n[1] = 0;
        n[2] = 0;
        continue
      }

      n[0] /= -l;
      n[1] /= -l;
      n[2] /= -l;
    }


    let result = [];
    for (i = 0; i < normals.length; i++)
      result.push(normals[i][0], normals[i][1], normals[i][2]);

    this.normals = result;

    return true;
  }

  serialize(extra = null): iMeshData {
    let obj = {extra: extra};
    // if (!this.isSerialized && isset(this.beforeSerializeFnArray))
    // {
    //     for (i = 0; i < count(this.beforeSerializeFnArray); i++)
    //     {
    //         n = this.beforeSerializeFnArray[i];
    //         if (is_callable([this, n[0]]))
    //             call_user_func_array([this, n[0]], n[1]);
    //     }
    // }

    let R: iMeshData = {
      positions: [] as number[],
      uvs: [] as number[],
      indices: this.indices,
      normals: this.normals,
      index: 0,
      type: ""
    }
    // let R = {
    //     positions: [] as number[],
    //     uvs: [] as number[],
    //     indices: this.indices,
    //     normals: this.normals,
    //     // extra: extra,
    // };

    // if (this.extra)
    //     R.extra = this.extra;

    let row, numRows, i, len, p;
    for (row = 0, numRows = this.rows.length; row < numRows; row++) {
      for (i = 0, len = this.rows[row].length; i < len; i++) {
        p = this.rows[row][i];
        R.positions.push(p.x, p.y, p.z);
        R.uvs.push(p.u, p.v);
      }
    }

    // this.isSerialized = 1;
    return R;
  }

  computePathVectors(): iPathVectors {

    let positions = new Array();
    let distances = new Array();
    let tangents = new Array();
    let normals = new Array();
    let binormals = new Array();

    let distance = 0.0;
    let ref = new CVertex;

    let i, i_l = this.rows.length, row, j, j_l;
    for (i = 0; i < i_l; i++) {
      row = this.rows[i];
      positions[i] = CVertex.fromVertex(row[1]);
      distances[i] = distance;

      if (i > 0) {
        distance += positions[i].subToRef(positions[i - 1], ref).length();
        distances[i] = distance;
      }

      // normals[i] = CVertex.fromVertex(row[2]).sub(row[1]);
      normals[i] = CVertex.fromVertex(row[2]).sub(row[0]);
      if (i == 0)
        tangents[i] = CVertex.fromVertex(this.rows[i + 1][1]).sub(this.rows[i_l - 1][1]);
      else if (i == i_l - 1)
        tangents[i] = CVertex.fromVertex(this.rows[0][1]).sub(this.rows[i_l - 2][1]);
      else
        tangents[i] = CVertex.fromVertex(this.rows[i + 1][1]).sub(this.rows[i - 1][1]);
      binormals[i] = CVertex.cross(normals[i], tangents[i]);

      // Normalen nochmals berechnen...es gab Fehler in der Geometrie
      // normals[i] = CVertex.crossToRef(binormals[i], tangents[i], normals[i]);

      normals[i].normalize();
      binormals[i].normalize();
      tangents[i].normalize();
    }

    return {
      distances,
      positions,
      normals,
      binormals,
      tangents
    }
  }
}

export let TEMP = {
  Matrix_1: new CMatrix(),
  Quaternion_1: new CQuaternion(0, 0, 0, 1.0),

  Vertex_1: new CVertex(),
  Vertex_2: new CVertex(),
  Vertex_3: new CVertex(),
  Vertex_4: new CVertex(),
  Vertex_5: new CVertex(),
}

export function isPowerOf2(v: number) {
  return v && !(v & (v - 1));
}

export interface iPoint {
  x: number;
  y: number;
}

export function calculateIntersection(p1: iPoint, p2: iPoint, p3: iPoint, p4: iPoint) {

  // down part of intersection point formula
  let d1 = (p1.x - p2.x) * (p3.y - p4.y); // (x1 - x2) * (y3 - y4)
  let d2 = (p1.y - p2.y) * (p3.x - p4.x); // (y1 - y2) * (x3 - x4)
  let d = (d1) - (d2);

  if (d == 0) {
    //   throw new Error('Number of intersection points is zero or infinity.');
    return null;
  }

  // upper part of intersection point formula
  let u1 = (p1.x * p2.y - p1.y * p2.x); // (x1 * y2 - y1 * x2)
  let u4 = (p3.x * p4.y - p3.y * p4.x); // (x3 * y4 - y3 * x4)

  let u2x = p3.x - p4.x; // (x3 - x4)
  let u3x = p1.x - p2.x; // (x1 - x2)
  let u2y = p3.y - p4.y; // (y3 - y4)
  let u3y = p1.y - p2.y; // (y1 - y2)

  // intersection point formula

  let px = (u1 * u2x - u3x * u4) / d;
  let py = (u1 * u2y - u3y * u4) / d;

  return {x: px, y: py};
}

export function translateVertexRow(row: CVertex[], x: number, y: number, z: number) {
  row.forEach(function (v) {
    v.x += x;
    v.y += y;
    v.z += z;
  })
}

export function rotateVertexRowZ(row: CVertex[], origin: CVertex, rad: number) {
  row.forEach(function (v) {
    v.rotateZ(rad, origin);
  })
}

/**
 * Extrudiert das 'shape' entlang von 'pfad'
 * Die Hauptrichtung des Pfades sollte in Y-Richtung liegen.

 * @param shape in XZ Koordinaten
 * @param shapeOrigin Ursprungspunkt
 * @param path in XYZ Koordinaten
 */
export function extrude(shape: CVertex[], path: CVertex[], origin: CVertex | undefined = undefined, angleFactor = 1.0): CVertex[][] {
  let result = [] as CVertex[][];

  if (path.length < 2) return result;

  let row: CVertex[];
  let x, y, z, index = 0, v: CVertex;
  let binormal = new CVertex();
  let tangent = new CVertex();
  origin = origin || shape[0];

  for (let i = 0; i < path.length; i++) {

    if (i == 0)
      path[i + 1].subToRef(path[i], tangent);
    else if (i == path.length - 1)
      path[i].subToRef(path[i - 1], tangent);
    else
      path[i + 1].subToRef(path[i - 1], tangent);

    shape[1].toRef(binormal);

    let angle = CVertex.angleXY(tangent, binormal) - Math.PI / 2;

    angle *= angleFactor;

    if (Math.abs(angle) == Math.PI / 2) angle = 0;

    row = [];

    for (let j = 0; j < shape.length; j++) {
      x = path[i].x + (shape[j].x - origin.x);
      y = path[i].y + (shape[j].y - origin.y);
      z = path[i].z + (shape[j].z - origin.z);
      v = new CVertex(x, y, z);
      if (angle !== 0)
        v.rotateZ(-angle, path[i]);
      v.i = index++;
      v.u = x;
      v.v = y;
      row.push(v);
    }

    result.push(row);
  }

  return result;
}

export function extrude_2(shape: CVertex[], path: CVertex[], originShapeIndex: number, angleFactor = 1.0): CVertex[][] {
  let result = [] as CVertex[][];

  if (shape.length < 2 || path.length < 2) return result;

  let row: CVertex[];
  let x, y, z, index = 0, v: CVertex;
  let binormal = new CVertex();
  let tangent = new CVertex();

  if (originShapeIndex < 0) originShapeIndex = 0;
  else if (originShapeIndex > shape.length - 1) originShapeIndex = shape.length - 1;

  let origin = shape[originShapeIndex];
  let shapeBinormalIndex = originShapeIndex < shape.length-1 ? originShapeIndex + 1 : originShapeIndex - 1;
  let shapeBinormal = shape[shapeBinormalIndex];

  for (let i = 0; i < path.length; i++) {

    if (i == 0)
      path[i + 1].subToRef(path[i], tangent);
    else if (i == path.length - 1)
      path[i].subToRef(path[i - 1], tangent);
    else
      path[i + 1].subToRef(path[i - 1], tangent);

    //shape[shapeBinormalIndex].toRef(binormal);

    let angle = CVertex.angleXY(tangent, shapeBinormal) - Math.PI / 2;

    angle *= angleFactor;

    if (Math.abs(angle) == Math.PI / 2) angle = 0;

    row = [];

    for (let j = 0; j < shape.length; j++) {
      x = path[i].x + (shape[j].x - origin.x);
      y = path[i].y + (shape[j].y - origin.y);
      z = path[i].z + (shape[j].z - origin.z);
      v = new CVertex(x, y, z);
      if (angle !== 0)
        v.rotateZ(angle, path[i]);
      v.i = index++;
      v.u = x;
      v.v = y;
      row.push(v);
    }

    result.push(row);
  }

  return result;
}

export function subdivide(vertices: CVertex[]): CVertex[] {
  if (vertices.length < 2) return vertices;

  let result = [] as CVertex[];

  result.push(CVertex.fromVertex(vertices[0]));

  for (let i = 0; i < vertices.length - 1; i++) {

    let a = vertices[i];
    let b = vertices[i + 1];

    let v = new CVertex();
    CVertex.lerpToRef(a, b, 0.5, v);

    result.push(v);
    result.push(CVertex.fromVertex(b));
  }

  return result;
}

// let interpolateDistance = function (x: number, distance: number/*, vecArray:CVertex[] =frontVerticesScaled*/): iInterpolateResult {
//
//   let vecArray = ring.profile.frontVertices;
//   let result = cRing.interpolate(x, vecArray);
//   if (distance == 0) return result;
//
//   if (distance > 0) {
//     let v = new CVertex(result.x, 0, result.z),
//       maxIndex = vecArray.length,
//       indexA,
//       indexB = result.indexVectorB,
//       t;
//
//     while (indexB < maxIndex) {
//
//       t = v.distance(vecArray[indexB]);
//
//       if (t >= distance) {
//         indexA = indexB - 1;
//         let pA = vecArray[indexA];
//         let pB = vecArray[indexB];
//
//         let distance_A = v.distance(pA);
//         let distance_B = t;
//         let distance_AB = distance_A + distance_B;
//
//         let v1 = TEMP.Vertex_1;
//         let scale = distance_A / distance_AB;
//
//         pA.lerpToRef(pB, scale, v1);
//
//         result.x = v1.x;
//         result.z = v1.z;
//         result.uv_u = v1.u;
//         break;
//       }
//
//       distance -= t;
//       vecArray[indexB].toRef(v);
//       indexB++;
//     }
//   } //
//   else //
//   {
//     let v = new CVertex(result.x, 0, result.z),
//       indexA = result.indexVectorA,
//       indexB, t;
//
//     distance = -distance;
//
//     while (indexA > 0) {
//       t = v.distance(vecArray[indexA]);
//       if (t >= distance) {
//         indexB = indexA + 1;
//         let pA = vecArray[indexA];
//         let pB = vecArray[indexB];
//
//         let distance_A = t;
//         let distance_B = v.distance(pB);
//         let distance_AB = distance_A + distance_B;
//
//         let v1 = TEMP.Vertex_1;
//         let scale = distance_B / distance_AB;
//         pB.lerpToRef(pA, scale, v1);
//
//         result.x = v1.x;
//         result.z = v1.z;
//         result.uv_u = v1.u;
//
//         break;
//       }
//
//       distance -= t;
//       vecArray[indexA].toRef(v);
//       indexA--;
//     }
//   }
//
//   return result;
// }

