import { Vector3 } from '@babylonjs/core';
import { CVertex } from './threeD';

export interface iVertexArray {
  vertex2DArray: CVertex[][];
  type: string | 'front' | 'back';
  index: number;
  triangulate_isFrontFace?: boolean;
  triangulate_useVectorDist?: boolean;
  no_outline?: boolean;
  no_rotate?: boolean;
  close_normals?: boolean;
}

export interface iInterpolateResult {
  x: number;
  z: number;
  indexVectorA: number;
  indexVectorB: number;
  uv_u: number;
  startIndex: number;
}

export interface iRingPath {
  len: number;
  points: Vector3[];
  binormals: Vector3[];
  normals: Vector3[];
  tangents: Vector3[];
}
