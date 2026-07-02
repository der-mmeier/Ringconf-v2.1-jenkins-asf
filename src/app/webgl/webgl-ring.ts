import {
  Color3,
  CreatePlane,
  DynamicTexture, ICanvasRenderingContext, Material,
  Mesh,
  PBRMaterial, Quaternion,
  TransformNode, VertexBuffer, VertexData
} from "@babylonjs/core";
import {
  iDivPreset,
  iGapMode,
  iMaterial,
  iMinMaxCur, iPresetStone, iProfile,
  iStoneCalc, iStonePositionSegment, iStoneSize, iStoneType, iSurface,
} from "../app.interfaces";
import {cProfile} from "./cProfile";
import {CVertex, iMeshData, TEMP} from "./threeD";
import {WebglComponent} from "./webgl.component";
import {AppComponent, calcPrice} from "../app.component";
import {RingData} from "../app.ringdata";
import {Matrix, Vector3} from "@babylonjs/core/Maths/math.vector";
import {Preload} from "../app.preload";
import {Log} from "../logger/logger.component";
import {getMilliseconds} from "../app.helper";

export enum eRingFlags {
  None,
  IsValid = 1 << 1,
  IsComputing = 1 << 2,
  InvalidateMaterialOnly = 1 << 3,
  // UpdateVisibilityState = 1 << 4,
  // IgnoreNextHistoryPush = 1 << 5
}

// enum eInvalidateMode
// {
//   ALL,
//   MATERIAL,
// }

interface iRingMaterial {
  surfaceId: number;
  material: PBRMaterial;
  uScale: number;
  vScale: number;
}

export let DEBUG_UV_MAP_ENABLED = false;

// export function DEBUG_Set_UV_Map_State(state: boolean) {
//   DEBUG_UV_MAP_ENABLED = state;
// }

export let DEBUG_STONES_ENABLED = true;

// export function DEBUG_Set_Stones_Enabled_State(state: boolean) {
//   DEBUG_STONES_ENABLED = state;
// }

let USE_BEVEL_ALPHA = true;

// export class WebglRing {
//   static list: WebglRing[] = [];
//   flags: eRingFlags;
//   ringData: RingData;
//   curStoneGroup: number = 0;
//   calc = {
//     wa_mm: 0,
//     waMax: 100,
//     amp100: 0,
//     swMax: [0, 0],
//     rhMax: 0,
//     gwMax: 0,
//     divMinMax: [] as iMinMaxCur[],
//     gapDivMinMax: [] as iMinMaxCur[],
//     stoneMinMaxCurSize: [] as iStonePositionSegment[],
//     stone: [{
//       minSizeOnGap: 0,
//       maxSize: 9999,
//       maxCount: 99,
//       maxRow: 99,
//     }] as iStoneCalc[],
//
//     gapSafeLeft: 0, // vom Rand zur Fugenmitte
//     gapSafeRight: 0,
//     stoneSafeLeft: 0, // vom Ringrand zum Steinrand
//     stoneSafeRight: 0,
//     profileSideLength: [0, 0],
//
//     area: 0,
//     mm3: 0
//   };
//   history: string[] = [] as string[];
//   GL: {
//     // @ts-ignore
//     profileResponse: iProfileResponse | null;
//     profile: cProfile | null;
//
//     /*
//     Texturzuordnung:
//     mesh-type       albedo-texture          alpha-texture
//     f               albedo: linke Seite     alpha: linke Seite
//     b               albedo: rechte Seite    alpha: rechte Seite
//     gap             albedo: linke Seite     alphaBevel: linke Seite
//     bevel*          albedo: linke Seite     ---
//      */
//     doubledTextures: {
//       albedo: DynamicTexture,
//       alpha: DynamicTexture,
//       alphaBevel: DynamicTexture | null,
//       roughnessEngraving: DynamicTexture,
//     },
//
//     generateTextureDownloads: boolean,
//
//     material: iRingMaterial[];
//
//     pivot: TransformNode;
//     position: CVertex;
//
//     cameraData: {
//       radius: number;
//       target: CVertex;
//       position: CVertex;
//       distance_x: number;
//     };
//
//     meshData: iMeshData[];
//     mesh: Mesh[];
//   }
//
//   context: {
//     albedo: ICanvasRenderingContext,
//     alpha: ICanvasRenderingContext,
//     alphaBevel: ICanvasRenderingContext | null,
//     roughnessEngraving: ICanvasRenderingContext
//   }
//
//   constructor(ringData: RingData) {
//     WebglRing.list.push(this);
//
//     this.flags = eRingFlags.IsValid;
//     this.ringData = ringData;
//
//     let that = this;
//     let webgl = WebglComponent.WEBGL;
//
//     this.GL = {
//       profileResponse: null,
//       profile: null,
//
//       doubledTextures: {
//         albedo: new DynamicTexture("doubled_albedo_front", {
//           width: webgl.maxTextureSize_doubled,
//           height: webgl.maxTextureSize_doubled
//         }, webgl?.scene),
//         alpha: new DynamicTexture("doubled_alpha_front", {
//           width: webgl.maxAlphaTextureSize_doubled,
//           height: webgl.maxAlphaTextureSize_doubled
//         }, webgl?.scene),
//         alphaBevel: null,
//         roughnessEngraving: new DynamicTexture("doubled_roughnessEngraving", {
//           width: webgl.maxTextureSize_doubled,
//           height: webgl.maxTextureSize_doubled
//         }, webgl?.scene),
//       },
//
//       generateTextureDownloads: AppComponent.app.state.debug,
//
//       material: [] as iRingMaterial[],
//
//       pivot: new TransformNode("", webgl?.scene),
//       position: new CVertex(),
//       cameraData: {
//         radius: 0,
//         target: new CVertex(),
//         position: new CVertex(),
//         distance_x: 0,
//       },
//
//       meshData: [],
//       mesh: []
//     };
//
//     if (USE_BEVEL_ALPHA) {
//       this.GL.doubledTextures.alphaBevel = new DynamicTexture("doubled_alpha_bevel", {
//         width: webgl.maxAlphaTextureSize_doubled,
//         height: webgl.maxAlphaTextureSize_doubled
//       }, webgl?.scene);
//       this.GL.doubledTextures.alphaBevel.getAlphaFromRGB = true;
//     }
//
//     this.context = {
//       albedo: this.GL.doubledTextures.albedo.getContext(),
//       alpha: this.GL.doubledTextures.alpha.getContext(),
//       // @ts-ignore
//       alphaBevel: USE_BEVEL_ALPHA ? this.GL.doubledTextures.alphaBevel.getContext():null,
//       roughnessEngraving: this.GL.doubledTextures.roughnessEngraving.getContext(),
//     };
//
//
//     this.GL.doubledTextures.albedo.gammaSpace = false;
//     this.GL.doubledTextures.alpha.getAlphaFromRGB = true;
//
//     // init Materials
//     AppComponent.app.data.surface.forEach(function (e) {
//       //@ts-ignore
//       let mat = new PBRMaterial(e.name, webgl.scene);
//       // mat.albedoColor = new Color3(1, 1, 1);
//       mat.metallic = e.material.metallic;
//       mat.roughness = e.material.roughness;
//       mat.metallicF0Factor = 0.0;
//       mat.backFaceCulling = true;
//       // mat.backFaceCulling = false;
//
//       if (e.material.file !== undefined) {
//         let T = Preload.surface.find(function (e1) {
//           return e1.id == e.id;
//         });
//
//         if (T) {
//           mat.bumpTexture = T.texture;
//           if (e.material.invertX !== undefined)
//             mat.invertNormalMapX = e.material.invertX;
//           if (e.material.invertY !== undefined)
//             mat.invertNormalMapY = e.material.invertY;
//         } else
//           console.log("no texture: " + e.material.file);
//       }
//
//       //@ts-ignore
//       mat.reflectionTexture = webgl.envTexture;
//
//       mat.albedoTexture = that.GL.doubledTextures.albedo;
//
//       that.GL.material.push({
//         surfaceId: e.id,
//         material: mat,
//         uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
//         vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
//       });
//
//       if (e.id == 0) // poliert...für Innenring und bevels
//       {
//         let M = mat.clone(e.name + '_back');
//         M.useRoughnessFromMetallicTextureAlpha = false;
//         M.useRoughnessFromMetallicTextureGreen = true;
//         M.useMetallnessFromMetallicTextureBlue = true;
//         M.metallicTexture = that.GL.doubledTextures.roughnessEngraving;
//         that.GL.material.push({
//           surfaceId: -1,
//           material: M,
//           uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
//           vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
//         });
//
//         M = mat.clone(e.name + '_bevel');
//         M.albedoTexture = that.GL.doubledTextures.albedo;
//         if (USE_BEVEL_ALPHA)
//           M.opacityTexture = that.GL.doubledTextures.alphaBevel;
//         M.backFaceCulling = true;
//         that.GL.material.push({
//           surfaceId: -2,
//           material: M,
//           uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
//           vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
//         });
//
//         M = mat.clone(e.name + '_cut');
//         M.albedoTexture = that.GL.doubledTextures.albedo;
//         // if (USE_BEVEL_ALPHA)
//         //     M.opacityTexture = that.GL.doubledTextures.alphaBevel;
//         M.backFaceCulling = true;
//         that.GL.material.push({
//           surfaceId: -3,
//           material: M,
//           uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
//           vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
//         });
//       }
//     })
//
//     setInterval(function () {
//       if (that.ringData.isDirty) {
//         that.flags &= ~eRingFlags.IsValid;
//       }
//
//       if (that.ringData.cartActive && (that.flags & eRingFlags.IsValid) !== eRingFlags.IsValid) {
//         if (that.flags & eRingFlags.InvalidateMaterialOnly) {
//           if (that.update("material"))
//             that.flags &= ~eRingFlags.InvalidateMaterialOnly;
//         } else {
//           WebglComponent.busyCounter++;
//           if (that.compute() && that.update("all")) {
//             that.flags |= eRingFlags.IsValid;
//             that.ringData.isDirty = false;
//
//             if (that.GL.profile) {
//               that.calc.area = that.GL.profile.area;
//               that.calc.mm3 = that.calc.area * that.ringData.ringHeight / 1000;
//             }
//           }
//         }
//       }
//
//       if (!that.ringData.cartActive && that.GL.mesh.length) {
//         WebglComponent.busyCounter++;
//         that.disposeMeshes();
//         let webgl = WebglComponent.WEBGL;
//         if (webgl)
//           webgl.renderFrame(AppComponent.app.data.webglSettings.forceFrames);
//         WebglComponent.busyCounter++;
//       }
//
//     }, 100);
//   }
//
//   isDivMode_h_s(): boolean {
//     let divMode = this.ringData.divPreset.slice(0, 1).toLowerCase();
//     return (divMode === "s" || divMode === "h");
//   }
//
//   private compute(): boolean {
//     this.flags |= eRingFlags.IsComputing;
//
//     let that = this,
//       ringData: RingData = this.ringData,
//       mDiv = ringData.materialDiv.slice(),
//       profile = AppComponent.app.data.profile.find(function (e: iProfile) {
//         return e.name == that.ringData.profileName;
//       });
//
//     let getLowerGW = function (): number | null {
//       let gm = AppComponent.app.data.gapMode.find(function (e: iGapMode) {
//         return e.id == ringData.gapMode;
//       })
//
//       if (gm) {
//         let i, i_l = gm.width.length - 1;
//         for (i = i_l; i >= 0; i--) {
//           if (gm.width[i] < ringData.gapWidth) {
//             return gm.width[i];
//           }
//         }
//       }
//
//       return null;
//     }
//     let getSurface = function (index: number): iSurface | undefined {
//       return AppComponent.app.data.surface.find(function (e) {
//         return e.id == index;
//       })
//     }
//     let getMaterial = function (index: number): iMaterial | undefined {
//       return AppComponent.app.data.material.find(function (e) {
//         return e.id == index;
//       })
//     }
//     let getWave = function (): boolean {
//       let char = that.ringData.divPreset.substring(0, 1).toLowerCase();
//       return char == "w" || char == "d";
//     }
//     let removeWave = function () {
//       let ar = ringData.divPreset.split(':');
//       ar[0] = ar[0].toLowerCase();
//       if (ar[0] == "w" || ar[0] == "d")
//         ar[0] = "-";
//       else if (ar[0] == "wf" || ar[0] == "df")
//         ar[0] = "f";
//
//       that.ringData.divPreset = ar.join(':');
//     };
//     let checkConditions = function (): boolean {
//       if (!profile) {
//         Log("error", "No profile");
//         return false;
//       }
//
//       // auf Welle prüfen
//       RingData.checkWave(that.ringData);
//       let hasWave = getWave();
//
//       if (hasWave && (profile.wa.max < 1 || profile.wc.max < 1)) {
//         removeWave();
//         hasWave = false;
//         Log("info", "Eine Welle oder Schräge ist bei diesem Profil nicht möglich.");
//       }
//
//       if (hasWave) {
//         let changed = false;
//         if (ringData.waveCount < profile.wc.min) {
//           ringData.waveCount = profile.wc.min;
//           changed = true;
//         } else if (ringData.waveCount > profile.wc.max) {
//           ringData.waveCount = profile.wc.max;
//           changed = true;
//         }
//
//         if (ringData.materialDiv.length > 2 && ringData.waveCount > profile.maxWaveCountMultipleWaves) {
//           ringData.waveCount = profile.maxWaveCountMultipleWaves;
//           changed = true;
//         }
//
//         if (changed)
//           Log("info", "Die Wellenanzahl wurde angepasst");
//
//         changed = false;
//         if (ringData.waveAmp < profile.wa.min) {
//           ringData.waveAmp = profile.wa.min;
//           changed = true;
//         } else if (ringData.waveAmp > profile.wa.max) {
//           ringData.waveAmp = profile.wa.max;
//           changed = true;
//         }
//
//         if (ringData.materialDiv.length > 2 && ringData.waveAmp > profile.maxWaveAmpMultipleWaves) {
//           ringData.waveAmp = profile.maxWaveAmpMultipleWaves;
//           changed = true;
//         }
//
//         if (changed)
//           Log("info", "Die Wellen- / Schrägenhöhe wurde angepasst");
//       }
//
//       let gapGapDistance = hasWave ? profile.gapGapDistanceWave : profile.gapGapDistance;
//
//       // Maße
//       if (ringData.ringWidth < profile.sideGapDistance * 2) {
//         ringData.ringWidth = profile.sideGapDistance * 2;
//         Log("info", "Die Ringbreite wurde angepasst.");
//       }
//
//       if (profile.syncRwRh) {
//         if (ringData.ringWidth != ringData.ringHeight) {
//           ringData.ringHeight = ringData.ringWidth;
//           Log("info", "Die Ringhöhe wurde an die Ringbreite angepasst.");
//         }
//       } else if (ringData.ringHeight > ringData.ringWidth * profile.rhMaxFactor) {
//         ringData.ringHeight = ringData.ringWidth * profile.rhMaxFactor;
//         Log("info", "Die Ringhöhe wurde im Verhältniss zur Ringbreite angepasst.");
//       }
//
//       that.calc.rhMax = ringData.ringWidth * profile.rhMaxFactor;
//
//       // -> divPreset filtern
//       if (1) {
//         let divPreset: iDivPreset | undefined;
//         AppComponent.app.data.divPreset.forEach(e => {
//           if (e.items) {
//             e.items.forEach(e2 => {
//               if (e2.divPreset == that.ringData.divPreset)
//                 divPreset = e2;
//             });
//           } else {
//             if (e.divPreset == that.ringData.divPreset)
//               divPreset = e;
//           }
//         });
//
//         if (divPreset) {
//           if (divPreset.notProfile && divPreset.notProfile.indexOf(that.ringData.profileName) != -1) {
//             that.ringData.divPreset = <string>AppComponent.app.data.divPreset[0].divPreset;
//             Log("info", "Materialteilung für dieses Profil nicht zulässig");
//           }
//           if (divPreset.rwMin && divPreset.rwMin > that.ringData.ringWidth) {
//             that.ringData.ringWidth = divPreset.rwMin;
//             Log("info", "Die gewählte Materialteilung erfordert eine Mindestringbreite.");
//           }
//           if (divPreset.rhMin && divPreset.rhMin > that.ringData.ringHeight) {
//             that.ringData.ringHeight = divPreset.rhMin;
//             Log("info", "Die gewählte Materialteilung erfordert eine Mindestringhöhe.");
//           }
//         }
//       }
//       // <- divPreset filtern
//
//       // Material
//       // Mindestgröße entsprechend der Teilungen prüfen
//       let gwBefore = ringData.gapWidth, divCount = mDiv.length;
//       let ok = true;
//       while (ok) {
//         let width = profile.sideGapDistance * 2 + ringData.gapWidth;
//
//         if (mDiv.length > 2)
//           width += (mDiv.length - 2) * (gapGapDistance * 2 + ringData.gapWidth);
//
//         if (width > ringData.ringWidth) {
//           let gw = getLowerGW();
//           if (gw !== null) {
//             ringData.gapWidth = gw;
//             continue;
//           } else if (mDiv.length > 1) {
//             mDiv.pop();
//             continue;
//           } else {
//             Log("error", "Anpassung nicht möglich. Keine passende Fugenbreite.");
//             ringData.divPreset = <string>AppComponent.app.data.divPreset[0].divPreset;
//             mDiv = ringData.materialDiv.slice();
//             ok = false;
//             break;
//           }
//         }
//
//         break;
//       }
//       // if (!ok) {
//       //   return checkConditions();
//
//       // Fugenart prüfen: Bei mehr als 1 Welle soll keine V-Fuge möglich sein
//       if (ringData.waveCount > 1) {
//         if (ringData.gapMode == 2) // V-Fuge
//         {
//           ringData.gapMode = 3; // U-Fuge
//           Log("info", "Die Fugenart wurde angepasst.");
//         }
//       }
//
//       if (gwBefore != ringData.gapWidth)
//         Log("info", "Die Fugenbreite wurde angepasst.");
//       if (divCount > mDiv.length)
//         Log("info", "Die Materialteilung wurde angepasst.");
//
//       // Teilungssumme ermitteln
//       let sum = 0;
//       mDiv.forEach(function (e: number) {
//         sum += e;
//       });
//
//       // Teilungssumme korrigieren -> Diese muss 10000 betragen
//       mDiv.forEach(function (e: number, i: number) {
//         mDiv[i] = Math.round((10000 * e) / sum);
//       })
//
//       // Teilung in mm*1000 umrechnen
//       mDiv.forEach(function (_e: number, i: number) {
//         mDiv[i] = Math.round(mDiv[i] * ringData.ringWidth / 10000);
//       })
//
//       // Teilung auf Mindestabstände prüfen
//       if (mDiv.length > 2) {
//         let min = ringData.gapWidth + gapGapDistance;
//         let minSide = ringData.gapWidth / 2 + profile.sideGapDistance;
//
//         if (mDiv[0] < minSide) {
//           let diff = minSide - mDiv[0];
//           mDiv[0] = minSide;
//           mDiv[1] -= diff;
//         }
//         if (mDiv[mDiv.length - 1] < minSide) {
//           let diff = minSide - mDiv[mDiv.length - 1];
//           mDiv[mDiv.length - 1] = minSide;
//           mDiv[mDiv.length - 2] -= diff;
//         }
//
//         let i, il = mDiv.length - 1;
//         for (i = 1; i < il; i++) {
//           if (mDiv[i] < min) {
//             Log("info", "Teilungsanpassung: min " + min);
//
//             console.log("before: " + mDiv[i - 1] + " " + mDiv[i] + " " + mDiv[i + 1]);
//             let left = mDiv[i - 1];
//             if (i == 1) left -= that.calc.gapSafeLeft;
//             let right = mDiv[i + 1];
//             if (i == mDiv.length - 2) right -= that.calc.gapSafeRight;
//
//             console.log("left: " + left + ", right: " + right);
//
//             let sum = left + right;
//             let factorLeft = left / sum;
//             let factorRight = right / sum;
//
//
//             let diff = min - mDiv[i];
//             let diffLeft = Math.round(diff * factorLeft);
//             let diffRight = Math.round(diff * factorRight);
//             console.log(diffLeft, diffRight);
//             mDiv[i - 1] -= diffLeft;
//             mDiv[i + 1] -= diffRight;
//             mDiv[i] += diffLeft + diffRight;
//             console.log("after: " + mDiv[i - 1] + " " + mDiv[i] + " " + mDiv[i + 1]);
//
//           }
//         }
//       }
//
//       // Oberfläche
//       divCount = mDiv.length;
//       let lastSurface: iSurface | undefined = undefined;
//       let surfaceAr = ringData.surface;
//       mDiv.forEach(function (e: number, i: number) {
//         let surface: iSurface | undefined = getSurface(surfaceAr[i]);
//         if (surface) {
//           if (surface.minSegmentWidth && surface.minSegmentWidth > e) {
//             RingData.setSurface(ringData, i, 0);
//             // ringData.surface[i] = 0;
//             Log("info", "Materialbreite zu klein. Die Oberfläche '" + (i + 1) + "' wurde angepasst.");
//           }
//           if (surface.maxDivision && surface.maxDivision < divCount) {
//             RingData.setSurface(ringData, i, 0);
//             // ringData._surface[i] = 0;
//             Log("info", "Materialanzahl zu groß. Die Oberfläche '" + (i + 1) + "' wurde angepasst.");
//           }
//         }
//
//         // Feingehalt prüfen unf ggf ersetzen (ohne Meldung)
//         let material = getMaterial(ringData.material[i]);
//         if (material) {
//           let finenessAr = ringData.fineness;
//           let f = material.fineness.find(function (e) {
//             return e == finenessAr[i];
//           })
//           if (!f) {
//             RingData.setFineness(ringData, i, material.fineness[0]);
//             // ringData.fineness[i] = material.fineness[0];
//           }
//         }
//
//         // auf Inaktive Fugen prüfen
//         if (i > 0 && lastSurface && surface) {
//           if (!ringData.gapEnabled[i - 1]) {
//             if (lastSurface.forceGap === true || surface.forceGap === true) {
//               ringData.gapEnabled[i - 1] = 1;
//               Log("info", "Trennfuge " + i + "' wurde aktiviert.");
//             }
//           }
//         }
//
//         lastSurface = surface;
//       })
//
//       // Feingehalt bei horizontaler und Segment-Teilung prüfen unf ggf ersetzen (ohne Meldung)
//       let divMode = that.ringData.divPreset.substring(0, 1).toLowerCase();
//       if (divMode == "h" || divMode == "s") {
//         let material = getMaterial(ringData.material[1]);
//         if (material) {
//           let finenessAr = ringData.fineness;
//           let f = material.fineness.find(function (e) {
//             return e == finenessAr[1];
//           })
//           if (!f) {
//             RingData.setFineness(ringData, 1, material.fineness[0]);
//             // ringData.fineness[1] = material.fineness[0];
//           }
//         }
//       }
//
//       // Stufen
//       if (!profile.sw) {
//         if (ringData.stepMode > 0) {
//           ringData.stepMode = 0;
//           Log("info", "Bei dem gewählten Profil sind keine Stufen möglich");
//         }
//       }
//
//       let sw_0 = (ringData.stepMode == 1 || ringData.stepMode == 3) ? ringData.stepWidth[0] : 0;
//       let sw_1 = (ringData.stepMode == 2 || ringData.stepMode == 3) ? ringData.stepWidth[1] : 0;
//
//       if (profile.sw) {
//         let i;
//         let remain = mDiv[0] - ringData.gapWidth / 2 - (sw_0 > 0 ? profile.gapGapDistance : profile.sideGapDistance);
//         for (i = profile.sw.max; i > remain;) i -= profile.sw.step;
//
//         if (ringData.stepMode == 1 || ringData.stepMode == 3) {
//           if (i < profile.sw.min) {
//             ringData.stepMode = ringData.stepMode == 1 ? 0 : 2;
//             sw_0 = 0;
//             Log("info", "Die linke Stufe wurde entfernt");
//           } else {
//             if (ringData.stepWidth[0] > i) {
//               ringData.stepWidth[0] = i;
//               Log("info", "Die linke Stufenbreite wurde angepasst");
//             } else if (ringData.stepWidth[0] == 0)
//               ringData.stepWidth[0] = i;
//
//             sw_0 = ringData.stepWidth[0];
//           }
//         } else
//           sw_0 = 0;
//
//         that.calc.swMax[0] = i;
//
//         remain = mDiv[mDiv.length - 1] - ringData.gapWidth / 2 - (sw_1 > 0 ? profile.gapGapDistance : profile.sideGapDistance);
//         for (i = profile.sw.max; i > remain;) i -= profile.sw.step;
//
//         if (ringData.stepMode == 2 || ringData.stepMode == 3) {
//           if (i < profile.sw.min) {
//             ringData.stepMode = ringData.stepMode == 2 ? 0 : 1;
//             sw_1 = 0;
//             Log("info", "Die rechte Stufe wurde entfernt");
//           } else {
//             if (ringData.stepWidth[1] > i) {
//               ringData.stepWidth[1] = i;
//               Log("info", "Die rechte Stufenbreite wurde angepasst");
//             } else if (ringData.stepWidth[1] == 0)
//               ringData.stepWidth[1] = i;
//
//             sw_1 = ringData.stepWidth[1];
//           }
//         } else
//           sw_1 = 0;
//
//         that.calc.swMax[1] = i;
//
//         if (sw_0 == 0 && sw_1 == 0 && ringData.stepMode != 0) {
//           ringData.stepMode = 0;
//           Log("info", "Die Stufen wurden entfernt");
//         }
//
//       }
//
//       let calcSafe = function (profile: iProfile) {
//         that.calc.stoneSafeLeft = sw_0 ? sw_0 + profile.gapGapDistance : profile.sideGapDistance;
//         that.calc.stoneSafeRight = sw_1 ? sw_1 + profile.gapGapDistance : profile.sideGapDistance;
//         that.calc.gapSafeLeft = that.calc.stoneSafeLeft /*+ profile.gapGapDistance*/ + ringData.gapWidth / 2;
//         that.calc.gapSafeRight = that.calc.stoneSafeRight /*+ profile.gapGapDistance*/ + ringData.gapWidth / 2;
//         that.calc.amp100 = (ringData.ringWidth / 2) - (that.calc.gapSafeLeft > that.calc.gapSafeRight ? that.calc.gapSafeLeft : that.calc.gapSafeRight);
//
//         let waMaxLeft = (mDiv[0] - that.calc.gapSafeLeft) * 100 / that.calc.amp100;
//         let waMaxRight = (mDiv[mDiv.length - 1] - that.calc.gapSafeRight) * 100 / that.calc.amp100;
//
//         if (profile && hasWave) {
//           if (ringData.waveAmp < profile.wa.min) ringData.waveAmp = profile.wa.min;
//           if (profile.wa.max > 60) alert("Die maximale Amplitude des Profiles überschreitet 60% !");
//           let max = Math.min(waMaxLeft, waMaxRight);
//           let i;
//           for (i = profile.wa.max; i > max;) i -= profile.wa.step;
//           if (ringData.waveAmp > i) {
//             ringData.waveAmp = i;
//             // Log("info", "Die Wellen- / Schrägenhöhe wurde angepasst");
//           }
//           that.calc.waMax = i;
//           that.calc.wa_mm = ringData.waveAmp * that.calc.amp100 / 100;
//
//           let left = (mDiv[0] - that.calc.stoneSafeLeft - that.calc.wa_mm);
//           let right = (mDiv[mDiv.length - 1] - that.calc.stoneSafeRight - that.calc.wa_mm);
//           that.calc.gwMax = Math.min(left, right);
//         } else {
//           that.calc.gwMax = 10000;
//           that.calc.wa_mm = 0;
//         }
//       };
//
//       calcSafe(profile);
//
//       // Anheften der äußeren Fugen an den Ringrand
//       // TODO: Hier wird eine -:1:4 Teilung auch an den Rand verschoben
//       if (0 && !hasWave) {
//         let gapSnap_percent = 20;
//         let gapSnap_mm = gapSnap_percent * that.ringData.ringWidth / 100;
//
//         // links
//         if (mDiv[0] <= gapSnap_mm/* && ringData.stepMode != 1 && ringData.stepMode != 3*/) {
//           let diff = that.calc.gapSafeLeft - mDiv[0];
//           mDiv[0] += diff;
//           mDiv[1] -= diff;
//         }
//
//         // rechts
//         if (mDiv[mDiv.length - 1] <= gapSnap_mm/* && ringData.stepMode != 2 && ringData.stepMode != 3*/) {
//           let diff = that.calc.gapSafeRight - mDiv[mDiv.length - 1];
//           mDiv[mDiv.length - 1] += diff;
//           mDiv[mDiv.length - 2] -= diff;
//         }
//
//         let remain = mDiv[0] - ringData.gapWidth / 2 - (sw_0 > 0 ? profile.gapGapDistance : profile.sideGapDistance);
//         let i;
//
//         if (profile.sw) {
//           // @ts-ignore
//           for (i = profile.sw.max; i > remain;) i -= profile.sw.step;
//         } else i = 0;
//         that.calc.swMax[0] = i;
//
//         remain = mDiv[mDiv.length - 1] - ringData.gapWidth / 2 - (sw_1 > 0 ? profile.gapGapDistance : profile.sideGapDistance);
//         if (profile.sw) {
//           // @ts-ignore
//           for (i = profile.sw.max; i > remain;) i -= profile.sw.step;
//         } else i = 0;
//         that.calc.swMax[1] = i;
//       }
//
//       let mDivMinMax = [] as iMinMaxCur[],
//         handlePosition = [] as number[],
//         pos = 0, i, i_l = mDiv.length - 1, t;
//
//       for (i = 0; i < i_l; i++) {
//         t = pos + mDiv[i];
//         handlePosition.push(t);
//         pos = t;
//       }
//
//       let lastIndex = handlePosition.length - 1,
//         min,
//         max;
//
//       handlePosition.forEach(function (e, index) {
//         if (index == 0) {
//           min = that.calc.gapSafeLeft + that.calc.wa_mm;
//           // min = that.calc.gapSafeLeft;
//           if (index == lastIndex) {
//             max = ringData.ringWidth - that.calc.gapSafeRight;
//           } else {
//             // @ts-ignore
//             max = handlePosition[1] - gapGapDistance;
//             if (ringData.gapEnabled[1]) max -= ringData.gapWidth;
//           }
//         } else if (index == lastIndex) {
//           max = ringData.ringWidth - that.calc.gapSafeRight - that.calc.wa_mm;
//           // max = ringData.ringWidth - that.calc.gapSafeRight;
//           // @ts-ignore
//           min = handlePosition[lastIndex - 1] + gapGapDistance;
//           if (ringData.gapEnabled[lastIndex - 1]) min += ringData.gapWidth;
//         } else {
//           // @ts-ignore
//           min = handlePosition[index - 1] + gapGapDistance;
//           if (ringData.gapEnabled[index - 1]) min += ringData.gapWidth;
//
//           // @ts-ignore
//           max = handlePosition[index + 1] - gapGapDistance;
//           if (ringData.gapEnabled[index + 1]) max -= ringData.gapWidth;
//         }
//
//         mDivMinMax.push({min, max, cur: e});
//       });
//
//       that.calc.divMinMax = mDivMinMax;
//
//       // Neue Teilungswerte ermitteln: mm -> %
//       mDiv.forEach(function (e: number, i: number) {
//         mDiv[i] = Math.round(e * 10000 / ringData.ringWidth);
//       })
//
//       // Steine
//       let resetStoneGroup = function (stoneGroup: iPresetStone) {
//         stoneGroup.mode = 0;
//         stoneGroup.type = 1;
//         stoneGroup.distribution = 0;
//         stoneGroup.size = 1000;
//         stoneGroup.rows = 1;
//         stoneGroup.count = 1;
//       }
//       let getLowerStoneSize = function (stoneType: iStoneType, size: number): iStoneSize | undefined {
//         let result = undefined;
//         stoneType.size.forEach(function (e) {
//           if (e.calcSize && e.calcSize <= size)
//             result = e;
//           else if (e.size <= size)
//             result = e;
//         })
//
//         return result;
//       }
//       let getHigherOrEqualStoneSize = function (stoneType: iStoneType, size: number): iStoneSize | undefined {
//         let result = [] as iStoneSize[];
//         stoneType.size.forEach(function (e) {
//           if (e.calcSize && e.calcSize >= size && e.minRingHeight <= ringData.ringHeight)
//             result.push(e);
//           else if (e.size >= size && e.minRingHeight <= ringData.ringHeight)
//             result.push(e);
//         })
//
//         return result[0];
//       }
//
//       let useSegments = false;
//
//       let calc_possible_stone_positions = function () {
//         let gaps = [] as number[], sum = 0;
//
//         let test = [31, 35, 36];
//         if (!that.isDivMode_h_s() || test.includes(ringData.stone[that.curStoneGroup].mode)) // nicht bei segmentierten, horizontal geteilten Ring, Kanal quer und Spannring
//         {
//           // materialfugen in mm umrechnen
//           ringData.materialDiv.forEach(function (e) {
//             sum += e;
//             gaps.push(sum * ringData.ringWidth / 10000);
//           })
//         } else
//           gaps.push(ringData.ringWidth);
//
//         if (ringData.gapDiv.length) {
//           // freie Fugen in mm unrechnen
//           sum = 0;
//           ringData.gapDiv.forEach(e => {
//             sum += e;
//             gaps.push(sum * ringData.ringWidth / 10000);
//           })
//
//           // letztes Teilsegment entfernen, da dies bis zum rechten Ringrand reicht
//           gaps.pop();
//         }
//
//         // positionen sortieren
//         gaps.sort(function (a, b): number {
//           return a - b;
//         })
//
//         // MinMax-Werte berechnen unter Berücksichtigung der Sicherheitsabstände zum Ringrand,
//         // der Fugenbreiten, der Sicherheitsabstände der Fugen und eventuell vorhandener Wellenamplitude
//         let minMax = [] as iStonePositionSegment[];
//         let last = 0;
//         gaps.forEach(e => {
//           minMax.push({
//             min: last,
//             max: e,
//             middle: 0,
//             size: 0,
//             onGap: false
//           })
//           last = e;
//         })
//
//
//         let profile = AppComponent.app.data.profile.find(e => {
//           return e.name == ringData.profileName;
//         })
//
//         let stepLeft = 0, stepRight = 0;
//
//         if (minMax.length && profile) {
//           let stepMode = that.ringData.stepMode;
//
//           if (stepMode == 1 || stepMode == 3)
//             stepLeft = that.ringData.stepWidth[0];
//           if (stepMode == 2 || stepMode == 3)
//             stepRight = that.ringData.stepWidth[1];
//
//
//           minMax[0].min += (stepLeft > 0 ? (stepLeft + profile.gapGapDistance) : profile.sideGapDistance);
//           minMax[minMax.length - 1].max -= (stepRight > 0 ? (stepRight + profile.gapGapDistance) : profile.sideGapDistance);
//           // minMax[0].min += (stepLeft > 0 ? (stepLeft + profile.gapGapDistance) : profile.sideGapDistance) + that.calc.wa_mm;
//           // minMax[minMax.length - 1].max -= (stepRight > 0 ? (stepRight + profile.gapGapDistance) : profile.sideGapDistance) + that.calc.wa_mm;
//           // minMax[0].min += (stepLeft + profile.sideGapDistance + that.calc.wa_mm);
//           // minMax[minMax.length - 1].max -= (stepRight + profile.sideGapDistance + that.calc.wa_mm);
//
//           let gapHalfAndSafe = ringData.gapWidth / 2 + profile.gapGapDistance;
//
//           if (minMax.length > 1) {
//             minMax[0].max -= gapHalfAndSafe;
//             minMax[minMax.length - 1].min += gapHalfAndSafe;
//           }
//
//           for (i = 1; i < minMax.length - 1; i++) {
//             minMax[i].min += gapHalfAndSafe;
//             minMax[i].max -= gapHalfAndSafe;
//           }
//         }
//
//         // Mittelwert von min/max berechnen
//         minMax.forEach(e => {
//           e.min = Math.trunc(e.min);
//           e.max = Math.trunc(e.max);
//           e.middle = Math.trunc(e.min + (e.max - e.min) / 2);
//           e.size = e.max - e.min; // Größe des möglichen Steinbesatzes
//         })
//
//         // minMax enthäht an dieser Stelle die Werte, um die Steine zwischen den Fugen zu platzieren
//         // min und max sind jeweils die die Außenkanten des Steines ohne Breücksichtigung der Steingröße
//
//         // ab hier erfolgt die Berechnung der Steinpositionierung Mittig auf den Fugen,
//         // wenn die Fugenbreite kleiner als 1.0mm ist
//         let minMax2 = [] as iStonePositionSegment[];
//
//
//         if (1) //ringData.gapWidth < 1000)
//         {
//           last = 0;
//           gaps.pop();
//           gaps.forEach(e => {
//             if (minMax2.length)
//               minMax2[minMax2.length - 1].max = e;
//
//             minMax2.push({
//               min: last,
//               max: 0,
//               middle: e,
//               size: 0,
//               onGap: true
//             })
//             last = e;
//           })
//
//           if (1 && minMax2.length && profile) {
//             // Durch das ignorieren der Wellenamplitude werden die Steine bis an der Ringrand ermöglicht. Sollte es zu
//             // einer überschreitung der Sicherheitsabstände am Ringrand kommen, wird die Steinanzahl reduziert.
//             minMax2[0].min = profile.sideGapDistance;// + that.calc.wa_mm;
//             minMax2[minMax2.length - 1].max = ringData.ringWidth - profile.sideGapDistance;//  - that.calc.wa_mm;
//
//             let gapHalfAndSafe = ringData.gapWidth / 2 + profile.gapGapDistance;
//             if (ringData.materialDiv.length > 1) {
//               minMax2[0].max -= gapHalfAndSafe;
//               minMax2[minMax2.length - 1].min += gapHalfAndSafe;
//             }
//
//             for (i = 1; i < minMax2.length - 1; i++) {
//               minMax2[i].min += gapHalfAndSafe;
//               minMax2[i].max -= gapHalfAndSafe;
//             }
//
//             minMax2.forEach(e => {
//               let a = e.middle - e.min,
//                 b = e.max - e.middle;
//               if (a < b)
//                 e.max = e.middle + a;
//               else
//                 e.min = e.middle - b;
//
//               e.middle = Math.trunc(e.middle);
//               e.min = Math.trunc(e.min);
//               e.max = Math.trunc(e.max);
//               e.size = e.max - e.min; // Größe des möglichen Steinbesatzes
//             })
//           }
//         }
//         // nach Einfügeposition aufsteigend sortieren
//         let minMaxResult = minMax.concat(minMax2);
//         minMaxResult.sort(function (a, b) {
//           return a.middle - b.middle;
//         })
//
//         // zu kleine Segmente entfernen, ermittle dazu den kleinst möglichen Stein
//         let smallestStoneSize = 10000;
//         AppComponent.app.data.stoneType.forEach(e => {
//           if (e.size[0].size < smallestStoneSize)
//             smallestStoneSize = e.size[0].size;
//         })
//
//         // Überschneidungen mit "Zwischenfugensegmenten" angleichen
//         for (i = 0, i_l = minMaxResult.length; i < i_l; i++) {
//           let e = minMaxResult[i];
//           if (e.onGap) {
//             if (i > 0) {
//               if (e.min < minMaxResult[i - 1].max)
//                 e.min = minMaxResult[i - 1].max;
//             }
//             if (i < i_l - 1) {
//               if (e.max > minMaxResult[i + 1].min)
//                 e.max = minMaxResult[i + 1].min;
//             }
//           }
//         }
//         // <=
//
//         // Zwischenspeichern, für den Fall, dass keine freien Zonen nach dem nächsten Schritt mehr vorhanden sind
//         let minMaxTemp: iStonePositionSegment[] = JSON.parse(JSON.stringify(minMaxResult));
//
//         for (i = 0; i < minMaxResult.length;) {
//           if (minMaxResult[i].size < smallestStoneSize) {
//             minMaxResult.splice(i, 1);
//             i = 0;
//             continue;
//           }
//           i++;
//         }
//
//         if (minMaxResult.length == 0) {
//           // Hier wird nach Zonen gesucht, die auf der Fuge liegen und die mögliche Größe so angepasst, dass ein Stein
//           // die angrenzenden Zwischenfugensegmente mit ausnutzt.
//           let i, i_l = minMaxTemp.length - 1;
//           for (i = 1; i < i_l; i++) {
//             if (minMaxTemp[i].onGap) {
//               minMaxTemp[i].size = minMaxTemp[i + 1].max - minMaxTemp[i - 1].min;
//               if (minMaxTemp[i].size >= smallestStoneSize) // nur einfügen, wenn auch ein Stein hineinpasst
//                 minMaxResult.push(minMaxTemp[i]);
//             }
//           }
//         }
//
//         if (!useSegments) // entferne alle Segmente außer den ersten und letzten
//         {
//           let T: iStonePositionSegment[] = [] as iStonePositionSegment[], last = minMaxResult[minMaxResult.length - 1];
//           T.push(minMaxResult[0]);
//
//           T[0].max = last.max;
//           T[0].onGap = false;
//           T[0].size = T[0].max - T[0].min;
//           T[0].middle = T[0].min + T[0].size / 2;
//           that.calc.stoneMinMaxCurSize = T;
//
//           return;
//         }
//
//         that.calc.stoneMinMaxCurSize = minMaxResult;
//       }
//
//       calc_possible_stone_positions();
//
//       interface iStonePositionandMaxSize {
//         position: number;
//         maxSize: number;
//         onGap: boolean;
//       }
//
//       let getStonePositionandMaxSize = function (positionDiv: number[], useOnGapStonePositions: boolean, stoneSize: number): iStonePositionandMaxSize {
//         let sum = positionDiv.reduce(function (a, b) {
//           return a + b;
//         })
//
//         let posMM = ringData.ringWidth * positionDiv[0] / sum;
//
//         let minMax = that.calc.stoneMinMaxCurSize;
//
//         let segments = [] as number[][];
//         minMax.forEach(function (e, index) {
//           if (e.onGap && !useOnGapStonePositions)
//             return;
//
//           segments.push([Math.abs(posMM - e.middle), index]);
//         })
//
//         segments.sort(function (a, b) {
//           return a[0] - b[0];
//         })
//
//         let halfSize = stoneSize / 2;
//         // berücksichtige eine Steingröße von mindestens 1.0mm
//         if (halfSize < 500) halfSize = 500;
//
//         if (segments.length) {
//           let segment = minMax[segments[0][1]];
//           // let segment = minMax.find(e => {
//           //   return e.min <= posMM && e.max >= posMM;
//           // })
//
//           if (!segment)
//             segment = minMax[0];
//
//           if (segment) {
//             if (segment.onGap)
//               posMM = segment.middle;
//             else {
//               // if (posMM < segment.min)
//               //   posMM = segment.min + halfSize;
//               // else if (posMM > segment.max)
//               //   posMM = segment.max - halfSize;
//               if (posMM < segment.min + halfSize)
//                 posMM = segment.min + halfSize;
//               else if (posMM > segment.max - halfSize)
//                 posMM = segment.max - halfSize;
//             }
//
//             let a = posMM - segment.min,
//               b = segment.max - posMM,
//               maxSize = a < b ? a * 2 : b * 2;
//
//             if (segment.size > maxSize)
//               maxSize = segment.size;
//
//             return {
//               position: posMM,
//               maxSize: maxSize,
//               onGap: segment.onGap,
//             }
//           }
//         }
//
//         return {
//           position: 0,
//           maxSize: 0,
//           onGap: false
//         }
//       }
//
//       ringData.stone.forEach(function (stoneGroup: iPresetStone, stoneGroupIndex: number) {
//         if (stoneGroup.mode > 0) {
//           let adaptLoop = true;
//           let useOnGapStonePositions = true;
//
//           let test = [31, 35, 36];
//           if (test.indexOf(stoneGroup.mode) !== -1) {
//
//             if (that.ringData.materialDiv.length > 1 ||
//               that.ringData.gapDiv.length > 1) {
//               let gapMode = AppComponent.app.data.gapMode.find(e => {
//                 return e.id == that.ringData.gapMode;
//               })
//               if (gapMode && that.ringData.gapWidth > gapMode.width[0]) {
//                 that.ringData.gapWidth = gapMode.width[0];
//                 Log("info", "Die Fugenbreite wurde angepasst");
//               }
//             }
//           }
//
//           while (adaptLoop) {
//             adaptLoop = false;
//
//             // Kombination Profil und Steinmodus zulässig?
//             if (profile && profile.stoneModes.indexOf(stoneGroup.mode) === -1) {
//               Log("info", "Die Kombination Profil/Steinbesatz ist nicht möglich (" + stoneGroupIndex + ").");
//               stoneGroup.mode = 0;
//               return;
//             }
//             let stoneMode = AppComponent.app.data.stoneMode.find(function (e) {
//               if (e.items) {
//                 return e.items.find(function (e) {
//                   return e.mode === stoneGroup.mode;
//                 })
//               }
//
//               return e.mode == stoneGroup.mode;
//             })
//
//             if (!stoneMode) {
//               Log("error", "Der gewählte Steinmodus wurde nicht gefunden (" + stoneGroup.mode + ")");
//               resetStoneGroup(stoneGroup);
//               return;
//             }
//
//             if (stoneMode.minRingWidth && stoneMode.minRingWidth > ringData.ringWidth) {
//               if (stoneMode.alternativeMode) {
//                 stoneGroup.mode = stoneMode.alternativeMode;
//                 adaptLoop = true;
//                 Log("info", "Der Steinmodus wurde aufgrund der Ringbreite angepasst.");
//                 continue;
//               }
//             }
//             if (stoneMode.maxWaveCount && stoneMode.maxWaveCount < ringData.waveCount) {
//               ringData.waveCount = stoneMode.maxWaveCount;
//               Log("info", "Die Wellenanzahl wurde angepasst");
//             }
//
//             if (stoneMode.distribution && stoneGroup.distribution !== stoneMode.distribution) {
//               stoneGroup.distribution = stoneMode.distribution;
//               Log("info", "Die Steinverteilung wurde angepasst");
//             }
//
//             if (stoneGroup.distribution >= 33 && stoneGroup.count < 0) {
//               stoneGroup.count = 1;
//               Log("info", "Die Steinanzahl 'Drittel-, Halber- oder Ganzer Ring' ist bei der gewählten Steinverteilung nicht möglich. Bitte die Steinanzahl neu wählen.");
//             }
//
//             // Kombination Steinmodus und Steintyp zulässig?
//             let stoneType = AppComponent.app.data.stoneType.find(function (e) {
//               return e.allowedStoneMode.indexOf(stoneGroup.mode) !== -1 && e.id == stoneGroup.type;
//             })
//
//             if (!stoneType) {
//               stoneType = AppComponent.app.data.stoneType.find(function (e) {
//                 return (e.allowedStoneMode.indexOf(stoneGroup.mode) !== -1);
//               })
//
//               if (!stoneType) {
//                 Log("error", "Kein Steintyp gefunden");
//                 resetStoneGroup(stoneGroup);
//                 return;
//               }
//
//               stoneGroup.type = stoneType.id;
//               Log("info", "Die Steinart wurde angepasst");
//               adaptLoop = true;
//               continue;
//             }
//
//             // Steingröße zulässig?
//             let stoneSize = stoneType.size.find(function (e) {
//               return e.size == stoneGroup.size;
//             })
//
//             if (!stoneSize) {
//               stoneSize = getLowerStoneSize(stoneType, stoneGroup.size);
//               if (!stoneSize)
//                 stoneSize = stoneType.size[0];
//             }
//
//             let rowStoneSize = stoneSize.size;
//             if (stoneGroup.rows > 1)
//               rowStoneSize = stoneSize.size * stoneGroup.rows + stoneMode.safeDistX * (stoneGroup.rows + 1);
//
//             let stonePositionandMaxSize = getStonePositionandMaxSize(stoneGroup.positionDiv, useOnGapStonePositions, rowStoneSize);
//
//             console.log(stonePositionandMaxSize);
//
//             // TODO: Steingröße mit Ringhöhe abgleichen
//             // <==
//
//             let rowsBefore = stoneGroup.rows;
//
//             while (stonePositionandMaxSize.maxSize < rowStoneSize && stoneGroup.rows > 1) {
//               stoneGroup.rows--;
//               rowStoneSize = stoneSize.size * stoneGroup.rows + stoneMode.safeDistX * (stoneGroup.rows + 1);
//               stonePositionandMaxSize = getStonePositionandMaxSize(stoneGroup.positionDiv, useOnGapStonePositions, rowStoneSize);
//             }
//
//             if (stonePositionandMaxSize.maxSize == 0) {
//               stoneGroup.mode = 0;
//               Log("info", "Kein Steinbesatz möglich");
//               return;
//             }
//
//             if (stoneGroup.rows != rowsBefore) {
//               Log("info", "Die Anzahl der Steinreihen wurde angepasst ");
//             }
//
//             if (stoneGroup.mode == 35 || stoneGroup.mode == 36) {
//               if (stoneGroup.count > 1) {
//                 stoneGroup.count = 1;
//                 Log("info", "Die Anzahl der Steine wurde angepasst");
//               }
//               stoneGroup.positionValue = 0;
//               RingData.setStonePositionValue(ringData, stoneGroupIndex, stoneGroup.positionValue, true);
//             }
//
//             // console.log(stoneSize, stonePositionandMaxSize);
//
//             // @ts-ignore
//             stoneGroup.positionValue = stonePositionandMaxSize.position;
//             RingData.setStonePositionValue(ringData, stoneGroupIndex, stoneGroup.positionValue, true);
//
//             if (stoneSize.minRingWidth > ringData.ringWidth || stoneSize.minRingHeight > ringData.ringHeight) {
//               // Stein zu groß, suche passende Größe
//               let newStoneSize: iStoneSize | undefined = undefined;
//               stoneType.size.forEach(function (e) {
//                 if (e.minRingHeight <= ringData.ringHeight && e.minRingWidth <= ringData.ringWidth)
//                   newStoneSize = e;
//               })
//
//               if (newStoneSize) {
//                 Log("info", "Die Steingröße wurde angepasst (0x1)");
//                 // @ts-ignore
//                 console.log("adapt from " + stoneGroup.size + " to " + newStoneSize.size);
//                 // @ts-ignore
//                 stoneGroup.size = newStoneSize.size;
//                 adaptLoop = true;
//                 continue;
//               } else {
//                 // Keine passende Steingröße für diese Steinart gefunden, versuche Steinart Brillant
//                 if (stoneType.id != 1) {
//                   Log("info", "Die Steinart wurde angepasst");
//                   stoneGroup.type = 1;
//                   adaptLoop = true;
//                   continue;
//                 } else {
//                   Log("info", "Keinen passenden Steinbesatz gefunden (0x1)");
//                   resetStoneGroup(stoneGroup);
//                 }
//               }
//             }
//             if (stoneGroup.mode == 20 && stoneGroup.size * stoneGroup.rows > stonePositionandMaxSize.maxSize) {
//               let maxSize = stonePositionandMaxSize.maxSize / stoneGroup.rows;
//               let newStoneSize: iStoneSize | undefined = undefined;
//               stoneType.size.forEach(function (e) {
//                 if (e.calcSize && e.calcSize <= maxSize)
//                   newStoneSize = e;
//                 else if (e.size <= maxSize)
//                   newStoneSize = e;
//               })
//               if (newStoneSize) {
//                 Log("info", "Die Steingröße wurde angepasst (0x2)");
//                 // @ts-ignore
//                 stoneGroup.size = newStoneSize.size;
//                 adaptLoop = true;
//                 continue;
//               } else {
//                 // Keine passende Steingröße gefunden, reduziere die Anzahl der Reihen
//                 if (stoneGroup.rows > 1) {
//                   stoneGroup.rows--;
//                   Log("info", "Die Anzahl der Reihen wurde angepasst");
//                   adaptLoop = true;
//                   continue;
//                 } else {
//                   Log("info", "Anpassung nicht möglich");
//                   resetStoneGroup(stoneGroup);
//                 }
//               }
//             } //
//             else if (stoneGroup.mode == 31 || stoneGroup.mode == 35 || stoneGroup.mode == 36) // keine Beschränkung bei Kanal quer und Spannring
//             {
//
//             } else if ((stoneSize.calcSize && stoneSize.calcSize > stonePositionandMaxSize.maxSize + 10) || (stoneGroup.size > stonePositionandMaxSize.maxSize + 10)) // +10 = Rundungsfehler blockieren 10 = 0.01mm
//             {
//               console.log(stoneSize, stonePositionandMaxSize);
//
//               // Stein zu groß, suche passende Größe
//               let newStoneSize: iStoneSize | null = null;
//               stoneType.size.forEach(function (e) {
//                 if (e.calcSize) {
//                   if (e.calcSize <= stonePositionandMaxSize.maxSize)
//                     newStoneSize = e;
//                 } else if (e.size <= stonePositionandMaxSize.maxSize)
//                   newStoneSize = e;
//               })
//
//               if (newStoneSize) {
//                 // @ts-ignore
//                 if (stoneGroup.size == newStoneSize.size) {
//                   Log("error", "Keine Anpassung möglich");
//                   resetStoneGroup(stoneGroup);
//                 } else {
//
//                   Log("info", "Die Steingröße wurde angepasst (0x3)");
//                   // @ts-ignore
//                   stoneGroup.size = newStoneSize.size;
//                   adaptLoop = true;
//                   continue;
//                 }
//               } else {
//                 // Keine passende Steingröße für diese Steinart gefunden, versuche Steinart Brillant
//                 if (stoneType.id != 1) {
//                   Log("info", "Die Steinart wurde angepasst");
//                   stoneGroup.type = 1;
//                   adaptLoop = true;
//                   continue;
//                 } else {
//                   Log("info", "Keinen passenden Steinbesatz gefunden (0x2)");
//                   resetStoneGroup(stoneGroup);
//                 }
//               }
//             }
//
//             let minStoneSizeOnGap = ringData.gapWidth + 600;
//             // let minStoneSizeOnGap = ringData.gapWidth * 2;
//             if (profile && stonePositionandMaxSize.onGap) {//} && ringData.materialDiv.length > 1 && ringData.gapEnabled.indexOf(1) > -1) {
//               // Suche die Position der Steingruppe. Wenn diese in einer Fuge liegt, dann prüfe auf minimaler Steingröße.
//               if (stonePositionandMaxSize.onGap && stoneGroup.size < minStoneSizeOnGap) {
//                 let size = getHigherOrEqualStoneSize(stoneType, minStoneSizeOnGap + 1);
//
//                 if (size && size.size <= stonePositionandMaxSize.maxSize) {
//                   stoneSize = size;
//                 } else {
//
//                   if (!useOnGapStonePositions) {
//                     Log("info", "Keinen passenden Steinbesatz gefunden (0x3)");
//                     resetStoneGroup(stoneGroup);
//                   } else {
//                     useOnGapStonePositions = false;
//                     adaptLoop = true;
//                     continue;
//                   }
//                 }
//               }
//             }
//
//             if (stoneGroup.mode > 0 && stoneSize.size !== stoneGroup.size) {
//               Log("info", "Die Steingröße wurde angepasst (0x4)");
//               stoneGroup.size = stoneSize.size;
//             }
//
//             let amp100 = (ringData.ringWidth / 2) - (that.calc.stoneSafeLeft > that.calc.stoneSafeRight ? that.calc.stoneSafeLeft : that.calc.stoneSafeRight);
//
//             let maxStoneSizeItem = getLowerStoneSize(stoneType, amp100 * 2);
//             let maxStoneSize = amp100 * 2;
//             if (maxStoneSizeItem)
//               maxStoneSize = maxStoneSizeItem.size;
//
//             that.calc.stone[stoneGroupIndex].minSizeOnGap = minStoneSizeOnGap;
//             that.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
//
//             if (stoneGroup.size > amp100 * 2) {
//               stoneGroup.size = maxStoneSize;
//               Log("info", "initiale Steingröße angepasst (" + stoneGroup.size + ")" + amp100);
//             }
//
//             if (stoneGroup.rows > 1) {
//               let get_lower_wa = function (profile: iProfile, wa: number) {
//                 let result = profile.wa.min;
//                 while (1) {
//                   if (result + profile.wa.step > wa)
//                     break;
//                   result += profile.wa.step;
//                 }
//
//                 return result;
//               }
//
//               if (amp100 * ringData.waveAmp > 200000) {
//                 let amp = 200000 / amp100;
//                 // @ts-ignore
//                 ringData.waveAmp = get_lower_wa(profile, amp / 100);
//                 that.calc.waMax = ringData.waveAmp;
//                 Log("info", "max Amplitude aufgrund der Steinreihen angepasst (" + ringData.waveAmp + ")");
//               }
//             }
//             // <=
//           }
//         }
//       })
//       return true;
//     };
//
//     if (checkConditions()) {
//       that.ringData.materialDiv = mDiv;
//       that.gapDiv_calc();
//       that.gapDiv_adapt();
//       this.flags &= ~eRingFlags.IsComputing;
//
//       return true;
//     }
//
//     // this.popHistory();
//
//     this.flags &= ~eRingFlags.IsComputing;
//
//     return false;
//   }
//
//   // Berechne alle möglichen Designfugenbereiche
//   public gapDiv_calc(gapDiv: number[] | null = null, gapDivIndexIgnore: number | null = null): iMinMaxCur[] {
//     // Alle Teilungen beziehen sich auf die Mittelposition. Die Fugenbreiten werden in der Berechnung min/max bereits abgezogen.
//     let j, pos: number, divMM = [], data = this.ringData;
//
//     let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
//       return e.name == data.profileName;
//     });
//
//     if (!profile) return [];
//
//     pos = 0;
//     if (!this.isDivMode_h_s()) {
//       for (j = 0; j < data.materialDiv.length - 1; j++) { // letztes Segment ignorieren
//         pos += data.materialDiv[j];
//         /*
//         Die Trennfuge ist hier absichtlich immer 'aktiv'.
//         Es wurde ein Fehler festgestellt, wodurch eine inaktive Trennfuge eine freie Fuge ermöglichte und dadurch die
//         Materialteilung fehlerhaft erstellt wurde. Eine Designfuge auf der Position einer Trennfuge wurde nicht dargestell´t.
//          */
//         // if (this.ringData.gapEnabled[j])
//         divMM.push(pos * data.ringWidth / 10000);
//       }
//     }
//
//     divMM.push(data.ringWidth);
//
//     if (!gapDiv)
//       gapDiv = data.gapDiv;
//
//     pos = 0;
//     for (j = 0; j < gapDiv.length - 1; j++) {  // letztes Segment ignorieren
//       pos += gapDiv[j];
//       if (gapDivIndexIgnore != j)
//         divMM.push(pos * data.ringWidth / 10000);
//     }
//
//     divMM.sort(function (a, b) {
//       return a - b
//     });
//
//     let new_segment = function (min: number, max: number) {
//       if (min > max) return;
//       let size = max - min, half = Math.trunc(size / 2);
//       segments.push({min, max, cur: min + half});
//     };
//
//     let gapGapDistance = data.hasWave ? profile.gapGapDistanceWave : profile.gapGapDistance;
//     let minSize = data.gapWidth + gapGapDistance,
//       segments: iMinMaxCur[] = [],
//       min = this.calc.gapSafeLeft + this.calc.wa_mm, max;
//
//     for (j = 0; j < divMM.length - 1; j++) {
//       max = divMM[j] - minSize;
//       new_segment(min, max);
//       min = max + minSize * 2;
//     }
//
//     new_segment(min, data.ringWidth - this.calc.gapSafeRight - this.calc.wa_mm);
//
//     return segments;
//   }
//
//   // Ermittle die Positionen für die Designfugen; verschiebe oder entferne die Designfuge wenn notwendig
//   private gapDiv_adapt() {
//     let data = this.ringData;
//     let gapDiv = data.gapDiv.slice(0),
//       gapDiv_mm = [] as number[],
//       gapDivCount = gapDiv.length;
//
//     let i, j: number, t: number, gapDiv_segments, move: boolean, a, b;
//
//     // Teilungssumme ermitteln; Diese muss 10000 betragen
//     let sum = 0;
//     gapDiv.forEach(function (e: number) {
//       sum += e;
//     });
//
//     // Teilung ggf. korigieren
//     if (sum < 10000 || sum > 10000) {
//       gapDiv.forEach(function (e: number, i: number) {
//         gapDiv[i] = Math.round((10000 * e) / sum);
//       })
//     }
//
//     j = 0;
//     for (i = 0; i < gapDiv.length - 1; i++) {
//       t = Math.round(j + gapDiv[i] * data.ringWidth / 10000);
//       gapDiv_mm.push(t);
//       j = t;
//     }
//
//     let moved_index = [];
//
//     gapDiv_segments = this.gapDiv_calc([10000]); // 10000
//
//     let gapDiv_new = [];
//     t = 0;
//     for (i = 0; i < gapDiv_mm.length; i++) {
//       move = false;
//       for (j = 0; j < gapDiv_segments.length; j++) {
//
//         if (gapDiv_mm[i] >= gapDiv_segments[j].min && gapDiv_mm[i] <= gapDiv_segments[j].max) {
//           gapDiv_new.push(gapDiv_mm[i]);
//           break;
//         } else {
//           move = true;
//         }
//       }
//
//       // kein Segment gefunden...Fugenposition in nächstmögliches Segment verschieben
//       if (move) {
//         for (j = 0; j < gapDiv_segments.length; j++) {
//           if (j < gapDiv_segments.length - 1) {
//             if (gapDiv_mm[i] >= gapDiv_segments[j].max && gapDiv_mm[i] <= gapDiv_segments[j + 1].min) {
//               a = gapDiv_mm[i] - gapDiv_segments[j].max;
//               b = gapDiv_segments[j + 1].min - gapDiv_mm[i];
//
//               gapDiv_new.push(a < b ? gapDiv_segments[j].max : gapDiv_segments[j + 1].min);
//               moved_index.push(i);
//               break;
//             }
//           }
//           if (j == 0) {
//             if (gapDiv_mm[i] < gapDiv_segments[j].min) {
//               gapDiv_new.push(gapDiv_segments[j].min);
//               moved_index.push(i);
//               break;
//             }
//           }
//           if (j == gapDiv_segments.length - 1) {
//             if (gapDiv_mm[i] > gapDiv_segments[j].max) {
//               gapDiv_new.push(gapDiv_segments[j].max);
//               moved_index.push(i);
//               break;
//             }
//           }
//         }
//       }
//
//       gapDiv_new.sort(function (a, b) {
//         return a - b;
//       });
//
//       t = 0;
//       gapDiv = [];
//       gapDiv_new.forEach(function (e) {
//         gapDiv.push(Math.round((e - t) * 10000 / data.ringWidth));
//         t = e;
//       })
//       gapDiv.push(Math.round((data.ringWidth - t) * 10000 / data.ringWidth));
//
//       gapDiv_segments = this.gapDiv_calc(gapDiv);
//     }
//
//     RingData.setGapDivArray(data, gapDiv);
//     // this.ringData.gapDiv = gapDiv;
//     this.calc.gapDivMinMax = gapDiv_segments;
//
//     if (gapDivCount > data.gapDiv.length)
//       Log("info", "Die Anzahl der freien Fugen wurden angepasst.");
//     // else if (moved_index.length > 0)
//     //   Log("info", "Die freien Fugen wurden verschoben.");
//   }
//
//   gapDiv_plus() {
//     if (!this.calc.gapDivMinMax.length) return;
//     let data = this.ringData,
//       calc = this.calc,
//       gapDivSegments = calc.gapDivMinMax,
//       gapDiv = data.gapDiv,
//       gapDivMM: number[] = [] as number[],
//       i: number, j: number, t, max = -1, maxIndex = 0;
//
//     j = 0;
//     for (i = 0; i < gapDiv.length - 1; i++) {
//       t = j + (gapDiv[i] * data.ringWidth / 10000);
//       gapDivMM.push(t);
//       j = t;
//     }
//
//     gapDivSegments.forEach(function (e, index) {
//       t = e.max - e.min;
//       if (t > max) {
//         max = t;
//         maxIndex = index;
//       }
//     })
//
//     gapDivMM.push(gapDivSegments[maxIndex].cur);
//     gapDivMM.sort(function (a, b) {
//       return a - b
//     });
//
//     gapDiv = [];
//     j = 0;
//     gapDivMM.forEach(function (e) {
//       gapDiv.push(Math.round((e - j) * 10000 / data.ringWidth));
//       j = e;
//     })
//
//     let sum = gapDiv.reduce(function (a, b) {
//       return a + b
//     });
//
//     gapDiv.push(10000 - sum);
//
//     RingData.setGapDivArray(this.ringData, gapDiv);
//     // this.gapDiv_adapt();
//     // this.invalidate();
//     // this.setLastAction("gapDiv");
//   }
//
//   disposeMeshes() {
//     let i, webgl = WebglComponent.WEBGL;
//     for (i = 0; i < this.GL.mesh.length; i++) {
//       if (this.GL.mesh[i]) {
//         webgl?.scene.removeMesh(this.GL.mesh[i]);
//         if (this.GL.mesh[i].material && this.GL.mesh[i].name !== "instance")
//           this.GL.mesh[i].material = null;
//         try {
//           this.GL.mesh[i].dispose();
//         } catch (e) {
//           console.log(e);
//         }
//       }
//     }
//
//     this.GL.mesh = [];
//   }
//
//   createMeshes(meshes: iMeshData[], scale: number | null = null) {
//     let webgl = WebglComponent.WEBGL;
//     if (!webgl) return;
//
//     this.disposeMeshes();
//
//     // pivot
//     this.GL.pivot.rotation.y = AppComponent.app.data.webglSettings.ringRotationY[this.ringData.index] * Math.PI / 180.0;
//     this.GL.pivot.position.x = this.GL.position.x;
//     this.GL.pivot.position.z = this.GL.position.z;// + this.posZOffset;
//     this.GL.pivot.position.y = (this.ringData.ringSize / Math.PI / 2 + this.ringData.ringHeight) / 1000;
//
//     // shadow
//     let radius = this.ringData.ringSize / Math.PI / 2 + this.ringData.ringHeight;
//     let plane = CreatePlane("shadow", {
//       width: (this.ringData.ringWidth * 5.5) / 1000,
//       height: (radius * 4) / 1000
//     }, webgl.scene);
//     this.GL.mesh.push(plane);
//     plane.position.y = -this.GL.pivot.position.y;
//     plane.rotation.x = 90 * Math.PI / 180.0;
//     plane.material = webgl.matShadow;
//     plane.parent = this.GL.pivot;
//
//     // meshes
//     let vertexData = new VertexData();
//     this.GL.meshData = meshes;
//
//     let frontMeshes = [];
//     let gapMeshes = [];
//
//     for (let i = 0; i < meshes.length; i++) {
//       let M = meshes[i];
//       if (1) // Debug: Meshfilter...
//       {
//         // if (!M.type.includes("frontChannel") && !M.type.includes("frontCut") && !M.type.includes("helper")) continue;
//         // if (!M.type.startsWith("bevel") && M.type != "gap") continue;
//         // if (!M.type.includes("Bevel") && M.type != "gap") continue;
//         // if (!M.type.includes("sideBevel") && M.type != "helper") continue;
//         // if (!M.type.includes("sideChannel") && M.type !== "back") continue;
//         // if (!M.type.includes("sideChannel") && !M.type.includes("cut") && M.type !== "helper") continue;
//         // if (M.type != "bevel" && M.type != "helper") continue;
//         // if (M.type != "bevel" && M.type != "helper" && M.type != "gap") continue;
//         // if (M.type != "helper" && M.type != "gap") continue;
//         // if (M.type != "bevel") continue;
//         // if (M.type != "helper") continue;
//         // if (M.type != "front" || M.type != "helper") continue;
//         // if (M.type != "back") continue;
//         // if (M.type == "back") continue;
//         // if (M.type != "gap" && M.type != "front") continue;
//         // if (M.type != "helper") continue;
//         // if (!M.type.includes("frontCut") && M.type !== "helper") continue;
//
//         // if (M.type == "front") continue;
//       }
//
//       let name = "";
//       if (M.type == "front") name = "f" + M.index;
//       else if (M.type == "back") name = "b" + M.index;
//       // else if (M.type == "bevel") name = "bevel" + M.index;
//       else name = M.type;
//
//       let mesh = new Mesh(name, webgl.scene);
//
//       if (M.type.includes("alpha"))
//         mesh.setEnabled(false);
//       else
//         mesh.setEnabled(true);
//
//       this.GL.mesh.push(mesh);
//
//       if (scale !== null) // Die Geometriedaten werden mit dem Faktor 1000 erzeugt: -> runterskalieren...
//       {
//         for (let j = 0; j < M.positions.length; j++)
//           M.positions[j] *= scale;
//       }
//
//       vertexData.positions = M.positions;
//       vertexData.indices = M.indices;
//
//       if (!M.normals) {
//         let normals: number[] = [];
//         VertexData.ComputeNormals(M.positions, M.indices, normals);
//         vertexData.normals = normals;
//       } else
//         vertexData.normals = M.normals;
//
//       /*
//       Die Texturen sind in doppelter Größe angelegt.
//       Die Albedo Textur liegt links. Die "ursprüngliche" Textur liegt mittig darin und wird
//       nach oben und nach unten vervielfältigt.
//       Ein UV Wert mit 0:0 wird dann zu 0:25 und ein UV Wert it 1:1 wird zu 0.5:0.75
//        */
//       let uv = M.uvs, j_l = uv.length, offset = 0.0;
//       if (M.type == "back" || M.type.includes("sideChannel") || M.type.includes("crossChannelBack"))
//         offset = 0.5;
//
//       // console.log(M.type, offset, ""+uv[0]);
//
//       for (let j = 0; j < j_l; j += 2) {
//         // optimierte map() function
//         uv[j] = uv[j] * 0.5 + offset;
//         uv[j + 1] = 0.25 + 0.5 * uv[j + 1];
//       }
//
//       vertexData.uvs = M.uvs;
//       vertexData.applyToMesh(mesh, true);
//
//       if (M.type == "front") frontMeshes.push(mesh);
//       else if (M.type == "gap") gapMeshes.push(mesh);
//       mesh.parent = this.GL.pivot;
//     }
//
//     if (1 && this.GL.profile) // stones
//     {
//       let colorNormal = new Color3(1, 0, 0);
//       let colorBinormal = new Color3(0, 0, 1);
//       let colorTangent = new Color3(0, 1, 0);
//
//       let that = this;
//       this.ringData.stone.forEach(function (stoneGroup: iPresetStone, stoneGroupIndex: number) {
//           let stone = Preload.stone.find(function (e) {
//             return e.id == stoneGroup.type;
//           });
//
//           if (stone) {
//             // @ts-ignore
//             for (let i = 0; i < that.GL.profile.stonePaths.length; i++) {
//               // @ts-ignore
//               let positions = that.GL.profile.stonePaths[i].positions;
//               // @ts-ignore
//               let normals = that.GL.profile.stonePaths[i].normals;
//               // @ts-ignore
//               let binormals = that.GL.profile.stonePaths[i].binormals;
//               // @ts-ignore
//               let tangents = that.GL.profile.stonePaths[i].tangents;
//
//               // let points = [] as Vector3[];
//               for (let j = 0; j < positions.length; j++) {
//                 positions[j].scale(0.001);
//                 // normals[j].scale(0.001);
//                 // binormals[j].scale(0.001);
//                 // tangents[j].scale(0.001);
//                 // points.push(new Vector3(positions[j].x, positions[j].y, positions[j].z));
//               }
//
//               // let lines = MeshBuilder.CreateLines("", {points: points});
//               // lines.color = new Color3(1, 0, 0);
//               // lines.parent = this.GL.pivot;
//               // this.GL.mesh.push(lines);
//
//               if (0)  // show stone normals
//               {
//                 let normalLines = [], v1, v2, size = 2.0;
//                 for (let j = 0; j < normals.length; j++) {
//                   v1 = new Vector3(positions[j].x, positions[j].y, positions[j].z);
//                   v2 = new Vector3(normals[j].x, normals[j].y, normals[j].z);
//                   v2.scaleInPlace(size);
//                   v2.addInPlace(v1);
//                   normalLines.push([v1, v2]);
//                 }
//                 // @ts-ignore
//                 let normalLinesMesh = MeshBuilder.CreateLineSystem("normalLines", {lines: normalLines}, webgl.scene);
//                 normalLinesMesh.color = colorNormal;
//                 normalLinesMesh.parent = that.GL.pivot;
//                 // that.mesh.push(normalLinesMesh);
//
//                 let binormalLines = [];
//                 for (let j = 0; j < binormals.length; j++) {
//                   v1 = new Vector3(positions[j].x, positions[j].y, positions[j].z);
//                   v2 = new Vector3(binormals[j].x, binormals[j].y, binormals[j].z);
//                   v2.scaleInPlace(size);
//                   v2.addInPlace(v1);
//                   binormalLines.push([v1, v2]);
//                 }
//                 // @ts-ignore
//                 let binormalLinesMesh = MeshBuilder.CreateLineSystem("normalLines", {lines: binormalLines}, webgl.scene);
//                 binormalLinesMesh.color = colorBinormal;
//                 binormalLinesMesh.parent = that.GL.pivot;
//                 // that.mesh.push(binormalLinesMesh);
//
//                 let tangentLines = [];
//                 for (let j = 0; j < tangents.length; j++) {
//                   v1 = new Vector3(positions[j].x, positions[j].y, positions[j].z);
//                   v2 = new Vector3(tangents[j].x, tangents[j].y, tangents[j].z);
//                   v2.scaleInPlace(size);
//                   v2.addInPlace(v1);
//                   tangentLines.push([v1, v2]);
//                 }
//                 // @ts-ignore
//                 let tangentLinesMesh = MeshBuilder.CreateLineSystem("normalLines", {lines: tangentLines}, webgl.scene);
//                 tangentLinesMesh.color = colorTangent;
//                 tangentLinesMesh.parent = that.GL.pivot;
//                 that.GL.mesh.push(tangentLinesMesh);
//               }
//
//               if (1) { // stones
//                 // @ts-ignore
//                 let path = that.GL.profile.stonePaths[i];
//
//                 // let stone_0 = null;
//                 let stoneMesh = null,
//                   stoneMatricesData = null, stoneMatrix = null, rotation = null;
//
//                 // -> krabbe
//                 let krabbeMesh = null;
//                 let krabbeMatricesData = null;
//                 let krabbeUVData = null;
//                 let krabbeDistance = [] as number[][];
//                 if ([20, 44, 45].includes(stoneGroup.mode)) {
//                   let krabbe = Preload.stone.find(function (e) {
//                     return e.id == 99;
//                   });
//
//                   if (krabbe) {
//                     krabbeMesh = krabbe.mesh.clone("krabbe");
//                     krabbeMesh.makeGeometryUnique();
//                     that.GL.mesh.push(<Mesh><unknown>krabbeMesh);
//                     let scale = stoneGroup.size / 1000;
//                     krabbeMesh.scaling.x = scale;
//                     krabbeMesh.scaling.y = scale;
//                     krabbeMesh.scaling.z = scale;
//                     krabbeMesh.position.y *= scale;
//                     krabbeMesh.bakeCurrentTransformIntoVertices();
//                     krabbeMesh.parent = that.GL.pivot;
//                     krabbeMesh.setEnabled(true);
//
//                     krabbeMatricesData = new Float32Array(path.positions.length * 4 * 16);
//                     krabbeUVData = new Float32Array(path.positions.length * 4 * 2);
//
//                     let dist = Math.cos(Math.PI / 4) * ((stoneGroup.size + (180 * scale)) / 2000);// + (0.07 * krabbeMesh.scaling.x);
//                     scale = 1.0 / (stoneGroup.size / 1000);
//                     dist *= scale;
//                     krabbeDistance.push([-dist, dist]);
//                     krabbeDistance.push([dist, dist]);
//                     krabbeDistance.push([dist, -dist]);
//                     krabbeDistance.push([-dist, -dist]);
//                   }
//                 }
//                 // <- krabbe
//
//                 let useStoneThinInstances = true;
//                 if (useStoneThinInstances) {
//                   stoneMesh = stone.mesh.clone("stone");
//                   that.GL.mesh.push(<Mesh><unknown>stoneMesh);
//                   stoneMesh.parent = that.GL.pivot;
//                   stoneMesh.setEnabled(true);
//                   stoneMatricesData = new Float32Array(path.positions.length * 16);
//                 }
//
//                 for (let j = 0; j < path.positions.length; j++) {
//                   if (DEBUG_STONES_ENABLED) {
//                     if (useStoneThinInstances) {
//                       let scale = new Vector3(stoneGroup.size / 1000, stoneGroup.size / 1000, stoneGroup.size / 1000);
//                       let tangent = path.tangents[j].toVector3();
//                       let binormal = path.binormals[j].toVector3();
//                       binormal.scaleInPlace(-1.0);
//                       rotation = Quaternion.FromLookDirectionRH(tangent, binormal);
//                       let trans = path.positions[j].toVector3();
//
//                       stoneMatrix = Matrix.Compose(scale, rotation, trans);
//                       // @ts-ignore
//                       stoneMatrix.copyToArray(stoneMatricesData, j * 16);
//                     } else {
//                       stoneMesh = stone.mesh.createInstance("instance");
//                       // @ts-ignore
//                       that.GL.mesh.push(stoneMesh);
//
//                       stoneMesh.scaling.x = stoneGroup.size / 1000;
//                       stoneMesh.scaling.y = stoneGroup.size / 1000;
//                       stoneMesh.scaling.z = stoneGroup.size / 1000;
//                       // @ts-ignore
//                       // stoneMesh.material = webgl.matStandard;
//                       // stoneMesh.material = webgl.matDiamond;
//                       stoneMesh.setEnabled(true);
//                       // @ts-ignore
//                       that.GL.mesh.push(stoneMesh);
//                       stoneMesh.parent = that.GL.pivot;
//                       stoneMesh.position = path.positions[j].toVector3();
//
//                       let tangent = path.tangents[j].toVector3();
//                       let binormal = path.binormals[j].toVector3();
//                       binormal.scaleInPlace(-1.0);
//                       rotation = Quaternion.FromLookDirectionRH(tangent, binormal);
//                       if (stoneMesh)
//                         stoneMesh.rotationQuaternion = rotation
//                     }
//                   }
//
//                   // => Bevels
//                   if (stoneGroup.mode == 10) // eingerieben front
//                   {
//                     let bevelMesh = that.GL.mesh.find(function (e) {
//                       return e.name === "frontBevel_" + stoneGroupIndex + "_" + j;
//                     })
//                     if (bevelMesh) {
//                       bevelMesh.parent = null;
//                       bevelMesh.rotationQuaternion = rotation
//                       bevelMesh.position = path.positions[j].toVector3();
//
//                       bevelMesh.bakeCurrentTransformIntoVertices();
//                       bevelMesh.parent = that.GL.pivot;
//
//                       let alignMeshToProfile = function (mesh: Mesh) {
//                         let profile = that.GL.profile;
//                         if (!profile)
//                           return;
//                         let position = mesh.getVerticesData(VertexBuffer.PositionKind);
//                         let uv = mesh.getVerticesData(VertexBuffer.UVKind);
//                         if (position && position.length && uv && uv.length) {
//                           let x, y, z;
//                           let innerRadius = that.ringData.ringSize / Math.PI / 2;
//                           let ringRotationRad = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
//                           let PI2 = Math.PI * 2;
//                           let positionHalf = position.length / 3 * 2;
//                           let vz0 = new CVertex(0, 0, -10000000);
//                           let t;
//
//                           for (let p = 0; p < position.length; p += 3) {
//                             x = position[p] * 1000;
//                             y = position[p + 1] * 1000;
//                             z = position[p + 2] * 1000;
//                             let distOrig = Math.sqrt(x * x + y * y + z * z);
//
//                             let result = profile.interpolate(x, profile.frontVertices);
//                             let v = new CVertex(result.x, 0, innerRadius - result.z);
//                             let distNew = Math.sqrt(v.x * v.x + v.z * v.z) * 0.998;
//
//                             v.x = x;
//                             v.y = y;
//                             v.z = z;
//                             v.scale(distNew / distOrig);
//
//                             if (p < positionHalf) // nur die 1. Bevelreihe an die Profilgeometrie anpassen
//                             {
//                               position[p] = v.x / 1000;
//                               position[p + 1] = v.y / 1000;
//                               position[p + 2] = v.z / 1000;
//                             }
//                             // für die uv-v Komponente muss der Winkel um den Nullpunkt berechnet werden
//                             v.rotateX(-ringRotationRad);
//                             let rad = CVertex.angleYZ(v, vz0);
//
//                             if (v.y < 0)
//                               rad = -rad;
//
//                             t = p / 3 * 2;
//
//                             uv[t] = result.uv_u;
//                             uv[t + 1] = rad / PI2;
//                           }
//
//                           // console.log("uv[" + j + "]: ", {uv});
//
//                           mesh.updateVerticesData(VertexBuffer.PositionKind, position);
//                           mesh.updateVerticesData(VertexBuffer.UVKind, uv);
//                         } else {
//                           console.log("position, uv");
//                         }
//                       }
//
//                       alignMeshToProfile(bevelMesh);
//                     }
//                   } else if ([20, 44, 45].includes(stoneGroup.mode) && krabbeMesh && krabbeMatricesData && krabbeUVData) // Verschnitt - Krabbe
//                   {
//                     // NEU: es werden BabylonJS thinInstances benutzt, welche eine viel bessere Performance ermöglichen
//                     let pivotPosition = that.GL.pivot.position;
//                     // let pV = new CVertex(pivotPosition.x, pivotPosition.y, pivotPosition.z);
//                     let pV = new CVertex(pivotPosition.x, pivotPosition.y, -1000000);
//                     let v0 = new CVertex(0, 0, -1000000);
//
//                     if (!useStoneThinInstances && stoneMesh) {
//                       stoneMatrix = stoneMesh.getWorldMatrix();
//                     }
//
//                     let ringRotationRad = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
//                     let PI2 = Math.PI * 2;
//
//                     for (let k = 0; k < 4; k++) {
//                       let p = krabbeDistance[k];
//
//                       let localPosition = new Vector3(p[0], -(stoneGroup.size * 0.1) / 1000 * (1.0 / (stoneGroup.size / 1000)), p[1]);
//                       // let localPosition = new Vector3(p[0], 0, p[1]);
//                       // @ts-ignore
//                       let m = stoneMatrix.clone();
//                       let globalPosition = Vector3.TransformCoordinates(localPosition, m);
//
//                       // @ts-ignore
//                       m.m[12] = globalPosition.x;
//                       // @ts-ignore
//                       m.m[13] = globalPosition.y;
//                       // @ts-ignore
//                       m.m[14] = globalPosition.z;
//
//                       let trans = new Vector3();
//                       let rot = new Quaternion();
//                       let scale = new Vector3();
//                       m.decompose(scale, rot, trans);
//                       scale.x = scale.y = scale.z = 1.0;
//                       m = Matrix.Compose(scale, rot, trans);
//
//                       m.copyToArray(krabbeMatricesData, (j * 4 + k) * 16);
//
//                       // get UV
//                       let v1 = new CVertex(globalPosition.x, globalPosition.y, globalPosition.z);
//                       v1.rotateX(-ringRotationRad);
//
//                       // UV-U Wert
//                       if ([44, 45].includes(stoneGroup.mode)) // seitlich
//                       {
//                         let back = false;
//                         if (k == 1 || k == 2)
//                           back = true;
//                         let x = v1.x * 1000;
//                         // @ts-ignore
//                         let result = that.GL.profile.interpolate(x, that.GL.profile.frontVertices);
//                         let u = result.uv_u * 0.5; // doppelte Texturgröße: Fronttextur ist auf der linken Hälfte der Textur
//                         if (back) u += 0.5;
//                         krabbeUVData[(j * 4 + k) * 2] = u;
//                       } else {
//                         let x = v1.x * 1000;
//                         // @ts-ignore
//                         let result = that.GL.profile.interpolate(x, that.GL.profile.frontVertices);
//                         krabbeUVData[(j * 4 + k) * 2] = result.uv_u * 0.5; // doppelte Texturgröße: Fronttextur ist auf der linken Hälfte der Textur
//                       }
//                       // UV-V Wert
//                       let rad = CVertex.angleYZ(v1, pV);
//                       if (v1.y < v0.y) rad = PI2 - rad;
//                       rad /= PI2;
//                       krabbeUVData[(j * 4 + k) * 2 + 1] = 0.25 + 0.5 * rad;
//                     }
//                   } else if (stoneGroup.mode == 40 || stoneGroup.mode == 41) // eingerieben seitlich
//                   {
//                     let bevelMesh = that.GL.mesh.find(function (e) {
//                       return e.name === "sideBevel_" + stoneGroupIndex + "_" + j;
//                     })
//                     if (bevelMesh) {
//                       bevelMesh.parent = null;
//
//                       bevelMesh.rotationQuaternion = rotation
//                       bevelMesh.position = path.positions[j].toVector3();
//
//                       bevelMesh.bakeCurrentTransformIntoVertices();
//                       bevelMesh.parent = that.GL.pivot;
//
//                       let generateUV_back = function (mesh: Mesh) {
//                         let profile = that.GL.profile;
//                         if (!profile) return;
//                         let position = mesh.getVerticesData(VertexBuffer.PositionKind);
//                         let uv = mesh.getVerticesData(VertexBuffer.UVKind);
//                         if (position && uv) {
//                           let x, y, z;
//                           let innerRadius = that.ringData.ringSize / Math.PI / 2;
//                           let ringRotationRad = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
//                           let PI2 = Math.PI * 2;
//                           let vz0 = new CVertex(0, 0, -100000);
//                           let v = new CVertex;
//                           let t;
//                           let pA,
//                             pB,
//                             AZ, ZB, AB, scale;
//
//                           if (stoneGroup.mode == 40) {
//                             let n1 = profile.middleVertexBack[0] - 1,
//                               n2 = profile.middleVertexBack[0] + 1;
//                             pA = profile.backVertices[n1];
//                             pB = profile.backVertices[n2];
//                           } else {
//                             let n1 = profile.backVertices.length - 1 - profile.middleVertexBack[1] - 1,
//                               n2 = profile.backVertices.length - 1 - profile.middleVertexBack[1] + 1;
//
//                             pA = profile.backVertices[n1];
//                             pB = profile.backVertices[n2];
//                           }
//
//                           for (let p = 0; p < position.length; p += 3) {
//                             x = position[p] * 1000;
//                             y = position[p + 1] * 1000;
//                             z = position[p + 2] * 1000;
//
//                             v.x = x;
//                             v.y = y;
//                             v.z = z;
//
//                             // für die uv-v Komponente muss der Winkel um den Nullpunkt berechnet werden
//                             v.rotateX(-ringRotationRad);
//                             let rad = CVertex.angleYZ(v, vz0);
//
//                             if (v.y < 0)
//                               rad = -rad;
//
//                             v.rotateX(-rad);
//                             v.z += innerRadius;
//
//                             AZ = v.z - pA.z;
//                             ZB = pB.z - v.z;
//                             AB = pB.z - pA.z;
//                             scale = AZ / AB;
//                             pA.lerpToRef(pB, scale, v);
//
//                             t = p / 3 * 2;
//                             // if (stoneGroup.mode == 40)
//                             uv[t] = v.u + 1.0;
//                             // else
//                             //     uv[t] = 2.0 - v.u;
//                             uv[t + 1] = (rad / PI2);
//                           }
//
//                           mesh.updateVerticesData(VertexBuffer.UVKind, uv);
//                           // console.log(uv);
//                         }
//                       }
//
//                       generateUV_back(bevelMesh);
//                     } else
//                       console.log("no bevelMesh: sideBevel_" + stoneGroupIndex + "_" + j);
//                   }
//                 }
//                 if (useStoneThinInstances && stoneMesh && stoneMatricesData) {
//                   (<Mesh>stoneMesh).thinInstanceSetBuffer("matrix", stoneMatricesData, 16);
//                 }
//                 if (krabbeMesh && krabbeMatricesData) {
//                   krabbeMesh.thinInstanceSetBuffer("matrix", krabbeMatricesData, 16);
//                   krabbeMesh.thinInstanceSetBuffer("uv", krabbeUVData, 2);
//                   // @ts-ignore
//                   krabbeMesh.krabbeUVData = krabbeUVData;
//                 }
//               }
//             }
//           }
//         }
//       )
//     }
//
//     this.assignMaterials();
//   }
//
//   assignMaterials() {
//     let webgl = WebglComponent.WEBGL;
//     if (!webgl || !this.GL.profile) return;
//
//     let divMode = this.ringData.divPreset.substring(0, 1).toLowerCase();
//     let textureSize = WebglComponent.WEBGL.maxTextureSize,
//       textureSize_half = textureSize / 2,
//       textureSizeAlpha = WebglComponent.WEBGL.maxAlphaTextureSize,
//       textureSizeAlpha_half = textureSizeAlpha / 2,
//       vec: CVertex[],
//       i, i_l,
//       u, v,
//       that = this;
//
//     // Farben ermitteln
//     let colors: string[] = [];
//     this.ringData.material.forEach(function (e: number) {
//       let mat = AppComponent.app.data.material.find(function (e2) {
//         return e2.id == e;
//       })
//       if (mat)
//         colors.push(mat.color3d);
//       else
//         colors.push('#0000ff');
//     })
//
//     let ctx = this.context.albedo;//this.GL.doubledTextures.albedo.getContext();
//     ctx.save();
//
//     ctx.translate(0, textureSize_half);
//     // ctx.lineWidth = 1;
//     ctx.lineWidth = 0.1;
//
//     if (divMode != "s" && divMode != "h") {
//       this.GL.meshData.forEach(function (e) {
//         if (e.outline && e.type != "gap" && !e.type.includes("Bevel") && !e.type.includes("hannel")) {
//           vec = e.outline;
//           ctx.fillStyle = colors[e.index];
//           ctx.strokeStyle = colors[e.index];
//
//           ctx.beginPath();
//           ctx.moveTo(Math.round(vec[0].u * textureSize), Math.round(vec[0].v * textureSize));
//
//           i_l = vec.length;
//           for (i = 1; i < i_l; i++) {
//             u = Math.round(vec[i].u * textureSize);
//             v = Math.round(vec[i].v * textureSize);
//             ctx.lineTo(u, v);
//           }
//
//           ctx.closePath();
//           ctx.fill();
//         }
//
//         // if (e.outline && e.type === "gap") {
//         //   vec = e.outline;
//         //   ctx.fillStyle = "#ff0000";
//         //   ctx.strokeStyle = "#ff0000";
//         //
//         //   ctx.beginPath();
//         //   ctx.moveTo(Math.round(vec[0].u * textureSize), Math.round(vec[0].v * textureSize));
//         //
//         //   i_l = vec.length;
//         //   for (i = 1; i < i_l; i++)
//         //   {
//         //     u = Math.round(vec[i].u * textureSize);
//         //     v = Math.round(vec[i].v * textureSize);
//         //     ctx.lineTo(u, v);
//         //   }
//         //
//         //   ctx.closePath();
//         //   ctx.fill();
//         //
//         // }
//       })
//
//       // Fugen mit Weißgold extra zeichnen
//       let mat = AppComponent.app.data.material.find(function (e2) {
//         return e2.id == 1;
//       })
//       let color = mat ? mat.color3d : '#0000ff';
//       let materialAr = this.ringData.material;
//
//       // let that = this;
//       this.GL.meshData.forEach(function (e) {
//         if (e.outline && e.type == "gap" && e.index != -1) {
//           if (materialAr[e.index] == 1 || materialAr[e.index + 1] == 1) {
//             vec = e.outline;
//             ctx.fillStyle = color;
//             ctx.strokeStyle = color;
//
//             ctx.beginPath();
//             // ctx.moveTo(Math.round(vec[0].u * textureSize), Math.round(vec[0].v * textureSize));
//
//             i_l = vec.length;
//             for (i = 0; i < i_l; i++) {
//               u = Math.round(vec[i].u * textureSize);
//               v = Math.round(vec[i].v * textureSize);
//               if (i == 0)
//                 ctx.moveTo(u, v);
//               else
//                 ctx.lineTo(u, v);
//             }
//
//             ctx.closePath();
//             ctx.fill();
//           }
//         }
//       })
//     } else if (divMode == "s") {
//       ctx.fillStyle = colors[0];
//       ctx.beginPath();
//       ctx.moveTo(0, 0);
//       ctx.lineTo(textureSize + 1, 0);
//       ctx.lineTo(textureSize + 1, textureSize / 2 + 1);
//       ctx.lineTo(0, textureSize / 2 + 1);
//       ctx.closePath();
//       ctx.fill();
//       ctx.fillStyle = colors[1];
//       ctx.beginPath();
//       ctx.moveTo(0, textureSize / 2 + 1);
//       ctx.lineTo(textureSize + 1, textureSize / 2 + 1);
//       ctx.lineTo(textureSize + 1, textureSize + 1);
//       ctx.lineTo(0, textureSize + 1);
//       ctx.closePath();
//       ctx.fill();
//     } else if (divMode == "h") {
//       ctx.fillStyle = colors[0];
//       ctx.beginPath();
//       ctx.moveTo(0, 0);
//       ctx.lineTo(textureSize + 1, 0);
//       ctx.lineTo(textureSize + 1, textureSize + 1);
//       ctx.lineTo(0, textureSize + 1);
//       ctx.closePath();
//       ctx.fill();
//     }
//
//     ctx.restore();
//
//     // Kopien der Texturdaten nach oben und unten anfertigen
//     let imageData = ctx.getImageData(0, textureSize_half, textureSize, textureSize_half);
//     ctx.putImageData(imageData, 0, textureSize + textureSize_half);
//     imageData = ctx.getImageData(0, textureSize, textureSize, textureSize_half);
//     ctx.putImageData(imageData, 0, 0);
//
//     if (divMode != "h") {
//       // Kopie nach rechts für den Innenring
//       imageData = ctx.getImageData(0, 0, textureSize, textureSize * 2);
//       ctx.putImageData(imageData, textureSize, 0);
//     } else {
//       // mit Frontmaterial füllen
//       ctx.fillStyle = colors[0];
//       ctx.beginPath();
//       ctx.moveTo(textureSize, 0);
//       ctx.lineTo(textureSize * 2, 0);
//       ctx.lineTo(textureSize * 2, textureSize * 2);
//       ctx.lineTo(textureSize, textureSize * 2);
//       ctx.closePath();
//       ctx.fill();
//
//       // "outline" mit Backmaterial füllen
//       let md = this.GL.meshData.find(function (e) {
//         return e.type == "back";
//       });
//
//       if (1 && md) {
//         vec = md.outline as CVertex[];
//         ctx.fillStyle = colors[1];
//
//         ctx.beginPath();
//         ctx.moveTo(Math.round(vec[0].u * textureSize) + textureSize, Math.round(vec[0].v * textureSize) + textureSize_half);
//
//         i_l = vec.length;
//         for (i = 1; i < i_l; i++) {
//           u = Math.round(vec[i].u * textureSize) + textureSize;
//           v = Math.round(vec[i].v * textureSize) + textureSize_half;
//           ctx.lineTo(u, v);
//         }
//
//         ctx.closePath();
//         ctx.fill();
//       }
//
//       // Kopien der Texturdaten nach oben und unten anfertigen
//       let imageData = ctx.getImageData(textureSize, textureSize_half, textureSize, textureSize_half);
//       ctx.putImageData(imageData, textureSize, textureSize + textureSize_half);
//       imageData = ctx.getImageData(textureSize, textureSize, textureSize, textureSize_half);
//       ctx.putImageData(imageData, textureSize, 0);
//     }
//
//     if (1 && this.GL.doubledTextures.roughnessEngraving) // Gravur: NEU: Nicht als Bump-Map, sondern als metallicRoughness Textur
//     {
//       let ctxEngraving = this.context.roughnessEngraving;// this.GL.doubledTextures.roughnessEngraving.getContext();
//       ctxEngraving.save();
//       // ctxEngraving.lineWidth = 0.1;
//       ctxEngraving.strokeStyle = "#0ff";
//       ctxEngraving.fillStyle = ctxEngraving.strokeStyle
//
//       ctxEngraving.fillRect(textureSize, 0, textureSize, textureSize * 2);
//
//       ctxEngraving.strokeStyle = "#00ff80";
//       ctxEngraving.fillStyle = ctxEngraving.strokeStyle;
//
//       ctxEngraving.translate(textureSize_half * 3, textureSize);
//       ctxEngraving.rotate(-Math.PI / 2.0);
//
//
//       let xPos = 0;
//
//       // @ts-ignore
//       let cy = this.GL.profile.maxVerticeLength * textureSize / this.ringData.ringSize;
//       let scaleHeight = textureSize / cy;
//       ctxEngraving.scale(1.0, scaleHeight);
//
//       // @ts-ignore
//       let fs = 1000 * textureSize / this.GL.profile.maxVerticeLength / scaleHeight; // 1mm
//
//       if (this.ringData.engraving.length > 0) {
//         let fsEgt = fs;
//         let t = this.ringData.ringWidth / 2 - 0.5;
//         if (t > 2500) fsEgt *= 2.2;
//         else if (t < 1500) fsEgt *= 1.5;
//         else fsEgt *= 2.0;
//
//         ctxEngraving.font = fsEgt + 'px "engraving-' + this.ringData.engravingFont + '"';
//         let egt = decodeURI(this.ringData.engraving);
//         let sizeEGT = ctxEngraving.measureText(egt);
//
//         xPos = -sizeEGT.width / 2;
//         // @ts-ignore
//         ctxEngraving.fillText(egt, xPos, (sizeEGT.actualBoundingBoxAscent - sizeEGT.actualBoundingBoxDescent) / 2);
//       }
//
//       // Punzierung
//       let divMode = this.ringData.divPreset.substring(0, 1).toLowerCase();
//       let n = this.ringData.materialDiv.length;
//       if (divMode == "h" || divMode == "s") n = 2;
//       let a = [], textPunzierung, m;
//       let finenessAr = this.ringData.fineness;
//       let materialAr = this.ringData.material;
//       for (let i = 0; i < n; i++) {
//         m = AppComponent.app.data.material[materialAr[i]];
//         if (m) {
//           textPunzierung = m.symbol + finenessAr[i];
//           if (a.indexOf(textPunzierung) === -1) a.push(textPunzierung);
//         }
//       }
//       textPunzierung = "";
//       for (let i = 0; i < a.length; i++) {
//         if (i > 0)
//           textPunzierung += "/";
//         textPunzierung += a[i];
//       }
//
//       textPunzierung += "  ";
//
//       fs *= 0.8;
//       ctxEngraving.font = fs + 'px Arial';
//       // c.font = (fs * 0.8) + 'px Arial';
//       let sizePunzierung = ctxEngraving.measureText(textPunzierung);
//
//       if (xPos == 0)
//         xPos = -sizePunzierung.width / 2;
//       else
//         xPos -= sizePunzierung.width + (fs * 2);
//       // @ts-ignore
//       ctxEngraving.fillText(textPunzierung, xPos, (sizePunzierung.fontBoundingBoxAscent - sizePunzierung.fontBoundingBoxDescent) / 2);
//       ctxEngraving.restore();
//       this.GL.doubledTextures.roughnessEngraving.update(false);
//
//
//       let link = document.getElementById('download_texture_roughnessMetallic');
//       if (link) {
//         link.setAttribute('download', 'albedo.png');
//         link.setAttribute('href', ctxEngraving.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
//       }
//     } else // Gravur: NEU: Nicht als Bump-Map, sondern in die Albedo geschrieben
//     {
//       ctx.save();
//       ctx.translate(textureSize_half * 3, textureSize);
//       ctx.rotate(-Math.PI / 2.0);
//       ctx.strokeStyle = AppComponent.app.data.engraving.color;
//       ctx.fillStyle = AppComponent.app.data.engraving.color;
//
//       let xPos = 0;
//
//       // @ts-ignore
//       let cy = this.GL.profile.maxVerticeLength * textureSize / this.ringData.ringSize;
//       let scaleHeight = textureSize / cy;
//       ctx.scale(1.0, scaleHeight);
//
//       // @ts-ignore
//       let fs = 1000 * textureSize / this.GL.profile.maxVerticeLength / scaleHeight; // 1mm
//
//       if (this.ringData.engraving.length > 0) {
//         let fsEgt = fs;
//         let t = this.ringData.ringWidth / 2 - 0.5;
//         if (t > 2500) fsEgt *= 2.2;
//         else if (t < 1500) fsEgt *= 1.5;
//         else fsEgt *= 2.0;
//
//         ctx.font = fsEgt + 'px "engraving-' + this.ringData.engravingFont + '"';
//         let egt = decodeURI(this.ringData.engraving);
//         let sizeEGT = ctx.measureText(egt);
//
//         xPos = -sizeEGT.width / 2;
//         // @ts-ignore
//         ctx.fillText(egt, xPos, (sizeEGT.actualBoundingBoxAscent - sizeEGT.actualBoundingBoxDescent) / 2);
//       }
//
//       // Punzierung
//       let divMode = this.ringData.divPreset.substring(0, 1).toLowerCase();
//       let n = this.ringData.materialDiv.length;
//       if (divMode == "h" || divMode == "s") n = 2;
//       let a = [], textPunzierung, m;
//       let finenessAr = this.ringData.fineness;
//       let materialAr = this.ringData.material;
//       for (let i = 0; i < n; i++) {
//         m = AppComponent.app.data.material[materialAr[i]];
//         if (m) {
//           textPunzierung = m.symbol + finenessAr[i];
//           if (a.indexOf(textPunzierung) === -1) a.push(textPunzierung);
//         }
//       }
//       textPunzierung = "";
//       for (let i = 0; i < a.length; i++) {
//         if (i > 0)
//           textPunzierung += "/";
//         textPunzierung += a[i];
//       }
//
//       textPunzierung += "  ";
//
//       fs *= 0.8;
//       ctx.font = fs + 'px Arial';
//       // c.font = (fs * 0.8) + 'px Arial';
//       let sizePunzierung = ctx.measureText(textPunzierung);
//
//       if (xPos == 0)
//         xPos = -sizePunzierung.width / 2;
//       else
//         xPos -= sizePunzierung.width + (fs * 2);
//       // @ts-ignore
//       ctx.fillText(textPunzierung, xPos, (sizePunzierung.fontBoundingBoxAscent - sizePunzierung.fontBoundingBoxDescent) / 2);
//       ctx.restore();
//     }
//
//     /*
//         if (0) // testen der Pins für den Verschnitt
//         {
//           this.GL.mesh.forEach(function (mesh)
//           {
//             if (mesh.name == "krabbe")
//             {
//               // console.log("krabbe mesh");
//               // @ts-ignore
//               let krabbeUVData = mesh.krabbeUVData;
//               let i_l = krabbeUVData.length;
//               ctx.restore();
//
//               ctx.beginPath();
//               ctx.strokeStyle = "#000000";
//               ctx.moveTo(0, textureSize_half);
//               ctx.lineTo(textureSize, textureSize_half);
//               ctx.moveTo(0, textureSize_half + textureSize);
//               ctx.lineTo(textureSize, textureSize_half + textureSize);
//               ctx.stroke();
//
//
//               let colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"];
//
//
//               for (let i = 0; i < i_l; i += 2)
//               {
//                 let x = krabbeUVData[i] * textureSize * 2;
//                 let y = krabbeUVData[i + 1] * textureSize * 2;
//                 let colorIndex = (i / 2) % 4;
//                 ctx.fillStyle = colors[colorIndex];
//                 ctx.strokeStyle = colors[colorIndex];
//                 // console.log(i, colorIndex, x, y);
//                 ctx.beginPath();
//                 ctx.moveTo(x, y);
//                 ctx.arc(x, y, 5, 0, Math.PI * 2);
//                 ctx.fill();
//               }
//             }
//           })
//         }
//     */
//
//     this.GL.doubledTextures.albedo.update(false);
//
//     // erzeuge Downloadlink der Textur
//     if (this.GL.generateTextureDownloads && this.ringData.index === 0) {
//       let link = document.getElementById('download_texture_albedo');
//       if (link) {
//         link.setAttribute('download', 'albedo.png');
//         link.setAttribute('href', ctx.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
//       }
//     }
//
//     // => Alpha
//     /*
//     Die UV-Koordinaten werden bereits in der createMeshes() Funktion umgerechten
//      */
//     let ctxAlpha = this.context.alpha;// this.GL.doubledTextures.alpha.getContext();
//     ctxAlpha.fillStyle = "#fff";
//     ctxAlpha.strokeStyle = "#fff";
//     // ctxAlpha.lineWidth = 1;
//     ctxAlpha.lineWidth = 0.1;
//     ctxAlpha.fillRect(0, 0, textureSizeAlpha * 2, textureSizeAlpha * 2);
//     // ctxAlpha.beginPath();
//     // ctxAlpha.moveTo(0, 0);
//     // ctxAlpha.lineTo(0, textureSize * 2);
//     // ctxAlpha.lineTo(textureSize * 2, textureSize * 2);
//     // ctxAlpha.lineTo(textureSize * 2, 0);
//     // ctxAlpha.closePath();
//     // ctxAlpha.fill();
//
//     ctxAlpha.save();
//
//     // ctxAlpha.translate(0.5, 0.5);
//     // ctxAlpha.translate(0, textureSize_half);
//     ctxAlpha.fillStyle = "#000";
//     ctxAlpha.strokeStyle = "#000";
//
//     this.GL.mesh.forEach(function (e) {
//       if (e.name.includes("Bevel")) //
//       {
//         let uv = e.getVerticesData(VertexBuffer.UVKind);
//         if (uv) {
//           i_l = uv.length;
//           for (i = 0; i < i_l; i += 2) {
//             uv[i] = 0.5 * uv[i];
//             uv[i + 1] = 0.25 + 0.5 * uv[i + 1];
//           }
//           e.updateVerticesData(VertexBuffer.UVKind, uv);
//
//           // i_l / 3 ---> Bevel besteht aus 3 Vertex-Reihen...gehe zur 2. Reihe
//           let iBegin = i_l / 3, iEnd = iBegin * 2;
//           let min = 1.0, max = 0.0, t;
//
//           let doOffset = false;
//
//           for (i = iBegin; i < iEnd; i += 2) {
//             t = uv[i + 1];
//             if (t < min) min = t;
//             else if (t > max) max = t
//           }
//           if (max - min > 0.25)
//             doOffset = true;
//
//           ctxAlpha.beginPath();
//           for (i = iBegin; i < iEnd; i += 2) {
//             u = Math.round(uv[i] * textureSizeAlpha * 2);
//             if (doOffset) {
//               t = uv[i + 1];
//               if (t < 0.25)
//                 t += 0.5;
//               v = Math.round((t) * textureSizeAlpha * 2);
//             } else
//               v = Math.round(uv[i + 1] * textureSizeAlpha * 2);
//
//             if (i == iBegin)
//               ctxAlpha.moveTo(u, v);
//             else
//               ctxAlpha.lineTo(u, v);
//           }
//           ctxAlpha.closePath();
//           ctxAlpha.fill();
//         }
//       } else if (e.name.includes("frontCut")) //
//       {
//         let pointsPerRow = parseInt(e.name.substring(9));
//
//         let uv = e.getVerticesData(VertexBuffer.UVKind);
//         if (uv) {
//           i_l = uv.length;
//           let numRows = i_l / (pointsPerRow * 2);
//
//           let getUVIndex = function (x: number, y: number): number {
//             return y * (2 * pointsPerRow) + x * 2;
//           }
//
//           ctxAlpha.beginPath();
//
//           u = Math.round(uv[0] * textureSizeAlpha * 2);
//           v = Math.round(uv[1] * textureSizeAlpha * 2);
//           ctxAlpha.moveTo(u, v);
//
//           for (let i = 1; i < numRows; i++) {
//             let j = getUVIndex(0, i);
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           for (let i = numRows - 1; i >= 0; i--) {
//             let j = getUVIndex(pointsPerRow - 1, i);
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           //    ctxAlpha.closePath();
//           ctxAlpha.fill();
//         }
//       } else if (e.name.includes("sideChannel")) //
//       {
//         let uv = e.getVerticesData(VertexBuffer.UVKind);
//         if (uv) {
//           // Eine Reihe vom sideChannel besteht aus 6 Punkten
//
//           i_l = uv.length;
//           let numRows = i_l / 12;
//
//           let getUVIndex = function (x: number, y: number): number {
//             return y * 2 * 6 + x * 2;
//           }
//
//           ctxAlpha.beginPath();
//
//           u = Math.round(uv[0] * textureSizeAlpha * 2);
//           v = Math.round(uv[1] * textureSizeAlpha * 2);
//           ctxAlpha.moveTo(u, v);
//
//
//           for (let i = 1; i < numRows; i++) {
//             let j = getUVIndex(0, i);
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           for (let i = numRows - 1; i >= 0; i--) {
//             let j = getUVIndex(5, i);
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           ctxAlpha.closePath();
//           ctxAlpha.fill();
//         }
//       } else if (e.name == "frontChannel") //
//       {
//         let uv = e.getVerticesData(VertexBuffer.UVKind);
//         if (uv) {
//           // Eine Reihe vom frontChannel besteht aus 7 Punkten
//
//           i_l = uv.length;
//           let numRows = i_l / 14;
//
//           let getUVIndex = function (x: number, y: number): number {
//             return y * 2 * 7 + x * 2;
//           }
//
//           ctxAlpha.beginPath();
//
//           u = Math.round(uv[0] * textureSizeAlpha * 2);
//           v = Math.round(uv[1] * textureSizeAlpha * 2);
//           ctxAlpha.moveTo(u, v);
//
//
//           for (let i = 1; i < numRows; i++) {
//             let j = getUVIndex(0, i);
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           for (let i = numRows - 1; i >= 0; i--) {
//             let j = getUVIndex(5, i);
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           ctxAlpha.closePath();
//           ctxAlpha.fill();
//         }
//       } else if (e.name == "frontChannel_H") //
//       {
//         let uv = e.getVerticesData(VertexBuffer.UVKind);
//         // console.log(uv);
//         if (uv) {
//           i_l = uv.length;
//           let numRows = 2;
//           let pointsPerRow = i_l / numRows;
//
//           // Front
//           ctxAlpha.beginPath();
//           // links unten
//           u = 0;
//           v = Math.round(uv[1] * textureSizeAlpha * 2);
//           ctxAlpha.moveTo(u, v);
//           // links hoch
//           for (let i = 1; i < numRows; i++) {
//             let j = i * pointsPerRow;
//             u = 0;
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           // oben
//           for (let i = 0; i < pointsPerRow; i += 2) {
//             let j = i_l - pointsPerRow + i;
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           ctxAlpha.lineTo(textureSizeAlpha, v);
//           //rechts
//           for (let i = 0; i < numRows; i++) {
//             let j = (numRows - 1 - i) * pointsPerRow;
//             u = textureSizeAlpha;
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           //unten
//           for (let i = pointsPerRow - 2; i >= 0; i -= 2) {
//             u = Math.round(uv[i] * textureSizeAlpha * 2);
//             v = Math.round(uv[i + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           ctxAlpha.lineTo(0, v);
//
//           ctxAlpha.closePath();
//           ctxAlpha.fill();
//
//           // Back
//           if (1) {
//             let uvBack = [];
//             uvBack.push(textureSizeAlpha, Math.round(uv[1] * textureSizeAlpha * 2));
//             uvBack.push(textureSizeAlpha, Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
//             uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
//             uvBack.push(textureSizeAlpha + Math.round(uv[0] * textureSizeAlpha * 2), Math.round(uv[1] * textureSizeAlpha * 2));
//
//             ctxAlpha.beginPath();
//             for (let i = 0; i < uvBack.length; i += 2) {
//               ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
//             }
//
//             ctxAlpha.closePath();
//             ctxAlpha.fill();
//
//             uvBack = [];
//             uvBack.push(textureSizeAlpha * 2, Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));
//             uvBack.push(textureSizeAlpha * 2, Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
//             uvBack.push(textureSizeAlpha + Math.round(uv[i_l - 2] * textureSizeAlpha * 2), Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
//             uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow - 2] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));
//
//             ctxAlpha.beginPath();
//             for (let i = 0; i < uvBack.length; i += 2) {
//               ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
//             }
//
//             ctxAlpha.closePath();
//             ctxAlpha.fill();
//           }
//         }
//       } else //
//       if (e.name == "crossChannelFront_alpha") //
//       {
//         let uv = e.getVerticesData(VertexBuffer.UVKind);
//
//         if (uv) {
//           i_l = uv.length;
//           // console.log(uv);
//           let numRows = 2;
//           let pointsPerRow = i_l / numRows;
//
//           // Front
//           ctxAlpha.beginPath();
//           // links hoch
//           for (let i = 0; i < numRows; i++) {
//             let j = i * pointsPerRow;
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             if (i == 0) ctxAlpha.moveTo(u, v);
//             else ctxAlpha.lineTo(u, v);
//           }
//           // oben
//           for (let i = 0; i < pointsPerRow; i += 2) {
//             let j = pointsPerRow + i;
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           //rechts
//           for (let i = numRows - 1; i >= 0; i--) {
//             let j = i * pointsPerRow + pointsPerRow - 2;
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           //unten
//           for (let i = pointsPerRow - 2; i >= 0; i -= 2) {
//             u = Math.round(uv[i] * textureSizeAlpha * 2);
//             v = Math.round(uv[i + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           ctxAlpha.closePath();
//           ctxAlpha.fill();
//         }
//       }
//       if (e.name == "crossChannelBack_alpha") //
//       {
//         let uv = e.getVerticesData(VertexBuffer.UVKind);
//
//
//         if (uv) {
//           i_l = uv.length;
//           let numRows = 3;
//           let pointsPerRow = i_l / numRows;
//
//           ctxAlpha.beginPath();
//           // links hoch
//           for (let i = 0; i < numRows; i++) {
//             let j = i * pointsPerRow;
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             if (i == 0) ctxAlpha.moveTo(u, v);
//             else ctxAlpha.lineTo(u, v);
//           }
//           // oben
//           for (let i = 2; i < pointsPerRow; i += 2) {
//             let j = (numRows - 1) * pointsPerRow + i;
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           //rechts
//           for (let i = numRows - 1; i >= 0; i--) {
//             let j = i * pointsPerRow + pointsPerRow - 2;
//             u = Math.round(uv[j] * textureSizeAlpha * 2);
//             v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//           //unten
//           for (let i = pointsPerRow - 2; i >= 0; i -= 2) {
//             u = Math.round(uv[i] * textureSizeAlpha * 2);
//             v = Math.round(uv[i + 1] * textureSizeAlpha * 2);
//             ctxAlpha.lineTo(u, v);
//           }
//
//           ctxAlpha.closePath();
//           ctxAlpha.fill();
//
//           // Back
//           /*
//                     if (1) {
//                       let uvBack = [];
//                       uvBack.push(textureSizeAlpha, Math.round(uv[1] * textureSizeAlpha * 2));
//                       uvBack.push(textureSizeAlpha, Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
//                       uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
//                       uvBack.push(textureSizeAlpha + Math.round(uv[0] * textureSizeAlpha * 2), Math.round(uv[1] * textureSizeAlpha * 2));
//
//                       ctxAlpha.beginPath();
//                       for (let i = 0; i < uvBack.length; i += 2) {
//                         ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
//                       }
//
//                       ctxAlpha.closePath();
//                       ctxAlpha.fill();
//
//                       uvBack = [];
//                       uvBack.push(textureSizeAlpha * 2, Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));
//                       uvBack.push(textureSizeAlpha * 2, Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
//                       uvBack.push(textureSizeAlpha + Math.round(uv[i_l - 2] * textureSizeAlpha * 2), Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
//                       uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow - 2] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));
//
//                       ctxAlpha.beginPath();
//                       for (let i = 0; i < uvBack.length; i += 2) {
//                         ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
//                       }
//
//                       ctxAlpha.closePath();
//                       ctxAlpha.fill();
//                     }
//           */
//         }
//       }
//     })
//
//     // this.GL.meshData.forEach(function (e)
//     // {
//     //     if (e.outline && e.type.includes("hannel"))
//     //         // if (e.outline && e.type == "channel")
//     //     {
//     //         vec = e.outline as CVertex[];
//     //         ctxAlpha.beginPath();
//     //
//     //         i_l = vec.length;
//     //         let outOfBounds = 0;
//     //
//     //         for (i = 0; i < i_l; i++)
//     //         {
//     //             u = Math.round(vec[i].u * textureSize);
//     //             v = vec[i].v;
//     //             if (v < 0 || v > 1) outOfBounds++;
//     //             v = Math.round(v * textureSize);
//     //             if (i == 0)
//     //                 ctxAlpha.moveTo(u, v);
//     //             else
//     //                 ctxAlpha.lineTo(u, v);
//     //         }
//     //         ctxAlpha.closePath();
//     //         ctxAlpha.fill();
//     //
//     //         if (outOfBounds > 0)
//     //         {
//     //             ctxAlpha.beginPath();
//     //             for (i = 0; i < i_l; i++)
//     //             {
//     //                 u = Math.round(vec[i].u * textureSize);
//     //                 v = textureSize + Math.round(vec[i].v * textureSize);
//     //                 if (i == 0)
//     //                     ctxAlpha.moveTo(u, v);
//     //                 else
//     //                     ctxAlpha.lineTo(u, v);
//     //             }
//     //
//     //             ctxAlpha.closePath();
//     //             ctxAlpha.fill();
//     //         }
//     //     }
//     // })
//
//     // ctxAlpha.lineWidth=5;
//     // ctxAlpha.beginPath();
//     // ctxAlpha.moveTo(0, textureSize_half);
//     // ctxAlpha.lineTo(textureSize*2, textureSize_half);
//     // ctxAlpha.stroke();
//     // ctxAlpha.restore();
//
//     // Kopien der Texturdaten nach oben und unten anfertigen
//     let imageDataTop = ctxAlpha.getImageData(0, 0, textureSizeAlpha * 2, textureSizeAlpha_half + 1);
//     let imageDataBottom = ctxAlpha.getImageData(0, textureSizeAlpha - 1, textureSizeAlpha * 2, textureSizeAlpha_half + 1);
//     let dataTop = imageDataTop.data, dataBottom = imageDataBottom.data;
//     i_l = Math.min(dataTop.length, dataBottom.length);
//     let a, b;
//     for (i = 0; i < i_l; i++) {
//       a = dataTop[i];
//       b = dataBottom[i];
//
//       if (a !== 255 || b !== 255)
//         dataBottom[i] = a < b ? a : b;
//     }
//     ctxAlpha.putImageData(imageDataBottom, 0, textureSizeAlpha);
//
//
//     this.GL.doubledTextures.alpha.update(false);
//
//     // erzeuge Downloadlink der Textur
//     if (this.GL.generateTextureDownloads && this.ringData.index === 0) {
//       let link = document.getElementById('download_texture_alpha');
//       if (link) {
//         link.setAttribute('download', 'alpha.png');
//         link.setAttribute('href', ctxAlpha.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
//       }
//     }
//     // <= Alpha
//
//
//     // => Bevel Alpha
//     let hasChannel = false;
//     this.ringData.stone.forEach(function (e: iPresetStone) {
//       if (e.mode == 30)
//         hasChannel = true;
//     })
//
//     if (USE_BEVEL_ALPHA && this.GL.doubledTextures.alphaBevel && this.context.alphaBevel) {
//       ctxAlpha = this.context.alphaBevel;// this.GL.doubledTextures.alphaBevel.getContext();
//       ctxAlpha.fillStyle = "#fff";
//       ctxAlpha.strokeStyle = "#fff";
//       ctxAlpha.lineWidth = 0.1;
//       ctxAlpha.beginPath();
//       ctxAlpha.moveTo(0, 0);
//       ctxAlpha.lineTo(0, textureSizeAlpha * 2);
//       ctxAlpha.lineTo(textureSizeAlpha * 2, textureSizeAlpha * 2);
//       ctxAlpha.lineTo(textureSizeAlpha * 2, 0);
//       ctxAlpha.closePath();
//       ctxAlpha.fill();
//
//       ctxAlpha.save();
//
//       ctxAlpha.translate(0, textureSizeAlpha_half);
//       ctxAlpha.fillStyle = "#000";
//       ctxAlpha.strokeStyle = "#000";
//
//       if (!hasChannel) {
//         this.GL.meshData.forEach(function (e) {
//           if (e.outline && e.type == "gap") {
//             // alpha für Bevel
//             vec = e.outline;
//             ctxAlpha.beginPath();
//
//             i_l = vec.length;
//             for (i = 1; i < i_l; i++) {
//               u = Math.round(vec[i].u * textureSizeAlpha);
//               v = Math.round(vec[i].v * textureSizeAlpha);
//               if (i == 0)
//                 ctxAlpha.moveTo(u, v);
//               else
//                 ctxAlpha.lineTo(u, v);
//             }
//
//             ctxAlpha.closePath();
//             ctxAlpha.fill();
//           }
//         })
//       }
//
//       ctxAlpha.restore();
//
//       // Kopien der Texturdaten nach oben und unten anfertigen
//       imageData = ctxAlpha.getImageData(0, textureSizeAlpha_half, textureSizeAlpha, textureSizeAlpha_half);
//       ctxAlpha.putImageData(imageData, 0, textureSizeAlpha + textureSizeAlpha_half);
//       imageData = ctxAlpha.getImageData(0, textureSizeAlpha, textureSizeAlpha, textureSizeAlpha_half);
//       ctxAlpha.putImageData(imageData, 0, 0);
//
//       this.GL.doubledTextures.alphaBevel.update(false);
//
//       // erzeuge Downloadlink der Textur
//       if (this.GL.generateTextureDownloads && this.ringData.index === 0) {
//         let link = document.getElementById('download_texture_alpha_bevel');
//         if (link) {
//           link.setAttribute('download', 'alpha_bevel.png');
//           link.setAttribute('href', ctxAlpha.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
//         }
//       }
//       // <=
//     }
//
//     let surfaceId: number;
//     let type: string;
//     this.GL.mesh.forEach(function (e) {
//       if (e.name.includes("alpha")) return;
//       // @ts-ignore
//       type = e.name.substring(0, 1);
//
//
//       if (e.name.startsWith("frontBevel")) {
//         type = "bev";
//         surfaceId = -2;
//       } else if (e.name.startsWith("frontChannel") || e.name.includes("crossChannel")) {
//         type = "frontChannel";
//         surfaceId = -2;
//       } else if (e.name.startsWith("frontCut") || e.name.startsWith("krabbe")) {
//         type = "frontCut";
//         surfaceId = -3;
//       } else if (e.name.startsWith("sideBevel") || e.name.startsWith("sideChannel")) {
//         type = "";
//         surfaceId = -2;
//       } else if (type == "f")
//         surfaceId = that.ringData.surface[parseInt(e.name.substring(1))];
//       else if (type == "b")
//         surfaceId = -1;
//       else if (e.name == "sl" || e.name == "sr")
//         surfaceId = 0;
//       else if (e.name == "gap")
//         surfaceId = that.ringData.gapSurface;
//       else
//         surfaceId = -99;
//
//       if (surfaceId >= -3) {
//         let mat = that.GL.material.find(function (e) {
//           return e.surfaceId == surfaceId;
//         });
//
//         if (mat) {
//           if (mat.material.bumpTexture) {
//             //@ts-ignore
//             mat.material.bumpTexture.uScale = that.ringData.ringWidth * mat.uScale / 1000;
//             //@ts-ignore
//             mat.material.bumpTexture.vScale = that.ringData.ringSize * mat.vScale / 1000;
//             //@ts-ignore
//             mat.material.bumpTexture.vOffset = 0.5;
//           }
//
//           if (DEBUG_UV_MAP_ENABLED) { // @ts-ignore
//             mat.material._albedoTexture = webgl.textureUV;
//           } else
//             mat.material._albedoTexture = that.GL.doubledTextures.albedo;
//
//           if (type === "f" || e.name == "gap" || type == "b") {
//             mat.material.opacityTexture = that.GL.doubledTextures.alpha;
//             mat.material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
//             mat.material.needDepthPrePass = true;
//           }
//           if (type === "frontChannel" || type == "frontCut") {
//             mat.material.opacityTexture = null;
//             mat.material.backFaceCulling = false;
//             // mat.material.transparencyMode = Material.MATERIAL_ALPHATEST;//ANDBLEND;
//             // mat.material.needDepthPrePass = false;
//           }
//           if (USE_BEVEL_ALPHA && type === "bev") {
//             mat.material.opacityTexture = that.GL.doubledTextures.alphaBevel;
//             mat.material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
//             mat.material.needDepthPrePass = false;
//           }
//
//           e.material = mat.material;
//         }
//       } else if (e.name == "helper") { // @ts-ignore
//         e.material = webgl.matWireframe;
//       }
//     })
//   }
//
//   calcPivotData() {
//     let v1 = TEMP.Vertex_1;
//     let v2 = TEMP.Vertex_2;
//     let v3 = TEMP.Vertex_3;
//     let v4 = TEMP.Vertex_4;
//     let v5 = TEMP.Vertex_5;
//     let a = this.ringData.ringWidth / 1000;
//     let b = (this.ringData.ringSize / Math.PI / 2 + this.ringData.ringHeight) / 1000;
//     this.GL.cameraData.radius = b;
//     let rot = AppComponent.app.data.webglSettings.ringRotationY[this.ringData.index] * Math.PI / 180.0; // deg -> rad
//
//     let camPosZ = -b * 5;
//     // => Kameraposition für die Screenshots berechnen
//     let left = false;
// //        for (i = 0, li = count(this.CFG.STONE); i < li; i++) {
// //            if (in_array(this.CFG.STONE[i].M, [40, 42, 44])) {
// //                left = 1;
// //                break;
// //            }
// //        }
//
//     let rotCamera = -Math.PI / 6;
//     if (left) rotCamera = -rotCamera;
//
//     v1.assign(0, 0, 0); // Pivot Position (z=0)
//     v2.assign(0, 0, 0); // Kamera Ziel (z=Mitte Ring)
//     v3.assign(0, 0, 0); // Hilfspunkt
//     v4.assign(0, 0, 0); // Kameraposition
//     v5.assign(0, 0, 0);
//
//     if (rot <= 0.0) {
//       v3.x = -a / 2;
//       v3.z = b;
//
//       v4.z = camPosZ;
//       v4.rotateY(rotCamera, v1);
//
//       v1.rotateY(rot, v3);
//       v4.rotateY(rot, v3);
//
//       v1.x -= v3.x;
//       v1.x += 0.2;
//       v1.z += AppComponent.app.data.webglSettings.ringOffsetZ[this.ringData.index]; // Pivot
//       v4.x -= v3.x;
//       v4.x += 0.2;
//       v4.z += AppComponent.app.data.webglSettings.ringOffsetZ[this.ringData.index]; // Pivot
//
//       v5.x = a;
//     } else {
//       v3.x = a / 2;
//       v3.z = b;
//
//       v4.z = camPosZ;
//       v4.rotateY(rotCamera, v1);
//
//       v1.rotateY(rot, v3);
//       v4.rotateY(rot, v3);
//
//       v1.x -= v3.x;
//       v1.x -= 0.2;
//       v1.z += AppComponent.app.data.webglSettings.ringOffsetZ[this.ringData.index]; // Pivot
//       v4.x -= v3.x;
//       v4.x -= 0.2;
//       v4.z += AppComponent.app.data.webglSettings.ringOffsetZ[this.ringData.index]; // Pivot
//
//       v5.x = -a;
//     }
//
//     v5.z = -b;
//     v5.rotateY(rot, v1);
//
//     // this.position = v1; => funktioniert nicht in JS !!
//     v1.toRef(this.GL.position);
//
//     v2 = v1;
//     v2.y = b; // Ringmittelpunkt -> Kameratarget
//     v2.toRef(this.GL.cameraData.target);
//
//     v4.y = b * 3;
//     v4.z += AppComponent.app.data.webglSettings.ringOffsetZ[this.ringData.index]; // Kameraposition für Screenshot
//     v4.toRef(this.GL.cameraData.position);
//
//     this.GL.cameraData.distance_x = v5.x;
//   }
//
//   update(mode: string | "all" | "material" = "all"): boolean {
//     if (!this.ringData.cartActive)
//       return true;
//
//     let that = this;
//
//     if (mode == "material") {
//       this.assignMaterials();
//       WebglComponent.WEBGL.renderFrame(AppComponent.app.data.webglSettings.forceFrames);
//
//       that.ringData.stone.forEach(function (e, index) {
//         if (that.GL.profile && that.GL.profile.stonePaths)
//           e.countReal = that.GL.profile.stonePaths[index].positions.length;
//       });
//
//       calcPrice(that.ringData).then(function (price: number) {
//         that.ringData.price = price;
//       });
//       // AppComponent.app.apiService.callback(function (data: any)
//       // {
//       //   that.ringData.price = data.price;
//       // }, "calcPrice", [that.ringData]);
//
//       return true;
//     } else {
//       let prf = Preload.prf;
//       let data = null;
//       for (let i = 0; i < prf.length; i++) {
//         if (prf[i].name.toLowerCase() == that.ringData.profileName.toLowerCase()) {
//           data = JSON.parse(prf[i].json);
//           break;
//         }
//       }
//
//       if (data) {
//         let time = getMilliseconds();
//         that.GL.profileResponse = data;
//         let sw = [0, 0];
//         if (that.ringData.stepMode == 1)
//           sw[0] = that.ringData.stepWidth[0];
//         else if (that.ringData.stepMode == 2)
//           sw[1] = that.ringData.stepWidth[1];
//         else if (that.ringData.stepMode == 3) {
//           sw[0] = that.ringData.stepWidth[0];
//           sw[1] = that.ringData.stepWidth[1];
//         }
//
//         let profile = cProfile.create(data, that.ringData.ringWidth, that.ringData.ringHeight, sw, that.ringData.stepDepth);
//
//         if (profile) {
//           let meshes = profile.extrude(that);
//           if (meshes) {
//             that.GL.profile = profile;
//             that.calcPivotData();
//             that.createMeshes(meshes, 0.001);
//             WebglComponent.WEBGL.renderFrame(AppComponent.app.data.webglSettings.forceFrames);
//           } else {
//             Log("error", "Profil konnte nicht extrudiert werden");
//           }
//         } else return false;
//         that.ringData.calcTime = Math.trunc(getMilliseconds() - time);
//
//         that.ringData.stone.forEach(function (e, index) {
//           if (that.GL.profile && that.GL.profile.stonePaths.length)
//             e.countReal = that.GL.profile.stonePaths[index].positions.length;
//         });
//
//         calcPrice(that.ringData).then(function (price: number) {
//           that.ringData.price = price;
//         });
//
//         // AppComponent.app.apiService.callback(function (data: any)
//         // {
//         //   that.ringData.price = data.price;
//         // }, "calcPrice", [that.ringData]);
//         return true;
//       } else
//         console.log("no profile data");
//     }
//
//     return false;
//   }
// }
