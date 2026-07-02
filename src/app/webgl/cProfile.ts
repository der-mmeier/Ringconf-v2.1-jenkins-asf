import {
  calculateIntersection,
  CMesh,
  CVertex,
  iMeshData,
  iPathVectors,
  iPoint,
  TEMP,
} from './threeD';
import {Vector3} from "@babylonjs/core";
import {WebglRing} from "./webgl-ring";
import {iPresetStone, iProfileResponse, iStoneSize} from "../app.interfaces";
import {AppComponent} from "../app.component";
import {Log} from "../logger/logger.component";
import {RingData} from "../app.ringdata";

export interface iVertexArray {
  vertex2DArray: CVertex[][];
  type: string | "front" | "back";
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

// export class cProfile {
//   width: number = 0;
//   height: number = 0;
//   area: number = 0; // Fläche des Profils
//   heightFactor: number = 0; // Verhältniss der Höhe zur Ringbreite laut OBJ Daten
//   frontVertices: CVertex[] = [] as CVertex[];
//   backVertices: CVertex[] = [] as CVertex[];
//   channelVertices: CVertex[] = [] as CVertex[]; // Index 12 in der blend/obj-Datei
//
//   middleVertexBack: number[] = [0, 0]; // Anzahl der Punkte bis zur Mittellinie zwischen 3-6 und 5-8, ausgehend von der Front
//   maxVerticeLength: number = 1; // Länge der maximal abgewickelten front- oder backVertices
//
//   sideLength: number[] = [0, 0]; // Die Seitenlänge für die maximale Steingröße wird durch den Abstand der Vektoren V[middleVertexBack[0]-1] und V[middleVertexBack[0]+1] ermittelt
//   sideMidpoint: CVertex[] | null[] = [null, null];
//
//   frontVerticeLength: number = 1;
//   backVerticeLength: number = 1;
//
//   stepLeftVertices: CVertex[] = [] as CVertex[];
//   stepRightVertices: CVertex[] = [] as CVertex[];
//
//   stonePaths: iPathVectors[] = [] as iPathVectors[]; // pro Steingruppe ?!?
//
//   // private constructor() {
//   // }
//
//   static create(prf: iProfileResponse, width: number, height: number, sw: number[] | null = null, sd: number | null = null): cProfile | null {
//     /*
//     back
//     9   10  11
//     6   7   8
//     x---------
//     3   4   5
//     0   1   2
//     front
//
//     ausgehend von 'x' für 'back' im Uhrzeigersinn und für 'front' gegen den Uhrzeigersinn
//
//     für den Kanal: segment_10c
//     */
//
//     if (width <= 0.0 || height <= 0.0) return null;
//
//     let profile: cProfile | null = null;
//
//     // ermittle die Anzahl an gültigen Segmenten
//     let segmentCount = 0;
//     prf.xzs.forEach(function (e, index) {
//       if (e != null) segmentCount++;
//     })
//
//     if (segmentCount == 2 || segmentCount == 3) {
//       if (prf.xzs[0] && prf.xzs[9]) {
//         let setOrigin_topMiddle = function (vertices: CVertex[]) {
//           let xHalf = (vertices[vertices.length - 1].x - vertices[0].x) / 2, z = -9999, x0 = vertices[0].x;
//           vertices.forEach(e => {
//             if (e.z > z) z = e.z;
//           })
//           for (let i = 0, i_l = vertices.length; i < i_l; i++) {
//             vertices[i].x = vertices[i].x - x0 - xHalf;
//             vertices[i].z -= z;
//           }
//         }
//
//         profile = new cProfile();
//         let i, i_l, x = 0, z = 0, t;
//
//         // prf.xzs[9] = back
//         let backVertices = [] as CVertex[];
//         for (i = 0, i_l = prf.xzs[9].length; i < i_l; i++) {
//           if (i == 0) {
//             x = prf.xzs[9][i].x;
//             z = prf.xzs[9][i].z;
//             t = new CVertex(0, 0, 0);
//             backVertices.push(t);
//           } else {
//             t = new CVertex(prf.xzs[9][i].x - x, 0, prf.xzs[9][i].z - z)
//             backVertices.push(t);
//           }
//         }
//
//         setOrigin_topMiddle(backVertices);
//
//         // prf.xzs[0] = front
//         let frontVertices = [] as CVertex[];
//         for (i = 0, i_l = prf.xzs[0].length; i < i_l; i++) {
//           if (i == 0) {
//             x = prf.xzs[0][i].x;
//             z = prf.xzs[0][i].z;
//             t = new CVertex(backVertices[0].x, 0, backVertices[0].z);
//             frontVertices.push(t);
//           } else {
//             t = new CVertex(prf.xzs[0][i].x - x + backVertices[0].x, 0, prf.xzs[0][i].z - z + backVertices[0].z)
//             frontVertices.push(t);
//           }
//         }
//
//         // prf.xzy[12] = cross channel
//         let channelVertices = [] as CVertex[];
//         if (prf.xzs[12] != null) {
//           for (i = 0, i_l = prf.xzs[12].length; i < i_l; i++) {
//
//             if (i == 0) {
//               x = prf.xzs[12][i].x;
//               z = prf.xzs[12][i].z;
//               t = new CVertex(backVertices[0].x, 0, backVertices[0].z);
//               channelVertices.push(t);
//             } else {
//               t = new CVertex(prf.xzs[12][i].x - x + backVertices[0].x, 0, prf.xzs[12][i].z - z + backVertices[0].z)
//               channelVertices.push(t);
//             }
//           }
//         }
//
//         let sizeFrontVertices: any = CVertex.getVerticesDimensions(frontVertices);
//         let sizeBackVertices: any = CVertex.getVerticesDimensions(backVertices);
//
//         let cxVertices = sizeFrontVertices.cx,
//           czVertices = sizeFrontVertices.cz + sizeBackVertices.cz,
//           scaleX = width / cxVertices,
//           scaleZ = height / czVertices;
//
//         for (i = 0, i_l = frontVertices.length; i < i_l; i++) frontVertices[i].scale([scaleX, 1, scaleZ]);
//         for (i = 0, i_l = backVertices.length; i < i_l; i++) backVertices[i].scale([scaleX, 1, scaleZ]);
//
//         if (channelVertices.length)
//           for (i = 0, i_l = channelVertices.length; i < i_l; i++) channelVertices[i].scale([scaleX, 1, scaleZ]);
//
//         profile.frontVertices = frontVertices;
//         profile.backVertices = backVertices;
//         profile.channelVertices = channelVertices;
//         profile.heightFactor = czVertices / cxVertices;
//       } else {
//         Log("error", "Keine gültigen Profildaten!");
//         return null;
//       }
//     } else {
//       // ermittle die Ringhöhe durch den Abstand der mittleren Vertices aus den Segmenten 1 und 10 oder
//       // aus den letzten Vertices aus den Segmenten 0 und 9
//       let prfHeight = 0;
//
//       if (prf.xzs[1] != null && prf.xzs[10] != null)
//         prfHeight = Math.abs(prf.xzs[1][Math.round(prf.xzs[1].length / 2)].z - prf.xzs[10][Math.round(prf.xzs[10].length / 2)].z);
//       else if (prf.xzs[0] != null && prf.xzs[9] != null)
//         prfHeight = Math.abs(prf.xzs[0][prf.xzs[0].length - 1].z - prf.xzs[9][prf.xzs[9].length - 1].z);
//       else
//         return null;
//
//       profile = new cProfile();
//
//       let i, j, v: CVertex[], x, z, cx, t: any;
//
//       // konvertiere die Rohdaten in CVertex Klassen und verschieben auf den NUllpubkt
//       let vertices: CVertex[][] = [] as CVertex[][];
//
//       for (i = 0; i < prf.xzs.length; i++) {
//         if (prf.xzs[i]) {
//           vertices[i] = [] as CVertex[];
//           x = z = 0;
//           for (j = 0; j < prf.xzs[i].length; j++) {
//             // ...und setze den 1. Vertex eines jeden Segmentes auf die Nullposition
//             if (j == 0) {
//               x = prf.xzs[i][j].x;
//               z = prf.xzs[i][j].z;
//               t = new CVertex(0, 0, 0);
//               t.i = prf.xzs[i][j].s;
//               vertices[i].push(t);
//             } else {
//               t = new CVertex(prf.xzs[i][j].x - x, 0, prf.xzs[i][j].z - z)
//               t.i = prf.xzs[i][j].s;
//               vertices[i].push(t);
//             }
//           }
//         } else
//           vertices.push([]);
//       }
//
//       // ermittle die Größen der Reihen und Spalten
//       let rows = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
//       // let cols = [[0, 3, 6, 9], [1, 4, 7, 10], [2, 5, 8, 11]];
//
//       let rowsCX = [0, 0, 0, 0];
//       // let colsCZ = [0, 0, 0, 0];
//
//       // ...Reihen
//       for (i = 0; i < 4; i++) {
//         cx = 0.0;
//         for (j = 0; j < 3; j++) {
//           if (prf.size[rows[i][j]] != null)
//             cx += prf.size[rows[i][j]].cx;
//         }
//         rowsCX[i] = cx;
//       }
//
//       // ...Spalten
//       let profileOriginWidth = rowsCX.reduce(function (a, b) {
//         return Math.max(a, b);
//       });
//
//       let profileOriginHeight = prfHeight;
//
//       let t1, t2, scaleFactorX, scaleFactorZ;
//
//       if (vertices[1] == null || vertices[10] == null) {
//         t1 = width / profileOriginWidth;
//         t2 = height / profileOriginHeight;
//
//         scaleFactorX = Math.min(t1, t2);
//         scaleFactorZ = scaleFactorX;
//       } else {
//         scaleFactorX = width / profileOriginWidth;
//         scaleFactorZ = height / profileOriginHeight;
//       }
//
//       profile.width = profileOriginWidth * scaleFactorX;
//       profile.height = profileOriginHeight * scaleFactorZ;
//
//       // Skalierungsfaktor für die Segmente mit festem Seitenverhältniss (0, 2, 9, 11)
//       let scaleFactorLocked;
//
//       if (vertices[3].length == 0 && vertices[6].length == 0)
//         scaleFactorLocked = scaleFactorZ;
//       else
//         scaleFactorLocked = Math.min(scaleFactorX, scaleFactorZ);
//
//       // skalieren der Ecksegmente mit festem Seitenverhältniss
//       let ar = [0, 2, 9, 11];
//       for (i = 0; i < 4; i++) {
//         v = vertices[ar[i]];
//         for (j = 0; j < v.length; j++) {
//           v[j].x *= scaleFactorLocked;
//           v[j].z *= scaleFactorLocked;
//         }
//
//         t = CVertex.getVerticesDimensions(v);
//         prf.size[ar[i]].cx = t.cx;
//         prf.size[ar[i]].cz = t.cz;
//         prf.size[ar[i]].length = CVertex.getVerticesLength(v);
//       }
//
//       // skalieren der Mittelspalte
//       let scaleX, middleVertex;
//       let V1 = TEMP.Vertex_1, v0, v1, v2, v3, v5, v6, v8, v10, v9, v11, vt = TEMP.Vertex_3;
//       if (vertices[1].length > 0 && vertices[10].length > 0) {
//         ar = [1, 10, 12];
//         for (i = 0; i < 2; i++) {
//           if (i == 0)
//             scaleX = (profile.width - prf.size[0].cx - prf.size[2].cx) / prf.size[1].cx;
//           else
//             scaleX = (profile.width - prf.size[9].cx - prf.size[11].cx) / prf.size[10].cx;
//
//           v = vertices[ar[i]];
//           for (j = 0; j < v.length; j++) {
//             v[j].x *= scaleX;
//             v[j].z *= scaleFactorLocked;
//           }
//
//           t = CVertex.getVerticesDimensions(v);
//           prf.size[ar[i]].cx = t.cx;
//           prf.size[ar[i]].cz = t.cz;
//           prf.size[ar[i]].length = CVertex.getVerticesLength(v);
//
//           // Mittelpunkt auf 0:0 setzen
//           middleVertex = Math.trunc(vertices[ar[i]].length / 2)
//           // middleVertex = Math.trunc(prf.xzs[ar[i]].length / 2)
//
//           vertices[ar[i]][middleVertex].toRef(V1);
//
//           for (j = 0; j < v.length; j++)
//             v[j].sub(V1);
//         }
//
//         // Segment 1 auf Profilhöhe verschieben
//         V1.assign(0.0, 0.0, -profile.height);
//         v = vertices[1];
//         for (i = 0; i < v.length; i++)
//           v[i].add(V1);
//
//         // Segment 12 auf Profilhöhe verschieben (Kanal)
//         if (vertices[12].length) {
//           v = vertices[12];
//
//           // Mittelpunkt auf 0:0 setzen
//           middleVertex = Math.trunc(vertices[12].length / 2)
//           vertices[12][middleVertex].toRef(V1);
//
//           for (j = 0; j < v.length; j++)
//             v[j].sub(V1);
//
//           V1.assign(0.0, 0.0, -profile.height);
//           for (j = 0; j < v.length; j++) {
//             v[j].x *= scaleFactorX;
//             v[j].z *= scaleFactorZ;
//             v[j].add(V1);
//           }
//           profile.channelVertices = vertices[12];
//         }
//       }
//
//       // Ecksegmente verschieben
//       if (vertices[1].length > 0 && vertices[10].length > 0) {
//         // Segment 0
//         v1 = vertices[1];
//         v1[0].toRef(vt);
//         v0 = vertices[0];
//         vt.sub(v0[v0.length - 1]);
//         for (i = 0; i < v0.length; i++)
//           v0[i].add(vt);
//         // Segment 2
//         v1[v1.length - 1].toRef(vt);
//         v2 = vertices[2];
//         vt.sub(v2[0]);
//         for (i = 0; i < v2.length; i++)
//           v2[i].add(vt);
//         // Segment 9
//         v10 = vertices[10];
//         v10[0].toRef(vt);
//         v9 = vertices[9];
//         vt.sub(v9[v9.length - 1]);
//         for (i = 0; i < v9.length; i++)
//           v9[i].add(vt);
//         // Segment 11
//         v10[v10.length - 1].toRef(vt);
//         v11 = vertices[11];
//         vt.sub(v11[0]);
//         for (i = 0; i < v11.length; i++)
//           v11[i].add(vt);
//       } else {
//         // Segment 9
//         vt.assign(0.0, 0.0, 0.0);
//         v9 = vertices[9];
//         vt.sub(v9[v9.length - 1]);
//         for (i = 0; i < v9.length; i++)
//           v9[i].add(vt);
//         // Segment 0
//         v0 = vertices[0];
//         v9[0].toRef(vt);
//         for (i = 0; i < v0.length; i++)
//           v0[i].add(vt);
//
//         // Segment 11
//         vt.assign(0.0, 0.0, 0.0);
//         v11 = vertices[11];
//         vt.sub(v11[0]);
//         for (i = 0; i < v11.length; i++)
//           v11[i].add(vt);
//         // Segment 2
//         v2 = vertices[2];
//         v11[v11.length - 1].toRef(vt);
//         vt.sub(v2[v2.length - 1]);
//         for (i = 0; i < v2.length; i++)
//           v2[i].add(vt);
//       }
//
//       if (vertices[3].length > 0 && prf.size[6] != null) {
//         // Segmente 3 und 6 skalieren und verschieben
//         let scale = Math.abs(vertices[0][0].z - vertices[9][0].z) / Math.abs(prf.size[3].cz + prf.size[6].cz);
//
//         ar = [3, 6];
//         for (i = 0; i < 2; i++) {
//           v = vertices[ar[i]];
//           for (j = 0; j < v.length; j++)
//             v[j].scale([scaleFactorLocked, 1.0, scale]);
//
//           t = CVertex.getVerticesDimensions(v);
//           prf.size[ar[i]].cx = t.cx;
//           prf.size[ar[i]].cz = t.cz;
//           prf.size[ar[i]].length = CVertex.getVerticesLength(v);
//         }
//
//         v0 = vertices[0];
//         v3 = vertices[3];
//         v0[0].subToRef(v3[v3.length - 1], vt);
//         for (i = 0; i < v3.length; i++)
//           v3[i].add(vt);
//
//         v9 = vertices[9];
//         v6 = vertices[6];
//         v9[0].subToRef(v6[v6.length - 1], vt);
//         for (i = 0; i < v6.length; i++)
//           v6[i].add(vt);
//       }
//
//       if (vertices[5].length > 0 && prf.size[8] != null) {
//         // Segmente 5 und 8 skalieren und verschieben
//         let scale = Math.abs(vertices[2][vertices[2].length - 1].z - vertices[11][vertices[11].length - 1].z) / Math.abs(prf.size[5].cz + prf.size[8].cz);
//
//         ar = [5, 8];
//         for (i = 0; i < 2; i++) {
//           v = vertices[ar[i]];
//           for (j = 0; j < v.length; j++)
//             v[j].scale([scaleFactorLocked, 1.0, scale]);
//
//           t = CVertex.getVerticesDimensions(v);
//           prf.size[ar[i]].cx = t.cx;
//           prf.size[ar[i]].cz = t.cz;
//           prf.size[ar[i]].length = CVertex.getVerticesLength(v);
//         }
//
//         v2 = vertices[2];
//         v5 = vertices[5];
//         v2[v2.length - 1].subToRef(v5[0], vt);
//         for (i = 0; i < v5.length; i++)
//           v5[i].add(vt);
//
//         v11 = vertices[11];
//         v8 = vertices[8];
//         v11[v11.length - 1].subToRef(v8[0], vt);
//         for (i = 0; i < v8.length; i++)
//           v8[i].add(vt);
//       }
//
//       let reverse_vertices = function (V: CVertex[]) {
//         let c = V.length;
//         let half = Math.trunc(c / 2);
//         for (i = 0; i < half; i++) {
//           V[i].toRef(V1);
//           V[c - 1 - i].toRef(V[i]);
//           V1.toRef(V[c - 1 - i]);
//         }
//       };
//
//       if (vertices[0][0].i == 0) // is front ?
//       {
//         if (vertices[1].length > 0) {
//           vertices[1][0].toRef(vertices[0][vertices[0].length - 1]);
//           vertices[1][vertices[1].length - 1].toRef(vertices[2][0]);
//         } else {
//           vertices[2][0].toRef(vertices[0][vertices[0].length - 1]);
//         }
//
//         if (vertices[1].length) {
//           vertices[1] = vertices[1].slice(1, vertices[1].length - 1);
//         }
//
//         vertices[0].pop();
//         profile.frontVertices = vertices[0].concat(vertices[1]);
//         profile.frontVertices.pop();
//         profile.frontVertices = profile.frontVertices.concat(vertices[2]);
//
//         if (vertices[10].length) {
//           vertices[10][0].toRef(vertices[9][vertices[9].length - 1]);
//           vertices[10][vertices[10].length - 1].toRef(vertices[11][0]);
//         } else {
//           vertices[2][0].toRef(vertices[0][vertices[0].length - 1]);
//         }
//
//         if (vertices[10].length) {
//           vertices[10] = vertices[10].slice(1, vertices[10].length - 1);
//         }
//
//         vertices[9].pop();
//         profile.backVertices = vertices[9].concat(vertices[10]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[11]);
//       } else {
//         reverse_vertices(vertices[0]);
//         reverse_vertices(vertices[2]);
//         reverse_vertices(vertices[3]);
//         reverse_vertices(vertices[5]);
//
//         ar = [0, 3, 6, 9, 10, 11, 8, 5, 2];
//
//         for (i = 1; i < ar.length; i++) {
//           vertices[ar[i - 1]][vertices[ar[i - 1]].length - 1].toRef(vertices[ar[i]][0]);
//         }
//
//         vertices[0][0].toRef(vertices[1][0]);
//         vertices[2][vertices[2].length - 1].toRef(vertices[1][vertices[1].length - 1]);
//
//         profile.frontVertices = vertices[1];
//
//         vertices[0].pop();
//         profile.backVertices = vertices[0].concat(vertices[3]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[6]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[9]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[10]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[11]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[8]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[5]);
//         profile.backVertices.pop();
//         profile.backVertices = profile.backVertices.concat(vertices[2]);
//       }
//
//       // prüfen, ob z-Werte "kleiner" als die Ringhöhe sind und verschiebe die Vertices entsprechend
//       // Dies ist bei Profilen der Fall, wo die Segmente 0 und 2 "höher" sind als das Segment 1.
//       let minZ = -height;
//       profile.frontVertices.forEach(function (e) {
//         if (e.z < minZ) minZ = e.z;
//       });
//
//       if (minZ < -height) {
//         let diff = minZ + height;
//         profile.frontVertices.forEach(function (e) {
//           e.z -= diff;
//         });
//         profile.backVertices.forEach(function (e) {
//           e.z -= diff;
//         });
//         profile.channelVertices.forEach(function (e) {
//           e.z -= diff;
//         });
//       }
//
//
//       if (0) // Mindestwinkel zwischen 3 Vektoren prüfen; Dies soll "Knicke" im Profil verhindern
//       {
//         let calculateAngleBetweenvs = function (v1: CVertex, v2: CVertex, pivot: CVertex): number {
//           // Calculate the differences between the vs and the pivot point
//           const diff1 = [v1.x - pivot.x, v1.z - pivot.z];
//           const diff2 = [v2.x - pivot.x, v2.z - pivot.z];
//
//           // Calculate the magnitudes of the differences
//           const mag1 = Math.sqrt(diff1[0] ** 2 + diff1[1] ** 2);
//           const mag2 = Math.sqrt(diff2[0] ** 2 + diff2[1] ** 2);
//
//           // Calculate the dot product of the two differences
//           const dotProduct = diff1[0] * diff2[0] + diff1[1] * diff2[1];
//
//           let t = dotProduct / (mag1 * mag2);
//           // Calculate the angle between the vs in radians
//           const angleInRadians = Math.acos(dotProduct / (mag1 * mag2));
//
//           if (isNaN(angleInRadians))
//             console.log(t, dotProduct, mag1, mag2);
//
//           // Return the angle in degrees
//           return angleInRadians * (180 / Math.PI);
//         }
//
//
//         let adjustMiddleVertexToMinimumAngle = function (v1: CVertex, v2: CVertex, v3: CVertex, minAngleInDegrees: number) {
//           // Calculate the angle between v1 and v2
//           const angle1 = calculateAngleBetweenvs(v1, v3, v2);
//
//           // Calculate the angle between v2 and v3
//           // const angle2 = calculateAngleBetweenvs(v2, v3, v2);
//
//           // console.log(angle1, angle2);
//
//           // Calculate the difference between v2 and v1
//           const diff1 = [v2.x - v1.x, v2.z - v1.z];
//
//           // Calculate the difference between v3 and v2
//           const diff2 = [v3.x - v2.x, v3.z - v2.z];
//
//           // Calculate the dot product of the two differences
//           const dotProduct = diff1[0] * diff2[0] + diff1[1] * diff2[1];
//
//           // Calculate the magnitudes of the two differences
//           const mag1 = Math.sqrt(diff1[0] ** 2 + diff1[1] ** 2);
//           const mag2 = Math.sqrt(diff2[0] ** 2 + diff2[1] ** 2);
//
//           // Calculate the maximum angle between the two vs in radians
//           const maxAngleInRadians = Math.min(Math.PI - minAngleInDegrees * (Math.PI / 180), Math.acos(dotProduct / (mag1 * mag2)));
//
//           // if (isNaN(angle1))
//           //   return;
//
//           // console.log(angle1);
//
//           // If the actual angle is less than the minimum angle, adjust the middle v
//           if (angle1 < minAngleInDegrees/* * (Math.PI / 180)*//* || angle2 < minAngleInDegrees * (Math.PI / 180)*/) {
//             const maxDiffMag = mag1 * Math.tan(maxAngleInRadians / 2) + mag2 * Math.tan(maxAngleInRadians / 2);
//             const maxDiff = [diff1[0] / mag1 * maxDiffMag, diff1[1] / mag1 * maxDiffMag];
//             // console.log("before: "+v2.x+" "+v2.z);
//             v2.x += maxDiff[0];
//             v2.z += maxDiff[1];
//             // console.log("after : "+v2.x+" "+v2.z);
//             // const newv2 = [v2.x + maxDiff[0], v2.z + maxDiff[1]];
//             // return newv2;
//           }
//
//           // If the actual angle is greater than or equal to the minimum angle, return the original middle v
//           // return v2;
//         }
//
//         let i, i_l = profile.frontVertices.length - 2;
//         for (i = 1; i < i_l; i++) {
//           adjustMiddleVertexToMinimumAngle(
//             profile.frontVertices[i - 1],
//             profile.frontVertices[i],
//             profile.frontVertices[i + 1],
//             175
//           );
//         }
//       }
//
//       // Anfangs und Endpunkte gleichsetzen
//       {
//         let A: CVertex[] = profile.frontVertices, B: CVertex[] = profile.backVertices;
//         B[0].x = A[0].x;
//         B[0].z = A[0].z;
//         B[B.length - 1].x = A[A.length - 1].x;
//         B[B.length - 1].z = A[A.length - 1].z;
//       }
//
//       if (vertices[0].length && vertices[3].length)
//         profile.middleVertexBack[0] = vertices[0].length + vertices[3].length - 1;
//
//       if (vertices[2].length && vertices[5].length)
//         profile.middleVertexBack[1] = vertices[2].length + vertices[5].length - 2;
//
//       profile.heightFactor = profileOriginHeight / profileOriginWidth;
//     }
//
//     if (!profile) return null;
//
//     let stepLeftIndex = null, stepRightIndex = null;
//
//     // Stufen berechnen
//     if (sw !== null && sd !== null) {
//       let IP;
//
//       if (sw[0] > 0.0) {
//         IP = profile.interpolate(profile.frontVertices[0].x + sw[0], profile.frontVertices);
//
//         // Vectoren für die linke Stufe sichern
//         let vec3Before = profile.frontVertices.slice(0, IP.indexVectorA + 1);
//
//         // front Vectoren neu zuweisen
//         profile.frontVertices = profile.frontVertices.slice(IP.indexVectorB);
//
//         // Stufenvectoren anpassen
//         let z = IP.z + sd, i, i_l = vec3Before.length, v: CVertex;
//
//         // Der Übergang vom Profil zur Stufe muss scharfkantig sein. Deshalb wird hier ein extra Vector an der
//         // Übergangsstelle gesetzt (gedoppelt), damit die Normalen entsprechen berechnet werden können.
//         let ar = [], edge = false;
//         for (i = 0; i < i_l; i++) {
//           v = vec3Before[i];
//           if (v.z < z) {
//             v.z = z;
//             if (!edge) {
//               ar.push(v);
//               edge = true;
//             }
//           }
//           ar.push(v);
//         }
//         vec3Before = ar;
//
//         // Eckpunkte hinzufügen; doppelt für die Normalen
//         vec3Before.push(new CVertex(IP.x, 0.0, z));
//         vec3Before.push(new CVertex(IP.x, 0.0, z));
//         vec3Before.push(new CVertex(IP.x, 0.0, IP.z));
//
//         // 1 x für Front
//         vec3Before.push(new CVertex(IP.x, 0.0, IP.z));
//
//         stepLeftIndex = vec3Before.length - 1; // abzgl. 1 x Front
//
//         // zusammenführen für die U-Wert Berechnung
//         profile.frontVertices = vec3Before.concat(profile.frontVertices);
//
//         i_l = profile.backVertices.length;
//         for (i = 0; i < i_l; i++) {
//           v = profile.backVertices[i];
//           // if (v.x > IP.x) break;
//           if (v.z < z) v.z = z;
//           else break;
//         }
//
//         if (i > 1) {
//           profile.middleVertexBack[0] -= (i - 1);
//
//           if (profile.middleVertexBack[0] < 0)
//             profile.middleVertexBack[0] = 0;
//
//           let ar = profile.backVertices.slice(i);
//           ar.unshift(CVertex.fromVertex(vec3Before[0]));
//           ar[0].x = profile.backVertices[i].x;
//           vec3Before[0].x = ar[0].x;
//
//           for (i = 0; i < ar.length; i++)
//             ar[i].i = i + 1;
//           profile.backVertices = ar;
//         }
//       }
//       if (sw[1] > 0.0) {
//         IP = profile.interpolate(profile.frontVertices[profile.frontVertices.length - 1].x - sw[1], profile.frontVertices);
//
//         // Vectoren für die rechte Stufe sichern
//         let vec3After = profile.frontVertices.slice(IP.indexVectorB);
//
//         // front Vectoren neu zuweisen
//         profile.frontVertices = profile.frontVertices.slice(0, IP.indexVectorA + 1);
//
//         // Stufenvectoren anpassen
//         let z = IP.z + sd, i, i_l = vec3After.length, v: CVertex;
//
//         // Der Übergang vom Profil zur Stufe muss scharfkantig sein. Deshalb wird hier ein extra Vector an der
//         // Übergangsstelle gesetzt (gedoppelt), damit die Normalen entsprechen berechnet werden können.
//         let ar = [], edge = false;
//
//         for (i = 0; i < i_l; i++) {
//           v = vec3After[i];
//           if (v.z < z) {
//             v.z = z;
//             if (!edge) {
//               ar.push(v);
//               edge = true;
//             }
//           }
//           ar.push(v);
//         }
//         vec3After = ar;
//
//         // Eckpunkte hinzufügen; doppelt für die Normalen
//         profile.frontVertices.push(new CVertex(IP.x, 0.0, IP.z));
//
//         stepRightIndex = profile.frontVertices.length;
//
//         vec3After.unshift(new CVertex(IP.x, 0.0, z));
//         vec3After.unshift(new CVertex(IP.x, 0.0, z));
//         vec3After.unshift(new CVertex(IP.x, 0.0, IP.z));
//
//         // zusammenführen für die U-Wert Berechnung
//         profile.frontVertices = profile.frontVertices.concat(vec3After);
//
//         i_l = profile.backVertices.length - 1;
//         for (i = i_l; i > 0; i--) {
//           v = profile.backVertices[i];
//           // if (v.x < IP.x) break;
//           if (v.z < z) v.z = z;
//           else break;
//         }
//
//         if (i > 1) {
//           profile.middleVertexBack[1] -= (profile.backVertices.length - i);
//           profile.middleVertexBack[1] += 2;
//
//           if (profile.middleVertexBack[1] < 0)
//             profile.middleVertexBack[1] = 0;
//
//           let ar = profile.backVertices.slice(0, i + 1);
//           ar.push(CVertex.fromVertex(vec3After[vec3After.length - 1]));
//           ar[ar.length - 1].x = profile.backVertices[i].x;
//           vec3After[vec3After.length - 1].x = ar[ar.length - 1].x;
//           for (i = 0; i < ar.length; i++)
//             ar[i].i = i + 1;
//           profile.backVertices = ar;
//         }
//       }
//     }
//
//     //-------------------------------------------------------------------------------------
//     // U-Werte berechnen
//     let V = [profile.frontVertices, profile.backVertices];
//     if (profile.channelVertices.length)
//       V.push(profile.channelVertices);
//     let SUM: number[] = []; // um eine einzige albedoTextur zu benutzen, muss die maximale Länge der beiden Geometrien ermittelt werden
//     let sum = 0.0, last, iHalf, lHalf;
//
//     let i, i_l;
//
//     // ermiteln der maximalen Geometrielänge
//     V.forEach(function (e) {
//       sum = 0.0;
//       e[0].l = 0.0;
//       last = 0.0;
//
//       for (i = 1; i < e.length; i++) {
//         e[i].l = last + e[i].distance(e[i - 1]);
//         last = e[i].l;
//       }
//
//       SUM.push(last);
//     })
//
//     sum = SUM[0] > SUM[1] ? SUM[0] : SUM[1];
//
//     /*
//     Es gab Texturfehler bei der Berechnung der seitlichen Kanäle. Werden Stufen eingebracht, so ist der Mittelpunkt der
//     Textur nicht gleich der Mittelpubkt des Ringes. Aus diesem Grund wurde ein Puffer von 0.5mm eingebracht.
//     */
//     sum += 500;
//
//     profile.maxVerticeLength = sum;
//     profile.frontVerticeLength = SUM[0];
//     profile.backVerticeLength = SUM[1];
//
//     let factor = SUM[0] < SUM[1] ? SUM[0] / SUM[1] : SUM[1] / SUM[0];
//     let that = this;
//     // U-Werte berechnen
//     V.forEach(function (e, index) {
//       // let factor = 1.0;
//       //
//       // if (index == 0 && SUM[0] < SUM[1])
//       //   factor = (SUM[0] / SUM[1]);
//       // else if (index == 1 && SUM[1] < SUM[0])
//       //   factor = (SUM[1] / SUM[0]);
//
//       // sum = SUM[index];
//
//
//       if (profile) {
//         let iHalf = V[index].findIndex(e2 => {
//           return e2.x > -15 && e2.x < 15;
//           // return e2.x > -0.001 && e2.x < 0.001;
//         });
//
//         // console.log(iHalf);
//
//         if (iHalf == -1) {
//           // console.log((index == 0 ? profile.frontVertices : profile.backVertices));
//           return;
//         }
//
//         lHalf = V[index][iHalf].l;
//         // lHalf = (index == 0 ? profile.frontVertices : profile.backVertices)[iHalf].l;
//
//         // iHalf = e.findIndex(function (e2)
//         // {
//         //   return e2.x > -0.001 && e2.x < 0.001;
//         // })
//         // lHalf = e[iHalf].l;
//
//         for (i = 0; i < e.length; i++) {
//           e[i].u = 0.5 + ((e[i].l - lHalf) / sum);
//           // e[i].u = 0.5 + ((e[i].l - lHalf) / sum / factor);
//           // e[i].u = 0.5 + ((e[i].l - lHalf) / sum);
//           // e[i].u = 0.5 + ((e[i].l - lHalf) / SUM[index]);
//           if (e[i].u < 0.0) e[i].u = 0.0;
//           else if (e[i].u >= 1.0) e[i].u = 1.0;
//         }
//       }
//     })
//
//     if (stepLeftIndex !== null) {
//       profile.stepLeftVertices = profile.frontVertices.slice(0, stepLeftIndex);
//       profile.frontVertices = profile.frontVertices.slice(stepLeftIndex);
//     }
//
//     if (stepRightIndex !== null) {
//       if (stepLeftIndex != null)
//         stepRightIndex -= stepLeftIndex;
//
//       profile.stepRightVertices = profile.frontVertices.slice(stepRightIndex);
//       profile.frontVertices = profile.frontVertices.slice(0, stepRightIndex);
//     }
//
//     //---------------------------------------------------------------------------------------------
//     // Flächenberechnung: Ergebniss liegt im mm2 vor
//     let calcArea_mm2 = function (): number {
//       let x = [] as number[];
//       let z = [] as number[];
//
//       if (profile) {
//         let v = profile.frontVertices;
//         let i, i_l = v.length;
//         for (i = 0; i < i_l; i++) {
//           x.push(v[i].x);
//           z.push(v[i].z);
//         }
//
//         v = profile.backVertices;
//         i_l = v.length;
//         for (i = i_l - 1; i > 0; i--) {
//           x.push(v[i].x);
//           z.push(v[i].z);
//         }
//       }
//
//       i_l = x.length;
//       let area = 0.0, j;
//       for (i = 0; i < i_l; i++) {
//         j = (i + 1) % i_l;
//         area += x[i] * z[j];
//         area -= x[j] * z[i];
//       }
//       area = Math.abs(area) / 2;
//       return area / 1000000;
//     }
//     profile.area = calcArea_mm2();
//     // console.log("area: "+profile.area);
//     // --------------------------------------------------------------------------------------------
//
//
//     /*
//     Seitenlänge für die seitliche Steinbesetzung ermitteln
//     Gültige Werte können nur ermittelt werden, wenn profile.middleVertexBack[l,r] > 0 ist
//     */
//     profile.sideLength[0] = 0;
//     profile.sideLength[1] = 0;
//     if (1) {
//       if (profile.middleVertexBack[0] > 0) {
//         let n1 = profile.middleVertexBack[0] - 1,
//           n2 = profile.middleVertexBack[0] + 1;
//
//         if (n1 >= 0 && n2 >= 0) {
//           let v1 = profile.backVertices[n1],
//             v2 = profile.backVertices[n2];
//
//           profile.sideLength[0] = v1.distance(v2);
//           profile.sideMidpoint[0] = CVertex.midpoint(v1, v2);
//         }
//       }
//
//       if (profile.middleVertexBack[1] > 0) {
//         let n1 = profile.backVertices.length - 1 - profile.middleVertexBack[1] - 1,
//           n2 = profile.backVertices.length - 1 - profile.middleVertexBack[1] + 1;
//
//         if (n1 >= 0 && n2 >= 0) {
//           let v1 = profile.backVertices[n1],
//             v2 = profile.backVertices[n2];
//
//           profile.sideLength[1] = v1.distance(v2);
//           profile.sideMidpoint[1] = CVertex.midpoint(v1, v2);
//         }
//       }
//     }
//
//     return profile;
//   }
//
//   /*
//     static createWithSimpleScaling(prf: iProfileResponse, width: number, height: number, sw: number[] | null = null, sd: number | null = null): cProfile | null {
//       let profile = new cProfile();
//
//       let i, j, t;
//
//       // konvertiere die Rohdaten in CVertex Klassen
//       let vertices: CVertex[][] = [] as CVertex[][];
//
//       for (i = 0; i < prf.xzs.length; i++) {
//         if (prf.xzs[i]) {
//           vertices[i] = [] as CVertex[];
//           for (j = 0; j < prf.xzs[i].length; j++) {
//             t = new CVertex(prf.xzs[i][j].x, 0, prf.xzs[i][j].z)
//             t.i = prf.xzs[i][j].s;
//             vertices[i].push(t);
//           }
//         } else
//           vertices.push([]);
//       }
//
//       let ar = [3, 0, 1, 2, 5];
//       let frontVertices = [] as CVertex[];
//       let backVertices = [] as CVertex[];
//       let index = 0;
//       let minX = 10000, maxX = -10000, minZ = 10000, maxZ = -10000;
//
//       ar.forEach(n => {
//         if (vertices[n]) {
//           for (i = 0; i < vertices[n].length; i++) {
//             vertices[n][i].i = index++;
//             frontVertices.push(vertices[n][i]);
//
//             // ermittle min/max Werte
//             let v = vertices[n][i];
//             if (v.x < minX) minX = v.x;
//             else if (v.x > maxX) maxX = v.x;
//             if (v.z < minZ) minZ = v.z;
//             else if (v.z > maxZ) maxZ = v.z;
//           }
//         }
//       });
//
//       ar = [6, 9, 10, 11, 8];
//       index = 0;
//
//       ar.forEach(n => {
//         if (vertices[n]) {
//           for (i = 0; i < vertices[n].length; i++) {
//             vertices[n][i].i = index++;
//             backVertices.push(vertices[n][i]);
//
//             // ermittle min/max Werte
//             let v = vertices[n][i];
//             if (v.x < minX) minX = v.x;
//             else if (v.x > maxX) maxX = v.x;
//             if (v.z < minZ) minZ = v.z;
//             else if (v.z > maxZ) maxZ = v.z;
//           }
//         }
//       });
//
//       let scaleX = width / (maxX - minX),
//           scaleZ = height / (maxZ - minZ);
//
//       frontVertices.forEach(v => {
//         v.scale([scaleX, 1.0, scaleZ]);
//       })
//
//       backVertices.forEach(v => {
//         v.scale([scaleX, 1.0, scaleZ]);
//       })
//
//       minX = 10000;
//       maxX = -10000;
//       minZ = 10000;
//       maxZ = -10000;
//
//       frontVertices.forEach(v => {
//         if (v.x < minX) minX = v.x;
//         else if (v.x > maxX) maxX = v.x;
//
//         if (v.z < minZ) minZ = v.z;
//         else if (v.z > maxZ) maxZ = v.z;
//       })
//
//       backVertices.forEach(v => {
//         if (v.x < minX) minX = v.x;
//         else if (v.x > maxX) maxX = v.x;
//
//         if (v.z < minZ) minZ = v.z;
//         else if (v.z > maxZ) maxZ = v.z;
//       })
//
//       let offsetX = (maxX - minX)/2;
//       frontVertices.forEach(v => {
//         v.x -= offsetX;
//         v.z -= maxZ;
//       })
//
//       backVertices.forEach(v => {
//         v.x -= offsetX;
//         v.z -= maxZ;
//       })
//
//       profile.frontVertices = frontVertices;
//       profile.backVertices = backVertices;
//
//       //-------------------------------------------------------------------------------------
//       // U-Werte berechnen
//       let V = [profile.frontVertices, profile.backVertices];
//       // if (profile.channelVertices.length)
//       //   V.push(profile.channelVertices);
//       let SUM: number[] = []; // um eine einzige albedoTextur zu benutzen, muss die maximale Länge der beiden Geometrien ermittelt werden
//       let sum = 0.0, last, iHalf, lHalf;
//
//       // ermiteln der maximalen Geometrielänge
//       V.forEach(function (e) {
//         sum = 0.0;
//         e[0].l = 0.0;
//         last = 0.0;
//
//         for (i = 1; i < e.length; i++) {
//           e[i].l = last + e[i].distance(e[i - 1]);
//           last = e[i].l;
//         }
//
//         SUM.push(last);
//       })
//
//       sum = SUM[0] > SUM[1] ? SUM[0] : SUM[1];
//
//       /!*
//       Es gab Texturfehler bei der Berechnung der seitlichen Kanäle. Werden Stufen eingebracht, so ist der Mittelpunkt der
//       Textur nicht gleich der Mittelpubkt des Ringes. Aus diesem Grund wurde ein Puffer von 0.5mm eingebracht.
//       *!/
//       sum += 500;
//
//       profile.maxVerticeLength = sum;
//       profile.frontVerticeLength = SUM[0];
//       profile.backVerticeLength = SUM[1];
//
//       let factor = SUM[0] < SUM[1] ? SUM[0] / SUM[1] : SUM[1] / SUM[0];
//       let that = this;
//       // U-Werte berechnen
//       V.forEach(function (e, index) {
//         // let factor = 1.0;
//         //
//         // if (index == 0 && SUM[0] < SUM[1])
//         //   factor = (SUM[0] / SUM[1]);
//         // else if (index == 1 && SUM[1] < SUM[0])
//         //   factor = (SUM[1] / SUM[0]);
//
//         // sum = SUM[index];
//
//
//         let iHalf = (index == 0 ? profile.frontVertices : profile.backVertices).findIndex(e2 => {
//           return e2.x > -1 && e2.x < 1;
//         });
//
//         console.log(iHalf);
//
//         if (iHalf == -1) {
//           console.log((index == 0 ? profile.frontVertices : profile.backVertices));
//           return;
//         }
//
//         lHalf = (index == 0 ? profile.frontVertices : profile.backVertices)[iHalf].l;
//
//         // iHalf = e.findIndex(function (e2)
//         // {
//         //   return e2.x > -0.001 && e2.x < 0.001;
//         // })
//         // lHalf = e[iHalf].l;
//
//         for (i = 0; i < e.length; i++) {
//           e[i].u = 0.5 + ((e[i].l - lHalf) / sum);
//           // e[i].u = 0.5 + ((e[i].l - lHalf) / sum / factor);
//           // e[i].u = 0.5 + ((e[i].l - lHalf) / sum);
//           // e[i].u = 0.5 + ((e[i].l - lHalf) / SUM[index]);
//           if (e[i].u < 0.0) e[i].u = 0.0;
//           else if (e[i].u >= 1.0) e[i].u = 1.0;
//         }
//       })
//
//       //---------------------------------------------------------------------------------------------
//       // Flächenberechnung: Ergebniss liegt im mm2 vor
//       let calcArea_mm2 = function (): number {
//         let x = [] as number[];
//         let z = [] as number[];
//
//         let v = profile.frontVertices;
//         let i, i_l = v.length;
//         for (i = 0; i < i_l; i++) {
//           x.push(v[i].x);
//           z.push(v[i].z);
//         }
//
//         v = profile.backVertices;
//         i_l = v.length;
//         for (i = i_l - 1; i > 0; i--) {
//           x.push(v[i].x);
//           z.push(v[i].z);
//         }
//
//         i_l = x.length;
//         let area = 0.0, j;
//         for (i = 0; i < i_l; i++) {
//           j = (i + 1) % i_l;
//           area += x[i] * z[j];
//           area -= x[j] * z[i];
//         }
//         area = Math.abs(area) / 2;
//         return area / 1000000;
//       }
//       profile.area = calcArea_mm2();
//
//
//       return profile;
//     }
//   */
//
//   // computeUV_V: berechnet die V-Werte der Vertex-Daten
//   // Die U-Werte werden bereits innerhalb der "create" funktion ermitteln
//   // scale: sollte 1.0 / Texturhöhe betragen bzw 1.0 / innerCircumference, da der Ringumfang größer als die abgewickelte Ringbreite ist
//
//   computeUV_V(vec: CVertex[] | CVertex[][], scale: number) {
//     let calc = function (row: CVertex[]) {
//       try {
//         let i;
//         for (i = 0; i < row.length; i++) {
//           row[i].v = row[i].y * scale;
//         }
//       } catch (e) {
//         console.log(row);
//         throw "error";
//       }
//     };
//
//     if (Array.isArray(vec[0])) {
//       let i;
//       for (i = 0; i < vec.length; i++) {
//         calc(<CVertex[]>vec[i]);
//       }
//     } else {
//       calc(<CVertex[]>vec);
//     }
//   }
//
//   outline(vec: CVertex[][], ccw: boolean = false, minIndex: number | null = null, maxIndex: number | null = null) {
//     let path: CVertex[] = [], i, i_l = vec.length;
//
//     if (minIndex == null) minIndex = 0;
//     if (maxIndex == null) maxIndex = 0;
//
//     if (ccw) {
//       for (i = 0; i < i_l; i++)
//         path.push(vec[i][vec[i].length - 1 - maxIndex]);
//       for (i = i_l - 1; i >= 0; i--)
//         path.push(vec[i][minIndex]);
//     } else {
//       for (i = 0; i < i_l; i++)
//         path.push(vec[i][minIndex]);
//       for (i = i_l - 1; i >= 0; i--)
//         path.push(vec[i][vec[i].length - 1 - maxIndex]);
//     }
//
//     return path;
//   }
//
//   extrude(ring: WebglRing): iMeshData[] | null {
//     let ringData = ring.ringData;
//
//     let profile = AppComponent.app.data.profile.find(function (e) {
//       return e.name.toLowerCase() == ringData.profileName.toLowerCase();
//     })
//
//     if (!profile) {
//       Log("error", "Profil '" + ringData.profileName + "' nicht gefunden");
//       return null;
//     }
//
//     let map = function (value: number, low1: number, high1: number, low2: number, high2: number) {
//       return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
//     }
//
//     let get_sin = function (y: number, maxY: number, factor: number): number {
//       return Math.sin(map(y, 0, maxY, 0, Math.PI * 2 * ringData.waveCount)) * factor;
//     }
//
//     let innerCircumference = ringData.ringSize,
//       xCenter = ringData.ringWidth / 2,
//       thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180, // zusätzliche Rotation des Ringes um die X-Achse
//       tesselation = AppComponent.app.state.mobile ? AppComponent.app.data.webglSettings.tesselation[1] : AppComponent.app.data.webglSettings.tesselation[0],
//       tesselation_inc = innerCircumference / tesselation,
//       path = [] as CVertex[],
//       y,
//       i,
//       rows: iVertexArray[] | null,
//       meshes: iMeshData[] = [] as iMeshData[],
//       innerRadius = innerCircumference / Math.PI / 2,
//       meshData: iMeshData,
//       countFront = 0,
//       countBack = 0,
//       divMode = ringData.divPreset.substring(0, 1).toLowerCase(),
//       that = this;
//
//     for (y = 0, i = 0; i <= tesselation; y += tesselation_inc, i++)
//       path.push(new CVertex(0, y, 0));
//
//     let extrude_mDiv = function (): iVertexArray[] | null {
//       let mDiv_to_mm = function (): number[] {
//         let lc = ring.ringData.divPreset.toLowerCase();
//         if (lc.startsWith("s:") || lc.startsWith("h:"))
//           return [ring.ringData.ringWidth];
//
//         let t, last = 0, result = [] as number[];
//         ring.ringData.materialDiv.forEach(function (e: number) {
//           t = ((e + last) * ring.ringData.ringWidth / 10000) - xCenter;
//           result.push(t);
//           last += e;
//         });
//
//         return result;
//       }
//       let fill_loopData = function () {
//         let result = [];
//         result.push({vertices: that.frontVertices, type: "front"});
//         result.push({vertices: that.backVertices, type: "back"});
//         if (that.stepLeftVertices.length) {
//           result.push({
//             vertices: that.stepLeftVertices,
//             type: "sl",
//           })
//         }
//
//         if (that.stepRightVertices.length) {
//           result.push({
//             vertices: that.stepRightVertices,
//             type: "sr",
//           })
//         }
//
//         return result;
//       }
//
//       let out: iVertexArray[] = [] as iVertexArray[],
//         WA = ring.calc.wa_mm,
//         mDiv = mDiv_to_mm();
//
//       let i: number, i_l: number,
//         j: number, j_l: number,
//         k: number, k_l: number,
//         index: number,
//         tmp: CVertex, A: CVertex, B: CVertex,
//         cx;
//
//       let row: CVertex[], x: number, vecIndex;
//       let IP: iInterpolateResult, lastIP: iInterpolateResult | null = null;
//
//       let loopData = fill_loopData();
//       for (let nLoop = 0; nLoop < loopData.length; nLoop++) {
//         let rows: CVertex[][][] = [],
//           j_l = 0;
//
//         switch (loopData[nLoop].type) {
//           case "front":
//           case "back": {
//             for (j = 0; j < mDiv.length; j++)
//               rows.push([] as CVertex[][]);
//             j_l = mDiv.length;
//             break;
//           }
//           case "sl":
//           case "sr": {
//             rows.push([] as CVertex[][]);
//             j_l = 1;
//             break;
//           }
//         }
//
//         let vertices = loopData[nLoop].vertices;
//
//         for (i = 1; i < path.length; i++) {
//           vecIndex = 0;
//           lastIP = null;
//
//           for (j = 0; j < j_l; j++) {
//             row = [];
//
//             if (lastIP != null) {
//               tmp = new CVertex(lastIP.x, 0, lastIP.z);
//               tmp.add(path[i - 1]);
//               tmp.u = lastIP.uv_u;
//               tmp.i = j;
//               row.push(tmp);
//             }
//
//             if (j == j_l - 1)
//               x = vertices[vertices.length - 1].x;
//             else
//               x = mDiv[j] + get_sin(path[i - 1].y, ringData.ringSize, WA);
//
//             if (x < vertices[0].x)
//               x = vertices[0].x;
//             else if (x > vertices[vertices.length - 1].x)
//               x = vertices[vertices.length - 1].x;
//
//             IP = that.interpolate(x, vertices, lastIP ? lastIP.indexVectorA : 0);
//             lastIP = IP;
//
//             A = vertices[IP.indexVectorA];
//             B = vertices[IP.indexVectorB];
//             cx = (B.x - A.x) / 4;
//
//             if (x - A.x < cx)
//               IP.indexVectorA--;
//             else if (B.x - x < cx)
//               IP.indexVectorB++;
//
//             if (j == j_l - 1) {
//               for (k = vecIndex; k < vertices.length; k++) {
//                 tmp = CVertex.fromVertex(vertices[k]);
//                 tmp.add(path[i - 1]);
//                 tmp.u = vertices[k].u;
//                 tmp.i = j;
//                 row.push(tmp);
//               }
//             } else {
//               for (k = vecIndex; k <= IP.indexVectorA; k++) {
//                 tmp = CVertex.fromVertex(vertices[k]);
//                 tmp.add(path[i - 1]);
//                 tmp.u = vertices[k].u;
//                 tmp.i = j;
//                 row.push(tmp);
//               }
//
//               tmp = new CVertex(IP.x, 0, IP.z);
//               tmp.add(path[i - 1]);
//               tmp.u = IP.uv_u;
//               tmp.i = j;
//               row.push(tmp);
//             }
//
//             rows[j].push(row);
//
//             vecIndex = IP.indexVectorB;
//           }
//         }
//
//         // die 1. Reihe aller Meshes an das Ende kopieren...
//
//         i_l = rows.length;
//         i = path.length - 1;
//         for (j = 0; j < j_l; j++) {
//           row = [];
//           rows[j][0].forEach(function (e) {
//             tmp = CVertex.fromVertex(e);
//             tmp.y = path[i].y;
//             tmp.u = e.u;
//             row.push(tmp);
//           })
//           rows[j].push(row);
//         }
//
//         let frontIndex = 0,
//           backIndex = 0,
//           get_index = function (type: string) {
//             switch (type) {
//               case "front":
//                 return frontIndex++;
//               case "back":
//                 return backIndex++;
//               case "sl":
//                 return 0;
//               case "sr":
//                 return mDiv.length - 1;
//             }
//
//             return -1;
//           }
//
//         for (i = 0; i < i_l; i++) {
//           index = 0;
//           j_l = rows[i].length;
//           for (j = 0; j < j_l; j++) {
//             k_l = rows[i][j].length;
//             row = rows[i][j];
//             for (k = 0; k < k_l; k++) {
//               row[k].i = index++;
//             }
//           }
//
//           out.push({
//             vertex2DArray: rows[i],
//             type: loopData[nLoop].type,
//             index: get_index(loopData[nLoop].type)
//           });
//         }
//       }
//
//       let mode = ring.ringData.divPreset.substring(0, 1).toLowerCase();
//
//       // Segmentierter Ring: Teile das Frontmesh horizontal in 2 gleiche Teile um die Oberflächen zu separieren
//       if (mode == "s") {
//         let front = out.find(function (e) {
//           return e.type == "front";
//         })
//
//         if (front) // in diesem Modus gibt es nur 1 Frontmesh
//         {
//           let rows = front.vertex2DArray;
//           let rowsBottom = rows.slice(0, rows.length / 2);
//           let rowsTop = rows.slice(rows.length / 2);
//           let row0 = rowsTop[0], rowNew = [];
//
//           for (i = 0; i < row0.length; i++) {
//             rowNew.push(CVertex.fromVertex(row0[i]));
//           }
//           rowsBottom.push(rowNew);
//
//           front.vertex2DArray = rowsBottom;
//
//
//           let index = 0, row;
//           i_l = rowsTop.length;
//           for (i = 0; i < i_l; i++) {
//             row = rowsTop[i];
//             j_l = row.length;
//             for (j = 0; j < j_l; j++) {
//               row[j].i = index++;
//             }
//           }
//           out.push({
//             vertex2DArray: rowsTop,
//             type: "front",
//             index: 1,
//           });
//         }
//       }
//
//       // generiere Trennfugen
//       let shape: CVertex[] = [], gm = ring.ringData.gapMode, gw = ring.ringData.gapWidth, gd = ring.ringData.gapDepth;
//       if (gd <= 1.0) gd = gw * gd;
//
//       switch (gm) {
//         case 1: // eckige Fuge
//           shape.push(new CVertex(-gw / 2, 0, 0));
//           shape.push(new CVertex(-gw / 2 + 10, 0, gd / 2));
//           shape.push(new CVertex(-gw / 2 + 20, 0, gd));
//           shape.push(new CVertex(-gw / 2 + 20, 0, gd));
//           shape.push(new CVertex(0, 0, gd));
//           shape.push(new CVertex(gw / 2 - 20, 0, gd));
//           shape.push(new CVertex(gw / 2 - 20, 0, gd));
//           shape.push(new CVertex(gw / 2 - 10, 0, gd / 2));
//           shape.push(new CVertex(gw / 2, 0, 0));
//
//           shape[0].u = 0;
//           break;
//         case 2: // V-Fuge
//           shape.push(new CVertex(-gw / 2, 0, 0));
//           shape.push(new CVertex(-0, 0, gd));
//           shape.push(new CVertex(-0, 0, gd));
//           shape.push(new CVertex(gw / 2, 0, 0));
//           break;
//         case 3: // U-Fuge
//           shape.push(new CVertex(-0.5, 0.0, 0.0).scale(gw));
//           shape.push(new CVertex(-0.460696, 0.0, 0.194589).scale(gw));
//           shape.push(new CVertex(-0.353523, 0.0, 0.353523).scale(gw));
//           shape.push(new CVertex(-0.194589, 0.0, 0.460696).scale(gw));
//           shape.push(new CVertex(0.0, 0.0, 0.5).scale(gw));
//           shape.push(new CVertex(0.194589, 0.0, 0.460696).scale(gw));
//           shape.push(new CVertex(0.353523, 0.0, 0.353523).scale(gw));
//           shape.push(new CVertex(0.460696, 0.0, 0.194589).scale(gw));
//           shape.push(new CVertex(0.5, 0.0, 0.0).scale(gw));
//           break;
//       }
//
//       let adaptLeftMesh = function (rowsFront: CVertex[][], rowsGap: CVertex[][]) {
//         if (!rowsFront.length || !rowsGap.length) {
//           throw "error: no data";
//         }
//         let i, i_l = rowsFront.length, j, j_l, B, index, rows, row;
//
//         for (i = 0; i < i_l; i++) {
//           B = CVertex.fromVertex(rowsGap[i][0]);
//           j_l = rowsFront[i].length;
//           for (j = 0; j < j_l - 1; j++) {
//             if (rowsFront[i][j + 1].x > B.x) break;
//           }
//           rows = rowsFront[i].slice(0, j + 1);
//           rows.push(B);
//           rowsFront[i] = rows;
//         }
//
//         // indices neu erstellen
//         index = 0;
//         i_l = rowsFront.length;
//         for (i = 0; i < i_l; i++) {
//           row = rowsFront[i];
//           j_l = row.length;
//           for (j = 0; j < j_l; j++)
//             row[j].i = index++;
//         }
//       }
//
//       let adaptRightMesh = function (rowsFront: CVertex[][], rowsGap: CVertex[][]) {
//         let i, i_l = rowsFront.length, j, j_l, index, B, row;
//
//         for (i = 0; i < i_l; i++) {
//           B = CVertex.fromVertex(rowsGap[i][rowsGap[i].length - 1]);
//           row = rowsFront[i];
//           j_l = row.length;
//           for (j = 0; j < j_l - 1; j++) {
//             if (row[j].x > B.x) break;
//             if (row[j + 1].x - (row[j + 1].x - row[j].x) / 4 > B.x) break;
//           }
//
//           row = [B].concat(row.slice(j + 1));
//           rowsFront[i] = row;
//         }
//
//         // indices neu erstellen
//         index = 0;
//         i_l = rowsFront.length;
//         for (i = 0; i < i_l; i++) {
//           row = rowsFront[i];
//           j_l = row.length;
//           for (j = 0; j < j_l; j++)
//             row[j].i = index++;
//         }
//       }
//
//       if (1 && mode != "s" && mode != "h" && ring.ringData.gapMode > 0 && ring.ringData.gapMode < 4) {
//         let front: iVertexArray[] = [];
//
//         out.forEach(function (e) {
//           if (e.type == "front")
//             front.push(e);
//         })
//
//         if (front.length > 1) {
//           let path, rows, rowsFront, rowsGap, gapIndex;
//
//           for (gapIndex = 0; gapIndex < front.length - 1; gapIndex++) {
//
//             if (!ring.ringData.gapEnabled[gapIndex]) {
//               continue;
//             }
//
//             path = [];
//             rowsFront = front[gapIndex].vertex2DArray;
//
//             i_l = rowsFront.length;
//             for (i = 0; i < i_l; i++) {
//               let t = CVertex.fromVertex(rowsFront[i][rowsFront[i].length - 1]);
//               path.push(t);
//             }
//
//             rowsGap = that.extrude_shape_xy(shape, path/*, this.frontVertices, true, false*/);
//
//             out.push({
//               vertex2DArray: rowsGap,
//               type: "gap",
//               index: gapIndex,
//             });
//
//             /*
//             Anpassung front zu gap Mesh
//             für jede Reihe:
//                 - suche im Frontmesh der ersten Vertex, der größer in X ist, als der erste Vertex im Gap-Mesh
//                 - verwerfe alle Vertices im Frontmesh bis zum Ende der Reihe
//                 - setze den letzten Vertex dieser Reihe auf die Koordinaten des ersten Vertex im Gap-Mesh
//                 - es wird dadurch ein eigenes "outline" vom GapMesh benötigt, (evtl. auch 2 Wenn unterschiedliche Materialien)
//                 - keine Alpha-Map für die Fugen
//              */
//
//             adaptLeftMesh(front[gapIndex].vertex2DArray, rowsGap);
//             adaptRightMesh(front[gapIndex + 1].vertex2DArray, rowsGap);
//
//             // I UV-u der Rechteckfuge anpassen
//             if (gm == 1) { // geht nur bei breiten Materialabständen; bei schmalen Abständen wird die Albedo teilweise überschrieben
//               rows = rowsGap;
//               i_l = rows.length;
//               let p1, p2;
//               for (i = 0; i < i_l; i++) {
//                 p1 = rows[i][0];
//                 p2 = rows[i][1];
//                 // p1.u = p2.u - (p1.distance(p2) / that.frontVerticeLength);
//                 p1.u = p2.u - (p1.distance(p2) / that.maxVerticeLength);
//                 p1 = rows[i][rows[i].length - 1];
//                 p2 = rows[i][rows[i].length - 2];
//                 // p1.u = p2.u + (p1.distance(p2) / that.frontVerticeLength);
//                 p1.u = p2.u + (p1.distance(p2) / that.maxVerticeLength);
//               }
//             }
//           }
//         }
//       }
//
//       // generiere Designfugen
//       if (1 && ring.ringData.gapDiv.length > 1) {
//         let gapDivPos = [] as number[], last = 0, t;
//         i_l = ring.ringData.gapDiv.length - 1;
//         for (i = 0; i < i_l; i++) {
//           t = ring.ringData.gapDiv[i];
//           gapDivPos.push((t + last) * ring.ringData.ringWidth / 10000 - ring.ringData.ringWidth / 2);
//           last += t;
//         }
//
//         let rows, rowsGap, fPath: CVertex[];
//
//         gapDivPos.forEach(function (xPos) {
//           out.forEach(function (e) {
//             let curFront = null;
//             if (e.type == "front" && e.vertex2DArray[0][0].x < xPos && e.vertex2DArray[0][e.vertex2DArray[0].length - 1].x > xPos)
//               curFront = e;
//
//             if (curFront) {
//               rows = curFront.vertex2DArray;
//
//               fPath = [];
//               i_l = rows.length
//               for (i = 0; i < i_l; i++) {
//                 t = new CVertex(xPos + get_sin(path[i].y, ringData.ringSize, WA), rows[i][0].y, 0);
//                 t.z = that.interpolate(t.x, that.frontVertices).z;
//                 fPath.push(t);
//               }
//
//               rowsGap = that.extrude_shape_xy(shape, fPath);
//
//               out.push({
//                 vertex2DArray: rowsGap,
//                 type: "gap",
//                 index: -1,
//               });
//
//               // Front neu erstellen
//               let rowsFront = curFront.vertex2DArray, rowsFrontLeft = [], rowsFrontRight = [], newRow;
//
//               i_l = rowsFront.length;
//               for (i = 0; i < i_l; i++) {
//                 row = rowsFront[i];
//
//                 x = fPath[i].x;
//                 j_l = row.length;
//                 for (j = 0; j < j_l - 1; j++) {
//                   if (row[j].x > x) break;
//                 }
//
//                 newRow = row.slice(0, j);
//                 rowsFrontLeft.push(newRow);
//
//                 newRow = row.slice(j);
//                 rowsFrontRight.push(newRow);
//               }
//
//               adaptLeftMesh(rowsFrontLeft, rowsGap);
//               adaptRightMesh(rowsFrontRight, rowsGap);
//
//               // indices neu erstellen: links
//               index = 0;
//               i_l = rowsFrontLeft.length;
//               for (i = 0; i < i_l; i++) {
//                 row = rowsFrontLeft[i];
//                 j_l = row.length;
//                 for (j = 0; j < j_l; j++)
//                   row[j].i = index++;
//               }
//               // indices neu erstellen: rechts
//               index = 0;
//               i_l = rowsFrontRight.length;
//               for (i = 0; i < i_l; i++) {
//                 row = rowsFrontRight[i];
//                 j_l = row.length;
//                 for (j = 0; j < j_l; j++)
//                   row[j].i = index++;
//               }
//
//               curFront.vertex2DArray = rowsFrontLeft;
//
//               out.push({
//                 vertex2DArray: rowsFrontRight,
//                 type: curFront.type,
//                 index: curFront.index,
//               });
//
//               // I UV-u der Rechteckfuge anpassen
//               if (gm == 1) { // geht nur bei breiten Materialabständen; bei schmalen Abständen wird die Albedo teilweise überschrieben
//                 rows = rowsGap;
//                 i_l = rows.length;
//                 let p1, p2;
//                 for (i = 0; i < i_l; i++) {
//                   p1 = rows[i][0];
//                   p2 = rows[i][1];
//                   // p1.u = p2.u - (p1.distance(p2) / that.frontVerticeLength) / 2;
//                   p1.u = p2.u - (p1.distance(p2) / that.maxVerticeLength) / 2;
//                   p1 = rows[i][rows[i].length - 1];
//                   p2 = rows[i][rows[i].length - 2];
//                   p1.u = p2.u + (p1.distance(p2) / that.frontVerticeLength) / 2;
//                   // p1.u = p2.u + (p1.distance(p2) / that.maxVerticeLength) / 2;
//                 }
//               }
//             }
//           })
//         })
//       }
//
//       return out;
//     }
//
//     let calc_stones = function (): iVertexArray[] | null {
//       let out: iVertexArray[] = [] as iVertexArray[];
//
//       let findStoneMode = function (mode: number) {
//         let modes = AppComponent.app.data.stoneMode, result = null;
//         for (let i = 0; i < modes.length; i++) {
//           if (modes[i].mode === mode) {
//             result = modes[i];
//           } else if (modes[i].items) {
//             // @ts-ignore
//             for (let j = 0; j < modes[i].items.length; j++) {
//               // @ts-ignore
//               if (modes[i].items[j].mode === mode) {
//                 // @ts-ignore
//                 result = modes[i].items[j];
//                 break;
//               }
//             }
//           }
//
//           if (result)
//             break;
//         }
//
//         return result;
//       }
//       let getLowerStoneSize = function (stoneType: number, maxSize: number, onSide: boolean = false): number {
//         let type = AppComponent.app.data.stoneType.find(function (e) {
//           return e.id === stoneType;
//         })
//         if (type) {
//           let size = 0;
//           if (onSide) {
//             for (let i = 0; i < type.size.length; i++) {
//               if (type.size[i].calcSize) {
//                 // @ts-ignore
//                 if (type.size[i].calcSize <= maxSize)
//                   size = type.size[i].size;
//               } else if (type.size[i].size <= maxSize)
//                 size = type.size[i].size;
//             }
//           } else {
//             for (let i = 0; i < type.size.length; i++) {
//               if (type.size[i].calcSize) {
//
//                 // @ts-ignore
//                 if (type.size[i].minRingHeight <= ringData.ringHeight && type.size[i].minRingWidth <= ringData.ringWidth && type.size[i].calcSize <= maxSize)
//                   size = type.size[i].size;
//               } else if (type.size[i].size <= maxSize && type.size[i].minRingHeight <= ringData.ringHeight && type.size[i].minRingWidth <= ringData.ringWidth)
//                 size = type.size[i].size;
//             }
//           }
//           return size;
//         }
//
//         return 0;
//       }
//       let getStoneSizeItem = function (stoneType: number, size: number): iStoneSize | null {
//         let type = AppComponent.app.data.stoneType.find(function (e) {
//           return e.id === stoneType;
//         })
//         if (type) {
//           for (let i = 0; i < type.size.length; i++) {
//             if (type.size[i].size === size)
//               return type.size[i];
//           }
//         }
//
//         return null;
//       }
//       let getStoneTypeItem = function (stoneType: number) {
//         return AppComponent.app.data.stoneType.find(function (e) {
//           return e.id === stoneType;
//         })
//       }
//
//       ring.calc.profileSideLength[0] = Math.trunc(that.sideLength[0]);
//       ring.calc.profileSideLength[1] = Math.trunc(that.sideLength[1]);
//
//       let debugStoneOffset = 0; // Abstand der Steine nach außen...zum testen ohne die Bevels
//
//       ringData.stone.forEach(function (stoneGroup: iPresetStone, stoneGroupIndex: number) {
//         // front
//         let test = [10, 20, 30];
//         if (test.indexOf(stoneGroup.mode) !== -1) {
//           let stoneMode = findStoneMode(stoneGroup.mode);
//
//           if (!stoneMode)
//             return;
//
//           let loopStoneSize = true;
//           let loopStoneSizeCount = 50;
//
//           while (loopStoneSize && loopStoneSizeCount-- > 0) {
//             loopStoneSize = false;
//
//             let stoneSize = stoneGroup.size;
//             let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//
//             /* Steingrößenermittlung Princess45 und Baguette war ungenau.
//             Neue Variable 'calcSize' in iStoneSizeItem eingefügt
//             1. nutze lengthFactor
//             2. ansonsten nutze calcSize
//             3. ansonsten nutze die 'size'
//              */
//
//             if (stoneSizeItem) {
//               let x = stoneSizeItem.size, y;
//               if (stoneSizeItem.lengthFactor) {
//                 y = x * stoneSizeItem.lengthFactor;
//                 stoneSize = Math.sqrt(x * x + y * y);
//               } else if (stoneSizeItem.calcSize) {
//                 stoneSize = stoneSizeItem.calcSize;
//               }
//               // else: ...Fallback zur stoneSize wurde oben schon definiert...
//             } else return;
//
//             let ringRadiusInner = innerCircumference / Math.PI / 2,
//               ringRadiusOuter = ringRadiusInner + ring.ringData.ringHeight,
//               ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
//               stoneSizeX_safe = stoneSize + stoneMode.safeDistX,
//               stoneSizeX_half = stoneSize / 2,
//               stoneSizeY_safe = (stoneSize + stoneMode.safeDistY) * ringRadiusFactor,
//               stoneSizeY = stoneSize * ringRadiusFactor,
//               stoneSizeY_half_safe = stoneSizeY_safe / 2,
//               distributionY = stoneSizeY_safe,
//               stoneCount = stoneGroup.count,
//               height = ringData.ringSize,
//               yCenter = height / 2,
//               heightFactor = 1.0,
//               maxY: number,
//
//               amp = ringData.waveAmp / 100,
//               amp100 = ring.calc.amp100,
//
//               stoneSafeLeft = -xCenter + ring.calc.stoneSafeLeft,
//               stoneSafeRight = xCenter - ring.calc.stoneSafeRight,
//
//               maxStoneCount = 0;
//
//             if (stoneMode.mode === 30) {
//               stoneSizeY_safe = (stoneSize * 1.02) * ringRadiusFactor; // extra Abstand zwischen den Steinen
//               stoneSizeY_half_safe = stoneSizeY_safe / 2;
//               distributionY = stoneSizeY_safe;
//             }
//
//             /*
//             ermittle den nächsten Y-Wert im Abstand von 'distance'; 'inc' kann positiv oder negativ sein
//             */
//             let debug_getPoint = false;
//             let getPoint = function (curX: number, curY: number, distance: number, inc: number, testY: boolean = false): iXY {
//               let result = {x: 0, y: 0}, x, y = curY, u, v, d = 0;
//               let orig_x = get_sin(curY, height, amp100 * amp);
//               let offset = curX - orig_x;
//
//               if (testY) {
//                 y = curY + distance;
//                 result.x = get_sin(y, height, amp100 * amp);
//                 result.y = y;
//                 return result;
//               }
//
//               while (1) {
//                 y += inc;
//                 x = get_sin(y, height, amp100 * amp);
//                 u = x - curX + offset;
//                 v = y - curY;
//                 d = Math.sqrt(u * u + v * v);
//                 if (d >= distance) {
//                   x += offset;
//                   result.x = x;
//                   result.y = y;
//                   break;
//                 }
//               }
//
//               if (debug_getPoint) {
//                 console.log("getPoint()", curX, curY, distance, inc, testY, x, y, d);
//               }
//               return result;
//             }
//
//             let getMaxStoneCount = function (): number {
//               let countMax = 1, p = getPoint(0, -maxY, stoneSizeY_half_safe, 1);
//
//               while (1) {
//                 p = getPoint(p.x, p.y, distributionY, 1);
//                 if (p.y > maxY)
//                   break;
//
//                 if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
//                 {
//                   // console.log(p.x, stoneSizeX_half, stoneSafeLeft, stoneSafeRight, distributionY);
//                   break;
//                 }
//
//                 countMax++;
//               }
//
//               return countMax;
//             }
//
//             let loop = 0;
//             while (loop++ < 2) // 2 Durchläufe sind hier notwendig weil sich innerhalb dieser Schleife die Verteilung ändern kann
//             {
//               distributionY = stoneSizeY_safe;
//
//               switch (stoneGroup.distribution) {
//                 case 0: // aneinander
//                   break;
//                 case 5: // halber Steinabstand
//                   distributionY *= 1.5;
//                   break;
//                 case 10: // ganzer Steinabstand
//                   distributionY *= 2.0;
//                   break;
//                 case 20: // doppelter Steinabstand
//                   distributionY *= 3.0;
//                   break;
//                 case 33: // drittel Ring
//                   heightFactor = 0.33;
//                   break;
//                 case 50: // halber Ring
//                   heightFactor = 0.5;
//                   break;
//                 case 100: // ganzer Ring
//                   heightFactor = 1.0;
//                   break;
//               }
//
//               maxY = yCenter * heightFactor;
//
//               if (stoneGroup.distribution == 100) {
//                 maxY -= stoneSizeY / 2;
//               }
//
//               maxStoneCount = getMaxStoneCount();
//
//               if (stoneGroup.distribution >= 33 && stoneGroup.count < 0)
//                 stoneGroup.count = stoneCount = maxStoneCount;
//
//               if (stoneGroup.count < 0) {
//                 switch (stoneGroup.count) {
//                   case -33.339:
//                     stoneCount = Math.trunc(maxStoneCount / 3);
//                     break;
//                   case -50:
//                     stoneCount = Math.trunc(maxStoneCount / 2);
//                     break;
//                   case -100:
//                     stoneCount = maxStoneCount;
//                     stoneGroup.distribution = 100;
//                     break;
//                 }
//               }
//
//               if (stoneCount > maxStoneCount)
//                 stoneCount = maxStoneCount;
//
//               if (stoneGroup.mode === 20) {
//                 if (stoneCount === maxStoneCount)
//                   stoneGroup.distribution = 100;
//                 else
//                   stoneGroup.distribution = 0;
//               } else {
//                 stoneGroup.rows = 1;
//               }
//             }
//
//             // console.log(maxStoneCount, stoneSizeY_half_safe);
//
//             ring.calc.stone[stoneGroupIndex].maxCount = maxStoneCount;
//
//             let loopDistribution = true;
//
//             interface iXY {
//               x: number;
//               y: number;
//             }
//
//             let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine
//
//             let testStoneSizeRingHeight_doLoopStoneSize = true;
//
//             let testStoneSizeRingHeight = function (position: iXY, safeDistance = 300): boolean {
//               let stoneType = getStoneTypeItem(stoneGroup.type);
//               if (stoneType) {
//                 let sizeLeft, sizeRight;
//
//                 if (stoneGroup.mode == 20 || stoneGroup.mode == 30) {
//                   let interpolationFront = that.interpolate(position.x - stoneSize / 2, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x - stoneSize / 2, that.backVertices);
//
//                   sizeLeft = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//
//                   interpolationFront = that.interpolate(position.x + stoneSize / 2, that.frontVertices);
//                   interpolationBack = that.interpolate(position.x + stoneSize / 2, that.backVertices);
//
//                   sizeRight = interpolationBack.z - interpolationFront.z - safeDistance;
//                   // sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//                 }
//                 else {
//                   let interpolationFront = that.interpolate(position.x, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x, that.backVertices);
//
//                   sizeLeft = sizeRight = (interpolationBack.z - interpolationFront.z) - safeDistance;
//                   // sizeLeft = sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//                 }
//
//                 // console.log(sizeLeft, sizeRight);
//
//                 let maxStoneSize = Math.min(sizeLeft, sizeRight) / stoneType.sizeDepthFactor;
//
//                 if (stoneGroup.size > maxStoneSize) {
//                   if (testStoneSizeRingHeight_doLoopStoneSize) {
//                     stoneGroup.size = getLowerStoneSize(stoneGroup.type, maxStoneSize);
//                     ring.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
//                     loopStoneSize = true;
//                     Log("info", "Die Steingröße wurde angepasst (0x5)");
//                   }
//                   return false;
//                 }
//               }
//               return true;
//             }
//
//             while (loopDistribution && !loopStoneSize) {
//               loopDistribution = false;
//
//               if (stoneCount === 1) //
//               {
//                 POINTS = [{x: 0, y: 0}];
//                 if (!testStoneSizeRingHeight(POINTS[0]))
//                   break;
//               } //
//               else if (stoneGroup.distribution <= 20) // aneinander, halber, ganzer, doppelter Steinabstand
//               {
//                 let distance = distributionY / 2;
//                 let sc = stoneCount;
//                 if (sc % 2 === 1) {
//                   POINTS = [{x: 0, y: 0}];
//                   distance *= 2;
//                   sc--;
//                 }
//                 let c = sc / 2;
//
//                 let curX = 0;
//
//                 let curY = 0, u, v, d;
//                 while (c > 0) {
//                   let p = getPoint(curX, curY, distance, 1);
//                   if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
//                   {
//                     stoneCount = POINTS.length;
//                     Log("info", "Steinbegrenzung am Rand");
//                     break;
//                   }
//                   if (POINTS.length === 0)
//                     distance *= 2;
//                   curX = p.x;
//                   curY = p.y;
//
//                   if (!testStoneSizeRingHeight(p))
//                     break;
//
//                   POINTS.push(p);
//                   POINTS.push({x: -curX, y: height - curY})
//
//                   c--;
//
//                   u = curX;
//                   v = height / 2 - curY;
//                   d = Math.sqrt(u * u + v * v);
//                   // @ts-ignore
//                   if (d < distance || curY > maxY) {
//                     stoneCount = POINTS.length;
//                     stoneGroup.distribution = 100;
//                     loopDistribution = true;
//                     break;
//                   }
//                 }
//               } //
//               else // drittel, halber, ganzer Ring
//               {
//                 if (stoneCount === 2) {
//                   // @ts-ignore
//                   let p = getPoint(0, 0, maxY, 1, true);
//                   if (stoneGroup.distribution === 100) // ganzer Ring
//                   {
//                     POINTS.push({x: 0, y: 0});
//                     if (!testStoneSizeRingHeight(POINTS[0]))
//                       break;
//                   } else {
//                     POINTS.push(p);
//                     if (!testStoneSizeRingHeight(p))
//                       break;
//                   }
//
//                   // POINTS.push({x: -p.x, y: p.y})
//                   POINTS.push({x: -p.x, y: height - p.y})
//                 } else {
//                   let getDistance = function (distribution: number, waveLength: number, stoneCount: number) {
//                     return ((waveLength * 2) / stoneCount) / 2;
//                   }
//
//                   let doLoop = true,
//                     loopCount = 200,
//                     sc_before = stoneCount,
//                     // @ts-ignore
//                     distance = getDistance(stoneGroup.distribution, maxY, sc_before),
//                     sc_half,
//                     p1,
//                     u,
//                     v,
//                     d;
//
//                   while (doLoop && loopCount-- > 0) {
//                     doLoop = false;
//                     let sc = sc_before;
//                     POINTS = [];
//                     while (distance < stoneSizeY_half_safe && sc > 1) {
//                       sc--;
//                       // @ts-ignore
//                       distance = getDistance(stoneGroup.distribution, maxY, sc);
//                     }
//                     if (sc % 2 === 1) {
//                       POINTS = [{x: 0, y: 0}];
//                       if (!testStoneSizeRingHeight(POINTS[0]))
//                         break;
//                       distance *= 2;
//                       sc--;
//                     }
//                     sc /= 2;
//                     sc_half = 0;
//                     let curX = 0,
//                       curY = 0;
//
//                     while (1 && sc > 0) {
//                       let p = getPoint(curX, curY, distance, 1, false);
//
//                       if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
//                       {
//                         break;
//                       }
//
//                       if (!testStoneSizeRingHeight(p))
//                         break;
//
//                       if (POINTS.length === 0)
//                         distance *= 2;
//
//                       curX = p.x;
//                       curY = p.y;
//                       POINTS.push(p);
//                       POINTS.push({x: -p.x, y: height - p.y})
//                       sc -= 1;
//                       sc_half += 1;
//                     }
//
//                     // @ts-ignore
//                     if (stoneGroup.distribution < 100 && curY < maxY - stoneSizeY_half_safe) // drittel oder halber Ring
//                     {
//                       distance = (distance + 50) / 2;
//                       doLoop = true;
//                     }
//
//                     if (stoneGroup.distribution === 100 && POINTS.length > 2) // ganzer Ring
//                     {
//                       p1 = POINTS[POINTS.length - 1];
//                       u = p1.x * 2;
//                       v = height - p1.y * 2;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d > distance + 100) {
//                         let t = d / 100;
//                         distance = (distance + t / 20) / 2;
//                         if (distance < stoneSizeY_half_safe) break;
//                         doLoop = true;
//                       }
//                     }
//                   }
//
//                   if (stoneGroup.distribution === 100) // ganzer Ring
//                     // @ts-ignore
//                     Log("debug", " Distanzfehler: " + ((distance - d) / 1000).toFixed(4) + "mm");
//                   Log("debug", "Durchläufe: " + (200 - loopCount));
//                 }
//               }
//             }
//
//             if (loopStoneSize)
//               continue;
//
//             if (stoneGroup.count > 0 && stoneGroup.count != POINTS.length) {
//               stoneGroup.count = POINTS.length;
//               Log("info", "Die Steinanzahl wurde angepasst");
//             }
//
//             POINTS.forEach(function (e) {
//               if (e.y > ringData.ringSize / 2)
//                 e.y -= ringData.ringSize;
//             })
//
//             POINTS.sort(function (a, b): number {
//               return a.y - b.y;
//             })
//
//             if (stoneGroup.rows > 1) // Steinreihen
//             {
//               let minX = 100000,
//                 maxX = -100000,
//                 i,
//                 i_l = POINTS.length / 2,
//                 i1 = 0,
//                 p1,
//                 p1_last: iXY | null = null,
//                 i2 = (POINTS.length === 2) ? 1 : (POINTS.length % 2 === 0) ? 2 : 1,
//                 p2,
//                 u,
//                 v,
//                 d,
//                 stoneShift = stoneSizeX_safe,
//                 stoneDiameter = stoneSizeY_safe,
//                 recalcStoneShift = true,
//                 doLoop = true,
//                 loopCount = 100,
//                 maxRows = AppComponent.app.data.stoneRowsMax,
//                 numRows = stoneGroup.rows,
//                 POINTS_ROWS = [] as iXY[];
//
//               for (i = 0; i < i_l; i++) {
//                 p1 = POINTS[i];
//                 if (p1.x < minX) minX = p1.x;
//                 else if (p1.x > maxX) maxX = p1.x;
//               }
//
//               minX = -minX;
//               minX = ringData.ringWidth / 2 - minX - ring.calc.stoneSafeLeft;
//               maxX = ringData.ringWidth / 2 - maxX - ring.calc.stoneSafeRight;
//
//
//               if (POINTS.length > 1) {
//                 p1 = POINTS[i1];
//                 p2 = POINTS[i2];
//                 v = p2.y - p1.y;
//
//                 while (doLoop && loopCount-- > 0) {
//                   doLoop = false;
//                   u = p1.x + stoneShift - p2.x;
//                   d = Math.sqrt(u * u + v * v);
//                   if (d < stoneDiameter) {
//                     stoneShift += 100;
//                     doLoop = true;
//                   }
//                 }
//               }
//
//               if (stoneShift < stoneDiameter)
//                 stoneShift = stoneDiameter;
//
//               while (recalcStoneShift) {
//                 recalcStoneShift = false;
//                 POINTS_ROWS = [];
//                 p1_last = null;
//
//                 maxRows = Math.trunc((Math.min(minX, maxX) * 2 - stoneDiameter) / stoneShift) + 1;
//                 ring.calc.stone[stoneGroupIndex].maxRow = maxRows;
//                 if (numRows > maxRows) {
//                   Log("info", "max Steinreihen angepasst:" + maxRows);
//                   numRows = stoneGroup.rows = maxRows;
//                 }
//
//                 let shiftPoints = ((numRows - 1) * stoneShift) / 2;
//
//                 i_l = POINTS.length;
//                 for (i = 0; i < i_l;) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     // Abstand zum vorherigen p1...
//                     if (p1_last) {
//                       u = p2.x - p1_last.x;
//                       v = p2.y - p1_last.y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     // Abstand zum nächsten p1...
//                     let inc = (i === 0 && i_l % 2 !== 0) ? 1 : 2;
//                     if (i < i_l - inc) {
//                       u = p2.x - POINTS[i + inc].x - shiftPoints;
//                       v = p2.y - POINTS[i + inc].y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     POINTS_ROWS.push(p2);
//                     p1_last = p1;
//                   }
//                   if (recalcStoneShift)
//                     break;
//                   if (i === 0 && i_l % 2 !== 0) i++;
//                   else i += 2;
//                 }
//                 i = (i_l % 2 === 0) ? 1 : 2;
//                 for (i; i < i_l; i += 2) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     POINTS_ROWS.push(p2);
//                   }
//                 }
//               }
//
//               POINTS = POINTS_ROWS;
//
//               // nochmal sortieren
//               POINTS.sort(function (a, b): number {
//                 return (a.y - b.y);
//               })
//             } else {
//               ring.calc.stone[stoneGroupIndex].maxRow = AppComponent.app.data.stoneRowsMax;
//             }
//
//
//             // berechne Geometriedaten...
//             let p = [] as iXY[];
//             // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
//             POINTS.forEach(function (e) {
//               if (e.y < 0) {
//                 let result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, -1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//                 p.push({x: e.x, y: e.y});
//                 result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, 1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//               } else {
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
//                 p.push({x: e.x, y: e.y});
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
//               }
//             })
//
//             //  Position
//             let positionOffset = 0.0;
//
//             if (1) // Neue Version mit positionDiv
//             {
//               positionOffset = map(stoneGroup.positionValue, 0, ringData.ringWidth, -ringData.ringWidth / 2, ringData.ringWidth / 2);
//
//               if (0) {
//                 let doLoop = true, doLoop_Count = 50, limit = positionOffset;
//                 testStoneSizeRingHeight_doLoopStoneSize = false;
//                 while (doLoop && doLoop_Count-- > 0) {
//                   doLoop = false;
//
//                   for (let i = 0, i_l = p.length; i < i_l; i++) {
//                     if (!testStoneSizeRingHeight({x: p[i].x + positionOffset, y: p[i].y})) {
//                       doLoop = true;
//                       break;
//                     }
//                   }
//
//                   if (doLoop) {
//                     if (positionOffset < 0)
//                       positionOffset += 100;
//                     else positionOffset -= 100;
//
//                     limit = positionOffset;
//                   }
//                 }
//               }
//
//               p.forEach(function (e) {
//                 e.x += positionOffset;
//               })
//
//
//
//
//             }
//             // else if (stoneGroup.positionValue !== 0)
//             // {
//             //   testStoneSizeRingHeight_doLoopStoneSize = false;
//             //   let pMin: iXY = {x: 0, y: 0}, pMax: iXY = {x: 0, y: 0};
//             //
//             //   p.forEach(function (e)
//             //   {
//             //     if (e.x < pMin.x)
//             //       pMin = e;
//             //     if (e.x > pMax.x)
//             //       pMax = e;
//             //   })
//             //
//             //   let availSpaceLeft = stoneSafeLeft - pMin.x + stoneSizeX_half;
//             //   let availSpaceRight = stoneSafeRight - pMax.x - stoneSizeX_half;
//             //
//             //   if (1)
//             //   {
//             //     if (stoneGroup.positionValue < 0)
//             //     {
//             //       // console.log("availLeft: " + (availSpaceLeft));
//             //       let test = testStoneSizeRingHeight({x: availSpaceLeft, y: pMin.y});
//             //       // console.log("test = ", test);
//             //
//             //       while (test == false && availSpaceLeft < 0)
//             //       {
//             //         availSpaceLeft += 50;
//             //         // console.log("   testing: " + (availSpaceLeft));
//             //         test = testStoneSizeRingHeight({x: availSpaceLeft, y: pMin.y});
//             //         // console.log("   test = ", test);
//             //       }
//             //
//             //       if (availSpaceLeft > 0)
//             //         availSpaceLeft = 0;
//             //       else
//             //         availSpaceLeft *= -stoneGroup.positionValue;
//             //
//             //       if (availSpaceLeft < 0)
//             //       {
//             //         p.forEach(function (e)
//             //         {
//             //           e.x += availSpaceLeft;
//             //         })
//             //         positionOffset = availSpaceLeft;
//             //       }
//             //       else
//             //       {
//             //         stoneGroup.positionId = 0;
//             //         stoneGroup.positionValue = 0.0;
//             //         Log("info", "Steinposition nicht möglich oder Abstand zu gering");
//             //       }
//             //
//             //     }
//             //     else if (stoneGroup.positionValue > 0)
//             //     {
//             //       // console.log("availRight: " + availSpaceRight);
//             //       let test = testStoneSizeRingHeight({x: availSpaceRight, y: pMax.y});
//             //       // console.log("test = ", test);
//             //
//             //       while (test == false && availSpaceRight > 0)
//             //       {
//             //         availSpaceRight -= 50;
//             //         // console.log("   testing: " + availSpaceRight);
//             //         test = testStoneSizeRingHeight({x: availSpaceRight, y: pMax.y});
//             //         // console.log("   test = ", test);
//             //       }
//             //
//             //       if (availSpaceRight < 0)
//             //         availSpaceRight = 0;
//             //       else
//             //         availSpaceRight *= stoneGroup.positionValue;
//             //
//             //       if (availSpaceRight > 0)
//             //       {
//             //         p.forEach(function (e)
//             //         {
//             //           e.x += availSpaceRight;
//             //         })
//             //         positionOffset = availSpaceRight;
//             //       }
//             //       else
//             //       {
//             //         stoneGroup.positionId = 0;
//             //         stoneGroup.positionValue = 0.0;
//             //         Log("info", "Steinposition nicht möglich oder Abstand zu gering");
//             //       }
//             //     }
//             //   }
//             //
//             //   // if (0)
//             //   // {
//             //   //     switch (stoneGroup.position)
//             //   //     {
//             //   //         case -1:
//             //   //         {
//             //   //             console.log("availLeft: " + availSpaceLeft);
//             //   //             let test = testStoneSizeRingHeight({x: pMin.x + availSpaceLeft, y: pMin.y});
//             //   //             console.log("test = ", test);
//             //   //
//             //   //             while (test == false && availSpaceLeft < 0)
//             //   //             {
//             //   //                 availSpaceLeft += 50;
//             //   //                 console.log("   testing: " + availSpaceLeft);
//             //   //                 test = testStoneSizeRingHeight({x: pMin.x + availSpaceLeft, y: pMin.y});
//             //   //                 console.log("   test = ", test);
//             //   //             }
//             //   //
//             //   //             if (availSpaceLeft < -100)
//             //   //             {
//             //   //                 p.forEach(function (e)
//             //   //                 {
//             //   //                     e.x += availSpaceLeft;
//             //   //                 })
//             //   //                 positionOffset = availSpaceLeft;
//             //   //             }
//             //   //             else
//             //   //             {
//             //   //                 stoneGroup.position = 0.0;
//             //   //                 Log("info", "Steinposition 'links' nicht möglich");
//             //   //             }
//             //   //             break;
//             //   //         }
//             //   //         case 1:
//             //   //         {
//             //   //             console.log("availRight: " + availSpaceRight);
//             //   //             let test = testStoneSizeRingHeight({x: pMax.x + availSpaceRight, y: pMax.y});
//             //   //             console.log("test = ", test);
//             //   //
//             //   //             while (test == false && availSpaceRight > 0)
//             //   //             {
//             //   //                 availSpaceRight -= 50;
//             //   //                 console.log("   testing: " + availSpaceRight);
//             //   //                 test = testStoneSizeRingHeight({x: pMax.x + availSpaceRight, y: pMax.y});
//             //   //                 console.log("   test = ", test);
//             //   //             }
//             //   //             if (availSpaceRight > 100)
//             //   //             {
//             //   //                 p.forEach(function (e)
//             //   //                 {
//             //   //                     e.x += availSpaceRight;
//             //   //                 })
//             //   //                 positionOffset = availSpaceRight;
//             //   //             }
//             //   //             else
//             //   //             {
//             //   //                 stoneGroup.position = 0.0;
//             //   //                 Log("info", "Steinposition 'rechts' nicht möglich");
//             //   //             }
//             //   //             break;
//             //   //         }
//             //   //         default:
//             //   //         {
//             //   //             console.log("implement me: stone position free")
//             //   //             break;
//             //   //         }
//             //   //     }
//             //   // }
//             // }
//
//             // let testStoneSizeForRingHeight = true;
//             // testStoneSizeRingHeight_doLoopStoneSize = false;
//             // p.forEach(e =>
//             // {
//             //   if (!testStoneSizeRingHeight(e))
//             //     testStoneSizeForRingHeight = false;
//             // });
//             //
//             // if (!testStoneSizeForRingHeight)
//             // {
//             //   if (stoneGroup.positionValue < 0)
//             //     stoneGroup.positionValue += 100;
//             //   else
//             //     stoneGroup.positionValue -= 100;
//             //   continue;
//             // }
//
//             let vertexRows = [] as CVertex[][];
//             let vertexRow = [] as CVertex[];
//             let index = 0;
//             let v: CVertex;
//
//             p.forEach(function (e) {
//               v = new CVertex(e.x - stoneSizeX_half, e.y, that.interpolate(e.x - stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x, e.y, that.interpolate(e.x, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x + stoneSizeX_half, e.y, that.interpolate(e.x + stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//
//               vertexRows.push(vertexRow);
//               vertexRow = [];
//             })
//
//             let stoneHelperMesh = new CMesh;
//             stoneHelperMesh.rows = vertexRows;
//
//             stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);
//
//             // out.push({
//             //     vertex2DArray: vertexRows,
//             //     type: "helper",
//             //     index: -1,
//             //     no_rotate: true,
//             //     triangulate_useVectorDist: false,
//             // });
//
//             let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
//               let positions = [];
//               let tangents = [];
//               let normals = [];
//               let binormals = [];
//               let distances = [] as number[];
//
//               let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
//               let i, i_l = rows.length, row, j, j_l;
//
//               for (i = 1; i < i_l; i += 3) {
//
//                 row = rows[i];
//                 j_l = row.length;
//
//                 for (j = 1; j < j_l; j += 3) {
//                   // Position
//                   P = CVertex.fromVertex(row[j]);
//
//                   // Tangente
//                   rows[i + 1][j].toRef(v1);
//                   rows[i - 1][j].toRef(v2);
//                   T = CVertex.fromVertex(v1).sub(v2);
//
//                   // Normal
//                   row[j - 1].toRef(v1);
//                   row[j + 1].toRef(v2);
//                   N = CVertex.fromVertex(v2).sub(v1);
//
//                   // Binormal
//                   B = CVertex.cross(N, T);
//
//                   // Normal again
//                   CVertex.crossToRef(B, T, N);
//
//                   N.normalize();
//                   B.normalize();
//                   T.normalize();
//
//                   positions.push(P);
//                   tangents.push(T);
//                   normals.push(N);
//                   binormals.push(B);
//                 }
//               }
//
//               return {
//                 distances,
//                 positions,
//                 normals,
//                 binormals,
//                 tangents
//               }
//             };
//             let stonePathVectors = computeStonePathVectors(vertexRows);
//
//             that.stonePaths.push(stonePathVectors);
//
//             let computeBevels = function () {
//               vertexRow = [];
//               vertexRows = [];
//               index = 0;
//               let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//               if (stoneSizeItem && stoneMode) {
//                 let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
//                   distY = stoneMode.bevelDistY || stoneMode.safeDistY;
//                 let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
//                   bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
//                   bevelHeight = stoneSizeItem.size / 2;
//
//                 /*
//                 Die Bevels werden an der Nullposition erstellt und beim Aufbau der Scene mit den Steinen
//                 ausgerichtet
//                  */
//                 switch (stoneGroup.type) {
//                   case 1: // Brillant
//                   {
//                     let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
//                     if (bevelTesselation < 2) bevelTesselation = 2;
//                     bevelTesselation *= 4;
//                     bevelTesselation--;
//                     let incRad = Math.PI * 2 / bevelTesselation,
//                       rad,
//                       dist,
//                       i,
//                       extraBorder = 30;
//
//                     stonePathVectors.positions.forEach(function (p, bevelIndex) {
//                         vertexRows = [];
//                         index = 0;
//
//                         // 1. Reihe
//                         vertexRow = [];
//                         dist = bevelSizeX_half + extraBorder;
//                         rad = 0.0;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(dist, 0, 0);
//                           v.rotateY(rad);
//                           rad -= incRad;
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // 2. Reihe
//                         vertexRow = [];
//                         dist = bevelSizeX_half;
//                         rad = 0.0;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(dist, 0, 0);
//                           v.rotateY(rad);
//                           rad -= incRad;
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // Mittelpunkt
//                         i = vertexRow.length;
//                         vertexRow = [];
//                         while (i--) {
//                           v = new CVertex(0, -bevelHeight, 0);
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         out.push({
//                           vertex2DArray: vertexRows,
//                           type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                           index: -1,
//                           no_rotate: true,
//                         });
//                       }
//                     )
//                     break;
//                   }
//                   case 2: // Princess
//                   case 3: // Princess 45°
//                   {
//                     let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
//                     if (bevelTesselation < 2) bevelTesselation = 2;
//                     bevelTesselation--;
//                     let incX = (bevelSizeX_half * 2) / bevelTesselation,
//                       incY = (bevelSizeY_half * 2) / bevelTesselation,
//                       x, y, z, i, j, j_l,
//                       extraBorder = 30;
//
//                     stonePathVectors.positions.forEach(function (p, bevelIndex) {
//                         vertexRows = [];
//                         index = 0;
//
//                         // 1. Reihe
//                         vertexRow = [];
//                         incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
//                         incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
//                         x = -bevelSizeX_half - extraBorder;
//                         y = 0;
//                         z = -bevelSizeY_half - extraBorder;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // 2. Reihe
//                         vertexRow = [];
//                         incX = (bevelSizeX_half * 2) / bevelTesselation;
//                         incY = (bevelSizeY_half * 2) / bevelTesselation;
//                         x = -bevelSizeX_half;
//                         y = 0;
//                         z = -bevelSizeY_half;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // Mittelpunkt
//                         i = vertexRow.length;
//                         vertexRow = [];
//                         while (i--) {
//                           v = new CVertex(0, -bevelHeight, 0);
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         if (stoneGroup.type == 3) // Princess 45°
//                         {
//                           for (i = 0; i < 3; i++) {
//                             vertexRow = vertexRows[i];
//                             j_l = vertexRow.length;
//                             for (j = 0; j < j_l; j++)
//                               vertexRow[j].rotateY(Math.PI / 4);
//                           }
//
//                         }
//
//                         out.push({
//                           vertex2DArray: vertexRows,
//                           type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                           index: -1,
//                           no_rotate: true,
//                         });
//                       }
//                     )
//                     break;
//                   }
//                   case 4: // Baguette quer
//                   case 5: // Baguette längs
//                   {
//                     let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
//                       bevelSizeY_half = stoneSizeItem.lengthFactor ? bevelSizeX_half * stoneSizeItem.lengthFactor : bevelSizeX_half,
//                       bevelHeight = stoneSizeItem.size / 2;
//
//                     let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
//                     if (bevelTesselation < 2) bevelTesselation = 2;
//                     bevelTesselation--;
//                     let incX = (bevelSizeX_half * 2) / bevelTesselation,
//                       incY = (bevelSizeY_half * 2) / bevelTesselation,
//                       x, y, z, i,
//                       extraBorder = 30;
//
//                     stonePathVectors.positions.forEach(function (p, bevelIndex) {
//                         vertexRows = [];
//                         index = 0;
//
//                         // 1. Reihe
//                         vertexRow = [];
//                         incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
//                         incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
//                         x = -bevelSizeX_half - extraBorder;
//                         y = 0;
//                         z = -bevelSizeY_half - extraBorder;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // 2. Reihe
//                         vertexRow = [];
//                         incX = (bevelSizeX_half * 2) / bevelTesselation;
//                         incY = (bevelSizeY_half * 2) / bevelTesselation;
//                         x = -bevelSizeX_half;
//                         y = 0;
//                         z = -bevelSizeY_half;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // Mittelpunkt
//                         i = vertexRow.length;
//                         vertexRow = [];
//                         while (i--) {
//                           v = new CVertex(0, -bevelHeight, 0);
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         out.push({
//                           vertex2DArray: vertexRows,
//                           type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                           index: -1,
//                           no_rotate: true,
//                         });
//                       }
//                     )
//                     break;
//                   }
//                 }
//               }
//             }
//             let computeChannel = function () {
//               vertexRows = [];
//               index = 0;
//               // @ts-ignore
//               let lastX = positionOffset, lastY = p[0].y;
//               let pChannel = [] as iXY[];
//               if (stoneGroup.distribution === 100) {
//                 lastY = -innerCircumference / 2;
//                 pChannel.push(getPoint(lastX, lastY, 0, 1));
//               }
//               let stoneType = getStoneTypeItem(stoneGroup.type);
//               // @ts-ignore
//               let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
//               // let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor : stoneSize * 0.5;
//
//               // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine (siehe weiter oben)
//               p.forEach(function (e, index) {
//                 if (index > 0 && e.y <= lastY)
//                   return;
//
//                 /*
//                 Bei einer Verteilung, wo die Steinabstände größer als der halbe Steinabstand sind, müssen
//                 extra Stützpunkte erzeugt werden
//                 */
//
//                 if (1 && e.y - lastY > stoneSizeY_half_safe + 100) {
//                   let count = Math.round((e.y - lastY) / stoneSizeY_half_safe + 0.5);
//                   let dist = (e.y - lastY) / count;
//                   for (let i = 0; i < count - 1; i++) {
//                     let p2;
//                     if (lastY < 0) {
//                       p2 = getPoint(lastX, lastY + ringData.ringSize, dist, 1)
//                       p2.y -= ringData.ringSize;
//                     } else {
//                       p2 = getPoint(lastX, lastY, dist, 1);
//                     }
//
//                     lastX = p2.x;
//                     lastY = p2.y;
//                     pChannel.push(p2);
//                   }
//                 }
//
//                 pChannel.push(e);
//                 lastX = e.x;
//                 lastY = e.y;
//               })
//
//               if (stoneGroup.distribution < 100) {
//                 // erste und letzte Reihe des Kanal nach unten/oben schieben, damit mehr "Luft" zwischen den ersten/letzte Stein und dem Kanal entsteht
//                 // pChannel[0] = getPoint(pChannel[1].x, pChannel[1].y, stoneSizeY_half_safe + (stoneSize * 50 / 1000), -1);
//                 // pChannel[pChannel.length - 1] = getPoint(pChannel[pChannel.length - 2].x, pChannel[pChannel.length - 2].y, stoneSizeY_half_safe + (stoneSize * 50 / 1000), 1);
//
//                 // Der Abstand der Endkappen zum Stein soll wie der seitliche Abstand sein. Der Kanal ist 12% kleiner als der Stein.
//                 pChannel[0] = getPoint(pChannel[1].x, pChannel[1].y, (stoneSizeY * 0.88) * 0.5, -1);
//                 pChannel[pChannel.length - 1] = getPoint(pChannel[pChannel.length - 2].x, pChannel[pChannel.length - 2].y, (stoneSizeY * 0.88) * 0.5, 1);
//               }
//               // Kanal nach oben verlängern; nach unten wird bereits beim initialisieren von lastY berücksichtigt
//               if (stoneGroup.distribution === 100) {
//                 let max = innerCircumference / 2;
//                 let dist = (max - lastY);// stoneSizeY_half_safe;
//                 if (dist > stoneSizeY_half_safe) {
//                   // dist = (max - lastY) / (dist / stoneSizeY_half_safe);
//                   // for (let y = lastY; y <= max; y += dist)
//                   // {
//                   //     pChannel.push(getPoint(0, y, dist, 1)); // TODO: Kanal ist an den Enden versetzt bei Position links/rechts
//                   // }
//                   let count = Math.round((max - lastY) / stoneSizeY_half_safe + 0.5);
//                   let dist = (max - lastY) / count;
//                   // count--;
//                   for (let i = 0; i < count; i++) {
//                     let p2;
//                     if (lastY < 0) {
//                       p2 = getPoint(lastX, lastY + ringData.ringSize, dist, 1)
//                       p2.y -= ringData.ringSize;
//                     } else {
//                       p2 = getPoint(lastX, lastY, dist, 1);
//                     }
//
//                     lastX = p2.x;
//                     lastY = p2.y;
//                     pChannel.push(p2);
//                   }
//                 } else {
//                   pChannel.push({x: 0, y: max});
//                 }
//               }
//
//               let doVertex = function (e: iXY, depth: number = 0) {
//                 let ip = that.interpolate(e.x, that.frontVertices);
//                 v = new CVertex(e.x, e.y, ip.z + depth);
//                 v.i = index++;
//                 v.u = ip.uv_u;
//                 v.v = v.y;
//                 vertexRow.push(v);
//               }
//
//               /*
//               1         7
//               |         |
//               2|3--4--5|6
//               */
//
//
//               /*
//               result[0] = width to left, result[1] = width to right
//                */
//               let calcChannelWidthOnRotatedStone = function (x: number): number[] {
//
//                 let channelSizeX_half = stoneSizeX_half * 0.88;
//
//                 let left = that.interpolate_distance(x, that.frontVertices, -channelSizeX_half).x;
//                 let right = that.interpolate_distance(x, that.frontVertices, channelSizeX_half).x;
//                 // let left = that.interpolate_distance(x, that.frontVertices, -stoneSizeX_half).x;
//                 // let right = that.interpolate_distance(x, that.frontVertices, stoneSizeX_half).x;
//
//                 return [x - left, right - x];
//               }
//
//
//               index = 0;
//               let z;
//               pChannel.forEach(function (e) {
//                 vertexRow = [];
//
//                 let channelWidth = calcChannelWidthOnRotatedStone(e.x);
//
//                 doVertex({x: e.x - channelWidth[0], y: e.y});
//                 doVertex({x: e.x - channelWidth[0], y: e.y}, depth);
//
//                 z = vertexRow[vertexRow.length - 1].z;
//
//                 doVertex({x: e.x - channelWidth[0], y: e.y});
//                 vertexRow[vertexRow.length - 1].z = z;
//                 doVertex(e);
//                 vertexRow[vertexRow.length - 1].z = z;
//                 doVertex({x: e.x + channelWidth[1], y: e.y});
//                 vertexRow[vertexRow.length - 1].z = z;
//
//                 doVertex({x: e.x + channelWidth[1], y: e.y}, depth);
//                 vertexRow[vertexRow.length - 1].z = z;
//
//                 doVertex({x: e.x + channelWidth[1], y: e.y});
//
//                 vertexRows.push(vertexRow);
//               })
//
//               stoneHelperMesh.rows = vertexRows;
//
//               // wenn keine Endkappen notwendig sind, dann gleiche die erste und letzte Reihe an
//               if (stoneGroup.distribution == 100) {
//                 // vertexRows.pop();
//                 let firstRow = vertexRows[0],
//                   lastRow = vertexRows[vertexRows.length - 1];
//                 let i, i_l = firstRow.length;
//                 for (i = 0; i < i_l; i++) {
//                   lastRow[i].x = firstRow[i].x;
//                   lastRow[i].y = -firstRow[i].y;
//                   lastRow[i].z = firstRow[i].z;
//                   lastRow[i].u = firstRow[i].u;
//                 }
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "frontChannel",
//                 index: -1,
//                 triangulate_isFrontFace: true,
//                 triangulate_useVectorDist: false,
//                 no_outline: true,
//                 close_normals: stoneGroup.distribution == 100 ? true : false,
//               });
//
//               if (1 && stoneGroup.distribution < 100) {
//                 // unten schließen
//                 let e = pChannel[0];
//                 vertexRows = [];
//                 index = 0;
//
//                 let channelWidth = calcChannelWidthOnRotatedStone(e.x);
//
//                 vertexRow = [];
//                 doVertex({x: e.x - channelWidth[0], y: e.y});
//                 doVertex(e);
//                 doVertex({x: e.x + channelWidth[1], y: e.y});
//                 vertexRows.push(vertexRow);
//
//                 vertexRow = [];
//                 doVertex({x: e.x - channelWidth[0], y: e.y}, depth);
//                 doVertex(e, depth);
//                 doVertex({x: e.x + channelWidth[1], y: e.y}, depth);
//                 vertexRows.push(vertexRow);
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "frontChannel",
//                   index: -1,
//                   triangulate_isFrontFace: true,
//                   triangulate_useVectorDist: false,
//                   no_outline: true,
//                 });
//
//                 // oben schließen
//                 e = pChannel[pChannel.length - 1];
//                 vertexRows = [];
//                 index = 0;
//
//                 vertexRow = [];
//                 doVertex({x: e.x - channelWidth[0], y: e.y});
//                 doVertex(e);
//                 doVertex({x: e.x + channelWidth[1], y: e.y});
//                 vertexRows.push(vertexRow);
//
//                 vertexRow = [];
//                 doVertex({x: e.x - channelWidth[0], y: e.y}, depth);
//                 doVertex(e, depth);
//                 doVertex({x: e.x + channelWidth[1], y: e.y}, depth);
//                 vertexRows.push(vertexRow);
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "frontChannel",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: true,
//                 });
//               }
//             }
//
//             let computeCut = function () {
//               let CUT_MESH_ROWS = [] as CVertex[][],
//                 vertexRow = [] as CVertex[],
//                 index = 0,
//                 v: CVertex,
//                 depth = stoneGroup.size * 0.15,
//                 dist_left_right = depth / 2;
//
//               // @ts-ignore
//               let borderDistance = stoneSizeX_half + stoneMode.safeDistX / 2;
//
//               let doVertex_left = function (p: iXY, noZoffset: boolean = false) {
//                 let IP = that.interpolate(p.x - borderDistance - dist_left_right, that.frontVertices);
//                 v = new CVertex(p.x - borderDistance - dist_left_right, p.y, IP.z);
//                 v.i = index++;
//                 v.u = IP.uv_u;
//                 vertexRow.push(v);
//                 IP = that.interpolate(p.x - borderDistance, that.frontVertices);
//                 v = new CVertex(p.x - borderDistance, p.y, IP.z + (noZoffset ? 0 : depth));
//                 v.i = index++;
//                 v.u = IP.uv_u;
//                 vertexRow.push(v);
//                 v = CVertex.fromVertex(v);
//                 v.i = index++;
//                 v.u = IP.uv_u;
//                 vertexRow.push(v);
//               }
//
//               let doVertex_right = function (p: iXY, noZoffset: boolean = false) {
//                 let IP = that.interpolate(p.x + borderDistance, that.frontVertices);
//                 v = new CVertex(p.x + borderDistance, p.y, IP.z + (noZoffset ? 0 : depth));
//                 v.i = index++;
//                 v.u = IP.uv_u;
//                 vertexRow.push(v);
//                 v = CVertex.fromVertex(v);
//                 v.i = index++;
//                 v.u = IP.uv_u;
//                 vertexRow.push(v);
//                 IP = that.interpolate(p.x + borderDistance + dist_left_right, that.frontVertices);
//                 v = new CVertex(p.x + borderDistance + dist_left_right, p.y, IP.z);
//                 v.i = index++;
//                 v.u = IP.uv_u;
//                 vertexRow.push(v);
//               }
//
//               let doVertex = function (p: iXY, d: number = depth) {
//                 let IP;
//                 IP = that.interpolate(p.x, that.frontVertices);
//                 v = new CVertex(p.x, p.y, IP.z + d);
//                 v.i = index++;
//                 v.u = IP.uv_u;
//                 vertexRow.push(v);
//               }
//
//               let doCaps = true;
//               let doLeft = true;
//               let doRight = true;
//
//               if (1) // teste, ob Endkappen notwendig sind
//               {
//                 let P = POINTS[0];
//                 let h = -height / 2;
//                 if (P.y - stoneSizeY_safe < h)
//                   doCaps = false;
//               }
//
//               // -> 221121: teste, ob die Auflösung erhöht werden muss
//               let left = POINTS[0].x - borderDistance;
//               let right = POINTS[stoneGroup.rows - 1].x + borderDistance;
//
//               let resolutionDist = right - left;
//               let resolutionCount = Math.ceil(resolutionDist / 400);
//               // <- 221121
//
//               // -> caps unten, neue Version
//               if (1 && doCaps) {
//                 let minIndex = 0 * stoneGroup.rows;
//                 let maxIndex = 0 * stoneGroup.rows + stoneGroup.rows - 1;
//                 let minX = POINTS[minIndex].x - borderDistance,
//                   maxX = POINTS[maxIndex].x + borderDistance,
//                   dist = maxX - minX,
//                   step = dist / resolutionCount,
//                   Y = POINTS[minIndex].y;
//
//                 if (doLeft) {
//                   let p = {x: minX + positionOffset + borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, -1);
//                     result.y -= ringData.ringSize;
//                     doVertex_left(result, true);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, -1);
//                     doVertex_left(result, true);
//                   }
//                 }
//
//                 // ## Mitte
//                 for (let X = minX + step; X <= maxX - step / 2; X += step) {
//                   let p = {x: X + positionOffset, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, -1);
//                     result.y -= ringData.ringSize;
//                     doVertex(result, 0);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, -1);
//                     doVertex(result, 0);
//                   }
//                 }
//
//                 if (doRight) {
//                   let p = {x: maxX + positionOffset - borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, -1);
//                     result.y -= ringData.ringSize;
//                     doVertex_right(result, true);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, -1);
//                     doVertex_right(result, true);
//                   }
//                 }
//
//                 CUT_MESH_ROWS.push(vertexRow);
//
//                 // Verschnitt-Grund
//                 vertexRow = [];
//
//                 if (doLeft) {
//                   let p = {x: minX + positionOffset + borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, -1);
//                     result.y -= ringData.ringSize;
//                     doVertex_left(result);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, -1);
//                     doVertex_left(result);
//                   }
//
//                 }
//
//                 // ## Mitte
//                 for (let X = minX + step; X <= maxX - step / 2; X += step) {
//                   let p = {x: X + positionOffset, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, -1);
//                     result.y -= ringData.ringSize;
//                     doVertex(result);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, -1);
//                     doVertex(result);
//                   }
//                 }
//
//                 if (doRight) {
//                   let p = {x: maxX + positionOffset - borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, -1);
//                     result.y -= ringData.ringSize;
//                     doVertex_right(result);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, -1);
//                     doVertex_right(result);
//                   }
//                 }
//
//                 CUT_MESH_ROWS.push(vertexRow);
//               }
//               // <-
//
//               // -> neue Version
//               if (1) {
//                 for (let i = 0; i < stoneCount; i++) {
//                   let minIndex = i * stoneGroup.rows;
//                   let maxIndex = i * stoneGroup.rows + stoneGroup.rows - 1;
//                   let minX = POINTS[minIndex].x - borderDistance,
//                     maxX = POINTS[maxIndex].x + borderDistance,
//                     dist = maxX - minX,
//                     step = dist / resolutionCount,
//                     Y = POINTS[minIndex].y;
//
//                   // # untere Steinkante -------------------------------------------------------------
//                   vertexRow = [];
//                   if (doLeft) // ## Links
//                   {
//                     let p = {x: minX + positionOffset + borderDistance, y: Y};
//
//                     if (p.y < 0) {
//                       let result = i == 0 ? getPoint(p.x, p.y + ringData.ringSize, (borderDistance-dist_left_right), -1) : getPoint(p.x, p.y + ringData.ringSize, stoneSizeY_half_safe, -1)
//                       result.y -= ringData.ringSize;
//                       if (i == 0 && !doCaps) result.y = -height / 2;
//                       doVertex_left(result);
//                     } else {
//                       let result = i == 0 ? getPoint(p.x, p.y, (borderDistance-dist_left_right), -1) : getPoint(p.x, p.y, stoneSizeY_half_safe, -1);
//                       if (i == 0 && !doCaps) result.y = height / 2;
//                       doVertex_left(result);
//                     }
//                   }
//
//                   // ## Mitte
//                   for (let X = minX + step; X <= maxX - step / 2; X += step) {
//                     let p = {x: X + positionOffset, y: Y};
//
//                     if (p.y < 0) {
//                       let result = i == 0 ? getPoint(p.x, p.y + ringData.ringSize, (borderDistance-dist_left_right), -1) : getPoint(p.x, p.y + ringData.ringSize, stoneSizeY_half_safe, -1)
//                       result.y -= ringData.ringSize;
//                       if (i == 0 && !doCaps) result.y = -height / 2;
//                       doVertex(result);
//                     } else {
//                       let result = i == 0 ? getPoint(p.x, p.y, (borderDistance-dist_left_right), -1) : getPoint(p.x, p.y, stoneSizeY_half_safe, -1);
//                       if (i == 0 && !doCaps) result.y = height / 2;
//                       doVertex(result);
//                     }
//                   }
//
//                   if (doRight) // ## Rechts
//                   {
//                     let p = {x: maxX + positionOffset - borderDistance, y: Y};
//
//                     if (p.y < 0) {
//                       let result = i == 0 ? getPoint(p.x, p.y + ringData.ringSize, (borderDistance-dist_left_right), -1) : getPoint(p.x, p.y + ringData.ringSize, stoneSizeY_half_safe, -1)
//                       result.y -= ringData.ringSize;
//                       if (i == 0 && !doCaps) result.y = -height / 2;
//                       doVertex_right(result);
//                     } else {
//                       let result = i == 0 ? getPoint(p.x, p.y, (borderDistance-dist_left_right), -1) : getPoint(p.x, p.y, stoneSizeY_half_safe, -1);
//                       if (i == 0 && !doCaps) result.y = height / 2;
//                       doVertex_right(result);
//                     }
//                   }
//
//                   CUT_MESH_ROWS.push(vertexRow);
//
//                   // # Steinmittelpunktslinie --------------------------------------------------------
//                   vertexRow = [];
//                   // ## Links
//                   if (doLeft) {
//                     let p = {x: minX + positionOffset + borderDistance, y: Y};
//                     doVertex_left(p); // Links
//                   }
//
//                   // ## Mitte
//                   for (let X = minX + step; X <= maxX - step / 2; X += step) {
//                     let p = {x: X + positionOffset, y: Y};
//                     doVertex(p);
//                   }
//
//                   // ## Rechts
//                   if (doRight) {
//                     let p = {x: maxX + positionOffset - borderDistance, y: Y};
//                     doVertex_right(p); // Rechts
//                   }
//
//                   CUT_MESH_ROWS.push(vertexRow);
//
//                   // obere Steinkante (nur bei letztem Stein) ----------------------------------------
//                   if (1 && i == stoneCount - 1) {
//                     vertexRow = [];
//
//                     if (doLeft) // Links
//                     {
//                       let p = {x: minX + positionOffset + borderDistance, y: Y};
//
//                       if (p.y < 0) {
//                         let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1)
//                         result.y -= ringData.ringSize;
//                         if (!doCaps) result.y = -height / 2;
//                         doVertex_left(result);
//                       } else {
//                         let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                         if (!doCaps) result.y = height / 2;
//                         doVertex_left(result);
//                       }
//                     }
//
//                     // ## Mitte
//                     for (let X = minX + step; X <= maxX - step/2; X += step) {
//                       let p = {x: X + positionOffset, y: Y};
//
//                       if (p.y < 0) {
//                         let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1)
//                         result.y -= ringData.ringSize;
//                         if (i == 0 && !doCaps) result.y = -height / 2;
//                         doVertex(result);
//                       } else {
//                         let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                         if (i == 0 && !doCaps) result.y = height / 2;
//                         doVertex(result);
//                       }
//                     }
//
//                     if (doRight) // Rechts
//                     {
//                       let p = {x: maxX + positionOffset - borderDistance, y: Y};
//
//                       if (p.y < 0) {
//                         let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1)
//                         result.y -= ringData.ringSize;
//                         if (!doCaps) result.y = -height / 2;
//                         doVertex_right(result);
//                       } else {
//                         let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                         if (!doCaps) result.y = height / 2;
//                         doVertex_right(result);
//                       }
//                     }
//
//                     CUT_MESH_ROWS.push(vertexRow);
//                   }
//                 }
//               }
//               // <- neue Version
//
//               // -> caps oben, neue Version
//               if (1 && doCaps) {
//                 let minIndex = (stoneCount - 1) * stoneGroup.rows;
//                 let maxIndex = (stoneCount - 1) * stoneGroup.rows + stoneGroup.rows - 1;
//                 let minX = POINTS[minIndex].x - borderDistance,
//                   maxX = POINTS[maxIndex].x + borderDistance,
//                   dist = maxX - minX,
//                   step = dist / resolutionCount,
//                   Y = POINTS[minIndex].y;
//
//                 // Verschnitt-Grund
//                 vertexRow = [];
//
//                 if (doLeft) {
//                   let p = {x: minX + positionOffset + borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1);
//                     result.y -= ringData.ringSize;
//                     doVertex_left(result);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                     doVertex_left(result);
//                   }
//                 }
//
//                 // ## Mitte
//                 for (let X = minX + step; X <= maxX - step / 2; X += step) {
//                   let p = {x: X + positionOffset, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1);
//                     result.y -= ringData.ringSize;
//                     doVertex(result);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                     doVertex(result);
//                   }
//                 }
//
//                 if (doRight) {
//                   let p = {x: maxX + positionOffset - borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1);
//                     result.y -= ringData.ringSize;
//                     doVertex_right(result);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                     doVertex_right(result);
//                   }
//                 }
//
//                 CUT_MESH_ROWS.push(vertexRow);
//
//                 vertexRow = [];
//
//                 if (doLeft) {
//                   let p = {x: minX + positionOffset + borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1);
//                     result.y -= ringData.ringSize;
//                     doVertex_left(result, true);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                     doVertex_left(result, true);
//                   }
//                 }
//
//                 // ## Mitte
//                 for (let X = minX + step; X <= maxX - step / 2; X += step) {
//                   let p = {x: X + positionOffset, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1);
//                     result.y -= ringData.ringSize;
//                     doVertex(result, 0);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                     doVertex(result, 0);
//                   }
//                 }
//
//                 if (doRight) {
//                   let p = {x: maxX + positionOffset - borderDistance, y: Y};
//
//                   if (p.y < 0) {
//                     let result = getPoint(p.x, p.y + ringData.ringSize, borderDistance-dist_left_right, 1);
//                     result.y -= ringData.ringSize;
//                     doVertex_right(result, true);
//                   } else {
//                     let result = getPoint(p.x, p.y, borderDistance-dist_left_right, 1);
//                     doVertex_right(result, true);
//                   }
//                 }
//
//                 CUT_MESH_ROWS.push(vertexRow);
//               }
//               // <-
//
//               if (1 && !doCaps) // wenn keine Endkappen notwendig sind, dann gleiche die erste und letzte Reihe an
//               {
//                 let firstRow = CUT_MESH_ROWS[0],
//                   lastRow = CUT_MESH_ROWS[CUT_MESH_ROWS.length - 1];
//                 let i, i_l = firstRow.length;
//                 for (i = 0; i < i_l; i++) {
//                   lastRow[i].x = firstRow[i].x;
//                   lastRow[i].y = -firstRow[i].y;
//                   lastRow[i].z = firstRow[i].z;
//                   lastRow[i].u = firstRow[i].u;
//                 }
//               }
//
//               let mesh = new CMesh;
//               mesh.rows = CUT_MESH_ROWS;
//
//               out.push({
//                 vertex2DArray: CUT_MESH_ROWS,
//                 type: "frontCut_" + (CUT_MESH_ROWS[0].length), // codiere die Anzahl der Punkte pro Reihe in den Namen; wird beim zuweisen der Materialien benötigt
//                 index: -1,
//                 triangulate_useVectorDist: false,
//                 triangulate_isFrontFace: true,
//                 close_normals: !doCaps,
//                 no_outline: true,
//               });
//             }
//
//             if (stoneGroup.mode === 10) // eingerieben
//               computeBevels();
//             else if (stoneGroup.mode === 20) // Verschnitt
//               computeCut();
//             else if (stoneGroup.mode === 30) // Kanal
//               computeChannel();
//           }
//         }
//
//         test = [31]; // Kanal quer, nur Brillant gültig
//         if (test.indexOf(stoneGroup.mode) !== -1) {
//           let stoneMode = findStoneMode(stoneGroup.mode);
//           let stoneType = getStoneTypeItem(stoneGroup.type);
//
//           if (!stoneMode || !stoneType)
//             return;
//
//           let loopStoneSize = true;
//           let loopStoneSizeCount = 50;
//
//           while (loopStoneSize && loopStoneSizeCount-- > 0) {
//             loopStoneSize = false;
//
//             let stoneSize = stoneGroup.size;
//             let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//
//             if (stoneSizeItem) {
//               let x = stoneSizeItem.size, y;
//               if (stoneSizeItem.lengthFactor) {
//                 y = x * stoneSizeItem.lengthFactor;
//                 stoneSize = Math.sqrt(x * x + y * y);
//               } else if (stoneSizeItem.calcSize) {
//                 stoneSize = stoneSizeItem.calcSize;
//               }
//               // else: ...Fallback zur stoneSize wurde oben schon definiert...
//
//             }
//
//             let ringRadiusInner = innerCircumference / Math.PI / 2,
//               ringRadiusOuter = ringRadiusInner + ring.ringData.ringHeight,
//               ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
//               stoneSizeX_safe = stoneSize + stoneMode.safeDistX,
//               stoneSizeX_half = stoneSize / 2,
//               stoneSizeY_safe = (stoneSize + stoneMode.safeDistY) * ringRadiusFactor,
//               stoneSizeY = stoneSize * ringRadiusFactor,
//               stoneSizeY_half = stoneSizeY / 2,
//               stoneSizeY_half_safe = stoneSizeY_safe / 2,
//               distributionY = stoneSizeY_safe,
//               stoneCount = stoneGroup.count,
//               height = ringData.ringSize,
//               yCenter = height / 2,
//               heightFactor = 1.0,
//               maxY: number,
//
//               // amp = ringData.waveAmp / 100,
//               // amp100 = ring.calc.amp100,
//
//               stoneSafeLeft = -xCenter + ring.calc.stoneSafeLeft,
//               stoneSafeRight = xCenter - ring.calc.stoneSafeRight,
//
//               maxStoneCount = 0;
//
//             /*
//             ermittle den nächsten Y-Wert im Abstand von 'distance'; 'inc' kann positiv oder negativ sein
//             */
//             // let debug_getPoint = false;
//             let getPoint = function (curX: number, curY: number, distance: number, inc: number, testY: boolean = false): iXY {
//               if (inc < 0) distance = -distance;
//               return {x: curX, y: curY + distance};
//               // let result = {x: 0, y: 0}, x, y = curY, u, v, d = 0;
//               // let orig_x = get_sin(curY, height, 1);
//               // let offset = curX - orig_x;
//               //
//               // if (testY)
//               // {
//               //   y = curY + distance;
//               //   result.x = get_sin(y, height, 1);
//               //   result.y = y;
//               //   return result;
//               // }
//               //
//               // while (1)
//               // {
//               //   y += inc;
//               //   x = get_sin(y, height, 1);
//               //   u = x - curX + offset;
//               //   v = y - curY;
//               //   d = Math.sqrt(u * u + v * v);
//               //   if (d >= distance)
//               //   {
//               //     x += offset;
//               //     result.x = x;
//               //     result.y = y;
//               //     break;
//               //   }
//               // }
//               //
//               // return result;
//             }
//             //
//             // let getMaxStoneCount = function (): number
//             // {
//             //   let countMax = 1, p = getPoint(0, -maxY, stoneSizeY_half_safe, 1);
//             //
//             //   while (1)
//             //   {
//             //     p = getPoint(p.x, p.y, distributionY, 1);
//             //     if (p.y > maxY)
//             //       break;
//             //
//             //     if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
//             //     {
//             //       console.log(p.x, stoneSizeX_half, stoneSafeLeft, stoneSafeRight, distributionY);
//             //       break;
//             //     }
//             //
//             //     countMax++;
//             //   }
//             //
//             //   return countMax;
//             // }
//             //
//             // let loop = 0;
//             // while (loop++ < 2) // 2 Durchläufe sind hier notwendig weil sich innerhalb dieser Schleife die Verteilung ändern kann
//             // {
//             //   distributionY = stoneSizeY_safe;
//             //
//             //   switch (stoneGroup.distribution)
//             //   {
//             //     case 0: // aneinander
//             //       break;
//             //     case 5: // halber Steinabstand
//             //       distributionY *= 1.5;
//             //       break;
//             //     case 10: // ganzer Steinabstand
//             //       distributionY *= 2.0;
//             //       break;
//             //     case 20: // doppelter Steinabstand
//             //       distributionY *= 3.0;
//             //       break;
//             //     case 33: // drittel Ring
//             //       heightFactor = 0.33;
//             //       break;
//             //     case 50: // halber Ring
//             //       heightFactor = 0.5;
//             //       break;
//             //     case 100: // ganzer Ring
//             //       heightFactor = 1.0;
//             //       break;
//             //   }
//             //
//             //   maxY = yCenter * heightFactor;
//             //
//             //   // if (stoneGroup.distribution == 100)
//             //   // {
//             //   //   maxY -= stoneSizeY / 2;
//             //   // }
//             //
//             //   maxStoneCount = getMaxStoneCount();
//             //
//             //   if (stoneGroup.distribution >= 33 && stoneGroup.count < 0)
//             //     stoneGroup.count = stoneCount = maxStoneCount;
//             //
//             //   if (stoneGroup.count < 0)
//             //   {
//             //     switch (stoneGroup.count)
//             //     {
//             //       case -33.339:
//             //         stoneCount = Math.trunc(maxStoneCount / 3);
//             //         break;
//             //       case -50:
//             //         stoneCount = Math.trunc(maxStoneCount / 2);
//             //         break;
//             //       case -100:
//             //         stoneCount = maxStoneCount;
//             //         stoneGroup.distribution = 100;
//             //         break;
//             //     }
//             //   }
//             //
//             //   if (stoneCount > maxStoneCount)
//             //     stoneCount = maxStoneCount;
//             //
//             //   if (stoneGroup.mode === 20)
//             //   {
//             //     if (stoneCount === maxStoneCount)
//             //       stoneGroup.distribution = 100;
//             //     else
//             //       stoneGroup.distribution = 0;
//             //   }
//             //   else
//             //   {
//             //     stoneGroup.rows = 1;
//             //   }
//             // }
//             //
//             // ring.calc.stone[stoneGroupIndex].maxCount = maxStoneCount;
//             //
//             // let loopDistribution = true;
//
//             interface iXY {
//               x: number;
//               y: number;
//             }
//
//             let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine
//
//             let testStoneSizeRingHeight_doLoopStoneSize = true;
//
//             let testStoneSizeRingHeight = function (position: iXY, safeDistance = 1000): boolean {
//               let stoneType = getStoneTypeItem(stoneGroup.type);
//               if (stoneType) {
//                 let sizeLeft, sizeRight;
//
//                 if (stoneGroup.mode == 20 || stoneGroup.mode == 30) {
//                   let interpolationFront = that.interpolate(position.x - stoneSize / 2, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x - stoneSize / 2, that.backVertices);
//
//                   sizeLeft = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//
//                   interpolationFront = that.interpolate(position.x + stoneSize / 2, that.frontVertices);
//                   interpolationBack = that.interpolate(position.x + stoneSize / 2, that.backVertices);
//
//                   sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//                 } else {
//                   let interpolationFront = that.interpolate(position.x, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x, that.backVertices);
//
//                   sizeLeft = sizeRight = -(interpolationFront.z - interpolationBack.z);// - safeDistance;
//                 }
//
//                 let maxStoneSize = Math.min(sizeLeft, sizeRight) / stoneType.sizeDepthFactor;
//
//                 if (stoneGroup.size > maxStoneSize) {
//                   if (testStoneSizeRingHeight_doLoopStoneSize) {
//                     stoneGroup.size = getLowerStoneSize(stoneGroup.type, maxStoneSize);
//                     ring.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
//                     loopStoneSize = true;
//                     Log("info", "Die Steingröße wurde angepasst (0x6)");
//                   }
//                   return false;
//                 }
//               }
//               return true;
//             }
//
//             POINTS = [{x: 0, y: 0}];
//             testStoneSizeRingHeight(POINTS[0]);
//
//             if (stoneGroup.count > 1) {
//               let minX = 100000,
//                 maxX = -100000,
//                 i,
//                 i_l = POINTS.length / 2,
//                 i1 = 0,
//                 p1,
//                 p1_last: iXY | null = null,
//                 i2 = (POINTS.length === 2) ? 1 : (POINTS.length % 2 === 0) ? 2 : 1,
//                 p2,
//                 u,
//                 v,
//                 d,
//                 stoneShift = stoneSize,//_safe,
//                 stoneDiameter = stoneSizeY,//_safe,
//                 recalcStoneShift = true,
//                 doLoop = true,
//                 loopCount = 100,
//                 maxRows = 9999,
//                 numRows = stoneGroup.count, // verwende den Algorithmus von oben für die horizontale Teilung
//                 POINTS_ROWS = [] as iXY[],
//                 safeProfileSideDist = 0;//stoneMode.safeProfileSideDist ? stoneMode.safeProfileSideDist : 0;
//
//               for (i = 0; i < i_l; i++) {
//                 p1 = POINTS[i];
//                 if (p1.x < minX) minX = p1.x;
//                 if (p1.x > maxX) maxX = p1.x;
//               }
//               console.log(minX, maxX);
//
//               minX = -minX;
//               minX = ringData.ringWidth / 2 - minX - safeProfileSideDist;// - ring.calc.stoneSafeLeft;
//               maxX = ringData.ringWidth / 2 - maxX - safeProfileSideDist;// - ring.calc.stoneSafeRight;
//
//               console.log(minX, maxX);
//
//               if (POINTS.length > 1) {
//                 p1 = POINTS[i1];
//                 p2 = POINTS[i2];
//                 v = p2.y - p1.y;
//
//                 while (doLoop && loopCount-- > 0) {
//                   doLoop = false;
//                   u = p1.x + stoneShift - p2.x;
//                   d = Math.sqrt(u * u + v * v);
//                   if (d < stoneDiameter) {
//                     stoneShift += 100;
//                     doLoop = true;
//                   }
//                 }
//               }
//
//               if (stoneShift < stoneDiameter)
//                 stoneShift = stoneDiameter;
//
//               while (recalcStoneShift) {
//                 recalcStoneShift = false;
//                 POINTS_ROWS = [];
//                 p1_last = null;
//
//                 maxRows = Math.trunc((Math.min(minX, maxX) * 2) / stoneShift);// + 1;
//                 ring.calc.stone[stoneGroupIndex].maxRow = maxRows;
//                 if (numRows > maxRows) {
//                   Log("info", "max Steinanzahl angepasst:" + maxRows);
//                   numRows = stoneGroup.count = maxRows;
//                 }
//
//                 let shiftPoints = ((numRows - 1) * stoneShift) / 2;
//
//                 i_l = POINTS.length;
//                 for (i = 0; i < i_l;) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     // Abstand zum vorherigen p1...
//                     if (p1_last) {
//                       u = p2.x - p1_last.x;
//                       v = p2.y - p1_last.y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     // Abstand zum nächsten p1...
//                     let inc = (i === 0 && i_l % 2 !== 0) ? 1 : 2;
//                     if (i < i_l - inc) {
//                       u = p2.x - POINTS[i + inc].x - shiftPoints;
//                       v = p2.y - POINTS[i + inc].y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     POINTS_ROWS.push(p2);
//                     p1_last = p1;
//                   }
//                   if (recalcStoneShift)
//                     break;
//                   if (i === 0 && i_l % 2 !== 0) i++;
//                   else i += 2;
//                 }
//                 i = (i_l % 2 === 0) ? 1 : 2;
//                 for (i; i < i_l; i += 2) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     POINTS_ROWS.push(p2);
//                   }
//                 }
//               }
//
//               POINTS = POINTS_ROWS;
//
//               // nochmal sortieren
//               POINTS.sort(function (a, b): number {
//                 return (a.y - b.y);
//               })
//             }
//
//             let testStoneSizeForRingHeight = true;
//             POINTS.forEach(e => {
//               if (!testStoneSizeRingHeight(e))
//                 testStoneSizeForRingHeight = false;
//             });
//
//             if (!testStoneSizeForRingHeight) {
//               continue;
//             }
//
//
//             // berechne Geometriedaten...
//             let p = [] as iXY[];
//             // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
//             POINTS.forEach(function (e) {
//               if (e.y < 0) {
//                 let result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half, -1)
//                 // let result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, -1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//                 p.push({x: e.x, y: e.y});
//                 result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half, 1)
//                 // result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, 1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//               } else {
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half, -1));
//                 // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
//                 p.push({x: e.x, y: e.y});
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half, 1));
//                 // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
//               }
//             })
//
//             let vertexRows = [] as CVertex[][];
//             let vertexRow = [] as CVertex[];
//             let index = 0;
//             let v: CVertex;
//
//             p.forEach(function (e) {
//               v = new CVertex(e.x - stoneSizeX_half, e.y, that.interpolate(e.x - stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x, e.y, that.interpolate(e.x, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x + stoneSizeX_half, e.y, that.interpolate(e.x + stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//
//               vertexRows.push(vertexRow);
//               vertexRow = [];
//             })
//
//             let stoneHelperMesh = new CMesh;
//             stoneHelperMesh.rows = vertexRows;
//
//             stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);
//
//             // out.push({
//             //   vertex2DArray: vertexRows,
//             //   type: "helper",
//             //   index: -1,
//             //   no_rotate: true,
//             //   triangulate_useVectorDist: false,
//             // });
//
//             let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
//               let positions = [];
//               let tangents = [];
//               let normals = [];
//               let binormals = [];
//               let distances = [] as number[];
//
//               let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
//               let i, i_l = rows.length, row, j, j_l;
//
//               for (i = 1; i < i_l; i += 3) {
//
//                 row = rows[i];
//                 j_l = row.length;
//
//                 for (j = 1; j < j_l; j += 3) {
//                   // Position
//                   P = CVertex.fromVertex(row[j]);
//
//                   // Tangente
//                   rows[i + 1][j].toRef(v1);
//                   rows[i - 1][j].toRef(v2);
//
//                   T = CVertex.fromVertex(v1).sub(v2);
//
//                   // Normal
//                   if (i == 1) {
//                     row[j - 1].toRef(v1); // Stein war falsch gedreht
//                     // row[j].toRef(v1);
//                     row[j + 1].toRef(v2);
//                   } else if (i == i_l - 2) {
//                     row[j - 1].toRef(v1);
//                     row[j].toRef(v2);
//                   } else {
//                     row[j - 1].toRef(v1);
//                     row[j + 1].toRef(v2);
//                   }
//
//                   N = CVertex.fromVertex(v2).sub(v1);
//
//                   // Binormal
//                   B = CVertex.cross(N, T);
//
//                   // Normal again
//                   CVertex.crossToRef(B, T, N);
//
//                   N.normalize();
//                   B.normalize();
//                   T.normalize();
//
//                   positions.push(P);
//                   tangents.push(T);
//                   normals.push(N);
//                   binormals.push(B);
//                 }
//               }
//
//               return {
//                 distances,
//                 positions,
//                 normals,
//                 binormals,
//                 tangents
//               }
//             };
//             let stonePathVectors = computeStonePathVectors(vertexRows);
//
//             that.stonePaths.push(stonePathVectors);
//
//             let vertexFront_start: CVertex | null = null;
//             let vertexFront_end: CVertex | null = null;
//
//             let channelSizeY_half = stoneSizeY_half * 0.88; // 12% kleiner als Stein: Ticket 1046
//
//             let computeCrossChannelFront = function () {
//               let vertexRows = [] as CVertex[][];
//               let vertexRow = [] as CVertex[];
//               let index = 0;
//               let v: CVertex;
//               let fv = that.frontVertices;
//               let bv = that.backVertices;
//               let cv = that.channelVertices;
//
//               let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
//               // let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor : stoneSize * 0.5;
//
//               let xStart = -ringData.ringWidth / 2;
//               for (let x = -ringData.ringWidth / 2; x < 0; x++) {
//                 let ip_channel = that.interpolate(x, cv);
//                 let ip_front = that.interpolate(x, fv);
//                 if (ip_channel.z + depth > ip_front.z) {
//                   xStart = ip_channel.x;
//                   break;
//                 }
//               }
//               let y = -channelSizeY_half;
//               let yStep = (channelSizeY_half * 2) / 4;
//               let xEnd = -xStart;
//
//               // mesh für alpha
//               for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half * 2) {
//                 for (let i = 0, i_l = fv.length; i < i_l; i++) {
//                   let x = fv[i].x;
//                   if (i == 0) x = xStart;
//                   else {
//                     if (x < xStart) continue;
//                   }
//                   if (x > xEnd) x = xEnd;
//                   let ip = that.interpolate(x, fv);
//                   v = new CVertex(x, y, ip.z);
//                   v.i = index++;
//                   v.u = ip.uv_u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                   if (x == xEnd) break;
//                 }
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelFront_alpha",
//                 index: -1,
//                 triangulate_isFrontFace: true,
//                 triangulate_useVectorDist: false,
//                 no_outline: false,
//                 close_normals: false,
//               });
//
//               // mesh für albedo
//               vertexRows = [];
//               vertexRow = [];
//               index = 0;
//               fv = that.frontVertices;
//
//               xStart = -ringData.ringWidth / 2;
//               for (let x = -ringData.ringWidth / 2; x < 0; x++) {
//                 let ip_back = that.interpolate(x, bv, that.middleVertexBack[0]);
//                 let ip_channel = that.interpolate(x, cv);
//                 let ip_front = that.interpolate(x, fv);
//                 if (ip_channel.z + depth < ip_front.z) {
//                   continue;
//                 }
//                 if (ip_channel.z + depth > ip_back.z)
//                   continue;
//                 if (ip_channel.z + depth <= ip_back.z) {
//                   xStart = ip_channel.x;
//                   break;
//                 }
//               }
//
//               xEnd = -xStart;
//
//               for (let i = 0; i < 5; i++) {
//                 let x = xStart;
//                 let count = 0;
//                 while (count++ < 100) {
//                   let ip_channel = that.interpolate(x, cv);
//                   v = new CVertex(x, y, ip_channel.z + depth);
//                   v.i = index++;
//                   v.u = ip_channel.uv_u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                   if (x == xEnd)
//                     break;
//                   x = cv[ip_channel.indexVectorB].x;
//                   if (x > xEnd)
//                     x = xEnd;
//                 }
//
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//
//                 y += yStep;
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelFront",
//                 index: -1,
//                 triangulate_isFrontFace: true,
//                 triangulate_useVectorDist: false,
//                 no_outline: true,
//                 close_normals: false,
//               });
//
//               vertexFront_start = CVertex.fromVertex(vertexRows[0][0]);
//               vertexFront_end = CVertex.fromVertex(vertexRows[0][vertexRows[0].length - 1]);
//             }
//             let computeCrossChannelBack = function () {
//               let vertexRows = [] as CVertex[][];
//               let vertexRow = [] as CVertex[];
//               let index = 0;
//               let v: CVertex;
//               let v2: CVertex;
//               let cv = that.channelVertices;
//               let bv = that.backVertices;
//               let ip;
//
//               if (vertexFront_start && vertexFront_start.z > bv[0].z) {
//                 // mesh für alpha
//                 for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
//                   v = CVertex.fromVertex(bv[0]);
//                   v.i = index++;
//                   v.y = y;
//                   v.v = y;
//                   v.u = 0.0;
//                   vertexRow.push(v);
//
//                   if (vertexFront_start.x < v.x) {
//                     v2 = new CVertex(vertexFront_start.x, y, vertexFront_start.z);
//                     let dist = v.distance(v2);
//                     ip = that.interpolate_distance_2(bv, 0, dist);
//                     v2.x = ip.x;
//                     v2.z = ip.z;
//                     v2.y = y;
//                     v2.i = index++;
//                     v2.u = ip.uv_u;
//                     v2.v = v2.y;
//                     vertexRow.push(v2);
//                   } else {
//                     ip = that.interpolate(vertexFront_start.x, bv);
//                     v2 = new CVertex(ip.x, y, ip.z);
//                     v2.i = index++;
//                     v2.u = ip.uv_u;
//                     v2.v = v2.y;
//                     vertexRow.push(v2);
//                   }
//
//                   vertexRows.push(vertexRow);
//                   vertexRow = [];
//                 }
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelBack_alpha",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: true,
//                   close_normals: false,
//                 });
//               }
//               if (vertexFront_end && vertexFront_end.z > bv[bv.length - 1].z) {
//                 vertexRows = [];
//                 vertexRow = [];
//                 index = 0;
//                 // mesh für alpha
//
//                 for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
//                   v = CVertex.fromVertex(bv[bv.length - 1]);
//                   v.i = index++;
//                   v.y = y;
//                   v.v = y;
//                   v.u = 1.0;
//
//                   if (vertexFront_end.x > v.x) {
//                     v2 = new CVertex(vertexFront_end.x, y, vertexFront_end.z);
//                     let dist = v.distance(v2);
//                     ip = that.interpolate_distance_2(bv, bv.length - 1, -dist);
//                     v2.x = ip.x;
//                     v2.z = ip.z;
//                     v2.y = y;
//                     v2.i = index++;
//                     v2.u = ip.uv_u;
//                     v2.v = v2.y;
//                     vertexRow.push(v2);
//                   } else {
//                     ip = that.interpolate(vertexFront_end.x, bv);
//                     v2 = new CVertex(ip.x, y, ip.z);
//                     v2.i = index++;
//                     v2.u = ip.uv_u;
//                     v2.v = v2.y;
//                     vertexRow.push(v2);
//                   }
//
//                   vertexRow.push(v);
//
//                   vertexRows.push(vertexRow);
//                   vertexRow = [];
//                 }
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelBack_alpha",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: true,
//                   close_normals: false,
//                 });
//               }
//             }
//             let computeCrossChannelCaps = function () {
//
//               let slv = that.stepLeftVertices;
//               let srv = that.stepRightVertices;
//               let fv = that.frontVertices;
//               let bv = that.backVertices;
//               let commonZ = bv[that.middleVertexBack[0]].z;
//               let Y = [channelSizeY_half, -channelSizeY_half];
//
//               for (let y = 0; y < 2; y++) {
//                 let vertexRows = [] as CVertex[][];
//                 let vertexRow = [] as CVertex[];
//                 let index = 0;
//                 let v: CVertex;
//
//                 // Front
//                 for (let i = 0, i_l = slv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(slv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//                 for (let i = 0, i_l = fv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(fv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//                 for (let i = 0, i_l = srv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(srv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//                 let row_0 = vertexRow;
//                 vertexRow = [];
//
//                 for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//                   v = new CVertex(row_0[i].x, Y[y], commonZ);
//                   v.i = index++;
//                   v.u = row_0[i].u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelFront",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: false,
//                   close_normals: false,
//                 });
//
//                 // Back
//                 vertexRows = [];
//                 vertexRow = [];
//                 index = 0;
//                 for (let i = 0, i_l = bv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(bv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//                 row_0 = vertexRow;
//                 vertexRow = [];
//
//                 for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//                   v = new CVertex(row_0[i].x, Y[y], commonZ);
//                   v.i = index++;
//                   v.u = row_0[i].u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelFront",
//                   index: -1,
//                   triangulate_isFrontFace: true,
//                   triangulate_useVectorDist: false,
//                   no_outline: false,
//                   close_normals: false,
//                 });
//               }
//             }
//
//             computeCrossChannelFront();
//             computeCrossChannelBack();
//             computeCrossChannelCaps();
//           }
//         }
//
//         test = [35]; // Spannring, nur Brillant gültig
//         if (test.indexOf(stoneGroup.mode) !== -1) {
//           let stoneMode = findStoneMode(stoneGroup.mode);
//           let stoneType = getStoneTypeItem(stoneGroup.type);
//
//           if (!stoneMode || !stoneType)
//             return;
//
//           let loopStoneSize = true;
//           let loopStoneSizeCount = 50;
//
//           while (loopStoneSize && loopStoneSizeCount-- > 0) {
//             loopStoneSize = false;
//
//             let stoneSize = stoneGroup.size;
//             let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//
//             if (stoneSizeItem) {
//               let x = stoneSizeItem.size, y;
//               if (stoneSizeItem.lengthFactor) {
//                 y = x * stoneSizeItem.lengthFactor;
//                 stoneSize = Math.sqrt(x * x + y * y);
//               } else if (stoneSizeItem.calcSize) {
//                 stoneSize = stoneSizeItem.calcSize;
//               }
//               // else: ...Fallback zur stoneSize wurde oben schon definiert...
//
//             }
//
//             let ringRadiusInner = innerCircumference / Math.PI / 2,
//               ringRadiusOuter = ringRadiusInner + ring.ringData.ringHeight,
//               ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
//               // stoneSizeX_safe = stoneSize + stoneMode.safeDistX,
//               stoneSizeX_half = stoneSize / 2,
//               // stoneSizeY_safe = (stoneSize + stoneMode.safeDistY) * ringRadiusFactor,
//               stoneSizeY = stoneSize * ringRadiusFactor,
//               stoneSizeY_half = stoneSizeY / 2,
//               channelSizeY_half = stoneSizeY_half * 0.88
//               // stoneSizeY_half_safe = stoneSizeY_safe / 2,
//               // distributionY = stoneSizeY_safe,
//               // stoneCount = stoneGroup.count,
//               // height = ringData.ringSize,
//               // yCenter = height / 2,
//               // heightFactor = 1.0,
//               // maxY: number,
//
//               // amp = ringData.waveAmp / 100,
//               // amp100 = ring.calc.amp100,
//
//               // stoneSafeLeft = -xCenter + ring.calc.stoneSafeLeft,
//               // stoneSafeRight = xCenter - ring.calc.stoneSafeRight,
//               //
//               // maxStoneCount = 0
//             ;
//
//             /*
//             ermittle den nächsten Y-Wert im Abstand von 'distance'; 'inc' kann positiv oder negativ sein
//             */
//             // let debug_getPoint = false;
//             let getPoint = function (curX: number, curY: number, distance: number, inc: number, testY: boolean = false): iXY {
//               if (inc < 0) distance = -distance;
//               return {x: curX, y: curY + distance};
//               // let result = {x: 0, y: 0}, x, y = curY, u, v, d = 0;
//               // let orig_x = get_sin(curY, height, 1);
//               // let offset = curX - orig_x;
//               //
//               // if (testY)
//               // {
//               //   y = curY + distance;
//               //   result.x = get_sin(y, height, 1);
//               //   result.y = y;
//               //   return result;
//               // }
//               //
//               // while (1)
//               // {
//               //   y += inc;
//               //   x = get_sin(y, height, 1);
//               //   u = x - curX + offset;
//               //   v = y - curY;
//               //   d = Math.sqrt(u * u + v * v);
//               //   if (d >= distance)
//               //   {
//               //     x += offset;
//               //     result.x = x;
//               //     result.y = y;
//               //     break;
//               //   }
//               // }
//               //
//               // return result;
//             }
//             //
//             // let getMaxStoneCount = function (): number
//             // {
//             //   let countMax = 1, p = getPoint(0, -maxY, stoneSizeY_half_safe, 1);
//             //
//             //   while (1)
//             //   {
//             //     p = getPoint(p.x, p.y, distributionY, 1);
//             //     if (p.y > maxY)
//             //       break;
//             //
//             //     if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
//             //     {
//             //       console.log(p.x, stoneSizeX_half, stoneSafeLeft, stoneSafeRight, distributionY);
//             //       break;
//             //     }
//             //
//             //     countMax++;
//             //   }
//             //
//             //   return countMax;
//             // }
//             //
//             // let loop = 0;
//             // while (loop++ < 2) // 2 Durchläufe sind hier notwendig weil sich innerhalb dieser Schleife die Verteilung ändern kann
//             // {
//             //   distributionY = stoneSizeY_safe;
//             //
//             //   switch (stoneGroup.distribution)
//             //   {
//             //     case 0: // aneinander
//             //       break;
//             //     case 5: // halber Steinabstand
//             //       distributionY *= 1.5;
//             //       break;
//             //     case 10: // ganzer Steinabstand
//             //       distributionY *= 2.0;
//             //       break;
//             //     case 20: // doppelter Steinabstand
//             //       distributionY *= 3.0;
//             //       break;
//             //     case 33: // drittel Ring
//             //       heightFactor = 0.33;
//             //       break;
//             //     case 50: // halber Ring
//             //       heightFactor = 0.5;
//             //       break;
//             //     case 100: // ganzer Ring
//             //       heightFactor = 1.0;
//             //       break;
//             //   }
//             //
//             //   maxY = yCenter * heightFactor;
//             //
//             //   // if (stoneGroup.distribution == 100)
//             //   // {
//             //   //   maxY -= stoneSizeY / 2;
//             //   // }
//             //
//             //   maxStoneCount = getMaxStoneCount();
//             //
//             //   if (stoneGroup.distribution >= 33 && stoneGroup.count < 0)
//             //     stoneGroup.count = stoneCount = maxStoneCount;
//             //
//             //   if (stoneGroup.count < 0)
//             //   {
//             //     switch (stoneGroup.count)
//             //     {
//             //       case -33.339:
//             //         stoneCount = Math.trunc(maxStoneCount / 3);
//             //         break;
//             //       case -50:
//             //         stoneCount = Math.trunc(maxStoneCount / 2);
//             //         break;
//             //       case -100:
//             //         stoneCount = maxStoneCount;
//             //         stoneGroup.distribution = 100;
//             //         break;
//             //     }
//             //   }
//             //
//             //   if (stoneCount > maxStoneCount)
//             //     stoneCount = maxStoneCount;
//             //
//             //   if (stoneGroup.mode === 20)
//             //   {
//             //     if (stoneCount === maxStoneCount)
//             //       stoneGroup.distribution = 100;
//             //     else
//             //       stoneGroup.distribution = 0;
//             //   }
//             //   else
//             //   {
//             //     stoneGroup.rows = 1;
//             //   }
//             // }
//             //
//             // ring.calc.stone[stoneGroupIndex].maxCount = maxStoneCount;
//             //
//             // let loopDistribution = true;
//
//             interface iXY {
//               x: number;
//               y: number;
//             }
//
//             let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine
//
//             let testStoneSizeRingHeight_doLoopStoneSize = true;
//
//             let testStoneSizeRingHeight = function (position: iXY, safeDistance = 1000): boolean {
//               let stoneType = getStoneTypeItem(stoneGroup.type);
//               if (stoneType) {
//                 let sizeLeft, sizeRight;
//
//                 if (stoneGroup.mode == 20 || stoneGroup.mode == 30) {
//                   let interpolationFront = that.interpolate(position.x - stoneSize / 2, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x - stoneSize / 2, that.backVertices);
//
//                   sizeLeft = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//
//                   interpolationFront = that.interpolate(position.x + stoneSize / 2, that.frontVertices);
//                   interpolationBack = that.interpolate(position.x + stoneSize / 2, that.backVertices);
//
//                   sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//                 } else {
//                   let interpolationFront = that.interpolate(position.x, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x, that.backVertices);
//
//                   sizeLeft = sizeRight = -(interpolationFront.z - interpolationBack.z);// - safeDistance;
//                 }
//
//                 let maxStoneSize = Math.min(sizeLeft, sizeRight) / stoneType.sizeDepthFactor;
//
//                 if (stoneGroup.size > maxStoneSize) {
//                   if (testStoneSizeRingHeight_doLoopStoneSize) {
//                     stoneGroup.size = getLowerStoneSize(stoneGroup.type, maxStoneSize);
//                     ring.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
//                     loopStoneSize = true;
//                     Log("info", "Die Steingröße wurde angepasst (0x6)");
//                   }
//                   return false;
//                 }
//               }
//               return true;
//             }
//
//             POINTS = [{x: 0, y: 0}];
//             testStoneSizeRingHeight(POINTS[0]);
//
//             if (stoneGroup.count > 1) {
//               let minX = 100000,
//                 maxX = -100000,
//                 i,
//                 i_l = POINTS.length / 2,
//                 i1 = 0,
//                 p1,
//                 p1_last: iXY | null = null,
//                 i2 = (POINTS.length === 2) ? 1 : (POINTS.length % 2 === 0) ? 2 : 1,
//                 p2,
//                 u,
//                 v,
//                 d,
//                 stoneShift = stoneSize,//_safe,
//                 stoneDiameter = stoneSizeY,//_safe,
//                 recalcStoneShift = true,
//                 doLoop = true,
//                 loopCount = 100,
//                 maxRows = 9999,
//                 numRows = stoneGroup.count, // verwende den Algorithmus von oben für die horizontale Teilung
//                 POINTS_ROWS = [] as iXY[],
//                 safeProfileSideDist = stoneMode.safeProfileSideDist ? stoneMode.safeProfileSideDist : 0;
//
//               for (i = 0; i < i_l; i++) {
//                 p1 = POINTS[i];
//                 if (p1.x < minX) minX = p1.x;
//                 else if (p1.x > maxX) maxX = p1.x;
//               }
//
//               minX = -minX;
//               minX = ringData.ringWidth / 2 - minX - safeProfileSideDist;// - ring.calc.stoneSafeLeft;
//               maxX = ringData.ringWidth / 2 - maxX - safeProfileSideDist;// - ring.calc.stoneSafeRight;
//
//               if (POINTS.length > 1) {
//                 p1 = POINTS[i1];
//                 p2 = POINTS[i2];
//                 v = p2.y - p1.y;
//
//                 while (doLoop && loopCount-- > 0) {
//                   doLoop = false;
//                   u = p1.x + stoneShift - p2.x;
//                   d = Math.sqrt(u * u + v * v);
//                   if (d < stoneDiameter) {
//                     stoneShift += 100;
//                     doLoop = true;
//                   }
//                 }
//               }
//
//               if (stoneShift < stoneDiameter)
//                 stoneShift = stoneDiameter;
//
//               while (recalcStoneShift) {
//                 recalcStoneShift = false;
//                 POINTS_ROWS = [];
//                 p1_last = null;
//
//                 maxRows = Math.trunc((Math.min(minX, maxX) * 2 - stoneDiameter) / stoneShift) + 1;
//                 ring.calc.stone[stoneGroupIndex].maxRow = maxRows;
//                 if (numRows > maxRows) {
//                   Log("info", "max Steinanzahl angepasst:" + maxRows);
//                   numRows = stoneGroup.count = maxRows;
//                 }
//
//                 let shiftPoints = ((numRows - 1) * stoneShift) / 2;
//
//                 i_l = POINTS.length;
//                 for (i = 0; i < i_l;) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     // Abstand zum vorherigen p1...
//                     if (p1_last) {
//                       u = p2.x - p1_last.x;
//                       v = p2.y - p1_last.y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     // Abstand zum nächsten p1...
//                     let inc = (i === 0 && i_l % 2 !== 0) ? 1 : 2;
//                     if (i < i_l - inc) {
//                       u = p2.x - POINTS[i + inc].x - shiftPoints;
//                       v = p2.y - POINTS[i + inc].y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     POINTS_ROWS.push(p2);
//                     p1_last = p1;
//                   }
//                   if (recalcStoneShift)
//                     break;
//                   if (i === 0 && i_l % 2 !== 0) i++;
//                   else i += 2;
//                 }
//                 i = (i_l % 2 === 0) ? 1 : 2;
//                 for (i; i < i_l; i += 2) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     POINTS_ROWS.push(p2);
//                   }
//                 }
//               }
//
//               POINTS = POINTS_ROWS;
//
//               // nochmal sortieren
//               POINTS.sort(function (a, b): number {
//                 return (a.y - b.y);
//               })
//             }
//
//             let testStoneSizeForRingHeight = true;
//             POINTS.forEach(e => {
//               if (!testStoneSizeRingHeight(e))
//                 testStoneSizeForRingHeight = false;
//             });
//
//             if (!testStoneSizeForRingHeight) {
//               continue;
//             }
//
//
//             // berechne Geometriedaten...
//             let p = [] as iXY[];
//             // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
//             POINTS.forEach(function (e) {
//               if (e.y < 0) {
//                 let result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half, -1)
//                 // let result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, -1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//                 p.push({x: e.x, y: e.y});
//                 result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half, 1)
//                 // result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, 1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//               } else {
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half, -1));
//                 // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
//                 p.push({x: e.x, y: e.y});
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half, 1));
//                 // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
//               }
//             })
//
//             let vertexRows = [] as CVertex[][];
//             let vertexRow = [] as CVertex[];
//             let index = 0;
//             let v: CVertex;
//
//             p.forEach(function (e) {
//               v = new CVertex(e.x - stoneSizeX_half, e.y, that.interpolate(e.x - stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x, e.y, that.interpolate(e.x, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x + stoneSizeX_half, e.y, that.interpolate(e.x + stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//
//               vertexRows.push(vertexRow);
//               vertexRow = [];
//             })
//
//             let stoneHelperMesh = new CMesh;
//             stoneHelperMesh.rows = vertexRows;
//
//             stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);
//
//             // out.push({
//             //   vertex2DArray: vertexRows,
//             //   type: "helper",
//             //   index: -1,
//             //   no_rotate: true,
//             //   triangulate_useVectorDist: false,
//             // });
//
//             let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
//               let positions = [];
//               let tangents = [];
//               let normals = [];
//               let binormals = [];
//               let distances = [] as number[];
//
//               let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
//               let i, i_l = rows.length, row, j, j_l;
//
//               for (i = 1; i < i_l; i += 3) {
//
//                 row = rows[i];
//                 j_l = row.length;
//
//                 for (j = 1; j < j_l; j += 3) {
//                   // Position
//                   P = CVertex.fromVertex(row[j]);
//
//                   // Tangente
//                   rows[i + 1][j].toRef(v1);
//                   rows[i - 1][j].toRef(v2);
//                   T = CVertex.fromVertex(v1).sub(v2);
//
//                   // Normal
//                   if (i == 1) {
//                     row[j - 1].toRef(v1); // Stein war falsch gedreht
//                     // row[j].toRef(v1);
//                     row[j + 1].toRef(v2);
//                   } else if (i == i_l - 2) {
//                     row[j - 1].toRef(v1);
//                     row[j].toRef(v2);
//                   } else {
//                     row[j - 1].toRef(v1);
//                     row[j + 1].toRef(v2);
//                   }
//                   N = CVertex.fromVertex(v2).sub(v1);
//
//                   // Binormal
//                   B = CVertex.cross(N, T);
//
//                   // Normal again
//                   CVertex.crossToRef(B, T, N);
//
//                   N.normalize();
//                   B.normalize();
//                   T.normalize();
//
//                   positions.push(P);
//                   tangents.push(T);
//                   normals.push(N);
//                   binormals.push(B);
//                 }
//               }
//
//               return {
//                 distances,
//                 positions,
//                 normals,
//                 binormals,
//                 tangents
//               }
//             };
//             let stonePathVectors = computeStonePathVectors(vertexRows);
//
//             that.stonePaths.push(stonePathVectors);
//
//             let vertexFront_start: CVertex | null = null;
//             let vertexFront_end: CVertex | null = null;
//
//             let computeCrossChannelFront = function () {
//               let vertexRows = [] as CVertex[][];
//               let vertexRow = [] as CVertex[];
//               let index = 0;
//               let v: CVertex;
//               let fv = that.frontVertices;
//               let bv = that.backVertices;
//               let cv = that.channelVertices;
//
//               let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
//               // let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor : stoneSize * 0.5;
//
//               let xStart = -ringData.ringWidth / 2;
//               // for (let x = -ringData.ringWidth / 2; x < 0; x++) {
//               //   let ip_channel = that.interpolate(x, cv);
//               //   let ip_front = that.interpolate(x, fv);
//               //   if (ip_channel.z + depth > ip_front.z) {
//               //     xStart = ip_channel.x;
//               //     break;
//               //   }
//               // }
//               let y = -channelSizeY_half;
//               // let y = -stoneSizeY_half - 20;
//               let yStep = (channelSizeY_half * 2) / 4;
//               let xEnd = -xStart;
//
//               // mesh für alpha
//               for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half * 2) {
//                 for (let i = 0, i_l = fv.length; i < i_l; i++) {
//                   let x = fv[i].x;
//                   if (i == 0) x = xStart;
//                   else {
//                     if (x < xStart) continue;
//                   }
//                   if (x > xEnd) x = xEnd;
//                   let ip = that.interpolate(x, fv);
//                   v = new CVertex(x, y, ip.z);
//                   v.i = index++;
//                   v.u = ip.uv_u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                   if (x == xEnd) break;
//                 }
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelFront_alpha",
//                 index: -1,
//                 triangulate_isFrontFace: true,
//                 triangulate_useVectorDist: false,
//                 no_outline: false,
//                 close_normals: false,
//               });
//
//               // mesh für albedo
//               vertexRows = [];
//               vertexRow = [];
//               index = 0;
//               fv = that.frontVertices;
//
//               xStart = -stoneSize / 2 * 0.65; // Brücke unter dem Stein darf max 65% der Steingröße entsprechen
//               // xStart = -ringData.ringWidth / 2;
//               // for (let x = -ringData.ringWidth / 2; x < 0; x++) {
//               //   let ip_back = that.interpolate(x, bv, that.middleVertexBack[0]);
//               //   let ip_channel = that.interpolate(x, cv);
//               //   let ip_front = that.interpolate(x, fv);
//               //   if (ip_channel.z + depth < ip_front.z) {
//               //     continue;
//               //   }
//               //   if (ip_channel.z + depth > ip_back.z)
//               //     continue;
//               //   if (ip_channel.z + depth <= ip_back.z) {
//               //     xStart = ip_channel.x;
//               //     break;
//               //   }
//               // }
//
//               xEnd = -xStart;
//
//               for (let i = 0; i < 5; i++) {
//                 let x = xStart;
//
//                 let ip_back = that.interpolate(x, bv);
//                 v = new CVertex(x, y, ip_back.z);
//                 v.i = index++;
//                 v.u = ip_back.uv_u;
//                 v.v = v.y;
//                 vertexRow.push(v);
//
//                 let make_double = true;
//
//                 let count = 0;
//                 while (count++ < 100) {
//                   let ip_channel = that.interpolate(x, cv);
//                   v = new CVertex(x, y, ip_channel.z + depth);
//                   v.i = index++;
//                   v.u = ip_channel.uv_u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                   if (make_double) {
//                     make_double = false;
//                     v = CVertex.fromVertex(v);
//                     v.i = index++;
//                     vertexRow.push(v);
//                   }
//                   if (x == xEnd)
//                     break;
//                   x = cv[ip_channel.indexVectorB].x;
//                   if (x > xEnd)
//                     x = xEnd;
//                 }
//
//                 v = CVertex.fromVertex(v);
//                 v.i = index++;
//                 vertexRow.push(v);
//                 ip_back = that.interpolate(xEnd, bv);
//                 v = new CVertex(xEnd, y, ip_back.z);
//                 v.i = index++;
//                 v.u = ip_back.uv_u;
//                 v.v = v.y;
//                 vertexRow.push(v);
//
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//
//                 y += yStep;
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelFront",
//                 index: -1,
//                 triangulate_isFrontFace: true,
//                 triangulate_useVectorDist: false,
//                 no_outline: true,
//                 close_normals: false,
//               });
//
//               vertexFront_start = CVertex.fromVertex(vertexRows[0][0]);
//               vertexFront_end = CVertex.fromVertex(vertexRows[0][vertexRows[0].length - 1]);
//             }
//             let computeCrossChannelBack = function () {
//               let vertexRows = [] as CVertex[][];
//               let vertexRow = [] as CVertex[];
//               let index = 0;
//               let v: CVertex;
//               let v2: CVertex;
//               let cv = that.channelVertices;
//               let bv = that.backVertices;
//               let ip;
//
//               ip = that.interpolate(-stoneSize / 2, bv);
//
//               //if (vertexFront_start && vertexFront_start.z > bv[0].z)
//               {
//                 // mesh für alpha
//                 for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
//                   v = CVertex.fromVertex(bv[0]);
//                   v.i = index++;
//                   v.y = y;
//                   v.v = y;
//                   v.u = 0.0;
//                   vertexRow.push(v);
//
//                   //if (vertexFront_start.x < v.x)
//                   {
//                     v2 = new CVertex(ip.x, y, ip.z);
//                     // v2 = new CVertex(vertexFront_start.x, y, vertexFront_start.z);
//                     // let dist = v.distance(v2);
//                     // ip = that.interpolate_distance_2(bv, 0, dist);
//                     // v2.x = ip.x;
//                     // v2.z = ip.z;
//                     // v2.y = y;
//                     v2.i = index++;
//                     v2.u = ip.uv_u;
//                     v2.v = v2.y;
//                     vertexRow.push(v2);
//                   }
//                   // else {
//                   //   ip = that.interpolate(vertexFront_start.x, bv);
//                   //   v2 = new CVertex(ip.x, y, ip.z);
//                   //   v2.i = index++;
//                   //   v2.u = ip.uv_u;
//                   //   v2.v = v2.y;
//                   //   vertexRow.push(v2);
//                   // }
//
//                   vertexRows.push(vertexRow);
//                   vertexRow = [];
//                 }
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelBack_alpha",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: true,
//                   close_normals: false,
//                 });
//               }
//
//               ip = that.interpolate(stoneSize / 2, bv);
//
//               //if (vertexFront_end && vertexFront_end.z > bv[bv.length-1].z)
//               {
//                 vertexRows = [];
//                 vertexRow = [];
//                 index = 0;
//                 // mesh für alpha
//
//                 for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
//                   v = CVertex.fromVertex(bv[bv.length - 1]);
//                   v.i = index++;
//                   v.y = y;
//                   v.v = y;
//                   v.u = 1.0;
//
//                   // if (vertexFront_end.x > v.x)
//                   {
//                     v2 = new CVertex(ip.x, y, ip.z);
//                     // v2 = new CVertex(vertexFront_end.x, y, vertexFront_end.z);
//                     // let dist = v.distance(v2);
//                     // ip = that.interpolate_distance_2(bv, bv.length - 1, -dist);
//                     // v2.x = ip.x;
//                     // v2.z = ip.z;
//                     // v2.y = y;
//                     v2.i = index++;
//                     v2.u = ip.uv_u;
//                     v2.v = v2.y;
//                     vertexRow.push(v2);
//                   }
//                   // else {
//                   //   ip = that.interpolate(vertexFront_end.x, bv);
//                   //   v2 = new CVertex(ip.x, y, ip.z);
//                   //   v2.i = index++;
//                   //   v2.u = ip.uv_u;
//                   //   v2.v = v2.y;
//                   //   vertexRow.push(v2);
//                   // }
//
//                   vertexRow.push(v);
//
//                   vertexRows.push(vertexRow);
//                   vertexRow = [];
//                 }
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelBack_alpha",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: true,
//                   close_normals: false,
//                 });
//               }
//
//             }
//             let computeCrossChannelCaps = function () {
//
//               let slv = that.stepLeftVertices;
//               let srv = that.stepRightVertices;
//               let fv = that.frontVertices;
//               let bv = that.backVertices;
//               let commonZ = bv[that.middleVertexBack[0]].z;
//               let Y = [channelSizeY_half, -channelSizeY_half];
//
//               for (let y = 0; y < 2; y++) {
//                 let vertexRows = [] as CVertex[][];
//                 let vertexRow = [] as CVertex[];
//                 let index = 0;
//                 let v: CVertex;
//
//                 // Front
//                 for (let i = 0, i_l = slv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(slv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//                 for (let i = 0, i_l = fv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(fv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//                 for (let i = 0, i_l = srv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(srv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//                 let row_0 = vertexRow;
//                 vertexRow = [];
//
//                 for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//                   v = new CVertex(row_0[i].x, Y[y], commonZ);
//                   v.i = index++;
//                   v.u = row_0[i].u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelCap",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: false,
//                   close_normals: false,
//                 });
//
//                 // Back
//                 vertexRows = [];
//                 vertexRow = [];
//                 index = 0;
//                 for (let i = 0, i_l = bv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(bv[i]);
//                   v.y = Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//                 row_0 = vertexRow;
//                 vertexRow = [];
//
//                 for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//                   v = new CVertex(row_0[i].x, Y[y], commonZ);
//                   v.i = index++;
//                   v.u = row_0[i].u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelCap",
//                   index: -1,
//                   triangulate_isFrontFace: true,
//                   triangulate_useVectorDist: false,
//                   no_outline: false,
//                   close_normals: false,
//                 });
//               }
//             }
//
//             computeCrossChannelFront();
//             computeCrossChannelBack();
//             computeCrossChannelCaps();
//           }
//         }
//
//         test = [36]; // Spannring schräg, nur Brillant gültig
//         if (test.indexOf(stoneGroup.mode) !== -1) {
//           let stoneMode = findStoneMode(stoneGroup.mode);
//           let stoneType = getStoneTypeItem(stoneGroup.type);
//
//           if (!stoneMode || !stoneType)
//             return;
//
//           let loopStoneSize = true;
//           let loopStoneSizeCount = 50;
//
//           while (loopStoneSize && loopStoneSizeCount-- > 0) {
//             loopStoneSize = false;
//
//             let stoneSize = stoneGroup.size;
//             let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//
//             if (stoneSizeItem) {
//               let x = stoneSizeItem.size, y;
//               if (stoneSizeItem.lengthFactor) {
//                 y = x * stoneSizeItem.lengthFactor;
//                 stoneSize = Math.sqrt(x * x + y * y);
//               } else if (stoneSizeItem.calcSize) {
//                 stoneSize = stoneSizeItem.calcSize;
//               }
//               // else: ...Fallback zur stoneSize wurde oben schon definiert...
//
//             }
//
//             let ringRadiusInner = innerCircumference / Math.PI / 2,
//               ringRadiusOuter = ringRadiusInner + ring.ringData.ringHeight,
//               ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
//               // stoneSizeX_safe = stoneSize + stoneMode.safeDistX,
//               stoneSizeX_half = stoneSize / 2,
//               // stoneSizeY_safe = (stoneSize + stoneMode.safeDistY) * ringRadiusFactor,
//               stoneSizeY = stoneSize * ringRadiusFactor,
//               stoneSizeY_half = stoneSizeY / 2,
//               channelSizeY_half = stoneSizeY_half * 0.88
//               // stoneSizeY_half_safe = stoneSizeY_safe / 2,
//               // distributionY = stoneSizeY_safe,
//               // stoneCount = stoneGroup.count,
//               // height = ringData.ringSize,
//               // yCenter = height / 2,
//               // heightFactor = 1.0,
//               // maxY: number,
//
//               // amp = ringData.waveAmp / 100,
//               // amp100 = ring.calc.amp100,
//
//               // stoneSafeLeft = -xCenter + ring.calc.stoneSafeLeft,
//               // stoneSafeRight = xCenter - ring.calc.stoneSafeRight,
//               //
//               // maxStoneCount = 0
//             ;
//
//             /*
//             ermittle den nächsten Y-Wert im Abstand von 'distance'; 'inc' kann positiv oder negativ sein
//             */
//             // let debug_getPoint = false;
//             let getPoint = function (curX: number, curY: number, distance: number, inc: number, testY: boolean = false): iXY {
//               if (inc < 0) distance = -distance;
//               return {x: curX, y: curY + distance};
//               // let result = {x: 0, y: 0}, x, y = curY, u, v, d = 0;
//               // let orig_x = get_sin(curY, height, 1);
//               // let offset = curX - orig_x;
//               //
//               // if (testY)
//               // {
//               //   y = curY + distance;
//               //   result.x = get_sin(y, height, 1);
//               //   result.y = y;
//               //   return result;
//               // }
//               //
//               // while (1)
//               // {
//               //   y += inc;
//               //   x = get_sin(y, height, 1);
//               //   u = x - curX + offset;
//               //   v = y - curY;
//               //   d = Math.sqrt(u * u + v * v);
//               //   if (d >= distance)
//               //   {
//               //     x += offset;
//               //     result.x = x;
//               //     result.y = y;
//               //     break;
//               //   }
//               // }
//               //
//               // return result;
//             }
//             //
//             // let getMaxStoneCount = function (): number
//             // {
//             //   let countMax = 1, p = getPoint(0, -maxY, stoneSizeY_half_safe, 1);
//             //
//             //   while (1)
//             //   {
//             //     p = getPoint(p.x, p.y, distributionY, 1);
//             //     if (p.y > maxY)
//             //       break;
//             //
//             //     if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
//             //     {
//             //       console.log(p.x, stoneSizeX_half, stoneSafeLeft, stoneSafeRight, distributionY);
//             //       break;
//             //     }
//             //
//             //     countMax++;
//             //   }
//             //
//             //   return countMax;
//             // }
//             //
//             // let loop = 0;
//             // while (loop++ < 2) // 2 Durchläufe sind hier notwendig weil sich innerhalb dieser Schleife die Verteilung ändern kann
//             // {
//             //   distributionY = stoneSizeY_safe;
//             //
//             //   switch (stoneGroup.distribution)
//             //   {
//             //     case 0: // aneinander
//             //       break;
//             //     case 5: // halber Steinabstand
//             //       distributionY *= 1.5;
//             //       break;
//             //     case 10: // ganzer Steinabstand
//             //       distributionY *= 2.0;
//             //       break;
//             //     case 20: // doppelter Steinabstand
//             //       distributionY *= 3.0;
//             //       break;
//             //     case 33: // drittel Ring
//             //       heightFactor = 0.33;
//             //       break;
//             //     case 50: // halber Ring
//             //       heightFactor = 0.5;
//             //       break;
//             //     case 100: // ganzer Ring
//             //       heightFactor = 1.0;
//             //       break;
//             //   }
//             //
//             //   maxY = yCenter * heightFactor;
//             //
//             //   // if (stoneGroup.distribution == 100)
//             //   // {
//             //   //   maxY -= stoneSizeY / 2;
//             //   // }
//             //
//             //   maxStoneCount = getMaxStoneCount();
//             //
//             //   if (stoneGroup.distribution >= 33 && stoneGroup.count < 0)
//             //     stoneGroup.count = stoneCount = maxStoneCount;
//             //
//             //   if (stoneGroup.count < 0)
//             //   {
//             //     switch (stoneGroup.count)
//             //     {
//             //       case -33.339:
//             //         stoneCount = Math.trunc(maxStoneCount / 3);
//             //         break;
//             //       case -50:
//             //         stoneCount = Math.trunc(maxStoneCount / 2);
//             //         break;
//             //       case -100:
//             //         stoneCount = maxStoneCount;
//             //         stoneGroup.distribution = 100;
//             //         break;
//             //     }
//             //   }
//             //
//             //   if (stoneCount > maxStoneCount)
//             //     stoneCount = maxStoneCount;
//             //
//             //   if (stoneGroup.mode === 20)
//             //   {
//             //     if (stoneCount === maxStoneCount)
//             //       stoneGroup.distribution = 100;
//             //     else
//             //       stoneGroup.distribution = 0;
//             //   }
//             //   else
//             //   {
//             //     stoneGroup.rows = 1;
//             //   }
//             // }
//             //
//             // ring.calc.stone[stoneGroupIndex].maxCount = maxStoneCount;
//             //
//             // let loopDistribution = true;
//
//             interface iXY {
//               x: number;
//               y: number;
//             }
//
//             let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine
//
//             let testStoneSizeRingHeight_doLoopStoneSize = true;
//
//             let testStoneSizeRingHeight = function (position: iXY, safeDistance = 1000): boolean {
//               let stoneType = getStoneTypeItem(stoneGroup.type);
//               if (stoneType) {
//                 let sizeLeft, sizeRight;
//
//                 if (stoneGroup.mode == 20 || stoneGroup.mode == 30) {
//                   let interpolationFront = that.interpolate(position.x - stoneSize / 2, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x - stoneSize / 2, that.backVertices);
//
//                   sizeLeft = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//
//                   interpolationFront = that.interpolate(position.x + stoneSize / 2, that.frontVertices);
//                   interpolationBack = that.interpolate(position.x + stoneSize / 2, that.backVertices);
//
//                   sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
//                 } else {
//                   let interpolationFront = that.interpolate(position.x, that.frontVertices);
//                   let interpolationBack = that.interpolate(position.x, that.backVertices);
//
//                   sizeLeft = sizeRight = -(interpolationFront.z - interpolationBack.z);// - safeDistance;
//                 }
//
//                 let maxStoneSize = Math.min(sizeLeft, sizeRight) / stoneType.sizeDepthFactor;
//
//                 if (stoneGroup.size > maxStoneSize) {
//                   if (testStoneSizeRingHeight_doLoopStoneSize) {
//                     stoneGroup.size = getLowerStoneSize(stoneGroup.type, maxStoneSize);
//                     ring.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
//                     loopStoneSize = true;
//                     Log("info", "Die Steingröße wurde angepasst (0x6)");
//                   }
//                   return false;
//                 }
//               }
//               return true;
//             }
//
//             POINTS = [{x: 0, y: 0}];
//             testStoneSizeRingHeight(POINTS[0]);
//
//             if (stoneGroup.count > 1) {
//               let minX = 100000,
//                 maxX = -100000,
//                 i,
//                 i_l = POINTS.length / 2,
//                 i1 = 0,
//                 p1,
//                 p1_last: iXY | null = null,
//                 i2 = (POINTS.length === 2) ? 1 : (POINTS.length % 2 === 0) ? 2 : 1,
//                 p2,
//                 u,
//                 v,
//                 d,
//                 stoneShift = stoneSize,//_safe,
//                 stoneDiameter = stoneSizeY,//_safe,
//                 recalcStoneShift = true,
//                 doLoop = true,
//                 loopCount = 100,
//                 maxRows = 9999,
//                 numRows = stoneGroup.count, // verwende den Algorithmus von oben für die horizontale Teilung
//                 POINTS_ROWS = [] as iXY[],
//                 safeProfileSideDist = stoneMode.safeProfileSideDist ? stoneMode.safeProfileSideDist : 0;
//
//               for (i = 0; i < i_l; i++) {
//                 p1 = POINTS[i];
//                 if (p1.x < minX) minX = p1.x;
//                 else if (p1.x > maxX) maxX = p1.x;
//               }
//
//               minX = -minX;
//               minX = ringData.ringWidth / 2 - minX - safeProfileSideDist;// - ring.calc.stoneSafeLeft;
//               maxX = ringData.ringWidth / 2 - maxX - safeProfileSideDist;// - ring.calc.stoneSafeRight;
//
//               if (POINTS.length > 1) {
//                 p1 = POINTS[i1];
//                 p2 = POINTS[i2];
//                 v = p2.y - p1.y;
//
//                 while (doLoop && loopCount-- > 0) {
//                   doLoop = false;
//                   u = p1.x + stoneShift - p2.x;
//                   d = Math.sqrt(u * u + v * v);
//                   if (d < stoneDiameter) {
//                     stoneShift += 100;
//                     doLoop = true;
//                   }
//                 }
//               }
//
//               if (stoneShift < stoneDiameter)
//                 stoneShift = stoneDiameter;
//
//               while (recalcStoneShift) {
//                 recalcStoneShift = false;
//                 POINTS_ROWS = [];
//                 p1_last = null;
//
//                 maxRows = Math.trunc((Math.min(minX, maxX) * 2 - stoneDiameter) / stoneShift) + 1;
//                 ring.calc.stone[stoneGroupIndex].maxRow = maxRows;
//                 if (numRows > maxRows) {
//                   Log("info", "max Steinanzahl angepasst:" + maxRows);
//                   numRows = stoneGroup.count = maxRows;
//                 }
//
//                 let shiftPoints = ((numRows - 1) * stoneShift) / 2;
//
//                 i_l = POINTS.length;
//                 for (i = 0; i < i_l;) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     // Abstand zum vorherigen p1...
//                     if (p1_last) {
//                       u = p2.x - p1_last.x;
//                       v = p2.y - p1_last.y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     // Abstand zum nächsten p1...
//                     let inc = (i === 0 && i_l % 2 !== 0) ? 1 : 2;
//                     if (i < i_l - inc) {
//                       u = p2.x - POINTS[i + inc].x - shiftPoints;
//                       v = p2.y - POINTS[i + inc].y;
//                       d = Math.sqrt(u * u + v * v);
//                       if (d < stoneDiameter) {
//                         stoneShift += 100;
//                         recalcStoneShift = true;
//                         break;
//                       }
//                     }
//                     POINTS_ROWS.push(p2);
//                     p1_last = p1;
//                   }
//                   if (recalcStoneShift)
//                     break;
//                   if (i === 0 && i_l % 2 !== 0) i++;
//                   else i += 2;
//                 }
//                 i = (i_l % 2 === 0) ? 1 : 2;
//                 for (i; i < i_l; i += 2) {
//                   p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
//                   POINTS_ROWS.push(p1);
//                   for (let j = 0; j < numRows - 1; j++) {
//                     p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
//                     POINTS_ROWS.push(p2);
//                   }
//                 }
//               }
//
//               POINTS = POINTS_ROWS;
//
//               // nochmal sortieren
//               POINTS.sort(function (a, b): number {
//                 return (a.y - b.y);
//               })
//             }
//
//             let testStoneSizeForRingHeight = true;
//             POINTS.forEach(e => {
//               if (!testStoneSizeRingHeight(e))
//                 testStoneSizeForRingHeight = false;
//             });
//
//             if (!testStoneSizeForRingHeight) {
//               continue;
//             }
//
//
//             // berechne Geometriedaten...
//             let p = [] as iXY[];
//             // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
//             POINTS.forEach(function (e) {
//               if (e.y < 0) {
//                 let result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half, -1)
//                 // let result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, -1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//                 p.push({x: e.x, y: e.y});
//                 result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half, 1)
//                 // result = getPoint(e.x, e.y + ringData.ringSize, stoneSizeY_half_safe, 1)
//                 result.y -= ringData.ringSize;
//                 p.push(result);
//               } else {
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half, -1));
//                 // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
//                 p.push({x: e.x, y: e.y});
//                 p.push(getPoint(e.x, e.y, stoneSizeY_half, 1));
//                 // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
//               }
//             })
//
//             let vertexRows = [] as CVertex[][];
//             let vertexRow = [] as CVertex[];
//             let index = 0;
//             let v: CVertex;
//
//             p.forEach(function (e) {
//               v = new CVertex(e.x - stoneSizeX_half, e.y, that.interpolate(e.x - stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x, e.y, that.interpolate(e.x, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(e.x + stoneSizeX_half, e.y, that.interpolate(e.x + stoneSizeX_half, that.frontVertices).z - debugStoneOffset);
//               v.i = index++;
//               vertexRow.push(v);
//
//               vertexRows.push(vertexRow);
//               vertexRow = [];
//             })
//
//             let stoneHelperMesh = new CMesh;
//             stoneHelperMesh.rows = vertexRows;
//
//             stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);
//
//             // out.push({
//             //   vertex2DArray: vertexRows,
//             //   type: "helper",
//             //   index: -1,
//             //   no_rotate: true,
//             //   triangulate_useVectorDist: false,
//             // });
//
//             let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
//               let positions = [];
//               let tangents = [];
//               let normals = [];
//               let binormals = [];
//               let distances = [] as number[];
//
//               let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
//               let i, i_l = rows.length, row, j, j_l;
//
//               for (i = 1; i < i_l; i += 3) {
//
//                 row = rows[i];
//                 j_l = row.length;
//
//                 for (j = 1; j < j_l; j += 3) {
//                   // Position
//                   P = CVertex.fromVertex(row[j]);
//
//                   // Tangente
//                   rows[i + 1][j].toRef(v1);
//                   rows[i - 1][j].toRef(v2);
//                   T = CVertex.fromVertex(v1).sub(v2);
//
//                   // Normal
//                   if (i == 1) {
//                     row[j - 1].toRef(v1); // Stein war falsch gedreht
//                     // row[j].toRef(v1);
//                     row[j + 1].toRef(v2);
//                   } else if (i == i_l - 2) {
//                     row[j - 1].toRef(v1);
//                     row[j].toRef(v2);
//                   } else {
//                     row[j - 1].toRef(v1);
//                     row[j + 1].toRef(v2);
//                   }
//                   N = CVertex.fromVertex(v2).sub(v1);
//
//                   // Binormal
//                   B = CVertex.cross(N, T);
//
//                   // Normal again
//                   CVertex.crossToRef(B, T, N);
//
//                   N.normalize();
//                   B.normalize();
//                   T.normalize();
//
//                   positions.push(P);
//                   tangents.push(T);
//                   normals.push(N);
//                   binormals.push(B);
//                 }
//               }
//
//               return {
//                 distances,
//                 positions,
//                 normals,
//                 binormals,
//                 tangents
//               }
//             };
//             let stonePathVectors = computeStonePathVectors(vertexRows);
//
//             that.stonePaths.push(stonePathVectors);
//
//             let vertexFront_start: CVertex | null = null;
//             let vertexFront_end: CVertex | null = null;
//
//             let alpha = 30, beta = 90 - alpha;
//             let getDistanceY = function (x: number): number {
//               return Math.sin(alpha * Math.PI / 180) * x / Math.sin(beta * Math.PI / 180);
//             }
//             let channelSizeY_rot = channelSizeY_half / Math.sin(beta * Math.PI / 180);
//
//             let computeCrossChannelFront = function () {
//               let vertexRows = [] as CVertex[][];
//               let vertexRow = [] as CVertex[];
//               let index = 0;
//               let v: CVertex;
//               let fv = that.frontVertices;
//               let bv = that.backVertices;
//               let cv = that.channelVertices;
//
//               let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
//               // let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor : stoneSize * 0.5;
//
//               let xStart = -ringData.ringWidth / 2;
//               // for (let x = -ringData.ringWidth / 2; x < 0; x++) {
//               //   let ip_channel = that.interpolate(x, cv);
//               //   let ip_front = that.interpolate(x, fv);
//               //   if (ip_channel.z + depth > ip_front.z) {
//               //     xStart = ip_channel.x;
//               //     break;
//               //   }
//               // }
//               let y = -channelSizeY_half;
//               // let y = -stoneSizeY_half - 20;
//               let yStep = (channelSizeY_half * 2) / 4;
//               let xEnd = -xStart;
//
//               // if (fv[0].x > bv[0].x) fv = bv;
//
//               // mesh für alpha
//               for (let y = -channelSizeY_rot; y <= channelSizeY_rot; y += channelSizeY_rot * 2) {
//                 // for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half * 2) {
//                 for (let i = 0, i_l = fv.length; i < i_l; i++) {
//                   let x = fv[i].x;
//                   if (i == 0) x = xStart;
//                   else {
//                     if (x < xStart) continue;
//                   }
//                   if (x > xEnd) x = xEnd;
//                   let ip = that.interpolate(x, fv);
//                   v = new CVertex(x, getDistanceY(x), ip.z);
//                   v.y += y;
//                   v.i = index++;
//                   v.u = ip.uv_u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                   if (x == xEnd) break;
//                 }
//
//                 let v0 = vertexRow[0];
//                 let v1 = vertexRow[1];
//                 v0.u -= v1.u - v0.u;
//                 v0.y -= v1.y - v0.y;
//                 v0 = vertexRow[vertexRow.length-1];
//                 v1 = vertexRow[vertexRow.length-2];
//                 v0.u += v0.u - v1.u;
//                 v0.y += v0.y - v1.y;
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelFront_alpha",
//                 index: -1,
//                 triangulate_isFrontFace: true,
//                 triangulate_useVectorDist: false,
//                 no_outline: false,
//                 close_normals: false,
//               });
//
//               // mesh für albedo
//               vertexRows = [];
//               vertexRow = [];
//               index = 0;
//               fv = that.frontVertices;
//
//               let arY = [-channelSizeY_rot, 0, channelSizeY_rot];
//               let arX = [], arXe = [];
//               v = new CVertex(-stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//               v.x = -stoneSize * 0.65 / 2;
//               v.y = 0;
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//               v.x = -stoneSize * 0.65 / 2;
//               v.y = stoneSize * 0.88 / 2;
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//
//               v = new CVertex(stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
//               v.rotateZ(alpha * Math.PI / 180);
//               arXe.push(v.x);
//               v.x = stoneSize * 0.65 / 2;
//               v.y = 0;
//               v.rotateZ(alpha * Math.PI / 180);
//               arXe.push(v.x);
//               v.x = stoneSize * 0.65 / 2;
//               v.y = stoneSize * 0.88 / 2;
//               v.rotateZ(alpha * Math.PI / 180);
//               arXe.push(v.x);
//
//               for (let i = 0; i < 3; i++) {
//                 let x = arX[i];
//                 let y = arY[i];
//
//                 let ip_back = that.interpolate(x, bv);
//                 v = new CVertex(x, getDistanceY(x) + y, ip_back.z);
//                 v.i = index++;
//                 v.u = ip_back.uv_u;
//                 v.v = v.y;
//                 vertexRow.push(v);
//
//                 let make_double = true;
//
//                 let count = 0;
//                 while (count++ < 100) {
//                   let ip_channel = that.interpolate(x, cv);
//                   v = new CVertex(x, getDistanceY(x) + y, ip_channel.z + depth);
//                   v.i = index++;
//                   v.u = ip_channel.uv_u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                   if (make_double) {
//                     make_double = false;
//                     v = CVertex.fromVertex(v);
//                     v.i = index++;
//                     vertexRow.push(v);
//                   }
//                   if (x == arXe[i])
//                     break;
//                   x = cv[ip_channel.indexVectorB].x;
//                   if (x > arXe[i]-100)
//                     x = arXe[i];
//                 }
//
//                 v = CVertex.fromVertex(v);
//                 v.i = index++;
//                 vertexRow.push(v);
//
//                 ip_back = that.interpolate(x, bv);
//                 v = new CVertex(x, getDistanceY(x) + y, ip_back.z);
//                 v.i = index++;
//                 v.u = ip_back.uv_u;
//                 v.v = v.y;
//                 vertexRow.push(v);
//
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelFront",
//                 index: -1,
//                 triangulate_isFrontFace: true,
//                 triangulate_useVectorDist: true,
//                 no_outline: true,
//                 close_normals: false,
//               });
//               //
//               // vertexFront_start = CVertex.fromVertex(vertexRows[0][0]);
//               // vertexFront_end = CVertex.fromVertex(vertexRows[0][vertexRows[0].length - 1]);
//             }
//
//             let computeCrossChannelBack = function () {
//               let vertexRows = [] as CVertex[][];
//               let vertexRow = [] as CVertex[];
//               let index = 0;
//               let v: CVertex;
//               let v2: CVertex;
//               let fv = that.frontVertices;
//               let cv = that.channelVertices;
//               let bv = that.backVertices;
//               let ip;
//
//               let xStart = -ringData.ringWidth / 2;
//
//               let arY = [-channelSizeY_rot, 0, channelSizeY_rot];
//               let arX = [];
//               v = new CVertex(-stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//               v.x = -stoneSize * 0.65 / 2;
//               v.y = 0;
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//               v.x = -stoneSize * 0.65 / 2;
//               v.y = stoneSize * 0.88 / 2;
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//
//               //let vertexCount = Math.trunc(ringData.ringWidth / 2 / 100);
//               let numVertices=[
//                 that.interpolate(arX[0], bv).indexVectorB,
//                 that.interpolate(arX[1], bv).indexVectorB,
//                 that.interpolate(arX[2], bv).indexVectorB];
//               let vertexCount = Math.max(numVertices[0], numVertices[1], numVertices[1]);
//
//               // mesh für alpha links
//               for (let iY = 0; iY < 3; iY++) {
//                 let y = arY[iY];
//                 let xStep = Math.abs((xStart - arX[iY]) / (vertexCount - 1));
//                 let x = xStart;
//                 for (let i = 0; i < vertexCount; i++) {
//                   let ip = that.interpolate(x, bv);
//                   v = new CVertex(x, getDistanceY(x) + y, ip.z);
//                   v.i = index++;
//                   v.u = ip.uv_u;
//                   // v.v = v.y;
//                   vertexRow.push(v);
//                   x += xStep;
//                 }
//                 vertexRow[0].u = 0;
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelBack_alpha",
//                 index: -1,
//                 triangulate_isFrontFace: false,
//                 triangulate_useVectorDist: false,
//                 no_outline: true,
//                 close_normals: false,
//               });
//
//               // mesh für alpha rechts
//               arX = [];
//               v = new CVertex(stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//               v.x = stoneSize * 0.65 / 2;
//               v.y = 0;
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//               v.x = stoneSize * 0.65 / 2;
//               v.y = stoneSize * 0.88 / 2;
//               v.rotateZ(alpha * Math.PI / 180);
//               arX.push(v.x);
//               vertexRows = [];
//               vertexRow = [];
//               index = 0;
//               for (let iY = 0; iY < 3; iY++) {
//                 let y = arY[iY];
//                 let xStep = Math.abs((-xStart - arX[iY]) / (vertexCount - 1));
//                 let x = arX[iY];
//                 for (let i = 0; i < vertexCount; i++) {
//                   let ip = that.interpolate(x, bv);
//                   v = new CVertex(x, getDistanceY(x) + y, ip.z);
//                   v.i = index++;
//                   v.u = ip.uv_u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                   x += xStep;
//                 }
//                 vertexRow[vertexRow.length-1].u = 1.0;
//                 vertexRows.push(vertexRow);
//                 vertexRow = [];
//               }
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "crossChannelBack_alpha",
//                 index: -1,
//                 triangulate_isFrontFace: false,
//                 triangulate_useVectorDist: false,
//                 no_outline: true,
//                 close_normals: false,
//               });
//             }
//             let computeCrossChannelCaps = function () {
//
//               let slv = that.stepLeftVertices;
//               let srv = that.stepRightVertices;
//               let fv = that.frontVertices;
//               let bv = that.backVertices;
//               let commonZ = bv[that.middleVertexBack[0]].z;
//               let Y = [-channelSizeY_rot, channelSizeY_rot];
//
//               for (let y = 0; y < 2; y++) {
//                 let vertexRows = [] as CVertex[][];
//                 let vertexRow = [] as CVertex[];
//                 let index = 0;
//                 let v: CVertex;
//
//                 // Front
//                 for (let i = 0, i_l = slv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(slv[i]);
//                   v.y = getDistanceY(v.x) + Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//                 for (let i = 0, i_l = fv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(fv[i]);
//                   // if (i == 0 && bv[0].x < v.x) v.x = bv[0].x;
//                   // else if (i == i_l-1 && bv[bv.length-1].x > v.x) v.x = bv[bv.length-1].x;
//                   v.y = getDistanceY(v.x) + Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//                 for (let i = 0, i_l = srv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(srv[i]);
//                   v.y = getDistanceY(v.x) + Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//                 let row_0 = vertexRow;
//                 vertexRow = [];
//
//                 for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//                   v = new CVertex(row_0[i].x, Y[y], commonZ);
//                   v.i = index++;
//                   v.u = row_0[i].u;
//                   v.y = getDistanceY(v.x) + Y[y];
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelFront",
//                   index: -1,
//                   triangulate_isFrontFace: false,
//                   triangulate_useVectorDist: false,
//                   no_outline: false,
//                   close_normals: false,
//                 });
//
//                 // Back
//                 vertexRows = [];
//                 vertexRow = [];
//                 index = 0;
//                 for (let i = 0, i_l = bv.length; i < i_l; i++) {
//                   v = CVertex.fromVertex(bv[i]);
//                   v.y = getDistanceY(v.x) + Y[y];
//                   v.v = v.y;
//                   v.i = index++;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//                 row_0 = vertexRow;
//                 vertexRow = [];
//
//                 for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//                   v = new CVertex(row_0[i].x, getDistanceY(row_0[i].x) + Y[y], commonZ);
//                   v.i = index++;
//                   v.u = row_0[i].u;
//                   v.v = v.y;
//                   vertexRow.push(v);
//                 }
//
//                 vertexRows.push(vertexRow);
//
//                 out.push({
//                   vertex2DArray: vertexRows,
//                   type: "crossChannelFront",
//                   index: -1,
//                   triangulate_isFrontFace: true,
//                   triangulate_useVectorDist: false,
//                   no_outline: false,
//                   close_normals: false,
//                 });
//               }
//             }
//
//             computeCrossChannelFront();
//             computeCrossChannelBack();
//             computeCrossChannelCaps();
//           }
//         }
//
//         // side
//         test = [40, 41, 42, 43, 44, 45];
//         if (test.indexOf(stoneGroup.mode) !== -1) {
//           let stoneMode = findStoneMode(stoneGroup.mode);
//           if (!stoneMode)
//             return;
//
//           let loopStoneSize = true;
//           while (loopStoneSize) {
//             loopStoneSize = false;
//
//             let stoneType = getStoneTypeItem(stoneGroup.type);
//             if (!stoneType)
//               return;
//
//             let maxStoneSize = 0;
//             let test2 = [40, 42, 44], isLeftSide: boolean = true;
//             if (test2.indexOf(stoneGroup.mode) > -1) // links
//             {
//               maxStoneSize = Math.trunc(that.sideLength[0] - stoneMode.safeDistX * 2);
//             } else // rechts
//             {
//               isLeftSide = false;
//               maxStoneSize = Math.trunc(that.sideLength[1] - stoneMode.safeDistX * 2);
//             }
//
//             maxStoneSize = getLowerStoneSize(stoneType.id, maxStoneSize, true);
//
//             ring.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
//
//             let stoneSizeX = stoneGroup.size,
//               stoneSizeY = 0;
//
//             if (stoneSizeX > maxStoneSize) {
//               stoneSizeX = getLowerStoneSize(stoneGroup.type, maxStoneSize, true);
//               if (!stoneSizeX) {
//                 if (stoneGroup.type > 1) {
//                   stoneGroup.type = 1;
//                   loopStoneSize = true;
//                   Log("info", "Die Steinart wurde angepasst");
//                   continue;
//                 }
//
//                 Log("info", "Keine passende Steingröße vorhanden (" + maxStoneSize + ")");
//                 RingData.resetStonegroup(ring.ringData, stoneGroupIndex);
//                 stoneGroup.mode = 0;
//                 return;
//               }
//               stoneGroup.size = stoneSizeX;
//               Log("info", "Die Steingröße wurde angepasst (0x7)");
//             }
//
//             stoneSizeY = stoneSizeX;
//
//             switch (stoneGroup.type) {
//               // case 2: // Princess gerade
//               // case 3: // Princess 45°
//               //   let t = stoneSizeX / 2;
//               //   t *= t;
//               //   stoneSizeX = stoneSizeY = Math.sqrt(t * 2) * 2;
//               //   break;
//               case 4:
//               case 5: // Baguette längs
//                 let stoneSizeItem = stoneType.size.find(e => {
//                   return e.size == stoneGroup.size;
//                 })
//                 if (stoneSizeItem && stoneSizeItem.lengthFactor) {
//                   stoneSizeY = stoneSizeX * stoneSizeItem.lengthFactor;
//                 }
//                 break;
//             }
//
//             // let safeDistX = stoneMode.safeDistX, safeDistY = stoneMode.safeDistY;
//             // let stoneSizeItem = stoneType.size.find(e => {
//             //   return e.size == stoneGroup.size;
//             // })
//             // if (stoneSizeItem) {
//             //   if (stoneSizeItem.safeDistX)
//             //     safeDistX = stoneSizeItem.safeDistX;
//             //   if (stoneSizeItem.safeDistY)
//             //     safeDistY = stoneSizeItem.safeDistY;
//             // }
//
//             // @ts-ignore
//             let ringSideRadius = (innerCircumference / Math.PI / 2) - that.sideMidpoint[isLeftSide ? 0 : 1].z,
//               stoneSizeX_half = stoneSizeX / 2,
//               stoneSizeY_half = stoneSizeY / 2,
//               stoneSizeY_safe = stoneSizeY + stoneMode.safeDistY,
//               stoneCount = stoneGroup.count,
//               // distributionRad = (stoneSizeY_safe * Math.PI * 2) / (Math.PI * ringSideRadius * 2),
//               maxPI = 0,
//               minPI = 0;
//
//             // if (stoneGroup.mode === 42 || stoneGroup.mode == 43)
//             //   distributionRad = (stoneSizeY * Math.PI * 2) / (Math.PI * ringSideRadius * 2);
//
//             // => 230205
//             let positionRectangle: iPositionRectangle = {
//               radius: ringSideRadius,
//               rectWidth: stoneSizeX,
//               rectHeight: stoneSizeY,
//               safetyMargin: stoneMode.safeDistY,//stoneMode.safeDistY,
//               maxRectangles: stoneGroup.count > 0 ? stoneGroup.count : stoneGroup.count / -100,
//               circumferenceFactor: 1.0,
//               initialAngleRad: AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180,
//               out_result: [] as iRectPosition[],
//               out_maxRectangles: 0,
//               out_angleIncrement: 0,
//             };
//
//             switch (stoneGroup.distribution) {
//               case 5: // halber Steinabstand
//                 positionRectangle.safetyMargin = stoneSizeY / 2;
//                 break;
//               case 10: // ganzer Steinabstand
//                 positionRectangle.safetyMargin = stoneSizeY;
//                 break;
//               case 20: // doppelter Steinabstand
//                 positionRectangle.safetyMargin = stoneSizeY * 2;
//                 break;
//               case 33: // drittel Ring
//                 positionRectangle.circumferenceFactor = 0.3339;
//                 break;
//               case 50: // halber Ring
//                 positionRectangle.circumferenceFactor = 0.5;
//                 break;
//               case 100: // ganzer Ring
//                 positionRectangle.forceFullCircle = true;
//                 break;
//             }
//
//             if (stoneGroup.count < 0) {
//               if (stoneGroup.count == -100) {
//                 positionRectangle.maxRectangles = 0;
//                 positionRectangle.circumferenceFactor = 1.0;
//               } else if (stoneGroup.count == -50) {
//                 positionRectangle.maxRectangles = 0;
//                 positionRectangle.circumferenceFactor = 0.5;
//               } else if (stoneGroup.count == -33.339) {
//                 positionRectangle.maxRectangles = 0;
//                 positionRectangle.circumferenceFactor = 0.3333;
//               }
//             }
//
//             that.position_rectangles(positionRectangle);
//
//             // <= 230205
//
//             interface iXYrad {
//               x: number;
//               y: number;
//               rad: number;
//             }
//
//             let POINTS = [] as iXYrad[]; // Die Mittelpunktkoordinaten der einzelnen Steine
//
//             ring.calc.stone[stoneGroupIndex].maxCount = positionRectangle.out_maxRectangles;
//
//             positionRectangle.out_result.forEach(e => {
//               let v = new CVertex();
//               v.x = e.x;
//               v.y = e.y - positionRectangle.rectHeight / 2;
//               v.rotateZ(e.zRotationRad);
//               POINTS.push({x: v.x, y: v.y, rad: e.zRotationRad});
//
//               POINTS.push({x: e.x, y: e.y, rad: e.zRotationRad});
//
//               v.x = e.x;
//               v.y = e.y + positionRectangle.rectHeight / 2;
//               v.rotateZ(e.zRotationRad);
//               POINTS.push({x: v.x, y: v.y, rad: e.zRotationRad});
//             })
//
//             if (stoneGroup.count > 0 && stoneGroup.count != POINTS.length / 3) {
//               stoneGroup.count = POINTS.length / 3;
//               Log("info", "Die Steinanzahl wurde angepasst");
//             }
//
//             let vertexRows = [] as CVertex[][];
//             let vertexRow = [] as CVertex[];
//             let index = 0;
//             let v: CVertex;
//             // @ts-ignore
//             let X = stoneGroup.mode % 2 === 0 ? that.sideMidpoint[0].x - debugStoneOffset : that.sideMidpoint[1].x + debugStoneOffset;
//
//             POINTS.forEach(function (e) {
//               v = new CVertex(X, e.y, -e.x - stoneSizeX_half);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(X, e.y, -e.x);
//               v.i = index++;
//               vertexRow.push(v);
//               v = new CVertex(X, e.y, -e.x + stoneSizeX_half);
//               v.i = index++;
//               vertexRow.push(v);
//
//               vertexRows.push(vertexRow);
//               vertexRow = [];
//             })
//
//             let mesh = new CMesh;
//             mesh.rows = vertexRows;
//             // mesh.rotateRows(ringRadiusInner, thetaExtra);
//
//             // out.push({
//             //     vertex2DArray: vertexRows,
//             //     type: "helper",
//             //     index: -1,
//             //     no_rotate: true,
//             // });
//
//             let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
//               let positions = [];
//               let tangents = [];
//               let normals = [];
//               let binormals = [];
//               let distances = [] as number[];
//
//               let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
//               let i, i_l = rows.length, row, j, j_l;
//
//               for (i = 1; i < i_l; i += 3) {
//
//                 row = rows[i];
//                 j_l = row.length;
//
//                 for (j = 1; j < j_l; j += 3) {
//                   // Position
//                   P = CVertex.fromVertex(row[j]);
//
//                   // Tangente
//                   rows[i + 1][j].toRef(v1);
//                   rows[i - 1][j].toRef(v2);
//                   T = CVertex.fromVertex(v1).sub(v2);
//
//                   // Normal
//                   // row[j - 1].toRef(v1);
//                   // row[j + 1].toRef(v2);
//                   // N = CVertex.fromVertex(v2).sub(v1);
//                   N = new CVertex();
//
//                   // Binormal
//                   // B = CVertex.cross(N, T);
//                   // B.x=1;
//                   // B.y=0;
//                   // B.z=0;
//                   B = new CVertex(X < 0 ? 1 : -1, 0, 0);
//
//                   // Normal again
//                   CVertex.crossToRef(B, T, N);
//
//                   N.normalize();
//                   B.normalize();
//                   T.normalize();
//
//                   positions.push(P);
//                   tangents.push(T);
//                   normals.push(N);
//                   binormals.push(B);
//                 }
//               }
//
//               return {
//                 distances,
//                 positions,
//                 normals,
//                 binormals,
//                 tangents
//               }
//             };
//             let stonePathVectors = computeStonePathVectors(vertexRows);
//             that.stonePaths.push(stonePathVectors);
//
//             // => Bevels
//             let computeBevels = function () {
//               vertexRow = [];
//               vertexRows = [];
//               index = 0;
//               let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//               if (stoneSizeItem && stoneMode) {
//                 let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
//                   distY = stoneMode.bevelDistY || stoneMode.safeDistY;
//                 let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
//                   bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
//                   bevelHeight = stoneSizeItem.size / 2 * 1.2;
//
//                 /*
//                 Die Bevels werden an der Nullposition erstellt und beim Aufbau der Scene mit den Steinen
//                 ausgerichtet
//                 */
//                 switch (stoneGroup.type) {
//                   case 1: // Brillant
//                   {
//                     let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
//                     if (bevelTesselation < 2) bevelTesselation = 2;
//                     bevelTesselation *= 4;
//                     bevelTesselation--;
//                     let incRad = Math.PI * 2 / bevelTesselation,
//                       rad,
//                       dist,
//                       i,
//                       extraBorder = 30;
//
//                     stonePathVectors.positions.forEach(function (p, bevelIndex) {
//                         vertexRows = [];
//                         index = 0;
//
//                         // 1. Reihe
//                         vertexRow = [];
//                         dist = bevelSizeX_half + extraBorder;
//                         rad = 0.0;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(dist, -5, 0);
//                           v.rotateY(rad);
//                           rad -= incRad;
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // 2. Reihe
//                         vertexRow = [];
//                         dist = bevelSizeX_half;
//                         rad = 0.0;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(dist, -5, 0);
//                           v.rotateY(rad);
//                           rad -= incRad;
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // Mittelpunkt
//                         i = vertexRow.length;
//                         vertexRow = [];
//                         while (i--) {
//                           v = new CVertex(0, -bevelHeight, 0);
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         out.push({
//                           vertex2DArray: vertexRows,
//                           type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                           index: -1,
//                           no_rotate: true,
//                         });
//                       }
//                     )
//                     break;
//                   }
//                   case 2: // Princess
//                   case 3: // Princess 45°
//                   {
//                     let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
//                     if (bevelTesselation < 2) bevelTesselation = 2;
//                     bevelTesselation--;
//                     let incX = (bevelSizeX_half * 2) / bevelTesselation,
//                       incY = (bevelSizeY_half * 2) / bevelTesselation,
//                       x, y, z, i, j, j_l,
//                       extraBorder = 30;
//
//                     stonePathVectors.positions.forEach(function (p, bevelIndex) {
//                         vertexRows = [];
//                         index = 0;
//
//                         // 1. Reihe
//                         vertexRow = [];
//                         incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
//                         incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
//                         x = -bevelSizeX_half - extraBorder;
//                         y = 0;
//                         z = -bevelSizeY_half - extraBorder;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // 2. Reihe
//                         vertexRow = [];
//                         incX = (bevelSizeX_half * 2) / bevelTesselation;
//                         incY = (bevelSizeY_half * 2) / bevelTesselation;
//                         x = -bevelSizeX_half;
//                         y = 0;
//                         z = -bevelSizeY_half;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // Mittelpunkt
//                         i = vertexRow.length;
//                         vertexRow = [];
//                         while (i--) {
//                           v = new CVertex(0, -bevelHeight, 0);
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         if (stoneGroup.type == 3) // Princess 45°
//                         {
//                           for (i = 0; i < 3; i++) {
//                             vertexRow = vertexRows[i];
//                             j_l = vertexRow.length;
//                             for (j = 0; j < j_l; j++)
//                               vertexRow[j].rotateY(Math.PI / 4);
//                           }
//                         }
//
//                         out.push({
//                           vertex2DArray: vertexRows,
//                           type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                           index: -1,
//                           no_rotate: true,
//                         });
//                       }
//                     )
//                     break;
//                   }
//                   case 4: // Baguette quer
//                   case 5: // Baguette längs
//                   {
//                     bevelSizeY_half = stoneSizeItem.lengthFactor ? ((stoneSizeItem.size * stoneSizeItem.lengthFactor) + distY) / 2 : bevelSizeX_half;
//
//                     let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
//                     if (bevelTesselation < 2) bevelTesselation = 2;
//                     bevelTesselation--;
//                     let incX = (bevelSizeX_half * 2) / bevelTesselation,
//                       incY = (bevelSizeY_half * 2) / bevelTesselation,
//                       x, y, z, i,
//                       extraBorder = 30;
//
//                     stonePathVectors.positions.forEach(function (p, bevelIndex) {
//                         vertexRows = [];
//                         index = 0;
//
//                         // 1. Reihe
//                         vertexRow = [];
//                         incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
//                         incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
//                         x = -bevelSizeX_half - extraBorder;
//                         y = 0;
//                         z = -bevelSizeY_half - extraBorder;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // 2. Reihe
//                         vertexRow = [];
//                         incX = (bevelSizeX_half * 2) / bevelTesselation;
//                         incY = (bevelSizeY_half * 2) / bevelTesselation;
//                         x = -bevelSizeX_half;
//                         y = 0;
//                         z = -bevelSizeY_half;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x += incX;
//                         }
//                         x -= incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z += incY;
//                         }
//                         z -= incY;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           x -= incX;
//                         }
//                         x += incX;
//                         for (i = 0; i <= bevelTesselation; i++) {
//                           v = new CVertex(x, y, z);
//                           v.i = index++;
//                           vertexRow.push(v)
//                           z -= incY;
//                         }
//                         vertexRows.push(vertexRow);
//
//                         // Mittelpunkt
//                         i = vertexRow.length;
//                         vertexRow = [];
//                         while (i--) {
//                           v = new CVertex(0, -bevelHeight, 0);
//                           v.i = index++;
//                           vertexRow.push(v)
//                         }
//                         vertexRows.push(vertexRow);
//
//                         out.push({
//                           vertex2DArray: vertexRows,
//                           type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                           index: -1,
//                           no_rotate: true,
//                         });
//                       }
//                     )
//                     break;
//                   }
//                 }
//               }
//             }
//
//             let computeCut = function () {
//               vertexRow = [];
//               vertexRows = [];
//               index = 0;
//
//               let min = 999999, max = -999999;
//               if (stoneGroup.distribution < 100 && (positionRectangle.out_maxRectangles > stoneGroup.count)) {
//                 POINTS.forEach(function (e) {
//                   if (e.rad < min) min = e.rad;
//                   if (e.rad > max) max = e.rad;
//                 })
//
//                 let stoneSizeY_rad_half = ((stoneSizeY + (stoneMode ? stoneMode.safeDistY : 0)) * Math.PI * 2) / (Math.PI * ringSideRadius * 2) / 2;
//
//                 min -= thetaExtra;
//                 min -= stoneSizeY_rad_half;
//                 max -= thetaExtra;
//                 max += stoneSizeY_rad_half;
//               } else {
//                 min = -Math.PI;
//                 max = Math.PI;
//               }
//
//               let length = max - min, cur = min;
//
//               let PI2 = Math.PI * 2;
//               let step = PI2 / 180; // 2 Grad schrittweite
//               let numRows = Math.trunc(length / step);
//               step = length / (numRows - 1);
//               let y, z = -(ringSideRadius - innerRadius);
//               // @ts-ignore
//               let depth = stoneGroup.size * 0.15;
//               if (X < 0) depth = -depth;
//               let uv_u, pA, pB, AZ, ZB, AB, scale;
//
//               if (X > 0) {
//                 pA = that.backVertices[that.middleVertexBack[0] + 1];
//                 pB = that.backVertices[that.middleVertexBack[0] - 1];
//               } else {
//                 pA = that.backVertices[that.middleVertexBack[1] - 1];
//                 pB = that.backVertices[that.middleVertexBack[1] + 1];
//               }
//
//               while (numRows-- > 0) {
//                 vertexRow = [];
//
//                 y = (cur) * innerCircumference / PI2;
//
//                 v = new CVertex(X, y, z - stoneSizeX_half);
//
//                 AZ = v.z - pA.z;
//                 ZB = pB.z - v.z;
//                 AB = pB.z - pA.z;
//                 scale = AZ / AB;
//                 uv_u = pA.u + ((pB.u - pA.u) * scale);
//                 uv_u = (X > 0 ? 1.0 - uv_u : uv_u);
//
//                 v.i = index++;
//                 // v.v = uv_v;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X - depth, y, z - stoneSizeX_half);
//                 v.i = index++;
//                 // v.v = uv_v;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X - depth, y, z - stoneSizeX_half);
//                 v.i = index++;
//                 // v.v = uv_v;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//
//                 v = new CVertex(X - depth, y, z + stoneSizeX_half);
//
//                 AZ = v.z - pA.z;
//                 ZB = pB.z - v.z;
//                 AB = pB.z - pA.z;
//                 scale = AZ / AB;
//                 uv_u = pA.u + ((pB.u - pA.u) * scale)
//                 uv_u = (X > 0 ? 1.0 - uv_u : uv_u);
//
//                 v.i = index++;
//                 // v.v = uv_v;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X - depth, y, z + stoneSizeX_half);
//                 v.i = index++;
//                 // v.v = uv_v;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X, y, z + stoneSizeX_half);
//                 v.i = index++;
//                 // v.v = uv_v;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//
//                 vertexRows.push(vertexRow);
//
//                 cur += step;
//               }
//
//               let mesh = new CMesh;
//               mesh.rows = vertexRows;
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "sideChannel_" + stoneGroupIndex,
//                 index: -1,
//                 triangulate_isFrontFace: X > 0,
//                 triangulate_useVectorDist: false,
//               });
//
//
//               let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//               if (stoneSizeItem && stoneMode) {
//                 // let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
//                 //     distY = stoneMode.bevelDistY || stoneMode.safeDistY;
//                 // let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
//                 //     bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
//                 //     bevelHeight = stoneSizeItem.size / 2;
//
//                 // TODO ?
//                 if (stoneGroup.type !== 1) {
//                   Log("warning", "Steinart nicht möglich! Änderung in der Config vornehmen!");
//                 } else {
//                   // let PI2 = Math.PI * 2;
//                   // let min = minPI * innerCircumference / PI2,
//                   //     max = maxPI * innerCircumference / PI2;
//
//                   // let bevelTesselation = AppComponent.app.data.bevelTesselation;
//                   // if (bevelTesselation < 2) bevelTesselation = 2;
//                   // bevelTesselation *= 4;
//                   // bevelTesselation--;
//                   // let incRad = Math.PI * 2 / bevelTesselation,
//                   //     rad,
//                   //     dist,
//                   //     i,
//                   //     extraBorder = 30;
//                   //
//                   // console.log(stonePathVectors.positions);
//                   // stonePathVectors.positions.forEach(function (p, bevelIndex)
//                   //     {
//                   //         // vertexRows = [];
//                   //         // index = 0;
//                   //         //
//                   //         // // 1. Reihe
//                   //         // vertexRow = [];
//                   //         // dist = bevelSizeX_half + extraBorder;
//                   //         // rad = 0.0;
//                   //         // for (i = 0; i <= bevelTesselation; i++)
//                   //         // {
//                   //         //     v = new CVertex(dist, -50, 0);
//                   //         //     v.rotateY(rad);
//                   //         //     rad -= incRad;
//                   //         //     v.i = index++;
//                   //         //     vertexRow.push(v)
//                   //         // }
//                   //         // vertexRows.push(vertexRow);
//                   //         //
//                   //         // // 2. Reihe
//                   //         // vertexRow = [];
//                   //         // dist = bevelSizeX_half;
//                   //         // rad = 0.0;
//                   //         // for (i = 0; i <= bevelTesselation; i++)
//                   //         // {
//                   //         //     v = new CVertex(dist, -50, 0);
//                   //         //     v.rotateY(rad);
//                   //         //     rad -= incRad;
//                   //         //     v.i = index++;
//                   //         //     vertexRow.push(v)
//                   //         // }
//                   //         // vertexRows.push(vertexRow);
//                   //         //
//                   //         // // Mittelpunkt
//                   //         // i = vertexRow.length;
//                   //         // vertexRow = [];
//                   //         // while (i--)
//                   //         // {
//                   //         //     v = new CVertex(0, -bevelHeight, 0);
//                   //         //     v.i = index++;
//                   //         //     vertexRow.push(v)
//                   //         // }
//                   //         // vertexRows.push(vertexRow);
//                   //         //
//                   //         // out.push({
//                   //         //     vertex2DArray: vertexRows,
//                   //         //     type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                   //         //     index: -1,
//                   //         // });
//                   //     }
//                   // )
//
//                 }
//               }
//             }
//
//             let computeChannel = function () {
//               vertexRow = [];
//               vertexRows = [];
//               index = 0;
//
//               let min = 999999, max = -999999;
//               if (stoneGroup.distribution < 100 && (positionRectangle.out_maxRectangles > stoneGroup.count) && stoneGroup.count !== -100) {
//                 POINTS.forEach(function (e) {
//                   if (e.rad < min) min = e.rad;
//                   if (e.rad > max) max = e.rad;
//                 })
//
//                 let stoneSizeY_rad_half = (stoneSizeY * Math.PI * 2) / (Math.PI * ringSideRadius * 2) / 2;
//
//                 min -= thetaExtra;
//                 min -= stoneSizeY_rad_half;
//                 max -= thetaExtra;
//                 max += stoneSizeY_rad_half;
//               } else {
//                 min = -Math.PI;
//                 max = Math.PI;
//               }
//
//               let length = max - min, cur = min;
//
//               let PI2 = Math.PI * 2;
//               let step = PI2 / 180; // 2 Grad schrittweite
//               let numRows = Math.trunc(length / step);
//               step = length / (numRows - 1);
//               let y, z = -(ringSideRadius - innerRadius);
//               // @ts-ignore
//               let depth = stoneType.sizeDepthFactor * stoneGroup.size;
//               if (X < 0) depth = -depth;
//               let uv_u, pA, pB, AZ, ZB, AB, scale;
//
//               if (X < 0) {
//                 pA = that.backVertices[that.middleVertexBack[0] - 1];
//                 pB = that.backVertices[that.middleVertexBack[0] + 1];
//               } else {
//                 pA = that.backVertices[that.backVertices.length - 1 - that.middleVertexBack[1] - 1];
//                 pB = that.backVertices[that.backVertices.length - 1 - that.middleVertexBack[1] + 1];
//               }
//
//               let channelSizeX_half = stoneSizeX_half * 0.88; // 12% kleiner als Stein
//
//               while (numRows-- > 0) {
//                 vertexRow = [];
//
//                 y = (cur) * innerCircumference / PI2;
//
//                 v = new CVertex(X, y, z - channelSizeX_half);
//                 // v = new CVertex(X, y, z - stoneSizeX_half);
//
//                 AZ = v.z - pA.z;
//                 ZB = pB.z - v.z;
//                 AB = pB.z - pA.z;
//                 scale = AZ / AB;
//                 uv_u = pA.u + ((pB.u - pA.u) * scale);
//
//                 v.i = index++;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X - depth, y, z - channelSizeX_half);
//                 // v = new CVertex(X - depth, y, z - stoneSizeX_half);
//                 v.i = index++;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X - depth, y, z - channelSizeX_half);
//                 // v = new CVertex(X - depth, y, z - stoneSizeX_half);
//                 v.i = index++;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//
//                 v = new CVertex(X - depth, y, z + channelSizeX_half);
//                 // v = new CVertex(X - depth, y, z + stoneSizeX_half);
//
//                 AZ = v.z - pA.z;
//                 ZB = pB.z - v.z;
//                 AB = pB.z - pA.z;
//                 scale = AZ / AB;
//                 uv_u = pA.u + ((pB.u - pA.u) * scale)
//
//                 v.i = index++;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X - depth, y, z + channelSizeX_half);
//                 // v = new CVertex(X - depth, y, z + stoneSizeX_half);
//                 v.i = index++;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//                 v = new CVertex(X, y, z + channelSizeX_half);
//                 // v = new CVertex(X, y, z + stoneSizeX_half);
//                 v.i = index++;
//                 v.u = uv_u;
//                 vertexRow.push(v);
//
//                 vertexRows.push(vertexRow);
//
//                 cur += step;
//               }
//
//               let mesh = new CMesh;
//               mesh.rows = vertexRows;
//
//               out.push({
//                 vertex2DArray: vertexRows,
//                 type: "sideChannel_" + stoneGroupIndex,
//                 index: -1,
//                 triangulate_isFrontFace: X > 0,
//                 triangulate_useVectorDist: false,
//               });
//
//               let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
//               if (stoneSizeItem && stoneMode) {
//                 // let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
//                 //     distY = stoneMode.bevelDistY || stoneMode.safeDistY;
//                 // let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
//                 //     bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
//                 //     bevelHeight = stoneSizeItem.size / 2;
//
//                 // TODO ?
//                 if (stoneGroup.type !== 1) {
//                   Log("warning", "Steinart nicht möglich! Änderung in der Config vornehmen!");
//                 } else {
//                   // let PI2 = Math.PI * 2;
//                   // let min = minPI * innerCircumference / PI2,
//                   //     max = maxPI * innerCircumference / PI2;
//
//                   // let bevelTesselation = AppComponent.app.data.bevelTesselation;
//                   // if (bevelTesselation < 2) bevelTesselation = 2;
//                   // bevelTesselation *= 4;
//                   // bevelTesselation--;
//                   // let incRad = Math.PI * 2 / bevelTesselation,
//                   //     rad,
//                   //     dist,
//                   //     i,
//                   //     extraBorder = 30;
//                   //
//                   // console.log(stonePathVectors.positions);
//                   // stonePathVectors.positions.forEach(function (p, bevelIndex)
//                   //     {
//                   //         // vertexRows = [];
//                   //         // index = 0;
//                   //         //
//                   //         // // 1. Reihe
//                   //         // vertexRow = [];
//                   //         // dist = bevelSizeX_half + extraBorder;
//                   //         // rad = 0.0;
//                   //         // for (i = 0; i <= bevelTesselation; i++)
//                   //         // {
//                   //         //     v = new CVertex(dist, -50, 0);
//                   //         //     v.rotateY(rad);
//                   //         //     rad -= incRad;
//                   //         //     v.i = index++;
//                   //         //     vertexRow.push(v)
//                   //         // }
//                   //         // vertexRows.push(vertexRow);
//                   //         //
//                   //         // // 2. Reihe
//                   //         // vertexRow = [];
//                   //         // dist = bevelSizeX_half;
//                   //         // rad = 0.0;
//                   //         // for (i = 0; i <= bevelTesselation; i++)
//                   //         // {
//                   //         //     v = new CVertex(dist, -50, 0);
//                   //         //     v.rotateY(rad);
//                   //         //     rad -= incRad;
//                   //         //     v.i = index++;
//                   //         //     vertexRow.push(v)
//                   //         // }
//                   //         // vertexRows.push(vertexRow);
//                   //         //
//                   //         // // Mittelpunkt
//                   //         // i = vertexRow.length;
//                   //         // vertexRow = [];
//                   //         // while (i--)
//                   //         // {
//                   //         //     v = new CVertex(0, -bevelHeight, 0);
//                   //         //     v.i = index++;
//                   //         //     vertexRow.push(v)
//                   //         // }
//                   //         // vertexRows.push(vertexRow);
//                   //         //
//                   //         // out.push({
//                   //         //     vertex2DArray: vertexRows,
//                   //         //     type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
//                   //         //     index: -1,
//                   //         // });
//                   //     }
//                   // )
//
//                 }
//               }
//             }
//
//             if (stoneGroup.mode === 40 || stoneGroup.mode == 41) // eingerieben
//               computeBevels();
//             else if (stoneGroup.mode === 42 || stoneGroup.mode == 43) // Kanal
//               computeChannel();
//             else if (stoneGroup.mode === 44 || stoneGroup.mode == 45) // Verschnitt
//               computeCut();
//           }
//         }
//       })
//
//       return out;
//     }
//
//     rows = extrude_mDiv();
//
//     let mesh = calc_stones();
//     if (mesh && rows) {
//       // @ts-ignore
//       mesh.forEach(function (e) {
//         // @ts-ignore
//         rows.push(e);
//       })
//     }
//
//     rows?.forEach(function (e) {
//       if (e.vertex2DArray && e.vertex2DArray.length) {
//         let mesh = new CMesh();
//         mesh.rows = e.vertex2DArray;
//         that.computeUV_V(mesh.rows, 1.0 / innerCircumference);
//
// /*
//         if (e.type.includes("crossChannelCap")) {
//           // UV-Koordinaten anpassen. Diese müssen um 90 Grad gedreht und in der Mitte der Textur platziert werden.
//           let rows = e.vertex2DArray;
//           for (let i = 0, i_l = rows.length; i < i_l; i++) {
//             let row = rows[i];
//             for (let j = 0, j_l = row.length; j < j_l; j++) {
//               let u = row[j].u;
//               let v = row[j].v;
//
//               // u = v;//0.8 - (v - 0.5);
//               // v = u;
//
//               // row[j].u = 1.0 - v;
//               // row[j].v = u;
//             }
//           }
//
//           console.log(rows);
//         }
// */
//
//         if (e.triangulate_isFrontFace !== undefined && e.triangulate_useVectorDist !== undefined)
//           mesh.triangulate(e.triangulate_isFrontFace, e.triangulate_useVectorDist);
//         else {
//           if (e.type == "front" || e.type == "sl" || e.type == "sr")
//             mesh.triangulate(true, true);
//           else if (e.type == "gap")
//             mesh.triangulate(true, false);
//           else if (e.type == "helper")
//             mesh.triangulate(true, true);
//           else if (e.type.includes("Bevel"))
//             mesh.triangulate(true, false);
//             // else if (e.type == "channel")
//           //     mesh.triangulate(true, false);
//           else
//             mesh.triangulate(false, true);
//         }
//
//         if (!e.no_rotate === true)
//           mesh.rotateRows(innerRadius, thetaExtra);
//
//         mesh.computeWeightedAngleNormals(divMode != "s" && e.close_normals !== false);
//
//         meshData = mesh.serialize();
//         meshData.index = e.index;
//         meshData.type = e.type;
//         if (e.type == "gap") {
//           if (ring.ringData.gapMode == 1) // eckig?
//             meshData.outline = that.outline(e.vertex2DArray, false, 1, 1);
//           else
//             meshData.outline = that.outline(e.vertex2DArray);
//         } else if (divMode == "h" && e.type == "back") {
//           meshData.outline = that.outline(e.vertex2DArray, false, that.middleVertexBack[0], that.middleVertexBack[1]);
//         } else if (!e.no_outline)
//           meshData.outline = that.outline(e.vertex2DArray);
//
//         meshData.rows = mesh.rows;
//         meshData.normals = mesh.normals;
//         meshes.push(meshData);
//
//         if (e.type == "front") countFront++;
//         else if (e.type == "back") countBack++;
//       }
//     })
//
//     let index = 0;
//     let A, B, iA, iB, normalsA, normalsB, nAx, nBx, j, j_l: number;
//
//     // Segmente angleichen
//     if (1 && divMode != "s") {
//       let equal_normals = function (typeA: string, indexA: number, typeB: string, indexB: number) {
//         let meshA = null;
//
//         for (let i = 0; i < meshes.length; i++) {
//           if (meshes[i].type == typeA && meshes[i].index == indexA) meshA = meshes[i];
//           // kein break...es soll das letzte gefunden werden, was den Suchkriterien entspricht -> linkes Mesh seitlich der Fuge
//         }
//
//         let meshB = meshes.find(function (e) {
//           return e.type == typeB && e.index == indexB;
//         });
//
//         if (meshA && meshB) {
//           CMesh.equalNormals(meshA, meshB);
//           return true;
//         }
//
//         return false;
//       }
//
//       while (0) {
//         if (!equal_normals("front", index, "front", index + 1))
//           break;
//         index++;
//       }
//       index = 0;
//       while (1) {
//         if (!equal_normals("back", index, "back", index + 1))
//           break;
//         index++;
//       }
//     }
//
//     // Front-Back angleichen
//     /*
//         if (0)
//         {
//           // links
//           if (this.stepLeftVertices.length == 0)
//           {
//             let meshA = meshes.find(function (e)
//             {
//               return e.type == "back" && e.index == 0;
//             });
//
//             let meshB = meshes.find(function (e)
//             {
//               return e.type == "front" && e.index == 0;
//             });
//
//             if (meshA && meshB)
//             {
//               A = <CVertex[][]>meshA.rows;
//               B = <CVertex[][]>meshB.rows;
//               normalsA = meshA.normals;
//               normalsB = meshB.normals;
//
//               j_l = A.length < B.length ? A.length : B.length;
//               for (j = 0; j < j_l; j++)
//               {
//                 iA = A[j][0].i;
//                 iB = B[j][0].i;
//
//                 nAx = iA * 3;
//                 nBx = iB * 3;
//                 normalsA[nAx] = (normalsA[nAx] + normalsB[nBx]) * 0.5;
//                 normalsA[nAx + 1] = (normalsA[nAx + 1] + normalsB[nBx + 1]) * 0.5;
//                 normalsA[nAx + 2] = (normalsA[nAx + 2] + normalsB[nBx + 2]) * 0.5;
//                 normalsB[nBx] = normalsA[nAx];
//                 normalsB[nBx + 1] = normalsA[nAx + 1];
//                 normalsB[nBx + 2] = normalsA[nAx + 2];
//
//               }
//             }
//           }
//           else
//           {
//             let SL = meshes.find(function (e)
//             {
//               return e.type == "sl";
//             });
//             if (SL)
//             {
//               SL.index = 0;
//             }
//           }
//           // rechts
//           if (this.stepRightVertices.length == 0)
//           {
//             let meshB = meshes.find(function (e)
//             {
//               return e.type == "back" && e.index == countBack - 1;
//             });
//
//             let meshA = meshes.find(function (e)
//             {
//               return e.type == "front" && e.index == countFront - 1;
//             });
//
//             if (meshA && meshB)
//             {
//
//               A = meshA.rows;
//               B = meshB.rows;
//
//               normalsA = meshA.normals;
//               normalsB = meshB.normals;
//
//               // @ts-ignore
//               j_l = A.length < B.length ? A.length : B.length;
//               for (j = 0; j < j_l; j++)
//               {
//                 // @ts-ignore
//                 iA = A[j][A[j].length - 1].i;
//                 // @ts-ignore
//                 iB = B[j][B[j].length - 1].i;
//
//                 nAx = iA * 3;
//                 nBx = iB * 3;
//                 normalsA[nAx] = (normalsA[nAx] + normalsB[nBx]) * 0.5;
//                 normalsA[nAx + 1] = (normalsA[nAx + 1] + normalsB[nBx + 1]) * 0.5;
//                 normalsA[nAx + 2] = (normalsA[nAx + 2] + normalsB[nBx + 2]) * 0.5;
//                 normalsB[nBx] = normalsA[nAx];
//                 normalsB[nBx + 1] = normalsA[nAx + 1];
//                 normalsB[nBx + 2] = normalsA[nAx + 2];
//               }
//             }
//
//           }
//           else
//           {
//             let SR = meshes.find(function (e)
//             {
//               return e.type == "sr";
//             });
//             if (SR)
//             {
//               SR.index = countFront - 1;
//             }
//
//           }
//         }
//     */
//
//     // Segmentierter Ring: Normalen Mat1-Mat2 horizontal angleichen
//     if (1 && divMode == "s") {
//       let frontMeshes: iMeshData[] = [];
//       meshes.forEach(function (e) {
//         if (e.type == "front")
//           frontMeshes.push(e);
//       })
//
//       if (frontMeshes.length == 2) {
//         let A = frontMeshes[0];
//         let B = frontMeshes[1];
//         let normalsA = A.normals;
//         let normalsB = B.normals;
//
//         let loop = [
//           {
//             // @ts-ignore
//             rowA: A.rows[0],
//             // @ts-ignore
//             rowB: B.rows[B.rows.length - 1],
//           },
//           {
//             // @ts-ignore
//             rowB: B.rows[0],
//             // @ts-ignore
//             rowA: A.rows[A.rows.length - 1],
//           },
//         ];
//
//         loop.forEach(function (e) {
//           let i_l = e.rowA.length < e.rowB.length ? e.rowA.length : e.rowB.length;
//
//           for (i = 0; i < i_l; i++) {
//             iA = e.rowA[i].i;
//             iB = e.rowB[i].i;
//
//             nAx = iA * 3;
//             nBx = iB * 3;
//             normalsA[nAx] = (normalsA[nAx] + normalsB[nBx]) * 0.5;
//             normalsA[nAx + 1] = (normalsA[nAx + 1] + normalsB[nBx + 1]) * 0.5;
//             normalsA[nAx + 2] = (normalsA[nAx + 2] + normalsB[nBx + 2]) * 0.5;
//             normalsB[nBx] = normalsA[nAx];
//             normalsB[nBx + 1] = normalsA[nAx + 1];
//             normalsB[nBx + 2] = normalsA[nAx + 2];
//           }
//         });
//       }
//     }
//
//     return meshes;
//   }
//
//   interpolate(xPos: number, vecArray: CVertex[], startIndex: number = 0/*, range: number = 50*/): iInterpolateResult {
//     let vecArrayIndex = 0, i;
//     if (startIndex < 0) startIndex = 0;
//     if (startIndex >= vecArray.length - 1) startIndex = 0;
//     for (i = startIndex; i < vecArray.length; i++) {
//       if (vecArray[i].x > xPos)
//         break;
//       vecArrayIndex = i;
//     }
//
//     let indexA = vecArrayIndex;
//     let indexB = vecArrayIndex >= vecArray.length - 1 ? indexA : vecArrayIndex + 1;
//
//     if (indexA == indexB) {
//       return {
//         x: xPos,
//         z: vecArray[indexA].z,
//         indexVectorA: indexA,
//         indexVectorB: indexB,
//         startIndex: startIndex,
//         uv_u: vecArray[indexA].u,
//       }
//     } else {
//       let pA = vecArray[indexA];
//       let pB = vecArray[indexB];
//
//       let AX = xPos - pA.x;
//       let XB = pB.x - xPos;
//       let AB = pB.x - pA.x;
//
//       let v1 = TEMP.Vertex_1;
//       let scale = AX / AB;
//       pA.lerpToRef(pB, scale, v1);
//
//       let fA = AX / AB, fB = XB / AB;
//       if (fA < 0.25) {
//         if (indexA > 0) {
//           indexA--;
//         }
//       } else if (fB < 0.25) {
//         if (indexB < vecArray.length - 1) {
//           indexB++;
//         }
//       }
//
//       return {
//         x: v1.x,
//         z: v1.z,
//         indexVectorA: indexA,
//         indexVectorB: indexB,
//         startIndex: startIndex,
//         uv_u: v1.u,
//       }
//     }
//   }
//
//   interpolate_distance(xPos: number, vecArray: CVertex[], distance: number): iInterpolateResult {
//     let result = this.interpolate(xPos, vecArray);
//
//     if (distance > 0) {
//       let v = new CVertex(result.x, 0, result.z),
//         vB = new CVertex(0, 0, 0),
//         maxIndex = vecArray.length,
//         indexA,
//         indexB = result.indexVectorB;
//
//       while (indexB < maxIndex) {
//
//         vB.x = vecArray[indexB].x;
//         vB.z = vecArray[indexB].z;
//         if (v.distance(vB) >= distance) {
//           indexA = indexB - 1;
//           let pA = vecArray[indexA];
//           let pB = vecArray[indexB];
//
//           let distance_A = v.distance(pA);
//           let distance_B = v.distance(pB);
//
//           let AX = distance - distance_A;
//           let XB = distance_B - distance;
//           let AB = distance_B - distance_A;
//
//           let v1 = TEMP.Vertex_1;
//           let scale = AX / AB;
//           pA.lerpToRef(pB, scale, v1);
//
//           let fA = AX / AB, fB = XB / AB;
//           if (fA < 0.25) {
//             if (indexA > 0) {
//               indexA--;
//             }
//           } else if (fB < 0.25) {
//             if (indexB < vecArray.length - 1) {
//               indexB++;
//             }
//           }
//
//           result.x = v1.x;
//           result.z = v1.z;
//           result.indexVectorA = indexA;
//           result.indexVectorB = indexB;
//           result.startIndex = 0;
//           result.uv_u = v1.u;
//           break;
//         }
//
//         indexB++;
//       }
//     } else {
//       let v = new CVertex(result.x, 0, result.z),
//         vA = new CVertex(0, 0, 0),
//         indexA = result.indexVectorA,
//         indexB;
//
//       distance = -distance;
//
//       while (indexA > 0) {
//         vA.x = vecArray[indexA].x;
//         vA.z = vecArray[indexA].z;
//         if (v.distance(vA) >= distance) {
//           indexB = indexA + 1;
//           let pA = vecArray[indexA];
//           let pB = vecArray[indexB];
//
//           let distance_A = v.distance(pA);
//           let distance_B = v.distance(pB);
//
//           let AX = distance_A - distance;
//           let XB = distance - distance_B;
//           let AB = distance_A - distance_B;
//
//           let v1 = TEMP.Vertex_1;
//           let scale = AX / AB;
//           pA.lerpToRef(pB, scale, v1);
//
//           let fA = AX / AB, fB = XB / AB;
//           if (fA < 0.25) {
//             if (indexA > 0) {
//               indexA--;
//             }
//           } else if (fB < 0.25) {
//             if (indexB < vecArray.length - 1) {
//               indexB++;
//             }
//           }
//
//           result.x = v1.x;
//           result.z = v1.z;
//           result.indexVectorA = indexA;
//           result.indexVectorB = indexB;
//           result.startIndex = 0;
//           result.uv_u = v1.u;
//
//           break;
//         }
//
//         indexA--;
//       }
//     }
//
//     return result;
//   }
//
//   interpolate_distance_2(vecArray: CVertex[], startIndex: number, distance: number): iInterpolateResult {
//     let xPos = 0, indexA = 0, indexB = 0;
//
//     if (vecArray.length < startIndex)
//       startIndex = 0;
//
//     let vStart = vecArray[startIndex], v1, v2, d1, d2;
//
//     if (distance > 0) {
//       for (let i = startIndex + 1, i_l = vecArray.length - 1; i < i_l; i++) {
//         v1 = vecArray[i];
//         d1 = vStart.distance(v1);
//         v2 = vecArray[i + 1];
//         d2 = vStart.distance(v2);
//         if (d1 <= distance && d2 >= distance) {
//           indexA = i;
//           indexB = i + 1;
//         } else if (d2 <= distance && d1 >= distance) {
//           indexA = i + 1;
//           indexB = i;
//         } else continue;
//
//         let AX = distance - d1;
//         let XB = d2 - distance;
//         let AB = d2 - d1;
//
//         let V = TEMP.Vertex_1;
//         let scale = AX / AB;
//         v1.lerpToRef(v2, scale, V);
//
//         let result = {
//           x: V.x,
//           z: V.z,
//           indexVectorA: indexA,
//           indexVectorB: indexB,
//           startIndex: 0,
//           uv_u: V.u
//         }
//
//         return result;
//       }
//     } else {
//       distance = -distance;
//       for (let i = startIndex - 1; i > 1; i--) {
//         v1 = vecArray[i];
//         d1 = vStart.distance(v1);
//         v2 = vecArray[i - 1];
//         d2 = vStart.distance(v2);
//         if (d1 <= distance && d2 >= distance) {
//           indexA = i;
//           indexB = i - 1;
//         } else if (d2 <= distance && d1 >= distance) {
//           indexA = i - 1;
//           indexB = i;
//         } else continue;
//
//         let AX = distance - d1;
//         let XB = d2 - distance;
//         let AB = d2 - d1;
//
//         let V = TEMP.Vertex_1;
//         let scale = AX / AB;
//         v1.lerpToRef(v2, scale, V);
//
//         let result = {
//           x: V.x,
//           z: V.z,
//           indexVectorA: indexA,
//           indexVectorB: indexB,
//           startIndex: 0,
//           uv_u: V.u
//         }
//
//         return result;
//       }
//     }
//
//     let result = {
//       x: xPos,
//       z: vecArray[indexA].z,
//       indexVectorA: indexA,
//       indexVectorB: indexB,
//       startIndex: startIndex,
//       uv_u: vecArray[indexA].u,
//     }
//
//     return result;
//   }
//
//   extrude_shape_xy(shape: CVertex[], path: CVertex[], zContour: CVertex[] = this.frontVertices, close: boolean = true, alignY = true) {
//     let V1 = TEMP.Vertex_1;
//     let V2 = TEMP.Vertex_2;
//     let normal = new CVertex(0, 0, 1.0);
//     let vX = new CVertex(1, 0, 0);
//
//     let rows = [], row, finalRow, lastPath = path.length - 1, theta = 0, index = 0, i, j, j_l, v, IP;
//
//     for (i = 1; i <= lastPath; i++) {
//       path[i].subToRef(path[i - 1], V1);
//       CVertex.crossToRef(V1, normal, V2);
//
//       theta = CVertex.angleXY(V2, vX);
//       if (V2.y < 0) theta = -theta;
//
//       row = [];
//       finalRow = [];
//       j_l = shape.length;
//       for (j = 0; j < j_l; j++) {
//         v = CVertex.fromVertex(shape[j]);
//         v.rotateZ(theta);
//         v.add(path[i - 1]);
//
//         row.push(v);
//       }
//
//       j_l = row.length;
//       for (j = 0; j < j_l; j++) {
//         v = row[j];
//         IP = this.interpolate(v.x, zContour, 0);
//
//         if (v.z < IP.z) {
//           let p1: iPoint = {x: zContour[IP.indexVectorA].x, y: zContour[IP.indexVectorA].z};
//           let p2: iPoint = {x: zContour[IP.indexVectorB].x, y: zContour[IP.indexVectorB].z};
//           let p3: iPoint = {x: v.x, y: v.z};
//           let p4: iPoint = {
//             x: j == j_l - 1 ? row[j - 1].x : row[j + 1].x,
//             y: j == j_l - 1 ? row[j - 1].z : row[j + 1].z
//           };
//
//           let pI = calculateIntersection(p1, p2, p3, p4);
//           if (pI != null) {
//             v.x = pI.x;
//             v.z = pI.y;
//           } else
//             continue;
//         } else {
//           if (j == 0 || j == j_l - 1)
//             v.z = IP.z;
//         }
//
//         v.u = this.interpolate(v.x, zContour).uv_u;
//         // Fehler bei Wellenfuge an rechter Ringseite. Die Fuge wurde an den Wellenbergen über den Ringrand hinaus gezeichnet
//         // v.u = this.interpolate(v.x, zContour, IP.indexVectorA).uv_u;
//         v.v = v.y;
//
//         finalRow.push(v);
//       }
//
//       rows.push(finalRow);
//     }
//
//     /*
//     Richtet die Y-Werte am Pfad aus.
//     Die Y-Werte einer Reihe haben alle den selben Wert.
//     */
//
//     if (alignY) {
//       for (i = 0; i < lastPath; i++) {
//         row = rows[i];
//
//         let p1: iPoint = {x: 0, y: path[i].y};
//         let p2: iPoint = {x: 100, y: path[i].y};
//         let p3: iPoint = {x: 0, y: 0};
//         let p4: iPoint = {x: 0, y: 0};
//
//         j_l = row.length;
//         for (j = 0; j < j_l; j++) {
//           p3.x = row[j].x;
//           p3.y = row[j].y;
//           try {
//             if (i == lastPath - 1) {
//               let l = rows[i - 1].length;
//               if (j >= l) {
//                 p4.x = rows[i - 1][l - 1].x;
//                 p4.y = rows[i - 1][l - 1].y;
//               } else {
//                 p4.x = rows[i - 1][j].x
//                 p4.y = rows[i - 1][j].y
//               }
//             } else {
//               let l = rows[i + 1].length;
//               if (j >= l) {
//                 p4.x = rows[i + 1][l - 1].x;
//                 p4.y = rows[i + 1][l - 1].y;
//               } else {
//                 p4.x = rows[i + 1][j].x
//                 p4.y = rows[i + 1][j].y
//               }
//             }
//           } catch (e) {
//             console.log(i, j, rows);
//             throw "er";
//           }
//
//           let pI = calculateIntersection(p1, p2, p3, p4);
//
//           if (pI) {
//             IP = this.interpolate(pI.x, zContour);
//             row[j].x = pI.x;
//             row[j].y = pI.y;
//             if (j == 0 || j == j_l - 1)
//               row[j].z = IP.z;
//           }
//         }
//       }
//     }
//
//     index = 0;
//     for (i = 0; i < rows.length; i++) {
//       row = rows[i];
//       for (j = 0; j < row.length; j++)
//         row[j].i = index++;
//     }
//
//     if (close) {
//       row = [];
//       let row_0 = rows[0];
//       j_l = row_0.length;
//       for (j = 0; j < j_l; j++) {
//         v = CVertex.fromVertex(row_0[j]);
//         v.sub(path[0]);
//         v.add(path[lastPath]);
//         v.v = v.y;
//         v.i = index++;
//         row.push(v);
//       }
//       rows.push(row);
//     }
//
//     return rows;
//   }
//
//   toCSV() {
//     let rows = [] as string[];
//     rows.push("frontVertices");
//     this.frontVertices.forEach(function (e) {
//       rows.push(e.x.toLocaleString() + ";" + e.z.toLocaleString());
//     })
//     rows.push("backVertices");
//     this.backVertices.forEach(function (e) {
//       rows.push(e.x.toLocaleString() + ";" + e.z.toLocaleString());
//     })
//
//     let csvContent = "data:text/csv;charset=utf-8,";
//
//     rows.forEach(function (e) {
//       csvContent += e + "\r\n";
//     });
//
//     let encodedUri = encodeURI(csvContent);
//     window.open(encodedUri);
//   }
//
//   position_rectangles(param: iPositionRectangle) {
//     if (param.circumferenceFactor > 1.0)
//       param.circumferenceFactor = 1.0;
//     else if (param.circumferenceFactor < 0.1)
//       param.circumferenceFactor = 0.1;
//
//     param.out_result = [] as iRectPosition[];
//     /* damit sich die Rechtecke nicht überschneiden. wird der Radius um die halbe Rechteckweite reduziert.
//     Der tatsächliche Radius bleibt erhalten.
//      */
//     let circumference = (2 * Math.PI * param.circumferenceFactor) * (param.radius - param.rectWidth / 2);
//     let maxRectangles = Math.trunc(circumference / (param.rectHeight + param.safetyMargin));
//     param.out_maxRectangles = maxRectangles;
//
//     let angleIncrement, angleStart;
//
//     if (param.circumferenceFactor < 1.0 || param.forceFullCircle) {
//       if (param.maxRectangles >= 1 && maxRectangles > param.maxRectangles) maxRectangles = param.maxRectangles;
//       else if (param.maxRectangles > 0.0 && param.maxRectangles < 1.0) maxRectangles = Math.trunc(maxRectangles * param.maxRectangles);
//
//       angleIncrement = (2 * Math.PI * (param.circumferenceFactor ?? 1)) / (maxRectangles - (param.circumferenceFactor < 1.0 ? 1 : 0));
//       angleStart = (angleIncrement * (maxRectangles - (param.circumferenceFactor < 1.0 ? 1 : 0))) / 2
//     } else {
//       angleIncrement = (2 * Math.PI) / (maxRectangles);
//
//       if (param.maxRectangles >= 1 && maxRectangles > param.maxRectangles) maxRectangles = param.maxRectangles;
//       else if (param.maxRectangles > 0.0 && param.maxRectangles < 1.0) maxRectangles = Math.trunc(maxRectangles * param.maxRectangles);
//
//       angleStart = (angleIncrement * (maxRectangles - 1)) / 2;
//     }
//
//     param.out_angleIncrement = angleIncrement;
//
//     for (let i = 0; i < maxRectangles; i++) {
//       let angle = i * angleIncrement - angleStart + param.initialAngleRad;// + Math.PI;
//       let x = param.radius * Math.cos(angle);
//       let y = param.radius * Math.sin(angle);
//
//       param.out_result.push({
//         x: x,
//         y: y,
//         zRotationRad: angle
//       });
//     }
//   }
//
//
// }

interface iRectPosition {
  x: number;
  y: number;
  zRotationRad: number;
}

interface iPositionRectangle {
  radius: number;
  rectWidth: number; // = Achse zum Mittelpunkt
  rectHeight: number;
  safetyMargin: number;
  circumferenceFactor: number; // 0.0 < n <= 1.0
  maxRectangles: number; // 0.0 < n < 1.0  oder  Ganzzahl
  forceFullCircle?: boolean; // erzwingt die verteilung auf den gesamten Kreis

  initialAngleRad: number;
  out_result: iRectPosition[];
  out_maxRectangles: number;
  out_angleIncrement: number;
}

