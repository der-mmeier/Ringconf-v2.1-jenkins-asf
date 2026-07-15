import {RingData} from "../app.ringdata";
import {
  Color3,
  CreatePlane,
  DynamicTexture,
  ICanvasRenderingContext, Material,
  Mesh,
  PBRMaterial, Quaternion,
  TransformNode, VertexBuffer,
  VertexData
} from "@babylonjs/core";
import {WebglComponent} from "./webgl.component";
import {calculateIntersection, CMesh, CVertex, iMeshData, iPathVectors, iPoint, TEMP} from "./threeD";
import {AppComponent, calcPrice, cyrb53} from "../app.component";
import {Preload} from "../app.preload";
import {
  iDivPreset, iFreeStone,
  iGapMode, iMaterial,
  iMinMaxCur,
  iPresetStone, iProfile,
  iProfileResponse,
  iStoneCalc,
  iStonePositionSegment,
  iStoneSize, iStoneCut, iSurface
} from "../app.interfaces";
import {Log} from "../logger/logger.component";
import {Matrix, Vector3} from "@babylonjs/core/Maths/math.vector";
import {iStoneCalcData, stoneCalc} from "./stoneCalc";
import {cMilgrain} from "./cMilgrain";
import {getStoneColorById, getStoneCuts} from "../stone-taxonomy";
import {formatCoordinates} from "../exterior-engraving";

export enum eRingFlags {
  None,
  IsValid = 1 << 1,
  IsComputing = 1 << 2,
  InvalidateMaterialOnly = 1 << 3,
  // UpdateVisibilityState = 1 << 4,
  // IgnoreNextHistoryPush = 1 << 5
}

interface iRingMaterial {
  surfaceId: number;
  material: PBRMaterial;
  uScale: number;
  vScale: number;
}

type EngravingSurface = "inner" | "outer";
type EngravingTextureTarget = "roughness" | "albedo";

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

function map(value: number, low1: number, high1: number, low2: number, high2: number) {
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

export class cRing {

  static list: cRing[] = [];

  ringData: RingData;
  flags: eRingFlags;
  static curStoneGroup: number = 0;
  texture: {
    albedo: DynamicTexture,
    alpha: DynamicTexture,
    alphaBevel: DynamicTexture,
    roughnessEngraving: DynamicTexture
  };
  context: {
    albedo: ICanvasRenderingContext,
    alpha: ICanvasRenderingContext,
    alphaBevel: ICanvasRenderingContext,
    roughnessEngraving: ICanvasRenderingContext
  };
  material: iRingMaterial[];
  pivot: TransformNode;
  position: CVertex;
  cameraData: {
    radius: number;
    target: CVertex;
    position: CVertex;
    distance_x: number;
  };

  profile: {
    response: iProfileResponse | null,
    heightFactor: number, // Verhältniss der Höhe zur Ringbreite laut OBJ Daten
    frontVertices: CVertex[],
    backVertices: CVertex[],
    channelVertices: CVertex[], // Index 12 in der blend/obj-Datei

    middleVertexBack: number[], // Anzahl der Punkte bis zur Mittellinie zwischen 3-6 und 5-8, ausgehend von der Front
    maxVerticeLength: number, // Länge der maximal abgewickelten front- oder backVertices

    sideLength: number[], // Die Seitenlänge für die maximale Steingröße wird durch den Abstand der Vektoren V[middleVertexBack[0]-1] und V[middleVertexBack[0]+1] ermittelt
    sideMidpoint: CVertex[] | null[],

    frontVerticeLength: number,
    backVerticeLength: number,

    stepLeftVertices: CVertex[],
    stepRightVertices: CVertex[],

    stonePaths: iPathVectors[],
  }

  meshData: iMeshData[];
  mesh: Mesh[];
  milgrain: cMilgrain;

  calc = {
    wa_mm: 0,
    waMax: 100,
    amp100: 0,
    swMax: [0, 0],
    rhMax: 0,
    gwMax: 0,
    divMinMax: [] as iMinMaxCur[],
    gapDivMinMax: [] as iMinMaxCur[],
    // stoneMinMaxCurSize: [] as iStonePositionSegment[],
    stone: [{
      minSizeOnGap: 0,
      maxSize: 9999,
      maxCount: 99,
      maxRow: 99,
    }] as iStoneCalc[],

    gapSafeLeft: 0, // vom Rand zur Fugenmitte
    gapSafeRight: 0,
    stoneSafeLeft: 0, // vom Ringrand zum Steinrand
    stoneSafeRight: 0,
    profileSideLength: [0, 0],

    area: 0,
    mm3: 0,

    outlineFront: [] as CVertex[][],
    outlineFrontMetarialIndex: [] as number[],
    outlineGap: [] as CVertex[][],

    lastComputed: 0,
  }

  stoneCalcData: iStoneCalcData | null = null;

  constructor(ringData: RingData) //
  {
    cRing.list.push(this);
    this.ringData = ringData;
    this.flags = eRingFlags.IsValid;

    let that = this;
    let webgl = WebglComponent.WEBGL;

    this.texture = {
      albedo: new DynamicTexture("doubled_albedo_front", webgl?.textureCanvas, webgl?.scene),
      // albedo: new DynamicTexture("doubled_albedo_front", {
      //   width: webgl.maxTextureSize_doubled,
      //   height: webgl.maxTextureSize_doubled,
      //   canvas: webgl.textureCanvas
      // }, webgl?.scene),
      alpha: new DynamicTexture("doubled_alpha_front", webgl?.alphaCanvas, webgl?.scene),
      // alpha: new DynamicTexture("doubled_alpha_front", {
      //   width: webgl.maxAlphaTextureSize_doubled,
      //   height: webgl.maxAlphaTextureSize_doubled,
      //   canvas: webgl.textureCanvas
      // }, webgl?.scene),
      alphaBevel: new DynamicTexture("doubled_alpha_bevel", webgl?.alphaCanvas, webgl?.scene),
      // alphaBevel: new DynamicTexture("doubled_alpha_bevel", {
      //   width: webgl.maxAlphaTextureSize_doubled,
      //   height: webgl.maxAlphaTextureSize_doubled,
      //   canvas: webgl.textureCanvas
      // }, webgl?.scene),
      // roughnessEngraving: new DynamicTexture("doubled_roughnessEngraving", /*webgl?.engravingCanvas, */webgl?.scene),
      roughnessEngraving: new DynamicTexture("doubled_roughnessEngraving", {
        width: webgl.maxTextureSize_doubled,
        height: webgl.maxTextureSize_doubled,
      }, webgl?.scene),
    }
    this.texture.albedo.gammaSpace = false;
    this.texture.alpha.getAlphaFromRGB = true;
    this.texture.alphaBevel.getAlphaFromRGB = true;

    this.context = {
      albedo: this.texture.albedo.getContext(),
      alpha: this.texture.alpha.getContext(),
      alphaBevel: this.texture.alphaBevel.getContext(),
      roughnessEngraving: this.texture.roughnessEngraving.getContext(),
    };

    this.material = [] as iRingMaterial[];
    AppComponent.app.data.surface.forEach(function (e) {
      //@ts-ignore
      let mat = new PBRMaterial(e.name, webgl.scene);
      // mat.albedoColor = new Color3(1, 1, 1);
      mat.metallic = e.material.metallic;
      mat.roughness = e.material.roughness;
      mat.metallicF0Factor = 0.0;
      mat.backFaceCulling = true;
      // mat.backFaceCulling = false;

      if (e.material.file !== undefined) {
        let T = Preload.surface.find(function (e1) {
          return e1.id == e.id;
        });

        if (T) {
          mat.bumpTexture = T.texture;
          if (e.material.invertX !== undefined)
            mat.invertNormalMapX = e.material.invertX;
          if (e.material.invertY !== undefined)
            mat.invertNormalMapY = e.material.invertY;
        } else
          console.log("no texture: " + e.material.file);
      }

      //@ts-ignore
      mat.reflectionTexture = webgl.envTexture;

      mat.albedoTexture = that.texture.albedo;
      if (e.id == 0) {
        mat.useRoughnessFromMetallicTextureAlpha = false;
        mat.useRoughnessFromMetallicTextureGreen = true;
        mat.useMetallnessFromMetallicTextureBlue = true;
        mat.metallicTexture = that.texture.roughnessEngraving;
      }

      // mat.environmentIntensity = 1.5; // Einstellung nur in V2 zum testen

      that.material.push({
        surfaceId: e.id,
        material: mat,
        uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
        vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
      });

      if (e.id == 0) // poliert...für Innenring und bevels
      {
        let M = mat.clone(e.name + '_back');
        M.useRoughnessFromMetallicTextureAlpha = false;
        M.useRoughnessFromMetallicTextureGreen = true;
        M.useMetallnessFromMetallicTextureBlue = true;
        M.metallicTexture = that.texture.roughnessEngraving;
        M.reflectionTexture = webgl.envTexture;
        that.material.push({
          surfaceId: -1,
          material: M,
          uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
          vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
        });

        M = mat.clone(e.name + '_bevel');
        M.albedoTexture = that.texture.albedo;
        M.opacityTexture = that.texture.alphaBevel;
        M.backFaceCulling = true;
        M.reflectionTexture = webgl.envTexture;
        that.material.push({
          surfaceId: -2,
          material: M,
          uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
          vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
        });

        M = mat.clone(e.name + '_cut');
        M.albedoTexture = that.texture.albedo;
        M.opacityTexture = that.texture.alphaBevel;
        M.backFaceCulling = true;
        M.reflectionTexture = webgl.envTexture;
        that.material.push({
          surfaceId: -3,
          material: M,
          uScale: (e.material.uScale ? e.material.uScale * 2 : 1.0),
          vScale: (e.material.vScale ? e.material.vScale * 2 : 1.0),
        });
      }
    })

    this.pivot = new TransformNode("", webgl?.scene);
    this.position = new CVertex();
    this.cameraData = {
      radius: 0,
      target: new CVertex(),
      position: new CVertex(),
      distance_x: 0,
    };

    this.profile = {
      response: null,
      heightFactor: 0, // Verhältniss der Höhe zur Ringbreite laut OBJ Daten
      frontVertices: [] as CVertex[],
      backVertices: [] as CVertex[],
      channelVertices: [] as CVertex[], // Index 12 in der blend/obj-Datei

      middleVertexBack: [0, 0], // Anzahl der Punkte bis zur Mittellinie zwischen 3-6 und 5-8, ausgehend von der Front
      maxVerticeLength: 1, // Länge der maximal abgewickelten front- oder backVertices

      sideLength: [0, 0], // Die Seitenlänge für die maximale Steingröße wird durch den Abstand der Vektoren V[middleVertexBack[0]-1] und V[middleVertexBack[0]+1] ermittelt
      sideMidpoint: [null, null],

      frontVerticeLength: 1,
      backVerticeLength: 1,

      stepLeftVertices: [] as CVertex[],
      stepRightVertices: [] as CVertex[],

      stonePaths: [] as iPathVectors[],
    };

    this.meshData = [];
    this.mesh = [];
    this.milgrain = new cMilgrain(this);

    setInterval(function () {
      if (that.ringData.isDirty) {
        that.flags &= ~eRingFlags.IsValid;
        that.compute();
      }

    }, 100);
  }

  private compute() //
  {
    let that = this;

    if (!this.ringData.cartActive) //
    {
      if (this.mesh.length) //
      {
        WebglComponent.busyCounter++;
        this.disposeMeshes();
        let webgl = WebglComponent.WEBGL;
        if (webgl) webgl.renderFrame(AppComponent.app.data.webglSettings.forceFrames);
        WebglComponent.busyCounter++;
      }

      return;
    }

    if ((this.flags & eRingFlags.IsValid) == eRingFlags.IsValid) return;

    let LogError = function (errorText: string) {
      Log("error", errorText);
      that.flags |= eRingFlags.IsValid;
      that.ringData.isDirty = false;
    }

    if (!function preComputeMeshes(): boolean {

      if ((that.flags & eRingFlags.InvalidateMaterialOnly) == eRingFlags.InvalidateMaterialOnly) return true;

      that.flags |= eRingFlags.IsComputing;

      that.profile.stonePaths = [] as iPathVectors[];

      let mDiv = that.ringData.materialDiv.slice(),
        profile = AppComponent.app.data.profile.find(function (e: iProfile) {
          return e.name == that.ringData.profileName;
        }),
        hasWave = function (): boolean {
          RingData.checkWave(that.ringData);
          let char = that.ringData.divPreset.substring(0, 1).toLowerCase();
          return char == "w" || char == "d";
        }(),
        removeWave = function () {
          let ar = that.ringData.divPreset.split(':');
          ar[0] = ar[0].toLowerCase();
          if (ar[0] == "w" || ar[0] == "d")
            ar[0] = "-";
          else if (ar[0] == "wf" || ar[0] == "df")
            ar[0] = "f";

          that.ringData.divPreset = ar.join(':');
          hasWave = false;
        },
        getLowerGW = function (): number | null {
          let gm = AppComponent.app.data.gapMode.find(function (e: iGapMode) {
            return e.id == that.ringData.gapMode;
          })

          if (gm) {
            let i, i_l = gm.width.length - 1;
            for (i = i_l; i >= 0; i--) {
              if (gm.width[i] < that.ringData.gapWidth) {
                return gm.width[i];
              }
            }
          }

          return null;
        },
        getSurface = function (index: number): iSurface | undefined {
          return AppComponent.app.data.surface.find(function (e) {
            return e.id == index;
          })
        },
        getMaterial = function (index: number): iMaterial | undefined {
          return AppComponent.app.data.material.find(function (e) {
            return e.id == index;
          })
        },
        get_sin = function (y: number, maxY: number, factor: number): number {
          return Math.sin(map(y, 0, maxY, 0, Math.PI * 2 * that.ringData.waveCount)) * factor;
        };

      if (!profile) {
        LogError("Profil '" + that.ringData.profileName + "' nicht gefunden");
        return false;
      }

      if (!function isPlausible(): boolean {
        // auf Welle prüfen
        if (hasWave && (profile.wa.max < 1 || profile.wc.max < 1)) {
          removeWave();
          Log("info", "Eine Welle oder Schräge ist bei diesem Profil nicht möglich.");
        }

        if (hasWave) {
          let changed = false;
          if (that.ringData.waveCount < profile.wc.min) //
          {
            that.ringData.waveCount = profile.wc.min;
            changed = true;
          } //
          else if (that.ringData.waveCount > profile.wc.max) //
          {
            that.ringData.waveCount = profile.wc.max;
            changed = true;
          }

          if (that.ringData.materialDiv.length > 2 && that.ringData.waveCount > profile.maxWaveCountMultipleWaves) {
            that.ringData.waveCount = profile.maxWaveCountMultipleWaves;
            changed = true;
          }

          if (changed)
            Log("info", "Die Wellenanzahl wurde angepasst");

          changed = false;
          if (that.ringData.waveAmp < profile.wa.min) //
          {
            that.ringData.waveAmp = profile.wa.min;
            changed = true;
          } //
          else if (that.ringData.waveAmp > profile.wa.max) //
          {
            that.ringData.waveAmp = profile.wa.max;
            changed = true;
          }

          if (that.ringData.materialDiv.length > 2 && that.ringData.waveAmp > profile.maxWaveAmpMultipleWaves) {
            that.ringData.waveAmp = profile.maxWaveAmpMultipleWaves;
            changed = true;
          }

          /**
           * prüfe den Steinbesatz auf Wellenbegrenzung und Amplitudenbegrenzung
           */
          if (1) {
            that.ringData.stone.forEach(function (stoneGroup: iPresetStone, stoneGroupIndex: number) {

              let stoneMode = AppComponent.app.data.stoneMode.find(e => {
                return e.mode == stoneGroup.mode;
              })
              if (stoneMode) {
                if (stoneMode.maxWaveCount != undefined && stoneMode.maxWaveCount < that.ringData.waveCount) {
                  that.ringData.waveCount = stoneMode.maxWaveCount;
                  Log("info", "Wellenanzahl aufgrund des Steinbesatzes angepasst");
                }
              }

              let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
                return (e.legacyId ?? e.id) == stoneGroup.type;
              })

              if (stoneType) {
                if (stoneType.maxWaveCount != undefined && stoneType.maxWaveCount < that.ringData.waveCount) {
                  that.ringData.waveCount = stoneType.maxWaveCount;
                  Log("info", "Wellenanzahl aufgrund des Steinbtyps angepasst");
                }
              }
            })
          }

          if (changed)
            Log("info", "Die Wellen- / Schrägenhöhe wurde angepasst");
        }

        let gapGapDistance = hasWave ? profile.gapGapDistanceWave : profile.gapGapDistance;

        if (that.ringData.ringWidth < profile.sideGapDistance * 2) {
          that.ringData.ringWidth = profile.sideGapDistance * 2;
          Log("info", "Die Ringbreite wurde angepasst.");
        }

        that.calc.rhMax = that.ringData.ringWidth * profile.rhMaxFactor;

        if (profile.syncRwRh) //
        {
          if (that.ringData.ringWidth != that.ringData.ringHeight) {
            that.ringData.ringHeight = that.ringData.ringWidth;
            Log("info", "Die Ringhöhe wurde an die Ringbreite angepasst.");
          }
        } //
        else if (that.ringData.ringHeight > that.calc.rhMax) //
        {
          that.ringData.ringHeight = that.calc.rhMax;
          Log("info", "Die Ringhöhe wurde im Verhältniss zur Ringbreite angepasst.");
        }

        // -> divPreset filtern
        let divPreset: iDivPreset | undefined;
        AppComponent.app.data.divPreset.forEach(e => {
          if (e.items) //
          {
            e.items.forEach(e2 => {
              if (e2.divPreset == that.ringData.divPreset)
                divPreset = e2;
            });
          } //
          else //
          {
            if (e.divPreset == that.ringData.divPreset)
              divPreset = e;
          }
        });

        if (divPreset) {
          if (divPreset.notProfile && divPreset.notProfile.indexOf(that.ringData.profileName) != -1) {
            that.ringData.divPreset = <string>AppComponent.app.data.divPreset[0].divPreset;
            Log("info", "Materialteilung für dieses Profil nicht zulässig");
          }
          if (divPreset.rwMin && divPreset.rwMin > that.ringData.ringWidth) {
            that.ringData.ringWidth = divPreset.rwMin;
            Log("info", "Die gewählte Materialteilung erfordert eine Mindestringbreite.");
          }
          if (divPreset.rhMin && divPreset.rhMin > that.ringData.ringHeight) {
            that.ringData.ringHeight = divPreset.rhMin;
            Log("info", "Die gewählte Materialteilung erfordert eine Mindestringhöhe.");
          }
        }
        // <- divPreset filtern

        // Material: Mindestgröße entsprechend der Teilungen prüfen
        let gwBefore = that.ringData.gapWidth,
          divCount = mDiv.length;

        /**
         * Ermittle die maximal mögliche Fugenbreite.
         * Nutze dazu die Teilungsbreiten und prüfe die Randabstände
         */
        if (0) {
          let availSpace: number[] = [];
          let lastIndex = mDiv.length - 1;
          mDiv.forEach((e, index) => {
            let t = map(e, 0, 10000, 0, that.ringData.ringWidth);
            console.log(e, t);
            if (index == 0 && index == lastIndex) {
              // @ts-ignore
              availSpace.push(t - profile.sideGapDistance * 2); // freier Platz für halbe Fugenbreite
            } else if (index == 0 || index == lastIndex) {
              // @ts-ignore
              availSpace.push(t - profile.sideGapDistance); // freier Platz für halbe Fugenbreite
            } else {
              // @ts-ignore
              availSpace.push((t - (hasWave ? profile.gapGapDistanceWave : profile.gapGapDistance)) / 2); // freier Platz für halbe Fugenbreite
            }
          })
          console.log(availSpace);

        }


        that.calc.gwMax = 10000;
        that.calc.wa_mm = 0;

        while (1) {
          let width = profile.sideGapDistance * 2 + that.ringData.gapWidth;

          if (mDiv.length > 2)
            width += (mDiv.length - 2) * (gapGapDistance * 2 + that.ringData.gapWidth);

          if (width > that.ringData.ringWidth) {
            let gw = getLowerGW();
            if (gw !== null) //
            {
              that.ringData.gapWidth = gw;
              continue;
            } //
            else if (mDiv.length > 1) //
            {
              mDiv.pop();
              continue;
            } //
            else //
            {
              Log("error", "Anpassung nicht möglich. Keine passende Fugenbreite.");
              that.ringData.divPreset = <string>AppComponent.app.data.divPreset[0].divPreset;
              mDiv = that.ringData.materialDiv.slice();
              break;
            }
          }

          break;
        }

        if (gwBefore != that.ringData.gapWidth) {
          Log("info", "Die Fugenbreite wurde angepasst.");
          that.calc.gwMax = that.ringData.gapWidth;
        }
        if (divCount > mDiv.length)
          Log("info", "Die Materialteilung wurde angepasst.");

        // Fugenart prüfen: Bei mehr als 1 Welle soll keine V-Fuge möglich sein
        if (that.ringData.waveCount > 1 && that.ringData.gapMode == 2) // V-Fuge
        {
          that.ringData.gapMode = 3; // U-Fuge
          Log("info", "Die Fugenart wurde angepasst.");
        }

        // Teilungssumme ermitteln
        let divSum = 0;
        mDiv.forEach(function (e: number) {
          divSum += e;
        });

        // Teilungssumme korrigieren -> Diese muss 10000 betragen
        mDiv.forEach(function (e: number, i: number) {
          mDiv[i] = Math.round((10000 * e) / divSum);
        })

        // Teilung in mm*1000 umrechnen
        mDiv.forEach(function (_e: number, i: number) {
          mDiv[i] = Math.round(mDiv[i] * that.ringData.ringWidth / 10000);
        })

        // Teilung auf Mindestabstände prüfen
        if (mDiv.length > 2) {
          let min = that.ringData.gapWidth + gapGapDistance;
          let minSide = that.ringData.gapWidth / 2 + profile.sideGapDistance;

          if (mDiv[0] < minSide) {
            let diff = minSide - mDiv[0];
            mDiv[0] = minSide;
            mDiv[1] -= diff;
          }
          if (mDiv[mDiv.length - 1] < minSide) {
            let diff = minSide - mDiv[mDiv.length - 1];
            mDiv[mDiv.length - 1] = minSide;
            mDiv[mDiv.length - 2] -= diff;
          }

          let i, il = mDiv.length - 1;
          for (i = 1; i < il; i++) {
            if (mDiv[i] < min) {
              if (min - mDiv[i] > 10)
                Log("info", "Teilungsanpassung (Fuge): min " + min);

              // console.log("before: " + mDiv[i - 1] + " " + mDiv[i] + " " + mDiv[i + 1]);
              let left = mDiv[i - 1];
              if (i == 1) left -= that.calc.gapSafeLeft;
              let right = mDiv[i + 1];
              if (i == mDiv.length - 2) right -= that.calc.gapSafeRight;

              // console.log("left: " + left + ", right: " + right);

              let sum = left + right;
              let factorLeft = left / sum;
              let factorRight = right / sum;


              let diff = min - mDiv[i];
              let diffLeft = Math.round(diff * factorLeft);
              let diffRight = Math.round(diff * factorRight);
              // console.log(diffLeft, diffRight);
              mDiv[i - 1] -= diffLeft;
              mDiv[i + 1] -= diffRight;
              mDiv[i] += diffLeft + diffRight;
              // console.log("after: " + mDiv[i - 1] + " " + mDiv[i] + " " + mDiv[i + 1]);

            }
          }
        }

        // Oberfläche
        divCount = mDiv.length;
        let lastSurface: iSurface | undefined = undefined;
        let surfaceAr = that.ringData.surface;
        mDiv.forEach(function (e: number, i: number) {
          let surface: iSurface | undefined = getSurface(surfaceAr[i]);
          if (surface) {
            if (surface.minSegmentWidth && surface.minSegmentWidth > e) {
              RingData.setSurface(that.ringData, i, 0);
              //that.ringData.surface[i] = 0;
              Log("info", "Materialbreite zu klein. Die Oberfläche '" + (i + 1) + "' wurde angepasst.");
            }
            if (surface.maxDivision && surface.maxDivision < divCount) {
              RingData.setSurface(that.ringData, i, 0);
              //that.ringData._surface[i] = 0;
              Log("info", "Materialanzahl zu groß. Die Oberfläche '" + (i + 1) + "' wurde angepasst.");
            }
          }

          // Feingehalt prüfen unf ggf ersetzen (ohne Meldung)
          let material = getMaterial(that.ringData.material[i]);
          if (material) {
            let finenessAr = that.ringData.fineness;
            let f = material.fineness.find(function (e) {
              return e == finenessAr[i];
            })
            if (!f) {
              RingData.setFineness(that.ringData, i, material.fineness[0]);
              //that.ringData.fineness[i] = material.fineness[0];
            }
          }

          // auf Inaktive Fugen prüfen
          if (i > 0 && lastSurface && surface) {
            if (!that.ringData.gapEnabled[i - 1]) {
              if (lastSurface.forceGap === true || surface.forceGap === true) {
                that.ringData.gapEnabled[i - 1] = 1;
                Log("info", "Trennfuge " + i + "' wurde aktiviert.");
              }
            }
          }

          lastSurface = surface;
        })

        // Feingehalt bei horizontaler und Segment-Teilung prüfen unf ggf ersetzen (ohne Meldung)
        let divMode = that.ringData.divPreset.substring(0, 1).toLowerCase();
        if (divMode == "h" || divMode == "s") {
          let material = getMaterial(that.ringData.material[1]);
          if (material) {
            let finenessAr = that.ringData.fineness;
            let f = material.fineness.find(function (e) {
              return e == finenessAr[1];
            })
            if (!f) {
              RingData.setFineness(that.ringData, 1, material.fineness[0]);
              //that.ringData.fineness[1] = material.fineness[0];
            }
          }
        }

        // Stufen
        if (!profile.sw) {
          if (that.ringData.stepMode > 0) {
            that.ringData.stepMode = 0;
            Log("info", "Bei dem gewählten Profil sind keine Stufen möglich");
          }
        }

        let sw_0 = (that.ringData.stepMode == 1 || that.ringData.stepMode == 3) ? that.ringData.stepWidth[0] : 0;
        let sw_1 = (that.ringData.stepMode == 2 || that.ringData.stepMode == 3) ? that.ringData.stepWidth[1] : 0;

        if (profile.sw) {
          let i;
          let remain = mDiv[0] - that.ringData.gapWidth / 2 - (sw_0 > 0 ? profile.gapGapDistance : profile.sideGapDistance);
          for (i = profile.sw.max; i > remain;) i -= profile.sw.step;

          if (that.ringData.stepMode == 1 || that.ringData.stepMode == 3) {
            if (i < profile.sw.min) {
              that.ringData.stepMode = that.ringData.stepMode == 1 ? 0 : 2;
              sw_0 = 0;
              Log("info", "Die linke Stufe wurde entfernt");
            } else {
              if (that.ringData.stepWidth[0] > i) {
                that.ringData.stepWidth[0] = i;
                Log("info", "Die linke Stufenbreite wurde angepasst");
              } else if (that.ringData.stepWidth[0] == 0)
                that.ringData.stepWidth[0] = i;

              sw_0 = that.ringData.stepWidth[0];
            }
          } else
            sw_0 = 0;

          that.calc.swMax[0] = i;

          remain = mDiv[mDiv.length - 1] - that.ringData.gapWidth / 2 - (sw_1 > 0 ? profile.gapGapDistance : profile.sideGapDistance);
          for (i = profile.sw.max; i > remain;) i -= profile.sw.step;

          if (that.ringData.stepMode == 2 || that.ringData.stepMode == 3) {
            if (i < profile.sw.min) {
              that.ringData.stepMode = that.ringData.stepMode == 2 ? 0 : 1;
              sw_1 = 0;
              Log("info", "Die rechte Stufe wurde entfernt");
            } else {
              if (that.ringData.stepWidth[1] > i) {
                that.ringData.stepWidth[1] = i;
                Log("info", "Die rechte Stufenbreite wurde angepasst");
              } else if (that.ringData.stepWidth[1] == 0)
                that.ringData.stepWidth[1] = i;

              sw_1 = that.ringData.stepWidth[1];
            }
          } else
            sw_1 = 0;

          that.calc.swMax[1] = i;

          if (sw_0 == 0 && sw_1 == 0 && that.ringData.stepMode != 0) {
            that.ringData.stepMode = 0;
            Log("info", "Die Stufen wurden entfernt");
          }

        }

        // calcSafe
        that.calc.stoneSafeLeft = sw_0 ? sw_0 + profile.gapGapDistance : profile.sideGapDistance;
        that.calc.stoneSafeRight = sw_1 ? sw_1 + profile.gapGapDistance : profile.sideGapDistance;
        that.calc.gapSafeLeft = that.calc.stoneSafeLeft /*+ profile.gapGapDistance*/ + that.ringData.gapWidth / 2;
        that.calc.gapSafeRight = that.calc.stoneSafeRight /*+ profile.gapGapDistance*/ + that.ringData.gapWidth / 2;
        that.calc.amp100 = (that.ringData.ringWidth / 2) - (that.calc.gapSafeLeft > that.calc.gapSafeRight ? that.calc.gapSafeLeft : that.calc.gapSafeRight);

        let waMaxLeft = (mDiv[0] - that.calc.gapSafeLeft) * 100 / that.calc.amp100;
        let waMaxRight = (mDiv[mDiv.length - 1] - that.calc.gapSafeRight) * 100 / that.calc.amp100;

        if (hasWave) //
        {
          if (that.ringData.waveAmp < profile.wa.min) that.ringData.waveAmp = profile.wa.min;
          if (profile.wa.max > 60) alert("Die maximale Amplitude des Profiles überschreitet 60% !");
          let max = Math.min(waMaxLeft, waMaxRight);
          let i;
          for (i = profile.wa.max; i > max;) i -= profile.wa.step;
          if (that.ringData.waveAmp > i) {
            that.ringData.waveAmp = i;
            // Log("info", "Die Wellen- / Schrägenhöhe wurde angepasst");
          }
          that.calc.waMax = i;
          that.calc.wa_mm = that.ringData.waveAmp * that.calc.amp100 / 100;

          let left = (mDiv[0] - that.calc.stoneSafeLeft - that.calc.wa_mm);
          let right = (mDiv[mDiv.length - 1] - that.calc.stoneSafeRight - that.calc.wa_mm);
          that.calc.gwMax = Math.min(left, right);
        } //

        let mDivMinMax = [] as iMinMaxCur[],
          handlePosition = [] as number[],
          pos = 0, i, i_l = mDiv.length - 1, t;

        for (i = 0; i < i_l; i++) {
          t = pos + mDiv[i];
          handlePosition.push(t);
          pos = t;
        }

        let lastIndex = handlePosition.length - 1,
          min,
          max;

        handlePosition.forEach(function (e, index) {
          if (index == 0) {
            min = that.calc.gapSafeLeft + that.calc.wa_mm;
            // min = that.calc.gapSafeLeft;
            if (index == lastIndex) {
              max = that.ringData.ringWidth - that.calc.gapSafeRight;
            } else {
              // @ts-ignore
              max = handlePosition[1] - gapGapDistance;
              if (that.ringData.gapEnabled[1]) max -= that.ringData.gapWidth;
            }
          } else if (index == lastIndex) {
            max = that.ringData.ringWidth - that.calc.gapSafeRight - that.calc.wa_mm;
            // max =that.ringData.ringWidth - that.calc.gapSafeRight;
            // @ts-ignore
            min = handlePosition[lastIndex - 1] + gapGapDistance;
            if (that.ringData.gapEnabled[lastIndex - 1]) min += that.ringData.gapWidth;
          } else {
            // @ts-ignore
            min = handlePosition[index - 1] + gapGapDistance;
            if (that.ringData.gapEnabled[index - 1]) min += that.ringData.gapWidth;

            // @ts-ignore
            max = handlePosition[index + 1] - gapGapDistance;
            if (that.ringData.gapEnabled[index + 1]) max -= that.ringData.gapWidth;
          }

          mDivMinMax.push({min, max, cur: e});
        });

        that.calc.divMinMax = mDivMinMax;

        // Neue Teilungswerte ermitteln: mm -> %
        mDiv.forEach(function (e: number, i: number) {
          mDiv[i] = Math.round(e * 10000 / that.ringData.ringWidth);
        })

        // Steine
        if (1) {
          let gapMode = AppComponent.app.data.gapMode.find(e => {
            return e.id == that.ringData.gapMode;
          });
          if (!gapMode) return false;

          that.ringData.stone.forEach(function (stoneGroup: iPresetStone, stoneGroupIndex: number) {

            if (stoneGroup.mode && profile && profile.stoneModes.indexOf(stoneGroup.mode) == -1) {
              stoneGroup.mode = 0;
              Log("info", "Gewählter Steinbesatz ist bei diesem Profil nicht zulässig");
              return;
            }

            let stoneMode = AppComponent.app.data.stoneMode.find(e => {
              return e.mode == stoneGroup.mode;
            })
            if (stoneMode) {
              if (stoneMode.minRingWidth != undefined && stoneMode.minRingWidth > that.ringData.ringWidth) {
                stoneGroup.mode = 0;
                Log("info", "Gewählter Steinbesatz erfordert eine Mindestringbreite von " + stoneMode.minRingWidth / 1000 + " mm");
                return;
              }

              if (stoneMode.maxGapWidth && stoneMode.maxGapWidth < that.ringData.gapWidth) {

                let t = 0;
                // @ts-ignore
                gapMode.width.forEach(e => {
                  // @ts-ignore
                  if (e <= stoneMode.maxGapWidth) t = e;
                })

                that.ringData.gapWidth = t;
                Log("info", "Die Fugenbreite wurde dem Steinbesatz angepasst");
              }
            }
          })
          // if (stoneModthat.ringData.gapWidth > stoneMode.)
          //   if (stoneGroup.mode == 31 || stoneGroup.mode == 35) {
          //     if (that.ringData.gapWidth > (<iGapMode>gapMode).width[0]) {
          //       that.ringData.gapWidth = (<iGapMode>gapMode).width[0];
          //       console.log("Fugenbreite dem Steinmodus angepasst!");
          //     }
          //   }
          // })
        }

        /*
                if (0) {
                  let resetStoneGroup = function (stoneGroup: iPresetStone) {
                    stoneGroup.mode = 0;
                    stoneGroup.type = 1;
                    stoneGroup.distribution = 0;
                    stoneGroup.size = 1000;
                    stoneGroup.rows = 1;
                    stoneGroup.count = 1;
                  }
                  let getLowerStoneSize = function (stoneType: iStoneCut, size: number): iStoneSize | undefined {
                    let result = undefined;
                    stoneType.size.forEach(function (e) {
                      if (e.calcSize && e.calcSize <= size)
                        result = e;
                      else if (e.size <= size)
                        result = e;
                    })

                    return result;
                  }
                  let getHigherOrEqualStoneSize = function (stoneType: iStoneCut, size: number): iStoneSize | undefined {
                    let result = [] as iStoneSize[];
                    stoneType.size.forEach(function (e) {
                      if (e.calcSize && e.calcSize >= size && e.minRingHeight <= that.ringData.ringHeight)
                        result.push(e);
                      else if (e.size >= size && e.minRingHeight <= that.ringData.ringHeight)
                        result.push(e);
                    })

                    return result[0];
                  }

                  let useSegments = true;

                  let calcStoneMinMaxCurSize = function () {
                    let gaps = [] as number[], sum = 0;

                    let test = [31, 35, 36];
                    if (!that.isDivMode_h_s() || test.includes(that.ringData.stone[cRing.curStoneGroup].mode)) // nicht bei segmentierten, horizontal geteilten Ring, Kanal quer und Spannring
                    {
                      // materialfugen in mm umrechnen
                      that.ringData.materialDiv.forEach(function (e) {
                        sum += e;
                        gaps.push(sum * that.ringData.ringWidth / 10000);
                      })
                    } else
                      gaps.push(that.ringData.ringWidth);

                    if (that.ringData.gapDiv.length) {
                      // freie Fugen in mm unrechnen
                      sum = 0;
                      that.ringData.gapDiv.forEach(e => {
                        sum += e;
                        gaps.push(sum * that.ringData.ringWidth / 10000);
                      })

                      // letztes Teilsegment entfernen, da dies bis zum rechten Ringrand reicht
                      gaps.pop();
                    }

                    // positionen sortieren
                    gaps.sort(function (a, b): number {
                      return a - b;
                    })

                    // MinMax-Werte berechnen unter Berücksichtigung der Sicherheitsabstände zum Ringrand,
                    // der Fugenbreiten, der Sicherheitsabstände der Fugen und eventuell vorhandener Wellenamplitude
                    let minMax = [] as iStonePositionSegment[];
                    let last = 0;
                    gaps.forEach(e => {
                      minMax.push({
                        min: last,
                        max: e,
                        middle: 0,
                        size: 0,
                        onGap: false
                      })
                      last = e;
                    })

                    let stepLeft = 0, stepRight = 0;

                    if (minMax.length && profile) {
                      let stepMode = that.ringData.stepMode;

                      if (stepMode == 1 || stepMode == 3)
                        stepLeft = that.ringData.stepWidth[0];
                      if (stepMode == 2 || stepMode == 3)
                        stepRight = that.ringData.stepWidth[1];


                      minMax[0].min += (stepLeft > 0 ? (stepLeft + profile.gapGapDistance) : profile.sideGapDistance);
                      minMax[minMax.length - 1].max -= (stepRight > 0 ? (stepRight + profile.gapGapDistance) : profile.sideGapDistance);
                      // minMax[0].min += (stepLeft > 0 ? (stepLeft + profile.gapGapDistance) : profile.sideGapDistance) + that.calc.wa_mm;
                      // minMax[minMax.length - 1].max -= (stepRight > 0 ? (stepRight + profile.gapGapDistance) : profile.sideGapDistance) + that.calc.wa_mm;
                      // minMax[0].min += (stepLeft + profile.sideGapDistance + that.calc.wa_mm);
                      // minMax[minMax.length - 1].max -= (stepRight + profile.sideGapDistance + that.calc.wa_mm);

                      let gapHalfAndSafe = that.ringData.gapWidth / 2 + profile.gapGapDistance;

                      if (minMax.length > 1) {
                        minMax[0].max -= gapHalfAndSafe;
                        minMax[minMax.length - 1].min += gapHalfAndSafe;
                      }

                      for (i = 1; i < minMax.length - 1; i++) {
                        minMax[i].min += gapHalfAndSafe;
                        minMax[i].max -= gapHalfAndSafe;
                      }
                    }

                    // Mittelwert von min/max berechnen
                    minMax.forEach(e => {
                      e.min = Math.trunc(e.min);
                      e.max = Math.trunc(e.max);
                      e.middle = Math.trunc(e.min + (e.max - e.min) / 2);
                      e.size = e.max - e.min; // Größe des möglichen Steinbesatzes
                    })

                    // minMax enthäht an dieser Stelle die Werte, um die Steine zwischen den Fugen zu platzieren
                    // min und max sind jeweils die die Außenkanten des Steines ohne Breücksichtigung der Steingröße

                    // ab hier erfolgt die Berechnung der Steinpositionierung Mittig auf den Fugen,
                    // wenn die Fugenbreite kleiner als 1.0mm ist
                    let minMax2 = [] as iStonePositionSegment[];


                    if (1) //ringData.gapWidth < 1000)
                    {
                      last = 0;
                      gaps.pop();
                      gaps.forEach(e => {
                        if (minMax2.length)
                          minMax2[minMax2.length - 1].max = e;

                        minMax2.push({
                          min: last,
                          max: 0,
                          middle: e,
                          size: 0,
                          onGap: true
                        })
                        last = e;
                      })

                      if (1 && minMax2.length && profile) {
                        // Durch das ignorieren der Wellenamplitude werden die Steine bis an der Ringrand ermöglicht. Sollte es zu
                        // einer überschreitung der Sicherheitsabstände am Ringrand kommen, wird die Steinanzahl reduziert.
                        minMax2[0].min = profile.sideGapDistance;// + that.calc.wa_mm;
                        minMax2[minMax2.length - 1].max = that.ringData.ringWidth - profile.sideGapDistance;//  - that.calc.wa_mm;

                        let gapHalfAndSafe = that.ringData.gapWidth / 2 + profile.gapGapDistance;
                        if (that.ringData.materialDiv.length > 1) {
                          minMax2[0].max -= gapHalfAndSafe;
                          minMax2[minMax2.length - 1].min += gapHalfAndSafe;
                        }

                        for (i = 1; i < minMax2.length - 1; i++) {
                          minMax2[i].min += gapHalfAndSafe;
                          minMax2[i].max -= gapHalfAndSafe;
                        }

                        minMax2.forEach(e => {
                          let a = e.middle - e.min,
                            b = e.max - e.middle;
                          if (a < b)
                            e.max = e.middle + a;
                          else
                            e.min = e.middle - b;

                          e.middle = Math.trunc(e.middle);
                          e.min = Math.trunc(e.min);
                          e.max = Math.trunc(e.max);
                          e.size = e.max - e.min; // Größe des möglichen Steinbesatzes
                        })
                      }
                    }
                    // nach Einfügeposition aufsteigend sortieren
                    let minMaxResult = minMax.concat(minMax2);
                    minMaxResult.sort(function (a, b) {
                      return a.middle - b.middle;
                    })

                    // zu kleine Segmente entfernen, ermittle dazu den kleinst möglichen Stein
                    let smallestStoneSize = 10000;
                    getStoneCuts(AppComponent.app.data).forEach(e => {
                      if (e.size[0].size < smallestStoneSize)
                        smallestStoneSize = e.size[0].size;
                    })

                    // Überschneidungen mit "Zwischenfugensegmenten" angleichen
                    for (i = 0, i_l = minMaxResult.length; i < i_l; i++) {
                      let e = minMaxResult[i];
                      if (e.onGap) {
                        if (i > 0) {
                          if (e.min < minMaxResult[i - 1].max)
                            e.min = minMaxResult[i - 1].max;
                        }
                        if (i < i_l - 1) {
                          if (e.max > minMaxResult[i + 1].min)
                            e.max = minMaxResult[i + 1].min;
                        }
                      }
                    }
                    // <=

                    // Zwischenspeichern, für den Fall, dass keine freien Zonen nach dem nächsten Schritt mehr vorhanden sind
                    let minMaxTemp: iStonePositionSegment[] = JSON.parse(JSON.stringify(minMaxResult));

                    for (i = 0; i < minMaxResult.length;) {
                      if (minMaxResult[i].size < smallestStoneSize) {
                        minMaxResult.splice(i, 1);
                        i = 0;
                        continue;
                      }
                      i++;
                    }

                    if (minMaxResult.length == 0) {
                      // Hier wird nach Zonen gesucht, die auf der Fuge liegen und die mögliche Größe so angepasst, dass ein Stein
                      // die angrenzenden Zwischenfugensegmente mit ausnutzt.
                      let i, i_l = minMaxTemp.length - 1;
                      for (i = 1; i < i_l; i++) {
                        if (minMaxTemp[i].onGap) {
                          minMaxTemp[i].size = minMaxTemp[i + 1].max - minMaxTemp[i - 1].min;
                          if (minMaxTemp[i].size >= smallestStoneSize) // nur einfügen, wenn auch ein Stein hineinpasst
                            minMaxResult.push(minMaxTemp[i]);
                        }
                      }
                    }

                    if (!useSegments) // entferne alle Segmente außer den ersten und letzten
                    {
                      let T: iStonePositionSegment[] = [] as iStonePositionSegment[],
                        last = minMaxResult[minMaxResult.length - 1];
                      T.push(minMaxResult[0]);

                      T[0].max = last.max;
                      T[0].onGap = false;
                      T[0].size = T[0].max - T[0].min;
                      T[0].middle = T[0].min + T[0].size / 2;
                      that.calc.stoneMinMaxCurSize = T;

                      return;
                    }

                    that.calc.stoneMinMaxCurSize = minMaxResult;
                  }

                  calcStoneMinMaxCurSize();

                  interface iStonePositionandMaxSize {
                    position: number;
                    maxSize: number;
                    onGap: boolean;
                  }

                  let getStonePositionandMaxSize = function (positionDiv: number[], useOnGapStonePositions: boolean, stoneSize: number): iStonePositionandMaxSize {
                    let sum = positionDiv.reduce(function (a, b) {
                      return a + b;
                    })

                    let posMM = that.ringData.ringWidth * positionDiv[0] / sum;

                    let minMax = that.calc.stoneMinMaxCurSize;

                    let segments = [] as number[][];
                    minMax.forEach(function (e, index) {
                      if (e.onGap && !useOnGapStonePositions)
                        return;

                      segments.push([Math.abs(posMM - e.middle), index]);
                    })

                    segments.sort(function (a, b) {
                      return a[0] - b[0];
                    })

                    let halfSize = stoneSize / 2;
                    // berücksichtige eine Steingröße von mindestens 1.0mm
                    if (halfSize < 500) halfSize = 500;

                    if (segments.length) {
                      let segment = minMax[segments[0][1]];
                      // let segment = minMax.find(e => {
                      //   return e.min <= posMM && e.max >= posMM;
                      // })

                      if (!segment)
                        segment = minMax[0];

                      if (segment) {
                        if (segment.onGap)
                          posMM = segment.middle;
                        else {
                          // if (posMM < segment.min)
                          //   posMM = segment.min + halfSize;
                          // else if (posMM > segment.max)
                          //   posMM = segment.max - halfSize;
                          if (posMM < segment.min + halfSize)
                            posMM = segment.min + halfSize;
                          else if (posMM > segment.max - halfSize)
                            posMM = segment.max - halfSize;
                        }

                        let a = posMM - segment.min,
                          b = segment.max - posMM,
                          maxSize = a < b ? a * 2 : b * 2;

                        if (segment.size > maxSize)
                          maxSize = segment.size;

                        return {
                          position: posMM,
                          maxSize: maxSize,
                          onGap: segment.onGap,
                        }
                      }
                    }

                    return {
                      position: 0,
                      maxSize: 0,
                      onGap: false
                    }
                  }

                  that.ringData.stone.forEach(function (stoneGroup: iPresetStone, stoneGroupIndex: number) {
                    if (stoneGroup.mode > 0) {
                      let adaptLoop = true;
                      let useOnGapStonePositions = true;

                      let test = [31, 35, 36];
                      if (test.indexOf(stoneGroup.mode) !== -1) {

                        if (that.ringData.materialDiv.length > 1 ||
                          that.ringData.gapDiv.length > 1) {
                          let gapMode = AppComponent.app.data.gapMode.find(e => {
                            return e.id == that.ringData.gapMode;
                          })
                          if (gapMode && that.ringData.gapWidth > gapMode.width[0]) {
                            that.ringData.gapWidth = gapMode.width[0];
                            Log("info", "Die Fugenbreite wurde angepasst");
                          }
                        }
                      }

                      while (adaptLoop) {
                        adaptLoop = false;

                        // Kombination Profil und Steinmodus zulässig?
                        if (profile && profile.stoneModes.indexOf(stoneGroup.mode) === -1) {
                          Log("info", "Die Kombination Profil/Steinbesatz ist nicht möglich (" + stoneGroupIndex + ").");
                          stoneGroup.mode = 0;
                          return;
                        }
                        let stoneMode = AppComponent.app.data.stoneMode.find(function (e) {
                          if (e.items) {
                            return e.items.find(function (e) {
                              return e.mode === stoneGroup.mode;
                            })
                          }

                          return e.mode == stoneGroup.mode;
                        })

                        if (!stoneMode) {
                          Log("error", "Der gewählte Steinmodus wurde nicht gefunden (" + stoneGroup.mode + ")");
                          resetStoneGroup(stoneGroup);
                          return;
                        }

                        if (stoneMode.minRingWidth && stoneMode.minRingWidth > that.ringData.ringWidth) {
                          if (stoneMode.alternativeMode) {
                            stoneGroup.mode = stoneMode.alternativeMode;
                            adaptLoop = true;
                            Log("info", "Der Steinmodus wurde aufgrund der Ringbreite angepasst.");
                            continue;
                          }
                        }
                        if (stoneMode.maxWaveCount && stoneMode.maxWaveCount < that.ringData.waveCount) {
                          that.ringData.waveCount = stoneMode.maxWaveCount;
                          Log("info", "Die Wellenanzahl wurde angepasst");
                        }

                        if (stoneMode.distribution && stoneGroup.distribution !== stoneMode.distribution) {
                          stoneGroup.distribution = stoneMode.distribution;
                          Log("info", "Die Steinverteilung wurde angepasst");
                        }

                        if (stoneGroup.distribution >= 33 && stoneGroup.count < 0) {
                          stoneGroup.count = 1;
                          Log("info", "Die Steinanzahl 'Drittel-, Halber- oder Ganzer Ring' ist bei der gewählten Steinverteilung nicht möglich. Bitte die Steinanzahl neu wählen.");
                        }

                        // Kombination Steinmodus und Steintyp zulässig?
                        let stoneType = getStoneCuts(AppComponent.app.data).find(function (e) {
                          return e.allowedStoneMode.indexOf(stoneGroup.mode) !== -1 && (e.legacyId ?? e.id) == stoneGroup.type;
                        })

                        if (!stoneType) {
                          stoneType = getStoneCuts(AppComponent.app.data).find(function (e) {
                            return (e.allowedStoneMode.indexOf(stoneGroup.mode) !== -1);
                          })

                          if (!stoneType) {
                            Log("error", "Kein Steintyp gefunden");
                            resetStoneGroup(stoneGroup);
                            return;
                          }

                          stoneGroup.type = Number(stoneType.legacyId ?? stoneType.id);
                          Log("info", "Die Steinart wurde angepasst");
                          adaptLoop = true;
                          continue;
                        }

                        // Steingröße zulässig?
                        let stoneSize = stoneType.size.find(function (e) {
                          return e.size == stoneGroup.size;
                        })

                        if (!stoneSize) {
                          stoneSize = getLowerStoneSize(stoneType, stoneGroup.size);
                          if (!stoneSize)
                            stoneSize = stoneType.size[0];
                        }

                        let rowStoneSize = stoneSize.size;
                        if (stoneGroup.rows > 1)
                          rowStoneSize = stoneSize.size * stoneGroup.rows + stoneMode.safeDistX * (stoneGroup.rows + 1);

                        let stonePositionandMaxSize = getStonePositionandMaxSize(stoneGroup.positionDiv, useOnGapStonePositions, rowStoneSize);

                        let rowsBefore = stoneGroup.rows;

                        while (stonePositionandMaxSize.maxSize < rowStoneSize && stoneGroup.rows > 1) {
                          stoneGroup.rows--;
                          rowStoneSize = stoneSize.size * stoneGroup.rows + stoneMode.safeDistX * (stoneGroup.rows + 1);
                          stonePositionandMaxSize = getStonePositionandMaxSize(stoneGroup.positionDiv, useOnGapStonePositions, rowStoneSize);
                        }

                        if (stonePositionandMaxSize.maxSize == 0) {
                          stoneGroup.mode = 0;
                          Log("info", "Kein Steinbesatz möglich");
                          return;
                        }

                        if (stoneGroup.rows != rowsBefore) {
                          Log("info", "Die Anzahl der Steinreihen wurde angepasst ");
                        }

                        if (stoneGroup.mode == 35 || stoneGroup.mode == 36) {
                          if (stoneGroup.count > 1) {
                            stoneGroup.count = 1;
                            Log("info", "Die Anzahl der Steine wurde angepasst");
                          }
                          stoneGroup.positionValue = 0;
                          RingData.setStonePositionValue(that.ringData, stoneGroupIndex, stoneGroup.positionValue, true);
                        }

                        // @ts-ignore
                        stoneGroup.positionValue = stonePositionandMaxSize.position;
                        RingData.setStonePositionValue(that.ringData, stoneGroupIndex, stoneGroup.positionValue, true);

                        if (stoneSize.minRingWidth > that.ringData.ringWidth || stoneSize.minRingHeight > that.ringData.ringHeight) {
                          // Stein zu groß, suche passende Größe
                          let newStoneSize: iStoneSize | undefined = undefined;
                          stoneType.size.forEach(function (e) {
                            if (e.minRingHeight <= that.ringData.ringHeight && e.minRingWidth <= that.ringData.ringWidth)
                              newStoneSize = e;
                          })

                          if (newStoneSize) {
                            Log("info", "Die Steingröße wurde angepasst (0x1)");
                            // @ts-ignore
                            console.log("adapt from " + stoneGroup.size + " to " + newStoneSize.size);
                            // @ts-ignore
                            stoneGroup.size = newStoneSize.size;
                            adaptLoop = true;
                            continue;
                          } else {
                            // Keine passende Steingröße für diese Steinart gefunden, versuche Steinart Brillant
                            if ((stoneType.legacyId ?? stoneType.id) != 1) {
                              Log("info", "Die Steinart wurde angepasst");
                              stoneGroup.type = 1;
                              adaptLoop = true;
                              continue;
                            } else {
                              Log("info", "Keinen passenden Steinbesatz gefunden (0x1)");
                              resetStoneGroup(stoneGroup);
                            }
                          }
                        }
                        if (stoneGroup.mode == 20 && stoneGroup.size * stoneGroup.rows > stonePositionandMaxSize.maxSize) {
                          let maxSize = stonePositionandMaxSize.maxSize / stoneGroup.rows;
                          let newStoneSize: iStoneSize | undefined = undefined;
                          stoneType.size.forEach(function (e) {
                            if (e.calcSize && e.calcSize <= maxSize)
                              newStoneSize = e;
                            else if (e.size <= maxSize)
                              newStoneSize = e;
                          })
                          if (newStoneSize) {
                            Log("info", "Die Steingröße wurde angepasst (0x2)");
                            // @ts-ignore
                            stoneGroup.size = newStoneSize.size;
                            adaptLoop = true;
                            continue;
                          } else {
                            // Keine passende Steingröße gefunden, reduziere die Anzahl der Reihen
                            if (stoneGroup.rows > 1) {
                              stoneGroup.rows--;
                              Log("info", "Die Anzahl der Reihen wurde angepasst");
                              adaptLoop = true;
                              continue;
                            } else {
                              Log("info", "Anpassung nicht möglich");
                              resetStoneGroup(stoneGroup);
                            }
                          }
                        } //
                        else if (stoneGroup.mode == 31 || stoneGroup.mode == 35 || stoneGroup.mode == 36) // keine Beschränkung bei Kanal quer und Spannring
                        {

                        } else if (stoneGroup.mode == 11) // freie Steine
                        {

                        } else if ((stoneSize.calcSize && stoneSize.calcSize > stonePositionandMaxSize.maxSize + 10) || (stoneGroup.size > stonePositionandMaxSize.maxSize + 10)) // +10 = Rundungsfehler blockieren 10 = 0.01mm
                        {
                          console.log(stoneSize, stonePositionandMaxSize);

                          // Stein zu groß, suche passende Größe
                          let newStoneSize: iStoneSize | null = null;
                          stoneType.size.forEach(function (e) {
                            if (e.calcSize) {
                              if (e.calcSize <= stonePositionandMaxSize.maxSize)
                                newStoneSize = e;
                            } else if (e.size <= stonePositionandMaxSize.maxSize)
                              newStoneSize = e;
                          })

                          if (newStoneSize) {
                            // @ts-ignore
                            if (stoneGroup.size == newStoneSize.size) {
                              Log("error", "Keine Anpassung möglich");
                              resetStoneGroup(stoneGroup);
                            } else {

                              Log("info", "Die Steingröße wurde angepasst (0x3)");
                              // @ts-ignore
                              stoneGroup.size = newStoneSize.size;
                              adaptLoop = true;
                              continue;
                            }
                          } else {
                            // Keine passende Steingröße für diese Steinart gefunden, versuche Steinart Brillant
                            if ((stoneType.legacyId ?? stoneType.id) != 1) {
                              Log("info", "Die Steinart wurde angepasst");
                              stoneGroup.type = 1;
                              adaptLoop = true;
                              continue;
                            } else {
                              Log("info", "Keinen passenden Steinbesatz gefunden (0x2)");
                              resetStoneGroup(stoneGroup);
                            }
                          }
                        }

                        let minStoneSizeOnGap = that.ringData.gapWidth + 600;
                        // let minStoneSizeOnGap =that.ringData.gapWidth * 2;
                        if (0 && profile && stonePositionandMaxSize.onGap) {//} &&that.ringData.materialDiv.length > 1 &&that.ringData.gapEnabled.indexOf(1) > -1) {
                          // Suche die Position der Steingruppe. Wenn diese in einer Fuge liegt, dann prüfe auf minimaler Steingröße.
                          if (stonePositionandMaxSize.onGap && stoneGroup.size < minStoneSizeOnGap) {
                            let size = getHigherOrEqualStoneSize(stoneType, minStoneSizeOnGap + 1);

                            if (size && size.size <= stonePositionandMaxSize.maxSize) {
                              stoneSize = size;
                            } else {

                              if (!useOnGapStonePositions) {
                                Log("info", "Keinen passenden Steinbesatz gefunden (0x3)");
                                resetStoneGroup(stoneGroup);
                              } else {
                                useOnGapStonePositions = false;
                                adaptLoop = true;
                                continue;
                              }
                            }
                          }
                        }

                        if (stoneGroup.mode > 0 && stoneSize.size !== stoneGroup.size) {
                          Log("info", "Die Steingröße wurde angepasst (0x4)");
                          stoneGroup.size = stoneSize.size;
                        }

                        let amp100 = (that.ringData.ringWidth / 2) - (that.calc.stoneSafeLeft > that.calc.stoneSafeRight ? that.calc.stoneSafeLeft : that.calc.stoneSafeRight);

                        let maxStoneSizeItem = getLowerStoneSize(stoneType, amp100 * 2);
                        let maxStoneSize = amp100 * 2;
                        if (maxStoneSizeItem) {
                          maxStoneSize = maxStoneSizeItem.size;

                          if (stoneGroup.size > amp100 * 2) {
                            stoneGroup.size = maxStoneSize;
                            Log("info", "initiale Steingröße angepasst (" + stoneGroup.size + ")" + amp100);
                          }
                        } else {
                          resetStoneGroup(stoneGroup);
                          Log("info", "Kein Steinbesatz möglich");
                        }

                        that.calc.stone[stoneGroupIndex].minSizeOnGap = minStoneSizeOnGap;
                        that.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;

                        if (stoneGroup.rows > 1) {
                          let get_lower_wa = function (profile: iProfile, wa: number) {
                            let result = profile.wa.min;
                            while (1) {
                              if (result + profile.wa.step > wa)
                                break;
                              result += profile.wa.step;
                            }

                            return result;
                          }

                          if (amp100 * that.ringData.waveAmp > 200000) {
                            let amp = 200000 / amp100;
                            // @ts-ignore
                            that.ringData.waveAmp = get_lower_wa(profile, amp / 100);
                            that.calc.waMax = that.ringData.waveAmp;
                            Log("info", "max Amplitude aufgrund der Steinreihen angepasst (" + that.ringData.waveAmp + ")");
                          }
                        }
                      }
                    }
                  })
                }
        */

        that.ringData.materialDiv = mDiv;
        that.gapDiv_calc();
        that.gapDiv_adapt();

        return true;
      }()) return false;

      // back
      // 9   10  11
      // 6   7   8
      // x---------
      // 3   4   5
      // 0   1   2
      // front
      //
      // ausgehend von 'x' für 'back' im Uhrzeigersinn und für 'front' gegen den Uhrzeigersinn
      //
      // für den Kanal: segment_10c

      // reset profile data
      that.profile = {
        response: null,
        heightFactor: 0, // Verhältniss der Höhe zur Ringbreite laut OBJ Daten
        frontVertices: [] as CVertex[],
        backVertices: [] as CVertex[],
        channelVertices: [] as CVertex[], // Index 12 in der blend/obj-Datei

        middleVertexBack: [0, 0], // Anzahl der Punkte bis zur Mittellinie zwischen 3-6 und 5-8, ausgehend von der Front
        maxVerticeLength: 1, // Länge der maximal abgewickelten front- oder backVertices

        sideLength: [0, 0], // Die Seitenlänge für die maximale Steingröße wird durch den Abstand der Vektoren V[middleVertexBack[0]-1] und V[middleVertexBack[0]+1] ermittelt
        sideMidpoint: [null, null],

        frontVerticeLength: 1,
        backVerticeLength: 1,

        stepLeftVertices: [] as CVertex[],
        stepRightVertices: [] as CVertex[],

        stonePaths: [] as iPathVectors[],
      };
      // <=

      if (!function getJsonProfileData(): boolean {
        that.profile.response = null;

        for (let i = 0, i_l = Preload.prf.length; i < i_l; i++) {
          if (Preload.prf[i].name.toLowerCase() == that.ringData.profileName.toLowerCase()) {
            that.profile.response = JSON.parse(Preload.prf[i].json);
          }
        }

        if (!that.profile.response) {
          LogError("No profile data (" + that.ringData.profileName + ")");
          return false;
        }

        return true;
      }()) return false;

      if (that.profile.response && !function computeProfile(): boolean {

        // that.profile.frontVertices = [] as CVertex[];
        // that.profile.backVertices = [] as CVertex[];
        // that.profile.channelVertices = [] as CVertex[];
        // that.profile.stepLeftVertices = [] as CVertex[];
        // that.profile.stepRightVertices = [] as CVertex[];

        // ermittle die Anzahl an gültigen Segmenten
        let segmentCount = 0;
        that.profile.response.xzs.forEach(function (e) {
          if (e != null) segmentCount++;
        })

        if (segmentCount == 2 || segmentCount == 3) //
        {
          if (that.profile.response.xzs[0] && that.profile.response.xzs[9]) {
            let setOrigin_topMiddle = function (vertices: CVertex[]) {
              let xHalf = (vertices[vertices.length - 1].x - vertices[0].x) / 2, z = -9999, x0 = vertices[0].x;
              vertices.forEach(e => {
                if (e.z > z) z = e.z;
              })
              for (let i = 0, i_l = vertices.length; i < i_l; i++) {
                vertices[i].x = vertices[i].x - x0 - xHalf;
                vertices[i].z -= z;
              }
            }

            let i, i_l, x = 0, z = 0, t;

            // that.profile.response.xzs[9] = back
            let backVertices = [] as CVertex[];
            for (i = 0, i_l = that.profile.response.xzs[9].length; i < i_l; i++) {
              if (i == 0) {
                x = that.profile.response.xzs[9][i].x;
                z = that.profile.response.xzs[9][i].z;
                t = new CVertex(0, 0, 0);
                backVertices.push(t);
              } else {
                t = new CVertex(that.profile.response.xzs[9][i].x - x, 0, that.profile.response.xzs[9][i].z - z)
                backVertices.push(t);
              }
            }

            setOrigin_topMiddle(backVertices);

            // that.profile.response.xzs[0] = front
            let frontVertices = [] as CVertex[];
            for (i = 0, i_l = that.profile.response.xzs[0].length; i < i_l; i++) {
              if (i == 0) {
                x = that.profile.response.xzs[0][i].x;
                z = that.profile.response.xzs[0][i].z;
                t = new CVertex(backVertices[0].x, 0, backVertices[0].z);
                frontVertices.push(t);
              } else {
                t = new CVertex(that.profile.response.xzs[0][i].x - x + backVertices[0].x, 0, that.profile.response.xzs[0][i].z - z + backVertices[0].z)
                frontVertices.push(t);
              }
            }

            // that.profile.response.xzy[12] = cross channel
            let channelVertices = [] as CVertex[];
            if (that.profile.response.xzs[12] != null) {
              for (i = 0, i_l = that.profile.response.xzs[12].length; i < i_l; i++) {

                if (i == 0) {
                  x = that.profile.response.xzs[12][i].x;
                  z = that.profile.response.xzs[12][i].z;
                  t = new CVertex(backVertices[0].x, 0, backVertices[0].z);
                  channelVertices.push(t);
                } else {
                  t = new CVertex(that.profile.response.xzs[12][i].x - x + backVertices[0].x, 0, that.profile.response.xzs[12][i].z - z + backVertices[0].z)
                  channelVertices.push(t);
                }
              }
            }

            let sizeFrontVertices: any = CVertex.getVerticesDimensions(frontVertices);
            let sizeBackVertices: any = CVertex.getVerticesDimensions(backVertices);

            let cxVertices = sizeFrontVertices.cx,
              czVertices = sizeFrontVertices.cz + sizeBackVertices.cz,
              scaleX = that.ringData.ringWidth / cxVertices,
              scaleZ = that.ringData.ringHeight / czVertices;

            for (i = 0, i_l = frontVertices.length; i < i_l; i++) frontVertices[i].scale([scaleX, 1, scaleZ]);
            for (i = 0, i_l = backVertices.length; i < i_l; i++) backVertices[i].scale([scaleX, 1, scaleZ]);

            if (channelVertices.length) {

              // let sizeChannelVertices: any = CVertex.getVerticesDimensions(channelVertices);
              // scaleZ = sizeChannelVertices.cz;

              for (i = 0, i_l = channelVertices.length; i < i_l; i++) channelVertices[i].scale([scaleX, 1, scaleZ]);
            }

            // BUG 09-2023: Kanaltiefe nicht einheitlich
            // verschiebe die Kanallinie auf die Frontlinie
            // nutze dazu die x-position 0
            if (1) {
              let vFront = cRing.interpolate(0, frontVertices);
              let vChannel = cRing.interpolate(0, channelVertices);
              let cz = vFront.z - vChannel.z;
              channelVertices.forEach(e => {
                e.z += cz;
              })
            }

            that.profile.frontVertices = frontVertices;
            that.profile.backVertices = backVertices;
            that.profile.channelVertices = channelVertices;
            that.profile.heightFactor = czVertices / cxVertices;
          } else {
            LogError("Keine gültigen Profildaten!");
            return false
          }
        } //
        else //
        {
          // ermittle die Ringhöhe durch den Abstand der mittleren Vertices aus den Segmenten 1 und 10 oder
          // aus den letzten Vertices aus den Segmenten 0 und 9
          let prfHeight = 0;

          if (that.profile.response.xzs[1] != null && that.profile.response.xzs[10] != null)
            prfHeight = Math.abs(that.profile.response.xzs[1][Math.round(that.profile.response.xzs[1].length / 2)].z - that.profile.response.xzs[10][Math.round(that.profile.response.xzs[10].length / 2)].z);
          else if (that.profile.response.xzs[0] != null && that.profile.response.xzs[9] != null)
            prfHeight = Math.abs(that.profile.response.xzs[0][that.profile.response.xzs[0].length - 1].z - that.profile.response.xzs[9][that.profile.response.xzs[9].length - 1].z);
          else
            return false;

          let i, j, v: CVertex[], x, z, cx, t: any;

          // konvertiere die Rohdaten in CVertex Klassen und verschieben auf den NUllpubkt
          let vertices: CVertex[][] = [] as CVertex[][];

          for (i = 0; i < that.profile.response.xzs.length; i++) {
            if (that.profile.response.xzs[i]) {
              vertices[i] = [] as CVertex[];
              x = z = 0;
              for (j = 0; j < that.profile.response.xzs[i].length; j++) {
                // ...und setze den 1. Vertex eines jeden Segmentes auf die Nullposition
                if (j == 0) {
                  x = that.profile.response.xzs[i][j].x;
                  z = that.profile.response.xzs[i][j].z;
                  t = new CVertex(0, 0, 0);
                  t.i = that.profile.response.xzs[i][j].s;
                  vertices[i].push(t);
                } else {
                  t = new CVertex(that.profile.response.xzs[i][j].x - x, 0, that.profile.response.xzs[i][j].z - z)
                  t.i = that.profile.response.xzs[i][j].s;
                  vertices[i].push(t);
                }
              }
            } else
              vertices.push([]);
          }

          // ermittle die Größen der Reihen und Spalten
          let rows = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
          // let cols = [[0, 3, 6, 9], [1, 4, 7, 10], [2, 5, 8, 11]];

          let rowsCX = [0, 0, 0, 0];
          // let colsCZ = [0, 0, 0, 0];

          // ...Reihen
          for (i = 0; i < 4; i++) {
            cx = 0.0;
            for (j = 0; j < 3; j++) {
              if (that.profile.response.size[rows[i][j]] != null)
                cx += that.profile.response.size[rows[i][j]].cx;
            }
            rowsCX[i] = cx;
          }

          // ...Spalten
          let profileOriginWidth = rowsCX.reduce(function (a, b) {
            return Math.max(a, b);
          });

          let profileOriginHeight = prfHeight;

          let t1, t2, scaleFactorX, scaleFactorZ;

          if (vertices[1] == null || vertices[10] == null) {
            t1 = that.ringData.ringWidth / profileOriginWidth;
            t2 = that.ringData.ringHeight / profileOriginHeight;

            scaleFactorX = Math.min(t1, t2);
            scaleFactorZ = scaleFactorX;
          } else {
            scaleFactorX = that.ringData.ringWidth / profileOriginWidth;
            scaleFactorZ = that.ringData.ringHeight / profileOriginHeight;
          }

          // profile.width = profileOriginWidth * scaleFactorX;
          // profile.height = profileOriginHeight * scaleFactorZ;

          // Skalierungsfaktor für die Segmente mit festem Seitenverhältniss (0, 2, 9, 11)
          let scaleFactorLocked;

          if (vertices[3].length == 0 && vertices[6].length == 0)
            scaleFactorLocked = scaleFactorZ;
          else
            scaleFactorLocked = Math.min(scaleFactorX, scaleFactorZ);

          // skalieren der Ecksegmente mit festem Seitenverhältniss
          let ar = [0, 2, 9, 11];
          for (i = 0; i < 4; i++) {
            v = vertices[ar[i]];
            for (j = 0; j < v.length; j++) {
              v[j].x *= scaleFactorLocked;
              v[j].z *= scaleFactorLocked;
            }

            t = CVertex.getVerticesDimensions(v);
            that.profile.response.size[ar[i]].cx = t.cx;
            that.profile.response.size[ar[i]].cz = t.cz;
            that.profile.response.size[ar[i]].length = CVertex.getVerticesLength(v);
          }

          // skalieren der Mittelspalte
          let scaleX, middleVertex;
          let V1 = TEMP.Vertex_1, v0, v1, v2, v3, v5, v6, v8, v10, v9, v11, vt = TEMP.Vertex_3;
          if (vertices[1].length > 0 && vertices[10].length > 0) {
            ar = [1, 10, 12];
            for (i = 0; i < 2; i++) {
              if (i == 0)
                scaleX = (that.ringData.ringWidth - that.profile.response.size[0].cx - that.profile.response.size[2].cx) / that.profile.response.size[1].cx;
              else
                scaleX = (that.ringData.ringWidth - that.profile.response.size[9].cx - that.profile.response.size[11].cx) / that.profile.response.size[10].cx;

              v = vertices[ar[i]];
              for (j = 0; j < v.length; j++) {
                v[j].x *= scaleX;
                v[j].z *= scaleFactorLocked;
              }

              t = CVertex.getVerticesDimensions(v);
              that.profile.response.size[ar[i]].cx = t.cx;
              that.profile.response.size[ar[i]].cz = t.cz;
              that.profile.response.size[ar[i]].length = CVertex.getVerticesLength(v);

              // Mittelpunkt auf 0:0 setzen
              middleVertex = Math.trunc(vertices[ar[i]].length / 2)
              // middleVertex = Math.trunc(that.profile.response.xzs[ar[i]].length / 2)

              vertices[ar[i]][middleVertex].toRef(V1);

              for (j = 0; j < v.length; j++)
                v[j].sub(V1);
            }

            // Segment 1 auf Profilhöhe verschieben
            V1.assign(0.0, 0.0, -that.ringData.ringHeight);
            v = vertices[1];
            for (i = 0; i < v.length; i++)
              v[i].add(V1);

            // Segment 12 auf Profilhöhe verschieben (Kanal)
            if (vertices[12].length) {
              v = vertices[12];

              // Mittelpunkt auf 0:0 setzen
              middleVertex = Math.trunc(vertices[12].length / 2)
              vertices[12][middleVertex].toRef(V1);

              for (j = 0; j < v.length; j++)
                v[j].sub(V1);

              V1.assign(0.0, 0.0, -that.ringData.ringHeight);
              // let t = Math.min(scaleFactorX, scaleFactorZ);
              for (j = 0; j < v.length; j++) {
                // v[j].x *= t;
                // v[j].z *= t;
                v[j].x *= scaleFactorX;
                v[j].z *= scaleFactorLocked;
                // v[j].z *= scaleFactorZ;
                v[j].add(V1);
              }
              that.profile.channelVertices = vertices[12];
            }
          }

          // Ecksegmente verschieben
          if (vertices[1].length > 0 && vertices[10].length > 0) {
            // Segment 0
            v1 = vertices[1];
            v1[0].toRef(vt);
            v0 = vertices[0];
            vt.sub(v0[v0.length - 1]);
            for (i = 0; i < v0.length; i++)
              v0[i].add(vt);
            // Segment 2
            v1[v1.length - 1].toRef(vt);
            v2 = vertices[2];
            vt.sub(v2[0]);
            for (i = 0; i < v2.length; i++)
              v2[i].add(vt);
            // Segment 9
            v10 = vertices[10];
            v10[0].toRef(vt);
            v9 = vertices[9];
            vt.sub(v9[v9.length - 1]);
            for (i = 0; i < v9.length; i++)
              v9[i].add(vt);
            // Segment 11
            v10[v10.length - 1].toRef(vt);
            v11 = vertices[11];
            vt.sub(v11[0]);
            for (i = 0; i < v11.length; i++)
              v11[i].add(vt);
          } else {
            // Segment 9
            vt.assign(0.0, 0.0, 0.0);
            v9 = vertices[9];
            vt.sub(v9[v9.length - 1]);
            for (i = 0; i < v9.length; i++)
              v9[i].add(vt);
            // Segment 0
            v0 = vertices[0];
            v9[0].toRef(vt);
            for (i = 0; i < v0.length; i++)
              v0[i].add(vt);

            // Segment 11
            vt.assign(0.0, 0.0, 0.0);
            v11 = vertices[11];
            vt.sub(v11[0]);
            for (i = 0; i < v11.length; i++)
              v11[i].add(vt);
            // Segment 2
            v2 = vertices[2];
            v11[v11.length - 1].toRef(vt);
            vt.sub(v2[v2.length - 1]);
            for (i = 0; i < v2.length; i++)
              v2[i].add(vt);
          }

          if (vertices[3].length > 0 && that.profile.response.size[6] != null) {
            // Segmente 3 und 6 skalieren und verschieben
            let scale = Math.abs(vertices[0][0].z - vertices[9][0].z) / Math.abs(that.profile.response.size[3].cz + that.profile.response.size[6].cz);

            ar = [3, 6];
            for (i = 0; i < 2; i++) {
              v = vertices[ar[i]];
              for (j = 0; j < v.length; j++)
                v[j].scale([scaleFactorLocked, 1.0, scale]);

              t = CVertex.getVerticesDimensions(v);
              that.profile.response.size[ar[i]].cx = t.cx;
              that.profile.response.size[ar[i]].cz = t.cz;
              that.profile.response.size[ar[i]].length = CVertex.getVerticesLength(v);
            }

            v0 = vertices[0];
            v3 = vertices[3];
            v0[0].subToRef(v3[v3.length - 1], vt);
            for (i = 0; i < v3.length; i++)
              v3[i].add(vt);

            v9 = vertices[9];
            v6 = vertices[6];
            v9[0].subToRef(v6[v6.length - 1], vt);
            for (i = 0; i < v6.length; i++)
              v6[i].add(vt);
          }

          if (vertices[5].length > 0 && that.profile.response.size[8] != null) {
            // Segmente 5 und 8 skalieren und verschieben
            let scale = Math.abs(vertices[2][vertices[2].length - 1].z - vertices[11][vertices[11].length - 1].z) / Math.abs(that.profile.response.size[5].cz + that.profile.response.size[8].cz);

            ar = [5, 8];
            for (i = 0; i < 2; i++) {
              v = vertices[ar[i]];
              for (j = 0; j < v.length; j++)
                v[j].scale([scaleFactorLocked, 1.0, scale]);

              t = CVertex.getVerticesDimensions(v);
              that.profile.response.size[ar[i]].cx = t.cx;
              that.profile.response.size[ar[i]].cz = t.cz;
              that.profile.response.size[ar[i]].length = CVertex.getVerticesLength(v);
            }

            v2 = vertices[2];
            v5 = vertices[5];
            v2[v2.length - 1].subToRef(v5[0], vt);
            for (i = 0; i < v5.length; i++)
              v5[i].add(vt);

            v11 = vertices[11];
            v8 = vertices[8];
            v11[v11.length - 1].subToRef(v8[0], vt);
            for (i = 0; i < v8.length; i++)
              v8[i].add(vt);
          }

          let reverse_vertices = function (V: CVertex[]) {
            let c = V.length;
            let half = Math.trunc(c / 2);
            for (i = 0; i < half; i++) {
              V[i].toRef(V1);
              V[c - 1 - i].toRef(V[i]);
              V1.toRef(V[c - 1 - i]);
            }
          };

          if (vertices[0][0].i == 0) // is front ?
          {
            if (vertices[1].length > 0) {
              vertices[1][0].toRef(vertices[0][vertices[0].length - 1]);
              vertices[1][vertices[1].length - 1].toRef(vertices[2][0]);
            } else {
              vertices[2][0].toRef(vertices[0][vertices[0].length - 1]);
            }

            if (vertices[1].length) {
              vertices[1] = vertices[1].slice(1, vertices[1].length - 1);
            }

            vertices[0].pop();
            that.profile.frontVertices = vertices[0].concat(vertices[1]);
            that.profile.frontVertices.pop();
            that.profile.frontVertices = that.profile.frontVertices.concat(vertices[2]);

            if (vertices[10].length) {
              vertices[10][0].toRef(vertices[9][vertices[9].length - 1]);
              vertices[10][vertices[10].length - 1].toRef(vertices[11][0]);
            } else {
              vertices[2][0].toRef(vertices[0][vertices[0].length - 1]);
            }

            if (vertices[10].length) {
              vertices[10] = vertices[10].slice(1, vertices[10].length - 1);
            }

            vertices[9].pop();
            that.profile.backVertices = vertices[9].concat(vertices[10]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[11]);
          } //
          else //
          {
            reverse_vertices(vertices[0]);
            reverse_vertices(vertices[2]);
            reverse_vertices(vertices[3]);
            reverse_vertices(vertices[5]);

            ar = [0, 3, 6, 9, 10, 11, 8, 5, 2];

            for (i = 1; i < ar.length; i++) {
              vertices[ar[i - 1]][vertices[ar[i - 1]].length - 1].toRef(vertices[ar[i]][0]);
            }

            vertices[0][0].toRef(vertices[1][0]);
            vertices[2][vertices[2].length - 1].toRef(vertices[1][vertices[1].length - 1]);

            that.profile.frontVertices = vertices[1];

            vertices[0].pop();
            that.profile.backVertices = vertices[0].concat(vertices[3]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[6]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[9]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[10]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[11]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[8]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[5]);
            that.profile.backVertices.pop();
            that.profile.backVertices = that.profile.backVertices.concat(vertices[2]);
          }

          // prüfen, ob z-Werte "kleiner" als die Ringhöhe sind und verschiebe die Vertices entsprechend
          // Dies ist bei Profilen der Fall, wo die Segmente 0 und 2 "höher" sind als das Segment 1.
          let minZ = -that.ringData.ringHeight;
          that.profile.frontVertices.forEach(function (e) {
            if (e.z < minZ) minZ = e.z;
          });

          if (minZ < -that.ringData.ringHeight) {
            let diff = minZ + that.ringData.ringHeight;
            that.profile.frontVertices.forEach(function (e) {
              e.z -= diff;
            });
            that.profile.backVertices.forEach(function (e) {
              e.z -= diff;
            });
            that.profile.channelVertices.forEach(function (e) {
              e.z -= diff;
            });
          }

          if (0) // Mindestwinkel zwischen 3 Vektoren prüfen; Dies soll "Knicke" im Profil verhindern
          {
            let calculateAngleBetweenvs = function (v1: CVertex, v2: CVertex, pivot: CVertex): number {
              // Calculate the differences between the vs and the pivot point
              const diff1 = [v1.x - pivot.x, v1.z - pivot.z];
              const diff2 = [v2.x - pivot.x, v2.z - pivot.z];

              // Calculate the magnitudes of the differences
              const mag1 = Math.sqrt(diff1[0] ** 2 + diff1[1] ** 2);
              const mag2 = Math.sqrt(diff2[0] ** 2 + diff2[1] ** 2);

              // Calculate the dot product of the two differences
              const dotProduct = diff1[0] * diff2[0] + diff1[1] * diff2[1];

              let t = dotProduct / (mag1 * mag2);
              // Calculate the angle between the vs in radians
              const angleInRadians = Math.acos(dotProduct / (mag1 * mag2));

              if (isNaN(angleInRadians))
                console.log(t, dotProduct, mag1, mag2);

              // Return the angle in degrees
              return angleInRadians * (180 / Math.PI);
            }


            let adjustMiddleVertexToMinimumAngle = function (v1: CVertex, v2: CVertex, v3: CVertex, minAngleInDegrees: number) {
              // Calculate the angle between v1 and v2
              const angle1 = calculateAngleBetweenvs(v1, v3, v2);

              // Calculate the angle between v2 and v3
              // const angle2 = calculateAngleBetweenvs(v2, v3, v2);

              // console.log(angle1, angle2);

              // Calculate the difference between v2 and v1
              const diff1 = [v2.x - v1.x, v2.z - v1.z];

              // Calculate the difference between v3 and v2
              const diff2 = [v3.x - v2.x, v3.z - v2.z];

              // Calculate the dot product of the two differences
              const dotProduct = diff1[0] * diff2[0] + diff1[1] * diff2[1];

              // Calculate the magnitudes of the two differences
              const mag1 = Math.sqrt(diff1[0] ** 2 + diff1[1] ** 2);
              const mag2 = Math.sqrt(diff2[0] ** 2 + diff2[1] ** 2);

              // Calculate the maximum angle between the two vs in radians
              const maxAngleInRadians = Math.min(Math.PI - minAngleInDegrees * (Math.PI / 180), Math.acos(dotProduct / (mag1 * mag2)));

              // if (isNaN(angle1))
              //   return;

              // console.log(angle1);

              // If the actual angle is less than the minimum angle, adjust the middle v
              if (angle1 < minAngleInDegrees/* * (Math.PI / 180)*//* || angle2 < minAngleInDegrees * (Math.PI / 180)*/) {
                const maxDiffMag = mag1 * Math.tan(maxAngleInRadians / 2) + mag2 * Math.tan(maxAngleInRadians / 2);
                const maxDiff = [diff1[0] / mag1 * maxDiffMag, diff1[1] / mag1 * maxDiffMag];
                // console.log("before: "+v2.x+" "+v2.z);
                v2.x += maxDiff[0];
                v2.z += maxDiff[1];
                // console.log("after : "+v2.x+" "+v2.z);
                // const newv2 = [v2.x + maxDiff[0], v2.z + maxDiff[1]];
                // return newv2;
              }

              // If the actual angle is greater than or equal to the minimum angle, return the original middle v
              // return v2;
            }

            let i, i_l = that.profile.frontVertices.length - 2;
            for (i = 1; i < i_l; i++) {
              adjustMiddleVertexToMinimumAngle(
                that.profile.frontVertices[i - 1],
                that.profile.frontVertices[i],
                that.profile.frontVertices[i + 1],
                175
              );
            }
          }

          // Anfangs und Endpunkte gleichsetzen
          {
            let A: CVertex[] = that.profile.frontVertices, B: CVertex[] = that.profile.backVertices;
            B[0].x = A[0].x;
            B[0].z = A[0].z;
            B[B.length - 1].x = A[A.length - 1].x;
            B[B.length - 1].z = A[A.length - 1].z;
          }

          if (vertices[0].length && vertices[3].length)
            that.profile.middleVertexBack[0] = vertices[0].length + vertices[3].length - 1;

          if (vertices[2].length && vertices[5].length)
            that.profile.middleVertexBack[1] = vertices[2].length + vertices[5].length - 2;

          that.profile.heightFactor = profileOriginHeight / profileOriginWidth;
        }

        let stepLeftIndex = null, stepRightIndex = null;

        // Stufen berechnen
        let sw = [0, 0], sd = that.ringData.stepDepth;
        if (that.ringData.stepMode == 1)
          sw[0] = that.ringData.stepWidth[0];
        else if (that.ringData.stepMode == 2)
          sw[1] = that.ringData.stepWidth[1];
        else if (that.ringData.stepMode == 3) {
          sw[0] = that.ringData.stepWidth[0];
          sw[1] = that.ringData.stepWidth[1];
        }

        let IP;

        if (sw[0] > 0.0) {
          IP = cRing.interpolate(that.profile.frontVertices[0].x + sw[0], that.profile.frontVertices);

          // Vectoren für die linke Stufe sichern
          let vec3Before = that.profile.frontVertices.slice(0, IP.indexVectorA + 1);

          // front Vectoren neu zuweisen
          that.profile.frontVertices = that.profile.frontVertices.slice(IP.indexVectorB);

          // Stufenvectoren anpassen
          let z = IP.z + sd, i, i_l = vec3Before.length, v: CVertex;

          // Der Übergang vom Profil zur Stufe muss scharfkantig sein. Deshalb wird hier ein extra Vector an der
          // Übergangsstelle gesetzt (gedoppelt), damit die Normalen entsprechen berechnet werden können.
          let ar = [], edge = false;
          for (i = 0; i < i_l; i++) {
            v = vec3Before[i];
            if (v.z < z) {
              v.z = z;
              if (!edge) {
                ar.push(v);
                edge = true;
              }
            }
            ar.push(v);
          }
          vec3Before = ar;

          // Eckpunkte hinzufügen; doppelt für die Normalen
          vec3Before.push(new CVertex(IP.x, 0.0, z));
          vec3Before.push(new CVertex(IP.x, 0.0, z));
          vec3Before.push(new CVertex(IP.x, 0.0, IP.z));

          // 1 x für Front
          vec3Before.push(new CVertex(IP.x, 0.0, IP.z));

          stepLeftIndex = vec3Before.length - 1; // abzgl. 1 x Front

          // zusammenführen für die U-Wert Berechnung
          that.profile.frontVertices = vec3Before.concat(that.profile.frontVertices);

          i_l = that.profile.backVertices.length;
          for (i = 0; i < i_l; i++) {
            v = that.profile.backVertices[i];
            // if (v.x > IP.x) break;
            if (v.z < z) v.z = z;
            else break;
          }

          if (i > 1) {
            that.profile.middleVertexBack[0] -= (i - 1);

            if (that.profile.middleVertexBack[0] < 0)
              that.profile.middleVertexBack[0] = 0;

            let ar = that.profile.backVertices.slice(i);
            ar.unshift(CVertex.fromVertex(vec3Before[0]));
            ar[0].x = that.profile.backVertices[i].x;
            vec3Before[0].x = ar[0].x;

            for (i = 0; i < ar.length; i++)
              ar[i].i = i + 1;
            that.profile.backVertices = ar;
          }
        }
        if (sw[1] > 0.0) {
          IP = cRing.interpolate(that.profile.frontVertices[that.profile.frontVertices.length - 1].x - sw[1], that.profile.frontVertices);

          // Vectoren für die rechte Stufe sichern
          let vec3After = that.profile.frontVertices.slice(IP.indexVectorB);

          // front Vectoren neu zuweisen
          that.profile.frontVertices = that.profile.frontVertices.slice(0, IP.indexVectorA + 1);

          // Stufenvectoren anpassen
          let z = IP.z + sd, i, i_l = vec3After.length, v: CVertex;

          // Der Übergang vom Profil zur Stufe muss scharfkantig sein. Deshalb wird hier ein extra Vector an der
          // Übergangsstelle gesetzt (gedoppelt), damit die Normalen entsprechen berechnet werden können.
          let ar = [], edge = false;

          for (i = 0; i < i_l; i++) {
            v = vec3After[i];
            if (v.z < z) {
              v.z = z;
              if (!edge) {
                ar.push(v);
                edge = true;
              }
            }
            ar.push(v);
          }
          vec3After = ar;

          // Eckpunkte hinzufügen; doppelt für die Normalen
          that.profile.frontVertices.push(new CVertex(IP.x, 0.0, IP.z));

          stepRightIndex = that.profile.frontVertices.length;

          vec3After.unshift(new CVertex(IP.x, 0.0, z));
          vec3After.unshift(new CVertex(IP.x, 0.0, z));
          vec3After.unshift(new CVertex(IP.x, 0.0, IP.z));

          // zusammenführen für die U-Wert Berechnung
          that.profile.frontVertices = that.profile.frontVertices.concat(vec3After);

          i_l = that.profile.backVertices.length - 1;
          for (i = i_l; i > 0; i--) {
            v = that.profile.backVertices[i];
            // if (v.x < IP.x) break;
            if (v.z < z) v.z = z;
            else break;
          }

          if (i > 1) {
            that.profile.middleVertexBack[1] -= (that.profile.backVertices.length - i);
            that.profile.middleVertexBack[1] += 2;

            if (that.profile.middleVertexBack[1] < 0)
              that.profile.middleVertexBack[1] = 0;

            let ar = that.profile.backVertices.slice(0, i + 1);
            ar.push(CVertex.fromVertex(vec3After[vec3After.length - 1]));
            ar[ar.length - 1].x = that.profile.backVertices[i].x;
            vec3After[vec3After.length - 1].x = ar[ar.length - 1].x;
            for (i = 0; i < ar.length; i++)
              ar[i].i = i + 1;
            that.profile.backVertices = ar;
          }
        }

        //-------------------------------------------------------------------------------------
        // U-Werte berechnen
        let V = [that.profile.frontVertices, that.profile.backVertices];
        if (that.profile.channelVertices.length)
          V.push(that.profile.channelVertices);
        let SUM: number[] = []; // um eine einzige albedoTextur zu benutzen, muss die maximale Länge der beiden Geometrien ermittelt werden
        let sum = 0.0, last, lHalf;

        let i;

        // ermiteln der maximalen Geometrielänge
        V.forEach(function (e) {
          sum = 0.0;
          e[0].l = 0.0;
          last = 0.0;

          for (i = 1; i < e.length; i++) {
            e[i].l = last + e[i].distance(e[i - 1]);
            last = e[i].l;
          }

          SUM.push(last);
        })

        sum = SUM[0] > SUM[1] ? SUM[0] : SUM[1];

        /*
        Es gab Texturfehler bei der Berechnung der seitlichen Kanäle. Werden Stufen eingebracht, so ist der Mittelpunkt der
        Textur nicht gleich der Mittelpubkt des Ringes. Aus diesem Grund wurde ein Puffer von 0.5mm eingebracht.
        */
        sum += 500;

        that.profile.maxVerticeLength = sum;
        that.profile.frontVerticeLength = SUM[0];
        that.profile.backVerticeLength = SUM[1];

        // U-Werte berechnen
        V.forEach(function (e, index) {
          // let factor = 1.0;
          //
          // if (index == 0 && SUM[0] < SUM[1])
          //   factor = (SUM[0] / SUM[1]);
          // else if (index == 1 && SUM[1] < SUM[0])
          //   factor = (SUM[1] / SUM[0]);

          // sum = SUM[index];


          let iHalf = V[index].findIndex(e2 => {
            return e2.x > -15 && e2.x < 15;
            // return e2.x > -0.001 && e2.x < 0.001;
          });

          // console.log(iHalf);

          if (iHalf == -1) {
            // console.log((index == 0 ? profile.frontVertices : profile.backVertices));
            return;
          }

          lHalf = V[index][iHalf].l;
          // lHalf = (index == 0 ? profile.frontVertices : profile.backVertices)[iHalf].l;

          // iHalf = e.findIndex(function (e2)
          // {
          //   return e2.x > -0.001 && e2.x < 0.001;
          // })
          // lHalf = e[iHalf].l;

          for (i = 0; i < e.length; i++) {
            e[i].u = 0.5 + ((e[i].l - lHalf) / sum);
            // e[i].u = 0.5 + ((e[i].l - lHalf) / sum / factor);
            // e[i].u = 0.5 + ((e[i].l - lHalf) / sum);
            // e[i].u = 0.5 + ((e[i].l - lHalf) / SUM[index]);
            if (e[i].u < 0.0) e[i].u = 0.0;
            else if (e[i].u >= 1.0) e[i].u = 1.0;
          }
        })

        if (stepLeftIndex !== null) {
          that.profile.stepLeftVertices = that.profile.frontVertices.slice(0, stepLeftIndex);
          that.profile.frontVertices = that.profile.frontVertices.slice(stepLeftIndex);
        }

        if (stepRightIndex !== null) {
          if (stepLeftIndex != null)
            stepRightIndex -= stepLeftIndex;

          that.profile.stepRightVertices = that.profile.frontVertices.slice(stepRightIndex);
          that.profile.frontVertices = that.profile.frontVertices.slice(0, stepRightIndex);
        }

        // Flächenberechnung: Ergebniss liegt im mm2 vor
        let calcArea_mm2 = function (): number {
          let x = [] as number[];
          let z = [] as number[];

          let v = that.profile.frontVertices;
          let i, i_l = v.length;
          for (i = 0; i < i_l; i++) {
            x.push(v[i].x);
            z.push(v[i].z);
          }

          v = that.profile.backVertices;
          i_l = v.length;
          for (i = i_l - 1; i > 0; i--) {
            x.push(v[i].x);
            z.push(v[i].z);
          }

          i_l = x.length;
          let area = 0.0, j;
          for (i = 0; i < i_l; i++) {
            j = (i + 1) % i_l;
            area += x[i] * z[j];
            area -= x[j] * z[i];
          }
          area = Math.abs(area) / 2;
          return area / 1000000;
        }
        that.calc.area = calcArea_mm2();
        that.calc.mm3 = that.calc.area * that.ringData.ringHeight / 1000;

        /*
        Seitenlänge für die seitliche Steinbesetzung ermitteln
        Gültige Werte können nur ermittelt werden, wenn profile.middleVertexBack[l,r] > 0 ist
        */
        that.profile.sideLength[0] = 0;
        that.profile.sideLength[1] = 0;

        if (that.profile.middleVertexBack[0] > 0) {
          let n1 = that.profile.middleVertexBack[0] - 1,
            n2 = that.profile.middleVertexBack[0] + 1;

          if (n1 >= 0 && n2 >= 0) {
            let v1 = that.profile.backVertices[n1],
              v2 = that.profile.backVertices[n2];

            that.profile.sideLength[0] = v1.distance(v2);
            that.profile.sideMidpoint[0] = CVertex.midpoint(v1, v2);
          }
        }

        if (that.profile.middleVertexBack[1] > 0) {
          let n1 = that.profile.backVertices.length - 1 - that.profile.middleVertexBack[1] - 1,
            n2 = that.profile.backVertices.length - 1 - that.profile.middleVertexBack[1] + 1;

          if (n1 >= 0 && n2 >= 0) {
            let v1 = that.profile.backVertices[n1],
              v2 = that.profile.backVertices[n2];

            that.profile.sideLength[1] = v1.distance(v2);
            that.profile.sideMidpoint[1] = CVertex.midpoint(v1, v2);
          }
        }
        return true;
      }()) return false;

      let innerCircumference = that.ringData.ringSize,
        xCenter = that.ringData.ringWidth / 2,
        yCenter = that.ringData.ringSize / 2,
        thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180, // zusätzliche Rotation des Ringes um die X-Achse
        tesselation = AppComponent.app.state.mobile ? AppComponent.app.data.webglSettings.tesselation[1] : AppComponent.app.data.webglSettings.tesselation[0],
        tesselation_inc = innerCircumference / tesselation,
        // path = [] as CVertex[],
        path = function () {
          let result = [] as CVertex[];
          for (let y = 0, i = 0; i <= tesselation; y += tesselation_inc, i++)
            result.push(new CVertex(0, y, 0));
          return result;
        }(),
        i,
        vertexArray = [] as iVertexArray[],
        meshes = [] as iMeshData[],
        innerRadius = innerCircumference / Math.PI / 2,
        meshData: iMeshData,
        countFront = 0,
        countBack = 0,
        divMode = that.ringData.divPreset.substring(0, 1).toLowerCase();

      if (!function extrude(): boolean {
        vertexArray = [] as iVertexArray[];

        let WA = that.calc.wa_mm,
          mDiv = function (): number[] {
            let lc = that.ringData.divPreset.toLowerCase();
            if (lc.startsWith("s:") || lc.startsWith("h:"))
              return [that.ringData.ringWidth];

            let t, last = 0, result = [] as number[];
            that.ringData.materialDiv.forEach(function (e: number) {
              t = ((e + last) * that.ringData.ringWidth / 10000) - xCenter;
              result.push(t);
              last += e;
            });

            return result;
          }(),
          i: number, i_l: number,
          j: number, j_l: number,
          k: number, k_l: number,
          index: number,
          tmp: CVertex,
          A: CVertex,
          B: CVertex,
          cx,
          row: CVertex[],
          x: number,
          vecIndex,
          IP: iInterpolateResult,
          lastIP: iInterpolateResult | null = null,
          loopData = function () {
            let result = [];
            result.push({vertices: that.profile.frontVertices, type: "front"});
            result.push({vertices: that.profile.backVertices, type: "back"});
            if (that.profile.stepLeftVertices.length) {
              result.push({
                vertices: that.profile.stepLeftVertices,
                type: "sl",
              })
            }

            if (that.profile.stepRightVertices.length) {
              result.push({
                vertices: that.profile.stepRightVertices,
                type: "sr",
              })
            }

            return result;
          }();

        for (let nLoop = 0; nLoop < loopData.length; nLoop++) {
          let rows: CVertex[][][] = [],
            j_l = 0;

          switch (loopData[nLoop].type) {
            case "front":
            case "back": {
              for (j = 0; j < mDiv.length; j++)
                rows.push([] as CVertex[][]);
              j_l = mDiv.length;
              break;
            }
            case "sl":
            case "sr": {
              rows.push([] as CVertex[][]);
              j_l = 1;
              break;
            }
          }

          let vertices = loopData[nLoop].vertices;

          for (i = 1; i < path.length; i++) {
            vecIndex = 0;
            lastIP = null;

            for (j = 0; j < j_l; j++) {
              row = [];

              if (lastIP != null) {
                tmp = new CVertex(lastIP.x, 0, lastIP.z);
                tmp.add(path[i - 1]);
                tmp.u = lastIP.uv_u;
                tmp.i = j;
                row.push(tmp);
              }

              if (j == j_l - 1)
                x = vertices[vertices.length - 1].x;
              else
                x = mDiv[j] + get_sin(path[i - 1].y, that.ringData.ringSize, WA);

              if (x < vertices[0].x)
                x = vertices[0].x;
              else if (x > vertices[vertices.length - 1].x)
                x = vertices[vertices.length - 1].x;

              IP = cRing.interpolate(x, vertices, lastIP ? lastIP.indexVectorA : 0);
              lastIP = IP;

              A = vertices[IP.indexVectorA];
              B = vertices[IP.indexVectorB];
              cx = (B.x - A.x) / 4;

              if (x - A.x < cx)
                IP.indexVectorA--;
              else if (B.x - x < cx)
                IP.indexVectorB++;

              if (j == j_l - 1) {
                for (k = vecIndex; k < vertices.length; k++) {
                  tmp = CVertex.fromVertex(vertices[k]);
                  tmp.add(path[i - 1]);
                  tmp.u = vertices[k].u;
                  tmp.i = j;
                  row.push(tmp);
                }
              } else {
                for (k = vecIndex; k <= IP.indexVectorA; k++) {
                  tmp = CVertex.fromVertex(vertices[k]);
                  tmp.add(path[i - 1]);
                  tmp.u = vertices[k].u;
                  tmp.i = j;
                  row.push(tmp);
                }

                tmp = new CVertex(IP.x, 0, IP.z);
                tmp.add(path[i - 1]);
                tmp.u = IP.uv_u;
                tmp.i = j;
                row.push(tmp);
              }

              rows[j].push(row);

              vecIndex = IP.indexVectorB;
            }
          }

          // die 1. Reihe aller Meshes an das Ende kopieren...

          i_l = rows.length;
          i = path.length - 1;
          for (j = 0; j < j_l; j++) {
            row = [];
            rows[j][0].forEach(function (e) {
              tmp = CVertex.fromVertex(e);
              tmp.y = path[i].y;
              tmp.u = e.u;
              row.push(tmp);
            })
            rows[j].push(row);
          }

          let frontIndex = 0,
            backIndex = 0,
            get_index = function (type: string) {
              switch (type) {
                case "front":
                  return frontIndex++;
                case "back":
                  return backIndex++;
                case "sl":
                  return 0;
                case "sr":
                  return mDiv.length - 1;
              }

              return -1;
            }

          for (i = 0; i < i_l; i++) {
            index = 0;
            j_l = rows[i].length;
            for (j = 0; j < j_l; j++) {
              k_l = rows[i][j].length;
              row = rows[i][j];
              for (k = 0; k < k_l; k++) {
                row[k].i = index++;
              }
            }

            vertexArray.push({
              vertex2DArray: rows[i],
              type: loopData[nLoop].type,
              index: get_index(loopData[nLoop].type)
            });
          }
        }

        let mode = that.ringData.divPreset.substring(0, 1).toLowerCase();

        // Segmentierter Ring: Teile das Frontmesh horizontal in 2 gleiche Teile um die Oberflächen zu separieren
        if (mode == "s") {
          let front = vertexArray.find(function (e) {
            return e.type == "front";
          })

          if (front) // in diesem Modus gibt es nur 1 Frontmesh
          {
            let rows = front.vertex2DArray;
            let rowsBottom = rows.slice(0, rows.length / 2);
            let rowsTop = rows.slice(rows.length / 2);
            let row0 = rowsTop[0], rowNew = [];

            for (i = 0; i < row0.length; i++) {
              rowNew.push(CVertex.fromVertex(row0[i]));
            }
            rowsBottom.push(rowNew);

            front.vertex2DArray = rowsBottom;


            let index = 0, row;
            i_l = rowsTop.length;
            for (i = 0; i < i_l; i++) {
              row = rowsTop[i];
              j_l = row.length;
              for (j = 0; j < j_l; j++) {
                row[j].i = index++;
              }
            }
            vertexArray.push({
              vertex2DArray: rowsTop,
              type: "front",
              index: 1,
            });
          }
        }

        // generiere Trennfugen
        let shape: CVertex[] = [], gm = that.ringData.gapMode, gw = that.ringData.gapWidth,
          gd = that.ringData.gapDepth;
        if (gd <= 1.0) gd = gw * gd;

        switch (gm) {
          case 1: // eckige Fuge
            shape.push(new CVertex(-gw / 2, 0, 0));
            shape.push(new CVertex(-gw / 2 + 10, 0, gd / 2));
            shape.push(new CVertex(-gw / 2 + 20, 0, gd));
            shape.push(new CVertex(-gw / 2 + 20, 0, gd));
            shape.push(new CVertex(0, 0, gd));
            shape.push(new CVertex(gw / 2 - 20, 0, gd));
            shape.push(new CVertex(gw / 2 - 20, 0, gd));
            shape.push(new CVertex(gw / 2 - 10, 0, gd / 2));
            shape.push(new CVertex(gw / 2, 0, 0));

            shape[0].u = 0;
            break;
          case 2: // V-Fuge
            shape.push(new CVertex(-gw / 2, 0, 0));
            shape.push(new CVertex(-0, 0, gd));
            shape.push(new CVertex(-0, 0, gd));
            shape.push(new CVertex(gw / 2, 0, 0));
            break;
          case 3: // U-Fuge
            shape.push(new CVertex(-0.5, 0.0, 0.0).scale(gw));
            shape.push(new CVertex(-0.460696, 0.0, 0.194589).scale(gw));
            shape.push(new CVertex(-0.353523, 0.0, 0.353523).scale(gw));
            shape.push(new CVertex(-0.194589, 0.0, 0.460696).scale(gw));
            shape.push(new CVertex(0.0, 0.0, 0.5).scale(gw));
            shape.push(new CVertex(0.194589, 0.0, 0.460696).scale(gw));
            shape.push(new CVertex(0.353523, 0.0, 0.353523).scale(gw));
            shape.push(new CVertex(0.460696, 0.0, 0.194589).scale(gw));
            shape.push(new CVertex(0.5, 0.0, 0.0).scale(gw));
            break;
        }

        let adaptLeftMesh = function (rowsFront: CVertex[][], rowsGap: CVertex[][]) {
          if (!rowsFront.length || !rowsGap.length) {
            throw "error: no data";
          }
          let i, i_l = rowsFront.length, j, j_l, B, index, rows, row;

          for (i = 0; i < i_l; i++) {
            B = CVertex.fromVertex(rowsGap[i][0]);
            j_l = rowsFront[i].length;
            for (j = 0; j < j_l - 1; j++) {
              if (rowsFront[i][j + 1].x > B.x) break;
            }
            rows = rowsFront[i].slice(0, j + 1);
            rows.push(B);
            rowsFront[i] = rows;
          }

          // indices neu erstellen
          index = 0;
          i_l = rowsFront.length;
          for (i = 0; i < i_l; i++) {
            row = rowsFront[i];
            j_l = row.length;
            for (j = 0; j < j_l; j++)
              row[j].i = index++;
          }
        }

        let adaptRightMesh = function (rowsFront: CVertex[][], rowsGap: CVertex[][]) {
          let i, i_l = rowsFront.length, j, j_l, index, B, row;

          for (i = 0; i < i_l; i++) {
            B = CVertex.fromVertex(rowsGap[i][rowsGap[i].length - 1]);
            row = rowsFront[i];
            j_l = row.length;
            for (j = 0; j < j_l - 1; j++) {
              if (row[j].x > B.x) break;
              if (row[j + 1].x - (row[j + 1].x - row[j].x) / 4 > B.x) break;
            }

            row = [B].concat(row.slice(j + 1));
            rowsFront[i] = row;
          }

          // indices neu erstellen
          index = 0;
          i_l = rowsFront.length;
          for (i = 0; i < i_l; i++) {
            row = rowsFront[i];
            j_l = row.length;
            for (j = 0; j < j_l; j++)
              row[j].i = index++;
          }
        }

        if (1 && mode != "s" && mode != "h" && that.ringData.gapMode > 0 && that.ringData.gapMode < 4) {
          let front: iVertexArray[] = [];

          vertexArray.forEach(function (e) {
            if (e.type == "front")
              front.push(e);
          })

          if (front.length > 1) {
            let path, rows, rowsFront, rowsGap, gapIndex;

            for (gapIndex = 0; gapIndex < front.length - 1; gapIndex++) {

              if (!that.ringData.gapEnabled[gapIndex]) {
                continue;
              }

              path = [];
              rowsFront = front[gapIndex].vertex2DArray;

              i_l = rowsFront.length;
              for (i = 0; i < i_l; i++) {
                let t = CVertex.fromVertex(rowsFront[i][rowsFront[i].length - 1]);
                path.push(t);
              }

              rowsGap = that.extrude_shape_xy(shape, path/*, this.frontVertices, true, false*/);

              vertexArray.push({
                vertex2DArray: rowsGap,
                type: "gap",
                index: gapIndex,
              });

              /*
          Anpassung front zu gap Mesh
          für jede Reihe:
              - suche im Frontmesh der ersten Vertex, der größer in X ist, als der erste Vertex im Gap-Mesh
              - verwerfe alle Vertices im Frontmesh bis zum Ende der Reihe
              - setze den letzten Vertex dieser Reihe auf die Koordinaten des ersten Vertex im Gap-Mesh
              - es wird dadurch ein eigenes "outline" vom GapMesh benötigt, (evtl. auch 2 Wenn unterschiedliche Materialien)
              - keine Alpha-Map für die Fugen
           */

              adaptLeftMesh(front[gapIndex].vertex2DArray, rowsGap);
              adaptRightMesh(front[gapIndex + 1].vertex2DArray, rowsGap);

              // I UV-u der Rechteckfuge anpassen
              if (gm == 1) { // geht nur bei breiten Materialabständen; bei schmalen Abständen wird die Albedo teilweise überschrieben
                rows = rowsGap;
                i_l = rows.length;
                let p1, p2;
                for (i = 0; i < i_l; i++) {
                  p1 = rows[i][0];
                  p2 = rows[i][1];
                  // p1.u = p2.u - (p1.distance(p2) / that.frontVerticeLength);
                  p1.u = p2.u - (p1.distance(p2) / that.profile.maxVerticeLength);
                  p1 = rows[i][rows[i].length - 1];
                  p2 = rows[i][rows[i].length - 2];
                  // p1.u = p2.u + (p1.distance(p2) / that.frontVerticeLength);
                  p1.u = p2.u + (p1.distance(p2) / that.profile.maxVerticeLength);
                }
              }
            }
          }
        }

        // generiere Designfugen
        if (1 && that.ringData.gapDiv.length > 1) {
          let gapDivPos = [] as number[], last = 0, t;
          i_l = that.ringData.gapDiv.length - 1;
          for (i = 0; i < i_l; i++) {
            t = that.ringData.gapDiv[i];
            gapDivPos.push((t + last) * that.ringData.ringWidth / 10000 - that.ringData.ringWidth / 2);
            last += t;
          }

          let rows, rowsGap, fPath: CVertex[];

          gapDivPos.forEach(function (xPos) {
            vertexArray.forEach(function (e) {
              let curFront = null;
              if (e.type == "front" && e.vertex2DArray[0][0].x < xPos && e.vertex2DArray[0][e.vertex2DArray[0].length - 1].x > xPos)
                curFront = e;

              if (curFront) {
                rows = curFront.vertex2DArray;

                fPath = [];
                i_l = rows.length
                for (i = 0; i < i_l; i++) {
                  t = new CVertex(xPos + get_sin(path[i].y, that.ringData.ringSize, WA), rows[i][0].y, 0);
                  t.z = cRing.interpolate(t.x, that.profile.frontVertices).z;
                  fPath.push(t);
                }

                rowsGap = that.extrude_shape_xy(shape, fPath);

                vertexArray.push({
                  vertex2DArray: rowsGap,
                  type: "gap",
                  index: -1,
                });

                // Front neu erstellen
                let rowsFront = curFront.vertex2DArray, rowsFrontLeft = [], rowsFrontRight = [], newRow;

                i_l = rowsFront.length;
                for (i = 0; i < i_l; i++) {
                  row = rowsFront[i];

                  x = fPath[i].x;
                  j_l = row.length;
                  for (j = 0; j < j_l - 1; j++) {
                    if (row[j].x > x) break;
                  }

                  newRow = row.slice(0, j);
                  rowsFrontLeft.push(newRow);

                  newRow = row.slice(j);
                  rowsFrontRight.push(newRow);
                }

                adaptLeftMesh(rowsFrontLeft, rowsGap);
                adaptRightMesh(rowsFrontRight, rowsGap);

                // indices neu erstellen: links
                index = 0;
                i_l = rowsFrontLeft.length;
                for (i = 0; i < i_l; i++) {
                  row = rowsFrontLeft[i];
                  j_l = row.length;
                  for (j = 0; j < j_l; j++)
                    row[j].i = index++;
                }
                // indices neu erstellen: rechts
                index = 0;
                i_l = rowsFrontRight.length;
                for (i = 0; i < i_l; i++) {
                  row = rowsFrontRight[i];
                  j_l = row.length;
                  for (j = 0; j < j_l; j++)
                    row[j].i = index++;
                }

                curFront.vertex2DArray = rowsFrontLeft;

                vertexArray.push({
                  vertex2DArray: rowsFrontRight,
                  type: curFront.type,
                  index: curFront.index,
                });

                // I UV-u der Rechteckfuge anpassen
                if (gm == 1) { // geht nur bei breiten Materialabständen; bei schmalen Abständen wird die Albedo teilweise überschrieben
                  rows = rowsGap;
                  i_l = rows.length;
                  let p1, p2;
                  for (i = 0; i < i_l; i++) {
                    p1 = rows[i][0];
                    p2 = rows[i][1];
                    // p1.u = p2.u - (p1.distance(p2) / that.frontVerticeLength) / 2;
                    p1.u = p2.u - (p1.distance(p2) / that.profile.maxVerticeLength) / 2;
                    p1 = rows[i][rows[i].length - 1];
                    p2 = rows[i][rows[i].length - 2];
                    p1.u = p2.u + (p1.distance(p2) / that.profile.frontVerticeLength) / 2;
                    // p1.u = p2.u + (p1.distance(p2) / that.maxVerticeLength) / 2;
                  }
                }
              }
            })
          })
        }

        return true;
      }()) return false;


      if (!function computeStones(): boolean {
        // let findStoneMode = function (mode: number) {
        //   let modes = AppComponent.app.data.stoneMode, result = null;
        //   for (let i = 0; i < modes.length; i++) {
        //     if (modes[i].mode === mode) {
        //       result = modes[i];
        //     } else if (modes[i].items) {
        //       // @ts-ignore
        //       for (let j = 0; j < modes[i].items.length; j++) {
        //         // @ts-ignore
        //         if (modes[i].items[j].mode === mode) {
        //           // @ts-ignore
        //           result = modes[i].items[j];
        //           break;
        //         }
        //       }
        //     }
        //
        //     if (result)
        //       break;
        //   }
        //
        //   return result;
        // }
        // let getLowerStoneSize = function (stoneType: number, maxSize: number, onSide: boolean = false): number {
        //   let type = getStoneCuts(AppComponent.app.data).find(function (e) {
        //     return e.id === stoneType;
        //   })
        //   if (type) {
        //     let size = 0;
        //     if (onSide) {
        //       for (let i = 0; i < type.size.length; i++) {
        //         if (type.size[i].calcSize) {
        //           // @ts-ignore
        //           if (type.size[i].calcSize <= maxSize)
        //             size = type.size[i].size;
        //         } else if (type.size[i].size <= maxSize)
        //           size = type.size[i].size;
        //       }
        //     } else {
        //       for (let i = 0; i < type.size.length; i++) {
        //         if (type.size[i].calcSize) {
        //
        //           // @ts-ignore
        //           if (type.size[i].minRingHeight <= that.ringData.ringHeight && type.size[i].minRingWidth <= that.ringData.ringWidth && type.size[i].calcSize <= maxSize)
        //             size = type.size[i].size;
        //         } else if (type.size[i].size <= maxSize && type.size[i].minRingHeight <= that.ringData.ringHeight && type.size[i].minRingWidth <= that.ringData.ringWidth)
        //           size = type.size[i].size;
        //       }
        //     }
        //     return size;
        //   }
        //
        //   return 0;
        // }
        // let getStoneSizeItem = function (stoneType: number, size: number): iStoneSize | null {
        //   let type = getStoneCuts(AppComponent.app.data).find(function (e) {
        //     return e.id === stoneType;
        //   })
        //   if (type) {
        //     for (let i = 0; i < type.size.length; i++) {
        //       if (type.size[i].size === size)
        //         return type.size[i];
        //     }
        //   }
        //
        //   return null;
        // }
        // let getStoneTypeItem = function (stoneType: number) {
        //   return getStoneCuts(AppComponent.app.data).find(function (e) {
        //     return e.id === stoneType;
        //   })
        // }

        // >============================================================================================================
        // Funktionen zum testen der gültigen Position von Steinen auf der Frontseite
        // let frontOutline: CVertex[][] = []; // die FrontMeshes, nicht rotiert
        that.calc.outlineFront = [] as CVertex[][];
        that.calc.outlineFrontMetarialIndex = [] as number[];
        (function calcFrontOutline() {

          vertexArray.sort(function (a, b) {
            return a.index - b.index;
          })

          vertexArray.forEach(e => {
            if (e.type == "front") {
              let result = cRing.outline(e.vertex2DArray, false); // ...im Uhrzeigersinn
              let segment: CVertex[] = [];
              result.forEach(p => {
                segment.push(CVertex.fromVertex(p));
              })
              // frontOutline.push(segment);
              that.calc.outlineFront.push(segment);
              that.calc.outlineFrontMetarialIndex.push(e.index);
            }
          })
          // that.calc.outlineFront = frontOutline;
        }());
        let gapOutline: CVertex[][] = []; // die FrontMeshes, nicht rotiert
        (function calcGapOutline() {
          vertexArray.forEach(e => {
            if (e.type == "gap") {
              let result = cRing.outline(e.vertex2DArray, false); // ...im Uhrzeigersinn
              let segment: CVertex[] = [];
              result.forEach(p => {
                segment.push(CVertex.fromVertex(p));
              })
              gapOutline.push(segment);
            }
          })
          that.calc.outlineGap = gapOutline;
        }());
        // let pointIsInPoly = function (x: number, y: number, polygon: CVertex[], safeDist_X: number = 0): boolean | number[] {
        //   let isInside = false;
        //   let minX = polygon[0].x, maxX = polygon[0].x;
        //   let minY = polygon[0].y, maxY = polygon[0].y;
        //   for (let n = 1; n < polygon.length; n++) {
        //     let q = polygon[n];
        //     minX = Math.min(q.x, minX);
        //     maxX = Math.max(q.x, maxX);
        //     minY = Math.min(q.y, minY);
        //     maxY = Math.max(q.y, maxY);
        //   }
        //
        //   if (x < minX + safeDist_X || x > maxX - safeDist_X || y < minY || y > maxY) {
        //     return [minX + safeDist_X, maxX - safeDist_X];//, Math.min(Math.abs(x - minX), Math.abs(x - maxX))];
        //   }
        //
        //   let i = 0, j = polygon.length - 1, lengthHalf = polygon.length / 2, ix, jx;
        //   for (; i < polygon.length; j = i++) {
        //     ix = polygon[i].x;
        //     if (i < lengthHalf) ix += safeDist_X;
        //     else ix -= safeDist_X;
        //     jx = polygon[j].x;
        //     if (j < lengthHalf) jx += safeDist_X;
        //     else jx -= safeDist_X;
        //     if ((polygon[i].y > y) != (polygon[j].y > y) &&
        //       x < (jx - ix) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + ix) {
        //       isInside = !isInside;
        //     }
        //   }
        //
        //   if (isInside)
        //     return true;
        //
        //   return [minX, maxX];//, Math.min(Math.abs(x - minX), Math.abs(x - maxX))];
        // }
        // let testStonePositionFrontOutline = function (x: number, y: number, safeDist: number = 0, getBoolean:boolean=false): boolean | number[] {
        //   let done = false, result = false, resultAr = [x, y];
        //
        //   let testResult = [] as any[];
        //
        //   frontOutline.forEach(outlineAr => {
        //     if (done) return;
        //     let test = pointIsInPoly(x, y, outlineAr, safeDist);
        //     // console.log(x, y, test);
        //     if (typeof (test) == "boolean" && test === true) {
        //       done = true;
        //       result = true;
        //     } else if (typeof (test) != "boolean") {
        //       testResult.push(test);
        //       // if (x < test[0]) resultAr= [test[0], y];
        //       // else resultAr= [test[1], y];
        //       // done = true;
        //     }
        //   })
        //
        //   if (!done && testResult.length) {
        //     let minDiff = 99999, closestIndex = -1;
        //     testResult.forEach(function (e, index) {
        //       let diff = Math.abs((e[0] + (e[1] - e[0]) / 2) - x);
        //       if (diff < minDiff) {
        //         minDiff = diff;
        //         closestIndex = index;
        //       }
        //     })
        //
        //     if (Math.abs(x - testResult[closestIndex][0]) < Math.abs(x - testResult[closestIndex][1]))
        //       return [testResult[closestIndex][0], y];
        //
        //     return [testResult[closestIndex][1], y];
        //   }
        //
        //   if (result)
        //     return result;
        //
        //   return resultAr;
        // }
        // <============================================================================================================

        that.calc.profileSideLength[0] = Math.trunc(that.profile.sideLength[0]);
        that.calc.profileSideLength[1] = Math.trunc(that.profile.sideLength[1]);

        that.stoneCalcData = stoneCalc(that, vertexArray);
        // console.log(that.stoneCalcData);
        if (that.stoneCalcData == null) {
          that.ringData.stone[0].mode = 0;
          that.ringData.stone[0].positionDiv = [5000, 5000];
          // Log("info", "Steinbesatz nicht möglich");
          // console.log("Kein Steinbesatz möglich");
        }

        return true;
      }()) return false;

      if (!function triangulate_computeNormals_computeUV(): boolean {
        vertexArray?.forEach(function (e) {
          if (e.vertex2DArray && e.vertex2DArray.length) {
            let mesh = new CMesh();
            mesh.rows = e.vertex2DArray;
            that.computeUV_V(mesh.rows, 1.0 / innerCircumference);

            /*
        if (e.type.includes("crossChannelCap")) {
          // UV-Koordinaten anpassen. Diese müssen um 90 Grad gedreht und in der Mitte der Textur platziert werden.
          let rows = e.vertex2DArray;
          for (let i = 0, i_l = rows.length; i < i_l; i++) {
            let row = rows[i];
            for (let j = 0, j_l = row.length; j < j_l; j++) {
              let u = row[j].u;
              let v = row[j].v;

              // u = v;//0.8 - (v - 0.5);
              // v = u;

              // row[j].u = 1.0 - v;
              // row[j].v = u;
            }
          }

          console.log(rows);
        }
*/

            if (e.triangulate_isFrontFace !== undefined && e.triangulate_useVectorDist !== undefined)
              mesh.triangulate(e.triangulate_isFrontFace, e.triangulate_useVectorDist);
            else {
              if (e.type == "front" || e.type == "sl" || e.type == "sr")
                mesh.triangulate(true, true);
              else if (e.type == "gap")
                mesh.triangulate(true, false);
              else if (e.type == "helper")
                mesh.triangulate(true, true);
              else if (e.type.includes("Bevel"))
                mesh.triangulate(true, false);
                // else if (e.type == "channel")
              //     mesh.triangulate(true, false);
              else
                mesh.triangulate(false, true);
            }

            if (!e.no_rotate === true)
              mesh.rotateRows(innerRadius, thetaExtra);

            if (e.type == "front" || e.type== "gap")
              mesh.computeWeightedAngleNormals(divMode != "s" && e.close_normals !== false);
            else
              mesh.computeWeightedAngleNormals(e.close_normals !== false);

            meshData = mesh.serialize();
            meshData.index = e.index;
            meshData.type = e.type;
            if (e.type == "gap") {
              if (that.ringData.gapMode == 1) // eckig?
                meshData.outline = cRing.outline(e.vertex2DArray, false, 1, 1);
              else
                meshData.outline = cRing.outline(e.vertex2DArray);
            } else if (divMode == "h" && e.type == "back") {
              meshData.outline = cRing.outline(e.vertex2DArray, false, that.profile.middleVertexBack[0], that.profile.middleVertexBack[1]);
            } else if (!e.no_outline)
              meshData.outline = cRing.outline(e.vertex2DArray);

            meshData.rows = mesh.rows;
            meshData.normals = mesh.normals;
            meshes.push(meshData);

            if (e.type == "front") countFront++;
            else if (e.type == "back") countBack++;
          }
        })

        let index = 0;
        let A, B, iA, iB, normalsA, normalsB, nAx, nBx, j, j_l: number;

        // Segmente angleichen
        if (1 && divMode != "s") {
          let equal_normals = function (typeA: string, indexA: number, typeB: string, indexB: number) {
            let meshA = null;

            for (let i = 0; i < meshes.length; i++) {
              if (meshes[i].type == typeA && meshes[i].index == indexA) meshA = meshes[i];
              // kein break...es soll das letzte gefunden werden, was den Suchkriterien entspricht -> linkes Mesh seitlich der Fuge
            }

            let meshB = meshes.find(function (e) {
              return e.type == typeB && e.index == indexB;
            });

            if (meshA && meshB) {
              CMesh.equalNormals(meshA, meshB);
              return true;
            }

            return false;
          }

          while (0) {
            if (!equal_normals("front", index, "front", index + 1))
              break;
            index++;
          }
          index = 0;
          while (1) {
            if (!equal_normals("back", index, "back", index + 1))
              break;
            index++;
          }
        }

        // Front-Back angleichen
        /*
        if (0)
        {
          // links
          if (this.stepLeftVertices.length == 0)
          {
            let meshA = meshes.find(function (e)
            {
              return e.type == "back" && e.index == 0;
            });

            let meshB = meshes.find(function (e)
            {
              return e.type == "front" && e.index == 0;
            });

            if (meshA && meshB)
            {
              A = <CVertex[][]>meshA.rows;
              B = <CVertex[][]>meshB.rows;
              normalsA = meshA.normals;
              normalsB = meshB.normals;

              j_l = A.length < B.length ? A.length : B.length;
              for (j = 0; j < j_l; j++)
              {
                iA = A[j][0].i;
                iB = B[j][0].i;

                nAx = iA * 3;
                nBx = iB * 3;
                normalsA[nAx] = (normalsA[nAx] + normalsB[nBx]) * 0.5;
                normalsA[nAx + 1] = (normalsA[nAx + 1] + normalsB[nBx + 1]) * 0.5;
                normalsA[nAx + 2] = (normalsA[nAx + 2] + normalsB[nBx + 2]) * 0.5;
                normalsB[nBx] = normalsA[nAx];
                normalsB[nBx + 1] = normalsA[nAx + 1];
                normalsB[nBx + 2] = normalsA[nAx + 2];

              }
            }
          }
          else
          {
            let SL = meshes.find(function (e)
            {
              return e.type == "sl";
            });
            if (SL)
            {
              SL.index = 0;
            }
          }
          // rechts
          if (this.stepRightVertices.length == 0)
          {
            let meshB = meshes.find(function (e)
            {
              return e.type == "back" && e.index == countBack - 1;
            });

            let meshA = meshes.find(function (e)
            {
              return e.type == "front" && e.index == countFront - 1;
            });

            if (meshA && meshB)
            {

              A = meshA.rows;
              B = meshB.rows;

              normalsA = meshA.normals;
              normalsB = meshB.normals;

              // @ts-ignore
              j_l = A.length < B.length ? A.length : B.length;
              for (j = 0; j < j_l; j++)
              {
                // @ts-ignore
                iA = A[j][A[j].length - 1].i;
                // @ts-ignore
                iB = B[j][B[j].length - 1].i;

                nAx = iA * 3;
                nBx = iB * 3;
                normalsA[nAx] = (normalsA[nAx] + normalsB[nBx]) * 0.5;
                normalsA[nAx + 1] = (normalsA[nAx + 1] + normalsB[nBx + 1]) * 0.5;
                normalsA[nAx + 2] = (normalsA[nAx + 2] + normalsB[nBx + 2]) * 0.5;
                normalsB[nBx] = normalsA[nAx];
                normalsB[nBx + 1] = normalsA[nAx + 1];
                normalsB[nBx + 2] = normalsA[nAx + 2];
              }
            }

          }
          else
          {
            let SR = meshes.find(function (e)
            {
              return e.type == "sr";
            });
            if (SR)
            {
              SR.index = countFront - 1;
            }

          }
        }
    */

        // Segmentierter Ring: Normalen Mat1-Mat2 horizontal angleichen
        if (1 && divMode == "s") {
          let frontMeshes: iMeshData[] = [];
          meshes.forEach(function (e) {
            if (e.type == "front")
              frontMeshes.push(e);
          })

          if (frontMeshes.length == 2) {
            let A = frontMeshes[0];
            let B = frontMeshes[1];
            let normalsA = A.normals;
            let normalsB = B.normals;

            let loop = [
              {
                // @ts-ignore
                rowA: A.rows[0],
                // @ts-ignore
                rowB: B.rows[B.rows.length - 1],
              },
              {
                // @ts-ignore
                rowB: B.rows[0],
                // @ts-ignore
                rowA: A.rows[A.rows.length - 1],
              },
            ];

            loop.forEach(function (e) {
              let i_l = e.rowA.length < e.rowB.length ? e.rowA.length : e.rowB.length;

              for (i = 0; i < i_l; i++) {
                iA = e.rowA[i].i;
                iB = e.rowB[i].i;

                nAx = iA * 3;
                nBx = iB * 3;
                normalsA[nAx] = (normalsA[nAx] + normalsB[nBx]) * 0.5;
                normalsA[nAx + 1] = (normalsA[nAx + 1] + normalsB[nBx + 1]) * 0.5;
                normalsA[nAx + 2] = (normalsA[nAx + 2] + normalsB[nBx + 2]) * 0.5;
                normalsB[nBx] = normalsA[nAx];
                normalsB[nBx + 1] = normalsA[nAx + 1];
                normalsB[nBx + 2] = normalsA[nAx + 2];
              }
            });
          }
        }
        return true;
      }()) return false;

      if (!function calcCameraData(): boolean {
        let v1 = TEMP.Vertex_1;
        let v2 = TEMP.Vertex_2;
        let v3 = TEMP.Vertex_3;
        let v4 = TEMP.Vertex_4;
        let v5 = TEMP.Vertex_5;
        let a = that.ringData.ringWidth / 1000;
        let b = (that.ringData.ringSize / Math.PI / 2 + that.ringData.ringHeight) / 1000;
        that.cameraData.radius = b;
        let rot = AppComponent.app.data.webglSettings.ringRotationY[that.ringData.index] * Math.PI / 180.0; // deg -> rad

        let camPosZ = -b * 5;
        // => Kameraposition für die Screenshots berechnen
        let left = false;
//        for (i = 0, li = count(that.CFG.STONE); i < li; i++) {
//            if (in_array(that.CFG.STONE[i].M, [40, 42, 44])) {
//                left = 1;
//                break;
//            }
//        }

        let rotCamera = -Math.PI / 6;
        if (left) rotCamera = -rotCamera;

        v1.assign(0, 0, 0); // Pivot Position (z=0)
        v2.assign(0, 0, 0); // Kamera Ziel (z=Mitte Ring)
        v3.assign(0, 0, 0); // Hilfspunkt
        v4.assign(0, 0, 0); // Kameraposition
        v5.assign(0, 0, 0);

        if (rot <= 0.0) {
          v3.x = -a / 2;
          v3.z = b;

          v4.z = camPosZ;
          v4.rotateY(rotCamera, v1);

          v1.rotateY(rot, v3);
          v4.rotateY(rot, v3);

          v1.x -= v3.x;
          v1.x += 0.2;
          v1.z += AppComponent.app.data.webglSettings.ringOffsetZ[that.ringData.index]; // Pivot
          v4.x -= v3.x;
          v4.x += 0.2;
          v4.z += AppComponent.app.data.webglSettings.ringOffsetZ[that.ringData.index]; // Pivot

          v5.x = a;
        } else {
          v3.x = a / 2;
          v3.z = b;

          v4.z = camPosZ;
          v4.rotateY(rotCamera, v1);

          v1.rotateY(rot, v3);
          v4.rotateY(rot, v3);

          v1.x -= v3.x;
          v1.x -= 0.2;
          v1.z += AppComponent.app.data.webglSettings.ringOffsetZ[that.ringData.index]; // Pivot
          v4.x -= v3.x;
          v4.x -= 0.2;
          v4.z += AppComponent.app.data.webglSettings.ringOffsetZ[that.ringData.index]; // Pivot

          v5.x = -a;
        }

        v5.z = -b;
        v5.rotateY(rot, v1);

        // that.position = v1; => funktioniert nicht in JS !!
        v1.toRef(that.position);

        v2 = v1;
        v2.y = b; // Ringmittelpunkt -> Kameratarget
        v2.toRef(that.cameraData.target);

        v4.y = b * 3;
        v4.z += AppComponent.app.data.webglSettings.ringOffsetZ[that.ringData.index]; // Kameraposition für Screenshot
        v4.toRef(that.cameraData.position);

        that.cameraData.distance_x = v5.x;
        return true;
      }()) return false;

      if (!function computeMeshes(): boolean {
        let webgl = WebglComponent.WEBGL;
        if (!webgl) return false;

        that.disposeMeshes();

        // pivot
        that.pivot.rotation.y = AppComponent.app.data.webglSettings.ringRotationY[that.ringData.index] * Math.PI / 180.0;
        that.pivot.position.x = that.position.x;
        that.pivot.position.z = that.position.z;// + that.posZOffset;
        that.pivot.position.y = (that.ringData.ringSize / Math.PI / 2 + that.ringData.ringHeight) / 1000;

        // shadow
        let radius = that.ringData.ringSize / Math.PI / 2 + that.ringData.ringHeight;
        let plane = CreatePlane("shadow", {
          width: (that.ringData.ringWidth * 5.5) / 1000,
          height: (radius * 4) / 1000
        }, webgl.scene);
        that.mesh.push(plane);
        plane.position.y = -that.pivot.position.y;
        plane.rotation.x = 90 * Math.PI / 180.0;
        plane.material = webgl.matShadow;
        plane.parent = that.pivot;

        // meshes
        let vertexData = new VertexData();
        that.meshData = meshes;

        let frontMeshes = [];
        let gapMeshes = [];

        for (let i = 0; i < meshes.length; i++) {
          let M = meshes[i];
          if (0) // Debug: Meshfilter...
          {
            // console.log(M.type);
            // if (!M.type.includes("front")) continue;
            // if (!M.type.includes("crossChannel")) continue;
            if (!M.type.includes("frontChannel") && !M.type.includes("frontCut") && !M.type.includes("helper")) continue;
            // if (!M.type.startsWith("bevel") && M.type != "gap") continue;
            // if (!M.type.includes("Bevel") && M.type != "helper") continue;
            // if (!M.type.includes("sideBevel") && M.type != "helper") continue;
            // if (!M.type.includes("sideChannel") && M.type !== "back") continue;
            // if (!M.type.includes("sideChannel") && !M.type.includes("cut") && M.type !== "helper") continue;
            // if (M.type != "bevel" && M.type != "helper") continue;
            // if (M.type != "bevel" && M.type != "helper" && M.type != "gap") continue;
            // if (M.type != "helper" && M.type != "gap") continue;
            // if (M.type != "bevel") continue;
            // if (M.type != "helper") continue;
            // if (M.type != "back") continue;
            // if (M.type == "back") continue;
            // if (M.type != "gap" && M.type != "front") continue;
            // if (M.type != "helper") continue;
            // if (!M.type.includes("frontCut") && M.type !== "helper") continue;

            // if (M.type == "front") continue;
          }

          let name = "";
          if (M.type == "front") name = "f" + M.index;
          else if (M.type == "back") name = "b" + M.index;
          // else if (M.type == "bevel") name = "bevel" + M.index;
          else name = M.type;

          let mesh = new Mesh(name, webgl.scene);

          if (M.type.includes("alpha"))
            mesh.setEnabled(false);
          else
            mesh.setEnabled(true);

          that.mesh.push(mesh);

          // if (scale !== null) // Die Geometriedaten werden mit dem Faktor 1000 erzeugt: -> runterskalieren...
          // {
          for (let j = 0; j < M.positions.length; j++) {
            M.positions[j] *= 0.001;//scale;
          }
          // }

          vertexData.positions = M.positions;
          vertexData.indices = M.indices;

          if (!M.normals) {
            let normals: number[] = [];
            VertexData.ComputeNormals(M.positions, M.indices, normals);
            vertexData.normals = normals;
          } else
            vertexData.normals = M.normals;

          /*
          Die Texturen sind in doppelter Größe angelegt.
          Die Albedo Textur liegt links. Die "ursprüngliche" Textur liegt mittig darin und wird
          nach oben und nach unten vervielfältigt.
          Ein UV Wert mit 0:0 wird dann zu 0:25 und ein UV Wert it 1:1 wird zu 0.5:0.75
           */
          let uv = M.uvs, j_l = uv.length, offset = 0.0;
          if (M.type == "back" || M.type.includes("sideChannel") || M.type.includes("crossChannelBack"))
            offset = 0.5;

          // console.log(M.type, offset, ""+uv[0]);

          for (let j = 0; j < j_l; j += 2) {
            // optimierte map() function
            uv[j] = uv[j] * 0.5 + offset;
            uv[j + 1] = 0.25 + 0.5 * uv[j + 1];
          }

          vertexData.uvs = M.uvs;
          vertexData.applyToMesh(mesh, true);

          if (M.type == "front") frontMeshes.push(mesh);
          else if (M.type == "gap") gapMeshes.push(mesh);
          mesh.parent = that.pivot;
        }

        // ==>
        if (1) // stones
        {
          that.ringData.stone.forEach(function (stoneGroup: iPresetStone, stoneGroupIndex: number) {
              let stone = Preload.stone.find(function (e) {
                return (e.legacyId ?? e.id) == stoneGroup.type;
              });

              if (stone) {
                // @ts-ignore
                for (let i = 0; i < that.profile.stonePaths.length; i++) {
                  // @ts-ignore
                  let positions = that.profile.stonePaths[i].positions;
                  // @ts-ignore
                  let normals = that.profile.stonePaths[i].normals;
                  // @ts-ignore
                  let binormals = that.profile.stonePaths[i].binormals;
                  // @ts-ignore
                  let tangents = that.profile.stonePaths[i].tangents;

                  for (let j = 0; j < positions.length; j++) {
                    positions[j].scale(0.001);
                  }

                  if (1) { // stones
                    // @ts-ignore
                    let path = that.profile.stonePaths[i];

                    let stoneMesh: Mesh | null = null,
                      stoneMatrix = null,
                      rotation = null;

                    // -> krabbe
                    let krabbeMesh = null;
                    let krabbeMatricesData = null;
                    let krabbeUVData = null;
                    let krabbeDistance = [] as number[][];
                    if ([20, 44, 45].includes(stoneGroup.mode)) {
                      let krabbe = Preload.stone.find(function (e) {
                        return (e.legacyId ?? e.id) == 99;
                      });

                      if (krabbe) {
                        krabbeMesh = krabbe.mesh.clone("krabbe");
                        krabbeMesh.makeGeometryUnique();
                        that.mesh.push(<Mesh><unknown>krabbeMesh);
                        let scale = stoneGroup.size / 1000 / 2 * 1.74;
                        krabbeMesh.scaling.x = scale;
                        krabbeMesh.scaling.y = scale;
                        krabbeMesh.scaling.z = scale;
                        krabbeMesh.position.y *= scale;
                        krabbeMesh.bakeCurrentTransformIntoVertices();
                        krabbeMesh.parent = that.pivot;
                        krabbeMesh.setEnabled(true);

                        krabbeMatricesData = new Float32Array(path.positions.length * 4 * 16);
                        krabbeUVData = new Float32Array(path.positions.length * 4 * 2);

                        let dist = 0.38;// nicht größer als 0.412;

                        krabbeDistance.push([-dist, dist]);
                        krabbeDistance.push([dist, dist]);
                        krabbeDistance.push([dist, -dist]);
                        krabbeDistance.push([-dist, -dist]);
                      }
                    }
                    // <- krabbe

                    stoneMesh = stone.mesh.clone("stone");
                    stoneMesh.makeGeometryUnique();
                    that.mesh.push(<Mesh><unknown>stoneMesh);
                    stoneMesh.parent = that.pivot;
                    stoneMesh.setEnabled(true);
                    const stoneColor = stoneGroup.stoneColor === "weiss"
                      ? null
                      : getStoneColorById(AppComponent.app.data, stoneGroup.stoneColor);
                    const stoneColorMaterial = webgl.getStoneColorMaterial(stoneColor, that.ringData.index, path.positions.length);
                    if (stoneColorMaterial) {
                      stoneMesh.material = stoneColorMaterial;
                    }

                    for (let j = 0; j < path.positions.length; j++) {
                      if (stoneMesh) {
                        let size = stoneGroup.size / 1000;
                        if (stoneGroup.mode == 11 && stoneGroup.freeStones) // freie Steine können unterschiedlich groß sein
                          size = stoneGroup.freeStones[i].size / 1000;
                        let scale = new Vector3(size, size, size);

                        let tangent = path.tangents[j].toVector3();
                        let binormal = path.binormals[j].toVector3();
                        binormal.scaleInPlace(-1.0);
                        rotation = Quaternion.FromLookDirectionRH(tangent, binormal);
                        let trans = path.positions[j].toVector3();

                        stoneMatrix = Matrix.Compose(scale, rotation, trans);

                        stoneMesh.thinInstanceAdd(stoneMatrix);
                      }

                      // => Bevels
                      if (stoneGroup.mode == 10) // eingerieben front
                      {
                        let bevelMesh = that.mesh.find(function (e) {
                          return e.name === "frontBevel_" + stoneGroupIndex + "_" + j;
                        })
                        if (bevelMesh) {
                          bevelMesh.parent = null;
                          bevelMesh.rotationQuaternion = rotation
                          bevelMesh.position = path.positions[j].toVector3();

                          bevelMesh.bakeCurrentTransformIntoVertices();
                          bevelMesh.parent = that.pivot;

                          let alignMeshToProfile = function (mesh: Mesh) {
                            let profile = that.profile;
                            if (!profile)
                              return;
                            let position = mesh.getVerticesData(VertexBuffer.PositionKind);
                            let uv = mesh.getVerticesData(VertexBuffer.UVKind);
                            if (position && position.length && uv && uv.length) {
                              let x, y, z;
                              let innerRadius = that.ringData.ringSize / Math.PI / 2;
                              let ringRotationRad = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
                              let PI2 = Math.PI * 2;
                              let positionHalf = position.length / 3 * 2;
                              let vz0 = new CVertex(0, 0, -10000000);
                              let t;

                              for (let p = 0; p < position.length; p += 3) {
                                x = position[p] * 1000;
                                y = position[p + 1] * 1000;
                                z = position[p + 2] * 1000;
                                let distOrig = Math.sqrt(x * x + y * y + z * z);

                                let result = cRing.interpolate(x, that.profile.frontVertices);
                                let v = new CVertex(result.x, 0, innerRadius - result.z);
                                let distNew = Math.sqrt(v.x * v.x + v.z * v.z) * 0.998;

                                v.x = x;
                                v.y = y;
                                v.z = z;
                                v.scale(distNew / distOrig);

                                if (p < positionHalf) // nur die 1. Bevelreihe an die Profilgeometrie anpassen
                                {
                                  position[p] = v.x / 1000;
                                  position[p + 1] = v.y / 1000;
                                  position[p + 2] = v.z / 1000;
                                }
                                // für die uv-v Komponente muss der Winkel um den Nullpunkt berechnet werden
                                v.rotateX(-ringRotationRad);
                                let rad = CVertex.angleYZ(v, vz0);

                                if (v.y < 0)
                                  rad = -rad;

                                t = p / 3 * 2;

                                uv[t] = result.uv_u;
                                uv[t + 1] = rad / PI2;
                              }

                              // console.log("uv[" + j + "]: ", {uv});

                              mesh.updateVerticesData(VertexBuffer.PositionKind, position);
                              mesh.updateVerticesData(VertexBuffer.UVKind, uv);
                            } else {
                              console.log("position, uv");
                            }
                          }

                          alignMeshToProfile(bevelMesh);
                        }
                      } else if (stoneGroup.mode == 11) // eingerieben front
                      {
                        let bevelMesh = that.mesh.find(function (e) {
                          return e.name === "frontBevel_" + stoneGroupIndex + "_" + i;
                        })
                        if (bevelMesh) {
                          bevelMesh.parent = null;
                          bevelMesh.rotationQuaternion = rotation
                          bevelMesh.position = path.positions[j].toVector3();

                          bevelMesh.bakeCurrentTransformIntoVertices();
                          bevelMesh.parent = that.pivot;

                          let alignMeshToProfile = function (mesh: Mesh) {
                            let profile = that.profile;
                            if (!profile)
                              return;
                            let position = mesh.getVerticesData(VertexBuffer.PositionKind);
                            let uv = mesh.getVerticesData(VertexBuffer.UVKind);
                            if (position && position.length && uv && uv.length) {
                              let x, y, z;
                              let innerRadius = that.ringData.ringSize / Math.PI / 2;
                              let ringRotationRad = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
                              let PI2 = Math.PI * 2;
                              let positionHalf = position.length / 3 * 2;
                              let vz0 = new CVertex(0, 0, -10000000);
                              let t;

                              for (let p = 0; p < position.length; p += 3) {
                                x = position[p] * 1000;
                                y = position[p + 1] * 1000;
                                z = position[p + 2] * 1000;
                                let distOrig = Math.sqrt(x * x + y * y + z * z);

                                let result = cRing.interpolate(x, that.profile.frontVertices);
                                let v = new CVertex(result.x, 0, innerRadius - result.z);
                                let distNew = Math.sqrt(v.x * v.x + v.z * v.z) * 0.998;

                                v.x = x;
                                v.y = y;
                                v.z = z;
                                v.scale(distNew / distOrig);

                                if (p < positionHalf) // nur die 1. Bevelreihe an die Profilgeometrie anpassen
                                {
                                  position[p] = v.x / 1000;
                                  position[p + 1] = v.y / 1000;
                                  position[p + 2] = v.z / 1000;
                                }
                                // für die uv-v Komponente muss der Winkel um den Nullpunkt berechnet werden
                                v.rotateX(-ringRotationRad);
                                let rad = CVertex.angleYZ(v, vz0);

                                if (v.y < 0)
                                  rad = -rad;

                                t = p / 3 * 2;

                                uv[t] = result.uv_u;
                                uv[t + 1] = rad / PI2;
                              }

                              // console.log("uv[" + j + "]: ", {uv});

                              mesh.updateVerticesData(VertexBuffer.PositionKind, position);
                              mesh.updateVerticesData(VertexBuffer.UVKind, uv);
                            } else {
                              console.log("position, uv");
                            }
                          }

                          alignMeshToProfile(bevelMesh);
                        }
                      } else if ([20, 44, 45].includes(stoneGroup.mode) && krabbeMesh && krabbeMatricesData && krabbeUVData && stoneMatrix) // Verschnitt - Krabbe
                      {
                        let pivotPosition = that.pivot.position;
                        let pV = new CVertex(pivotPosition.x, pivotPosition.y, -1000000);
                        let v0 = new CVertex(0, 0, -1000000);

                        let ringRotationRad = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
                        let PI2 = Math.PI * 2;

                        for (let k = 0; k < 4; k++) {
                          let p = krabbeDistance[k];

                          let localPosition = new Vector3(p[0], -(stoneGroup.size * 0.1) / 1000 * (1.0 / (stoneGroup.size / 1000)), p[1]);
                          let m = stoneMatrix.clone();
                          let globalPosition = Vector3.TransformCoordinates(localPosition, m);

                          // @ts-ignore
                          m.m[12] = globalPosition.x;
                          // @ts-ignore
                          m.m[13] = globalPosition.y;
                          // @ts-ignore
                          m.m[14] = globalPosition.z;

                          let trans = new Vector3();
                          let rot = new Quaternion();
                          let scale = new Vector3();
                          m.decompose(scale, rot, trans);
                          scale.x = scale.y = scale.z = 1.0;
                          m = Matrix.Compose(scale, rot, trans);

                          m.copyToArray(krabbeMatricesData, (j * 4 + k) * 16);

                          // get UV
                          let v1 = new CVertex(globalPosition.x, globalPosition.y, globalPosition.z);
                          v1.rotateX(-ringRotationRad);

                          // UV-U Wert
                          if ([44, 45].includes(stoneGroup.mode)) // seitlich
                          {
                            let back = false;
                            if (k == 1 || k == 2)
                              back = true;
                            let x = v1.x * 1000;
                            // @ts-ignore
                            let result = cRing.interpolate(x, that.profile.frontVertices);
                            let u = result.uv_u * 0.5; // doppelte Texturgröße: Fronttextur ist auf der linken Hälfte der Textur
                            if (back) u += 0.5;
                            krabbeUVData[(j * 4 + k) * 2] = u;
                          } else {
                            let x = v1.x * 1000;
                            // @ts-ignore
                            let result = cRing.interpolate(x, that.profile.frontVertices);
                            krabbeUVData[(j * 4 + k) * 2] = result.uv_u * 0.5; // doppelte Texturgröße: Fronttextur ist auf der linken Hälfte der Textur
                          }
                          // UV-V Wert
                          let rad = CVertex.angleYZ(v1, pV);
                          if (v1.y < v0.y) rad = PI2 - rad;
                          rad /= PI2;
                          krabbeUVData[(j * 4 + k) * 2 + 1] = 0.25 + 0.5 * rad;
                        }
                      } else if (stoneGroup.mode == 40 || stoneGroup.mode == 41) // eingerieben seitlich
                      {
                        let bevelMesh = that.mesh.find(function (e) {
                          return e.name === "sideBevel_" + stoneGroupIndex + "_" + j;
                        })
                        if (bevelMesh) {
                          bevelMesh.parent = null;

                          bevelMesh.rotationQuaternion = rotation
                          bevelMesh.position = path.positions[j].toVector3();

                          bevelMesh.bakeCurrentTransformIntoVertices();
                          bevelMesh.parent = that.pivot;

                          let generateUV_back = function (mesh: Mesh) {
                            let profile = that.profile;
                            if (!profile) return;
                            let position = mesh.getVerticesData(VertexBuffer.PositionKind);
                            let uv = mesh.getVerticesData(VertexBuffer.UVKind);
                            if (position && uv) {
                              let x, y, z;
                              let innerRadius = that.ringData.ringSize / Math.PI / 2;
                              let ringRotationRad = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
                              let PI2 = Math.PI * 2;
                              let vz0 = new CVertex(0, 0, -100000);
                              let v = new CVertex;
                              let t;
                              let pA,
                                pB,
                                AZ, ZB, AB, scale;

                              if (stoneGroup.mode == 40) {
                                let n1 = profile.middleVertexBack[0] - 1,
                                  n2 = profile.middleVertexBack[0] + 1;
                                pA = profile.backVertices[n1];
                                pB = profile.backVertices[n2];
                              } else {
                                let n1 = profile.backVertices.length - 1 - profile.middleVertexBack[1] - 1,
                                  n2 = profile.backVertices.length - 1 - profile.middleVertexBack[1] + 1;

                                pA = profile.backVertices[n1];
                                pB = profile.backVertices[n2];
                              }

                              for (let p = 0; p < position.length; p += 3) {
                                x = position[p] * 1000;
                                y = position[p + 1] * 1000;
                                z = position[p + 2] * 1000;

                                v.x = x;
                                v.y = y;
                                v.z = z;

                                // für die uv-v Komponente muss der Winkel um den Nullpunkt berechnet werden
                                v.rotateX(-ringRotationRad);
                                let rad = CVertex.angleYZ(v, vz0);

                                if (v.y < 0)
                                  rad = -rad;

                                v.rotateX(-rad);
                                v.z += innerRadius;

                                AZ = v.z - pA.z;
                                ZB = pB.z - v.z;
                                AB = pB.z - pA.z;
                                scale = AZ / AB;
                                pA.lerpToRef(pB, scale, v);

                                t = p / 3 * 2;
                                // if (stoneGroup.mode == 40)
                                uv[t] = v.u + 1.0;
                                // else
                                //     uv[t] = 2.0 - v.u;
                                uv[t + 1] = (rad / PI2);
                              }

                              mesh.updateVerticesData(VertexBuffer.UVKind, uv);
                              // console.log(uv);
                            }
                          }

                          generateUV_back(bevelMesh);
                        } else
                          console.log("no bevelMesh: sideBevel_" + stoneGroupIndex + "_" + j);
                      }
                    }
                    if (krabbeMesh && krabbeMatricesData) {
                      krabbeMesh.thinInstanceSetBuffer("matrix", krabbeMatricesData, 16);
                      krabbeMesh.thinInstanceSetBuffer("uv", krabbeUVData, 2);
                      // @ts-ignore
                      krabbeMesh.krabbeUVData = krabbeUVData;
                    }
                  }
                }
              }
            }
          )
        }
        // <==

        return true;
      }()) return false;

      if (!function computePrice(): boolean {
        that.ringData.stone.forEach(function (e, index) {
          if (that.profile.stonePaths && that.profile.stonePaths.length > index)
            e.countReal = that.profile.stonePaths[index].positions.length;
          else e.countReal = 0;
        });

        calcPrice(that.ringData).then(function (price: number) {
          that.ringData.price = price;
        });

        return true;
      }()) return false;

      return true;
    }())
      return;

    if (!function assignMaterials(): boolean {
      let webgl = WebglComponent.WEBGL;
      if (!webgl || !that.profile) return false;

      let divMode = that.ringData.divPreset.substring(0, 1).toLowerCase();
      let textureSize = WebglComponent.WEBGL.maxTextureSize,
        textureSize_half = textureSize / 2,
        textureSizeAlpha = WebglComponent.WEBGL.maxAlphaTextureSize,
        textureSizeAlpha_half = textureSizeAlpha / 2,
        vec: CVertex[],
        i, i_l,
        u, v;

      // Farben ermitteln
      let colors: string[] = [];
      that.ringData.material.forEach(function (e: number) {
        let mat = AppComponent.app.data.material.find(function (e2) {
          return e2.id == e;
        })
        if (mat)
          colors.push(mat.color3d);
        else
          colors.push('#0000ff');
      })

      let ctx = that.context.albedo;//that.doubledTextures.albedo.getContext();
      ctx.save();

      ctx.translate(0, textureSize_half);
      // ctx.lineWidth = 1;
      ctx.lineWidth = 0.1;

      if (divMode != "s" && divMode != "h") {
        that.meshData.forEach(function (e) {
          if (e.outline && e.type != "gap" && !e.type.includes("Bevel") && !e.type.includes("hannel")) {
            vec = e.outline;
            ctx.fillStyle = colors[e.index];
            ctx.strokeStyle = colors[e.index];

            ctx.beginPath();
            ctx.moveTo(Math.round(vec[0].u * textureSize), Math.round(vec[0].v * textureSize));

            i_l = vec.length;
            for (i = 1; i < i_l; i++) {
              u = Math.round(vec[i].u * textureSize);
              v = Math.round(vec[i].v * textureSize);
              ctx.lineTo(u, v);
            }

            ctx.closePath();
            ctx.fill();
          }

          // if (e.outline && e.type === "gap") {
          //   vec = e.outline;
          //   ctx.fillStyle = "#ff0000";
          //   ctx.strokeStyle = "#ff0000";
          //
          //   ctx.beginPath();
          //   ctx.moveTo(Math.round(vec[0].u * textureSize), Math.round(vec[0].v * textureSize));
          //
          //   i_l = vec.length;
          //   for (i = 1; i < i_l; i++)
          //   {
          //     u = Math.round(vec[i].u * textureSize);
          //     v = Math.round(vec[i].v * textureSize);
          //     ctx.lineTo(u, v);
          //   }
          //
          //   ctx.closePath();
          //   ctx.fill();
          //
          // }
        })

        // Fugen mit Weißgold extra zeichnen
        let mat = AppComponent.app.data.material.find(function (e2) {
          return e2.id == 1;
        })
        let color = mat ? mat.color3d : '#0000ff';
        let materialAr = that.ringData.material;

        // let that = that;
        that.meshData.forEach(function (e) {
          if (e.outline && e.type == "gap" && e.index != -1) {
            if (materialAr[e.index] == 1 || materialAr[e.index + 1] == 1) {
              vec = e.outline;
              ctx.fillStyle = color;
              ctx.strokeStyle = color;

              ctx.beginPath();
              // ctx.moveTo(Math.round(vec[0].u * textureSize), Math.round(vec[0].v * textureSize));

              i_l = vec.length;
              for (i = 0; i < i_l; i++) {
                u = Math.round(vec[i].u * textureSize);
                v = Math.round(vec[i].v * textureSize);
                if (i == 0)
                  ctx.moveTo(u, v);
                else
                  ctx.lineTo(u, v);
              }

              ctx.closePath();
              ctx.fill();
            }
          }
        })
      } else if (divMode == "s") {
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(textureSize + 1, 0);
        ctx.lineTo(textureSize + 1, textureSize / 2 + 1);
        ctx.lineTo(0, textureSize / 2 + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.moveTo(0, textureSize / 2 + 1);
        ctx.lineTo(textureSize + 1, textureSize / 2 + 1);
        ctx.lineTo(textureSize + 1, textureSize + 1);
        ctx.lineTo(0, textureSize + 1);
        ctx.closePath();
        ctx.fill();
      } else if (divMode == "h") {
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(textureSize + 1, 0);
        ctx.lineTo(textureSize + 1, textureSize + 1);
        ctx.lineTo(0, textureSize + 1);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Kopien der Texturdaten nach oben und unten anfertigen
      let imageData = ctx.getImageData(0, textureSize_half, textureSize, textureSize_half);
      ctx.putImageData(imageData, 0, textureSize + textureSize_half);
      imageData = ctx.getImageData(0, textureSize, textureSize, textureSize_half);
      ctx.putImageData(imageData, 0, 0);

      if (divMode != "h") {
        // Kopie nach rechts für den Innenring
        imageData = ctx.getImageData(0, 0, textureSize, textureSize * 2);
        ctx.putImageData(imageData, textureSize, 0);
      } else {
        // mit Frontmaterial füllen
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.moveTo(textureSize, 0);
        ctx.lineTo(textureSize * 2, 0);
        ctx.lineTo(textureSize * 2, textureSize * 2);
        ctx.lineTo(textureSize, textureSize * 2);
        ctx.closePath();
        ctx.fill();

        // "outline" mit Backmaterial füllen
        let md = that.meshData.find(function (e) {
          return e.type == "back";
        });

        if (1 && md) {
          vec = md.outline as CVertex[];
          ctx.fillStyle = colors[1];

          ctx.beginPath();
          ctx.moveTo(Math.round(vec[0].u * textureSize) + textureSize, Math.round(vec[0].v * textureSize) + textureSize_half);

          i_l = vec.length;
          for (i = 1; i < i_l; i++) {
            u = Math.round(vec[i].u * textureSize) + textureSize;
            v = Math.round(vec[i].v * textureSize) + textureSize_half;
            ctx.lineTo(u, v);
          }

          ctx.closePath();
          ctx.fill();
        }

        // Kopien der Texturdaten nach oben und unten anfertigen
        let imageData = ctx.getImageData(textureSize, textureSize_half, textureSize, textureSize_half);
        ctx.putImageData(imageData, textureSize, textureSize + textureSize_half);
        imageData = ctx.getImageData(textureSize, textureSize, textureSize, textureSize_half);
        ctx.putImageData(imageData, textureSize, 0);
      }

      if (1 && that.texture.roughnessEngraving) // Gravur: NEU: Nicht als Bump-Map, sondern als metallicRoughness Textur
      {
        let ctxEngraving = that.context.roughnessEngraving;// that.doubledTextures.roughnessEngraving.getContext();
        ctxEngraving.save();
        // ctxEngraving.lineWidth = 0.1;
        ctxEngraving.strokeStyle = "#00f";
        ctxEngraving.fillStyle = ctxEngraving.strokeStyle

        ctxEngraving.fillRect(0, 0, textureSize * 2, textureSize * 2);

        ctxEngraving.strokeStyle = "#00ff00";
        ctxEngraving.fillStyle = ctxEngraving.strokeStyle;

        that.applyEngravingCanvasTransform(ctxEngraving, "inner", textureSize, textureSize_half, 0.5, 1.0);

        let xPos = 0;

        // @ts-ignore
        let cy = that.profile.maxVerticeLength * textureSize / that.ringData.ringSize;
        let scaleHeight = textureSize / cy;
        ctxEngraving.scale(1.0, scaleHeight);

        // @ts-ignore
        let fs = 1000 * textureSize / that.profile.maxVerticeLength / scaleHeight; // 1mm

        if (that.ringData.engraving.length > 0) {
          let fsEgt = that.getEngravingTextFontSize(fs);

          ctxEngraving.font = fsEgt + 'px "engraving-' + that.ringData.engravingFont + '"';
          let egt = decodeURI(that.ringData.engraving);
          let sizeEGT = ctxEngraving.measureText(egt);

          xPos = -sizeEGT.width / 2;
          // @ts-ignore
          ctxEngraving.fillText(egt, xPos, (sizeEGT.actualBoundingBoxAscent - sizeEGT.actualBoundingBoxDescent) / 2);
        }

        // Punzierung
        let divMode = that.ringData.divPreset.substring(0, 1).toLowerCase();
        let n = that.ringData.materialDiv.length;
        if (divMode == "h" || divMode == "s") n = 2;
        let a = [], textPunzierung, m;
        let finenessAr = that.ringData.fineness;
        let materialAr = that.ringData.material;
        for (let i = 0; i < n; i++) {
          m = AppComponent.app.data.material[materialAr[i]];
          if (m) {
            textPunzierung = m.symbol + finenessAr[i];
            if (a.indexOf(textPunzierung) === -1) a.push(textPunzierung);
          }
        }
        textPunzierung = "";
        for (let i = 0; i < a.length; i++) {
          if (i > 0)
            textPunzierung += "/";
          textPunzierung += a[i];
        }

        textPunzierung += "  ";

        fs *= 0.8;
        ctxEngraving.font = fs + 'px Arial';
        // c.font = (fs * 0.8) + 'px Arial';
        let sizePunzierung = ctxEngraving.measureText(textPunzierung);

        if (xPos == 0)
          xPos = -sizePunzierung.width / 2;
        else
          xPos -= sizePunzierung.width + (fs * 2);
        // @ts-ignore
        ctxEngraving.fillText(textPunzierung, xPos, (sizePunzierung.fontBoundingBoxAscent - sizePunzierung.fontBoundingBoxDescent) / 2);
        ctxEngraving.restore();
        that.drawExteriorEngraving(ctxEngraving, textureSize, textureSize_half, scaleHeight, fs, "roughness");
        that.texture.roughnessEngraving.update(false);


        let link = document.getElementById('download_texture_roughnessMetallic');
        if (link) {
          link.setAttribute('download', 'albedo.png');
          link.setAttribute('href', ctxEngraving.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
        }
      }
      // kein else: die Gravur mittels metallic und roughness wird hier nochmals farblich abgesetzt
      {
        ctx.save();
        that.applyEngravingCanvasTransform(ctx, "inner", textureSize, textureSize_half, 0.5, 1.0);
        ctx.lineWidth = 0.1;
        ctx.fillStyle = AppComponent.app.data.engraving.color;
        ctx.fillStyle = "#000000";

        let xPos = 0;

        // @ts-ignore
        let cy = that.profile.maxVerticeLength * textureSize / that.ringData.ringSize;
        let scaleHeight = textureSize / cy;
        ctx.scale(1.0, scaleHeight);

        ctx.globalAlpha = AppComponent.app.data.engraving.alpha ?? 0.5; // Die Gravur wird farblich hinterlegt um sie besser sichtbar zu machen
        // ctx.globalAlpha = 1.0;//AppComponent.app.data.engraving.alpha ?? 0.5; // Die Gravur wird farblich hinterlegt um sie besser sichtbar zu machen

        // @ts-ignore
        let fs = 1000 * textureSize / that.profile.maxVerticeLength / scaleHeight; // 1mm

        if (that.ringData.engraving.length > 0) {
          let fsEgt = that.getEngravingTextFontSize(fs);

          ctx.font = fsEgt + 'px "engraving-' + that.ringData.engravingFont + '"';
          let egt = decodeURI(that.ringData.engraving);
          let sizeEGT = ctx.measureText(egt);

          xPos = -sizeEGT.width / 2;

          // ctx.strokeStyle = "#000000";
          // ctx.fillStyle = ctx.strokeStyle;
          // // @ts-ignore
          // ctx.fillText(egt, xPos, (sizeEGT.actualBoundingBoxAscent - sizeEGT.actualBoundingBoxDescent) / 2);

          // ctx.globalAlpha = 1.0;//AppComponent.app.data.engraving.alpha ?? 0.5;
          // ctx.strokeStyle = "#000000";//AppComponent.app.data.engraving.color;
          // ctx.fillStyle = "#333333";//ctx.strokeStyle;
          // @ts-ignore
          //ctx.strokeText(egt, xPos, (sizeEGT.actualBoundingBoxAscent - sizeEGT.actualBoundingBoxDescent) / 2);
          ctx.fillText(egt, xPos, (sizeEGT.actualBoundingBoxAscent - sizeEGT.actualBoundingBoxDescent) / 2);

          // ctx.globalAlpha = 0.5;//AppComponent.app.data.engraving.alpha ?? 0.5;
          //
          // // @ts-ignore
          // ctx.fillText(egt, xPos, (sizeEGT.actualBoundingBoxAscent - sizeEGT.actualBoundingBoxDescent) / 2);
        }

        // Punzierung
        let divMode = that.ringData.divPreset.substring(0, 1).toLowerCase();
        let n = that.ringData.materialDiv.length;
        if (divMode == "h" || divMode == "s") n = 2;
        let a = [], textPunzierung, m;
        let finenessAr = that.ringData.fineness;
        let materialAr = that.ringData.material;
        for (let i = 0; i < n; i++) {
          m = AppComponent.app.data.material[materialAr[i]];
          if (m) {
            textPunzierung = m.symbol + finenessAr[i];
            if (a.indexOf(textPunzierung) === -1) a.push(textPunzierung);
          }
        }
        textPunzierung = "";
        for (let i = 0; i < a.length; i++) {
          if (i > 0)
            textPunzierung += "/";
          textPunzierung += a[i];
        }

        textPunzierung += "  ";

        fs *= 0.8;
        ctx.font = fs + 'px Arial';
        // c.font = (fs * 0.8) + 'px Arial';
        let sizePunzierung = ctx.measureText(textPunzierung);

        if (xPos == 0)
          xPos = -sizePunzierung.width / 2;
        else
          xPos -= sizePunzierung.width + (fs * 2);

        // ctx.strokeStyle = "#000000";
        // ctx.fillStyle = "#333333";//ctx.strokeStyle;

        // @ts-ignore
        //ctx.strokeText(textPunzierung, xPos, (sizePunzierung.fontBoundingBoxAscent - sizePunzierung.fontBoundingBoxDescent) / 2);
        // @ts-ignore
        ctx.fillText(textPunzierung, xPos, (sizePunzierung.fontBoundingBoxAscent - sizePunzierung.fontBoundingBoxDescent) / 2);
        // // @ts-ignore
        // ctx.strokeText(textPunzierung, xPos, (sizePunzierung.fontBoundingBoxAscent - sizePunzierung.fontBoundingBoxDescent) / 2);
        // ctx.fillText(textPunzierung, xPos, (sizePunzierung.fontBoundingBoxAscent - sizePunzierung.fontBoundingBoxDescent) / 2);
        ctx.restore();
        that.drawExteriorEngraving(ctx, textureSize, textureSize_half, scaleHeight, fs, "albedo");
      }

      that.texture.albedo.update(false);

      // erzeuge Downloadlink der Textur
      if (AppComponent.app.state.debug && that.ringData.index === 0) {
        let link = document.getElementById('download_texture_albedo');
        if (link) {
          link.setAttribute('download', 'albedo.png');
          link.setAttribute('href', ctx.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
        }
      }

      if (1) {
        // => Alpha
        /*
        Die UV-Koordinaten werden bereits in der createMeshes() Funktion umgerechten
         */
        let ctxAlpha = that.context.alpha;// that.doubledTextures.alpha.getContext();
        ctxAlpha.fillStyle = "#fff";
        ctxAlpha.strokeStyle = "#fff";
        // ctxAlpha.lineWidth = 1;
        ctxAlpha.lineWidth = 0.1;
        ctxAlpha.fillRect(0, 0, textureSizeAlpha * 2, textureSizeAlpha * 2);
        // ctxAlpha.beginPath();
        // ctxAlpha.moveTo(0, 0);
        // ctxAlpha.lineTo(0, textureSize * 2);
        // ctxAlpha.lineTo(textureSize * 2, textureSize * 2);
        // ctxAlpha.lineTo(textureSize * 2, 0);
        // ctxAlpha.closePath();
        // ctxAlpha.fill();

        ctxAlpha.save();

        // ctxAlpha.translate(0.5, 0.5);
        // ctxAlpha.translate(0, textureSize_half);
        ctxAlpha.fillStyle = "#000";
        ctxAlpha.strokeStyle = "#000";

        if (1) {
          that.mesh.forEach(function (e) {
            if (e.name.includes("Bevel")) //
            {
              let uv = e.getVerticesData(VertexBuffer.UVKind);
              if (uv) {
                i_l = uv.length;
                for (i = 0; i < i_l; i += 2) {
                  uv[i] = 0.5 * uv[i];
                  uv[i + 1] = 0.25 + 0.5 * uv[i + 1];
                }
                e.updateVerticesData(VertexBuffer.UVKind, uv);

                // i_l / 3 ---> Bevel besteht aus 3 Vertex-Reihen...gehe zur 2. Reihe
                let iBegin = i_l / 3, iEnd = iBegin * 2;
                let min = 1.0, max = 0.0, t;

                let doOffset = false;

                for (i = iBegin; i < iEnd; i += 2) {
                  t = uv[i + 1];
                  if (t < min) min = t;
                  else if (t > max) max = t
                }
                if (max - min > 0.25)
                  doOffset = true;

                ctxAlpha.beginPath();
                for (i = iBegin; i < iEnd; i += 2) {
                  u = Math.round(uv[i] * textureSizeAlpha * 2);
                  if (doOffset) {
                    t = uv[i + 1];
                    if (t < 0.25)
                      t += 0.5;
                    v = Math.round((t) * textureSizeAlpha * 2);
                  } else
                    v = Math.round(uv[i + 1] * textureSizeAlpha * 2);

                  if (i == iBegin)
                    ctxAlpha.moveTo(u, v);
                  else
                    ctxAlpha.lineTo(u, v);
                }
                ctxAlpha.closePath();
                ctxAlpha.fill();
              }
            } else if (e.name.includes("frontCut")) //
            {
              let pointsPerRow = parseInt(e.name.substring(9));

              let uv = e.getVerticesData(VertexBuffer.UVKind);
              if (uv) {
                i_l = uv.length;
                let numRows = i_l / (pointsPerRow * 2);

                let getUVIndex = function (x: number, y: number): number {
                  return y * (2 * pointsPerRow) + x * 2;
                }

                ctxAlpha.beginPath();

                u = Math.round(uv[0] * textureSizeAlpha * 2);
                v = Math.round(uv[1] * textureSizeAlpha * 2);
                ctxAlpha.moveTo(u, v);

                for (let i = 1; i < numRows; i++) {
                  let j = getUVIndex(0, i);
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                for (let i = numRows - 1; i >= 0; i--) {
                  let j = getUVIndex(pointsPerRow - 1, i);
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                //    ctxAlpha.closePath();
                ctxAlpha.fill();

                if (1) {
                  ctxAlpha.beginPath();
                  let t = textureSizeAlpha * 2, y = textureSizeAlpha;

                  u = Math.round(uv[0] * t);
                  v = Math.round(uv[1] * t + y);
                  ctxAlpha.moveTo(u, v);

                  for (let i = 1; i < numRows; i++) {
                    let j = getUVIndex(0, i);
                    u = Math.round(uv[j] * t);
                    v = Math.round(uv[j + 1] * t + y);
                    ctxAlpha.lineTo(u, v);
                  }

                  for (let i = numRows - 1; i >= 0; i--) {
                    let j = getUVIndex(pointsPerRow - 1, i);
                    u = Math.round(uv[j] * t);
                    v = Math.round(uv[j + 1] * t + y);
                    ctxAlpha.lineTo(u, v);
                  }

                  ctxAlpha.fill();
                }
              }
            } else if (e.name.includes("sideChannel")) //
            {
              let uv = e.getVerticesData(VertexBuffer.UVKind);
              if (uv) {
                // Eine Reihe vom sideChannel besteht aus 6 Punkten

                i_l = uv.length;
                let numRows = i_l / 12;

                let getUVIndex = function (x: number, y: number): number {
                  return y * 2 * 6 + x * 2;
                }

                ctxAlpha.beginPath();

                u = Math.round(uv[0] * textureSizeAlpha * 2);
                v = Math.round(uv[1] * textureSizeAlpha * 2);
                ctxAlpha.moveTo(u, v);


                for (let i = 1; i < numRows; i++) {
                  let j = getUVIndex(0, i);
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                for (let i = numRows - 1; i >= 0; i--) {
                  let j = getUVIndex(5, i);
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                ctxAlpha.closePath();
                ctxAlpha.fill();
              }
            } else if (e.name == "frontChannel") //
            {
              let uv = e.getVerticesData(VertexBuffer.UVKind);
              if (uv) {
                // Eine Reihe vom frontChannel besteht aus 7 Punkten

                i_l = uv.length;
                let numRows = i_l / 14;

                let getUVIndex = function (x: number, y: number): number {
                  return y * 2 * 7 + x * 2;
                }

                ctxAlpha.beginPath();

                u = Math.round(uv[0] * textureSizeAlpha * 2);
                v = Math.round(uv[1] * textureSizeAlpha * 2);
                ctxAlpha.moveTo(u, v);


                for (let i = 1; i < numRows; i++) {
                  let j = getUVIndex(0, i);
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                for (let i = numRows - 1; i >= 0; i--) {
                  let j = getUVIndex(5, i);
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                // ctxAlpha.closePath();
                ctxAlpha.fill();
                if (1) {
                  ctxAlpha.beginPath();
                  let t = textureSizeAlpha * 2, y = textureSizeAlpha;

                  u = Math.round(uv[0] * t);
                  v = Math.round(uv[1] * t + y);
                  ctxAlpha.moveTo(u, v);

                  for (let i = 1; i < numRows; i++) {
                    let j = getUVIndex(0, i);
                    u = Math.round(uv[j] * t);
                    v = Math.round(uv[j + 1] * t + y);
                    ctxAlpha.lineTo(u, v);
                  }

                  for (let i = numRows - 1; i >= 0; i--) {
                    let j = getUVIndex(5, i);
                    u = Math.round(uv[j] * t);
                    v = Math.round(uv[j + 1] * t + y);
                    ctxAlpha.lineTo(u, v);
                  }

                  ctxAlpha.fill();
                }
              }
            } else if (e.name == "frontChannel_H") //
            {
              let uv = e.getVerticesData(VertexBuffer.UVKind);
              // console.log(uv);
              if (uv) {
                i_l = uv.length;
                let numRows = 2;
                let pointsPerRow = i_l / numRows;

                // Front
                ctxAlpha.beginPath();
                // links unten
                u = 0;
                v = Math.round(uv[1] * textureSizeAlpha * 2);
                ctxAlpha.moveTo(u, v);
                // links hoch
                for (let i = 1; i < numRows; i++) {
                  let j = i * pointsPerRow;
                  u = 0;
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                // oben
                for (let i = 0; i < pointsPerRow; i += 2) {
                  let j = i_l - pointsPerRow + i;
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                ctxAlpha.lineTo(textureSizeAlpha, v);
                //rechts
                for (let i = 0; i < numRows; i++) {
                  let j = (numRows - 1 - i) * pointsPerRow;
                  u = textureSizeAlpha;
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                //unten
                for (let i = pointsPerRow - 2; i >= 0; i -= 2) {
                  u = Math.round(uv[i] * textureSizeAlpha * 2);
                  v = Math.round(uv[i + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                ctxAlpha.lineTo(0, v);

                ctxAlpha.closePath();
                ctxAlpha.fill();

                // Back
                if (1) {
                  let uvBack = [];
                  uvBack.push(textureSizeAlpha, Math.round(uv[1] * textureSizeAlpha * 2));
                  uvBack.push(textureSizeAlpha, Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
                  uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
                  uvBack.push(textureSizeAlpha + Math.round(uv[0] * textureSizeAlpha * 2), Math.round(uv[1] * textureSizeAlpha * 2));

                  ctxAlpha.beginPath();
                  for (let i = 0; i < uvBack.length; i += 2) {
                    ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
                  }

                  ctxAlpha.closePath();
                  ctxAlpha.fill();

                  uvBack = [];
                  uvBack.push(textureSizeAlpha * 2, Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));
                  uvBack.push(textureSizeAlpha * 2, Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
                  uvBack.push(textureSizeAlpha + Math.round(uv[i_l - 2] * textureSizeAlpha * 2), Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
                  uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow - 2] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));

                  ctxAlpha.beginPath();
                  for (let i = 0; i < uvBack.length; i += 2) {
                    ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
                  }

                  ctxAlpha.closePath();
                  ctxAlpha.fill();
                }
              }
            } else //
            if (e.name == "crossChannelFront_alpha") //
            {
              let uv = e.getVerticesData(VertexBuffer.UVKind);

              if (uv) {
                i_l = uv.length;
                // console.log(uv);
                let numRows = 2;
                let pointsPerRow = i_l / numRows;

                // Front
                ctxAlpha.beginPath();
                // links hoch
                for (let i = 0; i < numRows; i++) {
                  let j = i * pointsPerRow;
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  if (i == 0) ctxAlpha.moveTo(u, v);
                  else ctxAlpha.lineTo(u, v);
                }
                // oben
                for (let i = 0; i < pointsPerRow; i += 2) {
                  let j = pointsPerRow + i;
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                //rechts
                for (let i = numRows - 1; i >= 0; i--) {
                  let j = i * pointsPerRow + pointsPerRow - 2;
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                //unten
                for (let i = pointsPerRow - 2; i >= 0; i -= 2) {
                  u = Math.round(uv[i] * textureSizeAlpha * 2);
                  v = Math.round(uv[i + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                ctxAlpha.closePath();
                ctxAlpha.fill();
              }
            }
            if (e.name == "crossChannelBack_alpha") //
            {
              let uv = e.getVerticesData(VertexBuffer.UVKind);


              if (uv) {
                i_l = uv.length;
                let numRows = 3;
                let pointsPerRow = i_l / numRows;

                ctxAlpha.beginPath();
                // links hoch
                for (let i = 0; i < numRows; i++) {
                  let j = i * pointsPerRow;
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  if (i == 0) ctxAlpha.moveTo(u, v);
                  else ctxAlpha.lineTo(u, v);
                }
                // oben
                for (let i = 2; i < pointsPerRow; i += 2) {
                  let j = (numRows - 1) * pointsPerRow + i;
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                //rechts
                for (let i = numRows - 1; i >= 0; i--) {
                  let j = i * pointsPerRow + pointsPerRow - 2;
                  u = Math.round(uv[j] * textureSizeAlpha * 2);
                  v = Math.round(uv[j + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }
                //unten
                for (let i = pointsPerRow - 2; i >= 0; i -= 2) {
                  u = Math.round(uv[i] * textureSizeAlpha * 2);
                  v = Math.round(uv[i + 1] * textureSizeAlpha * 2);
                  ctxAlpha.lineTo(u, v);
                }

                ctxAlpha.closePath();
                ctxAlpha.fill();

                // Back
                /*
                          if (1) {
                            let uvBack = [];
                            uvBack.push(textureSizeAlpha, Math.round(uv[1] * textureSizeAlpha * 2));
                            uvBack.push(textureSizeAlpha, Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
                            uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow + 1] * textureSizeAlpha * 2));
                            uvBack.push(textureSizeAlpha + Math.round(uv[0] * textureSizeAlpha * 2), Math.round(uv[1] * textureSizeAlpha * 2));

                            ctxAlpha.beginPath();
                            for (let i = 0; i < uvBack.length; i += 2) {
                              ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
                            }

                            ctxAlpha.closePath();
                            ctxAlpha.fill();

                            uvBack = [];
                            uvBack.push(textureSizeAlpha * 2, Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));
                            uvBack.push(textureSizeAlpha * 2, Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
                            uvBack.push(textureSizeAlpha + Math.round(uv[i_l - 2] * textureSizeAlpha * 2), Math.round(uv[i_l - 1] * textureSizeAlpha * 2));
                            uvBack.push(textureSizeAlpha + Math.round(uv[pointsPerRow - 2] * textureSizeAlpha * 2), Math.round(uv[pointsPerRow - 1] * textureSizeAlpha * 2));

                            ctxAlpha.beginPath();
                            for (let i = 0; i < uvBack.length; i += 2) {
                              ctxAlpha.lineTo(uvBack[i], uvBack[i + 1]);
                            }

                            ctxAlpha.closePath();
                            ctxAlpha.fill();
                          }
                */
              }
            }
          })
        }

        // that.meshData.forEach(function (e)
        // {
        //     if (e.outline && e.type.includes("hannel"))
        //         // if (e.outline && e.type == "channel")
        //     {
        //         vec = e.outline as CVertex[];
        //         ctxAlpha.beginPath();
        //
        //         i_l = vec.length;
        //         let outOfBounds = 0;
        //
        //         for (i = 0; i < i_l; i++)
        //         {
        //             u = Math.round(vec[i].u * textureSize);
        //             v = vec[i].v;
        //             if (v < 0 || v > 1) outOfBounds++;
        //             v = Math.round(v * textureSize);
        //             if (i == 0)
        //                 ctxAlpha.moveTo(u, v);
        //             else
        //                 ctxAlpha.lineTo(u, v);
        //         }
        //         ctxAlpha.closePath();
        //         ctxAlpha.fill();
        //
        //         if (outOfBounds > 0)
        //         {
        //             ctxAlpha.beginPath();
        //             for (i = 0; i < i_l; i++)
        //             {
        //                 u = Math.round(vec[i].u * textureSize);
        //                 v = textureSize + Math.round(vec[i].v * textureSize);
        //                 if (i == 0)
        //                     ctxAlpha.moveTo(u, v);
        //                 else
        //                     ctxAlpha.lineTo(u, v);
        //             }
        //
        //             ctxAlpha.closePath();
        //             ctxAlpha.fill();
        //         }
        //     }
        // })

        // ctxAlpha.lineWidth=5;
        // ctxAlpha.beginPath();
        // ctxAlpha.moveTo(0, textureSize_half);
        // ctxAlpha.lineTo(textureSize*2, textureSize_half);
        // ctxAlpha.stroke();
        // ctxAlpha.restore();

        // Kopien der Texturdaten nach oben und unten anfertigen
        if (1) {
          let imageDataTop = ctxAlpha.getImageData(0, 0, textureSizeAlpha * 2, textureSizeAlpha_half + 1);
          let imageDataBottom = ctxAlpha.getImageData(0, textureSizeAlpha - 1, textureSizeAlpha * 2, textureSizeAlpha_half + 1);
          let dataTop = imageDataTop.data, dataBottom = imageDataBottom.data;
          i_l = Math.min(dataTop.length, dataBottom.length);
          let a, b;
          for (i = 0; i < i_l; i++) {
            a = dataTop[i];
            b = dataBottom[i];

            if (a !== 255 || b !== 255)
              dataBottom[i] = a < b ? a : b;
          }
          ctxAlpha.putImageData(imageDataBottom, 0, textureSizeAlpha);
        }

        that.texture.alpha.update(false);

        // erzeuge Downloadlink der Textur
        if (AppComponent.app.state.debug && that.ringData.index === 0) {
          let link = document.getElementById('download_texture_alpha');
          if (link) {
            link.setAttribute('download', 'alpha.png');
            link.setAttribute('href', ctxAlpha.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
          }
        }
        // <= Alpha


        // => Bevel Alpha
        let hasChannel = false;
        that.ringData.stone.forEach(function (e: iPresetStone) {
          if (e.mode == 30)
            hasChannel = true;
        })

        // if (USE_BEVEL_ALPHA && that.doubledTextures.alphaBevel && that.context.alphaBevel)
        if (1) {
          ctxAlpha = that.context.alphaBevel;// that.doubledTextures.alphaBevel.getContext();
          ctxAlpha.fillStyle = "#fff";
          ctxAlpha.strokeStyle = "#fff";
          ctxAlpha.lineWidth = 0.1;
          ctxAlpha.beginPath();
          ctxAlpha.moveTo(0, 0);
          ctxAlpha.lineTo(0, textureSizeAlpha * 2);
          ctxAlpha.lineTo(textureSizeAlpha * 2, textureSizeAlpha * 2);
          ctxAlpha.lineTo(textureSizeAlpha * 2, 0);
          ctxAlpha.closePath();
          ctxAlpha.fill();

          ctxAlpha.save();

          ctxAlpha.translate(0, textureSizeAlpha_half);
          ctxAlpha.fillStyle = "#000";
          ctxAlpha.strokeStyle = "#000";

          if (!hasChannel) {
            that.meshData.forEach(function (e) {
              if (e.outline && e.type == "gap") {
                // alpha für Bevel
                vec = e.outline;
                ctxAlpha.beginPath();

                i_l = vec.length;
                for (i = 1; i < i_l; i++) {
                  u = Math.round(vec[i].u * textureSizeAlpha);
                  v = Math.round(vec[i].v * textureSizeAlpha);
                  if (i == 0)
                    ctxAlpha.moveTo(u, v);
                  else
                    ctxAlpha.lineTo(u, v);
                }

                ctxAlpha.closePath();
                ctxAlpha.fill();
              }
            })
          }

          ctxAlpha.restore();

          // Kopien der Texturdaten nach oben und unten anfertigen
          imageData = ctxAlpha.getImageData(0, textureSizeAlpha_half, textureSizeAlpha, textureSizeAlpha_half);
          ctxAlpha.putImageData(imageData, 0, textureSizeAlpha + textureSizeAlpha_half);
          imageData = ctxAlpha.getImageData(0, textureSizeAlpha, textureSizeAlpha, textureSizeAlpha_half);
          ctxAlpha.putImageData(imageData, 0, 0);

          that.texture.alphaBevel.update(false);

          // erzeuge Downloadlink der Textur
          if (AppComponent.app.state.debug && that.ringData.index === 0) {
            let link = document.getElementById('download_texture_alpha_bevel');
            if (link) {
              link.setAttribute('download', 'alpha_bevel.png');
              link.setAttribute('href', ctxAlpha.canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
            }
          }
          // <=
        }
      }

      // ==> TEXTUREN ZUWEISEN =========================================================================================
      let surfaceId: number;
      let type: string;

      that.mesh.forEach(function (e) {
        if (e.name.includes("alpha")) return;
        // @ts-ignore
        type = e.name.substring(0, 1);

        if (e.name.startsWith("frontBevel")) {
          type = "bev";
          surfaceId = -2;
        } else if (e.name.startsWith("frontChannel") || e.name.includes("crossChannel")) {
          type = "frontChannel";
          surfaceId = -2;
        } else if (e.name.startsWith("frontCut") || e.name.startsWith("krabbe")) {
          type = "frontCut";
          surfaceId = -3;
        } else if (e.name.startsWith("sideBevel") || e.name.startsWith("sideChannel")) {
          type = "";
          surfaceId = -2;
        } else if (type == "f")
          surfaceId = that.ringData.surface[parseInt(e.name.substring(1))];
        else if (type == "b")
          surfaceId = -1;
        else if (e.name == "sl" || e.name == "sr")
          surfaceId = 0;
        else if (e.name == "gap")
          surfaceId = that.ringData.gapSurface;
        else
          surfaceId = -99;


        if (surfaceId >= -3) {
          let mat = that.material.find(function (e) {
            return e.surfaceId == surfaceId;
          });

          if (mat) {
            if (mat.material.bumpTexture) {
              //@ts-ignore
              mat.material.bumpTexture.uScale = that.ringData.ringWidth * mat.uScale / 1000;
              //@ts-ignore
              mat.material.bumpTexture.vScale = that.ringData.ringSize * mat.vScale / 1000;
              //@ts-ignore
              mat.material.bumpTexture.vOffset = 0.5;
            }

            if (0) { // @ts-ignore
              mat.material._albedoTexture = webgl.textureUV;
            } else
              mat.material.albedoTexture = that.texture.albedo;

            if (type == "f" || e.name == "gap" || type == "b") {
              mat.material.opacityTexture = that.texture.alpha;
              mat.material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
              mat.material.needDepthPrePass = true;
              // mat.material.backFaceCulling = true;
            }
            if (type === "frontChannel" || type == "frontCut") {
              mat.material.opacityTexture = null;
              mat.material.backFaceCulling = false;
              // mat.material.transparencyMode = Material.MATERIAL_ALPHATEST;//ANDBLEND;
              // mat.material.needDepthPrePass = false;
            }
            if (/*USE_BEVEL_ALPHA && */type === "bev") {
              mat.material.opacityTexture = that.texture.alphaBevel;
              mat.material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
              mat.material.needDepthPrePass = false;
            }

            // @ts-ignore
            // mat.material.needAlphaTesting = () => mat.material.opacityTexture != null;
            e.material = mat.material;
          }
        } else if (e.name == "helper") { // @ts-ignore
          e.material = webgl.matWireframe;
        }
      })

      that.milgrain.update();

      return true;
    }())
      return;

    that.flags &= ~eRingFlags.IsComputing;
    that.flags &= ~eRingFlags.InvalidateMaterialOnly;
    this.flags |= eRingFlags.IsValid;
    this.ringData.isDirty = false;

    this.calc.lastComputed = new Date().getTime();

    WebglComponent.busyCounter++;
    WebglComponent.WEBGL.renderFrame(AppComponent.app.data.webglSettings.forceFrames);
  }

  private drawExteriorEngraving(
    ctx: ICanvasRenderingContext,
    textureSize: number,
    textureSizeHalf: number,
    scaleHeight: number,
    baseFontSize: number,
    target: EngravingTextureTarget
  ) {
    const config = this.ringData.exteriorEngraving;
    if (!config.enabled || config.type === "none") return;

    const ringPairActive = RingData.list[0]?.cartActive && RingData.list[1]?.cartActive;
    const isSplitPair = ringPairActive && config.placement === "split-pair" && (config.type === "waveform" || config.type === "fingerprint");
    const splitIndex = this.ringData.index === 0 ? 0 : 1;
    const width = textureSize * 0.78;
    const height = Math.max(textureSize * 0.11, baseFontSize * 2.4);
    const drawY = 0;
    const fontSize = this.getEngravingTextFontSize(baseFontSize) * 1.35;

    ctx.save();
    this.applyEngravingCanvasTransform(ctx, "outer", textureSize, textureSizeHalf, this.getOuterEngravingProfileU(), 1.0);
    ctx.scale(1.0, scaleHeight);
    ctx.globalAlpha = target === "albedo" ? (AppComponent.app.data.engraving.alpha ?? 0.5) : 1.0;
    ctx.fillStyle = target === "albedo" ? (AppComponent.app.data.engraving.color || "#000000") : "#00ff00";
    ctx.strokeStyle = ctx.fillStyle;
    (ctx as unknown as CanvasRenderingContext2D).lineCap = "round";
    (ctx as unknown as CanvasRenderingContext2D).lineJoin = "round";

    if (isSplitPair) {
      ctx.beginPath();
      if (splitIndex === 0) {
        ctx.rect(-width / 2, -height, width / 2, height * 2);
      } else {
        ctx.rect(0, -height, width / 2, height * 2);
      }
      ctx.clip();
    }

    switch (config.type) {
      case "text":
        this.drawExteriorText(ctx, String(config.text ?? ""), Number(config.fontId ?? 0), fontSize, drawY, width);
        break;
      case "coordinates":
        this.drawExteriorCoordinates(ctx, fontSize, drawY, width);
        break;
      case "waveform":
        this.drawExteriorWaveform(ctx, width, height, drawY, isSplitPair ? splitIndex : -1);
        break;
      case "fingerprint":
        this.drawExteriorFingerprint(ctx, width, height * 1.35, drawY, isSplitPair ? splitIndex : -1);
        break;
    }

    ctx.restore();
  }

  private applyEngravingCanvasTransform(
    ctx: ICanvasRenderingContext,
    surface: EngravingSurface,
    textureSize: number,
    textureSizeHalf: number,
    profileU: number,
    _scaleHeight: number
  ) {
    const clampedU = Math.max(0.08, Math.min(0.92, profileU));
    const x = surface === "inner"
      ? textureSize + clampedU * textureSize
      : clampedU * textureSize;
    ctx.translate(x, textureSize);
    ctx.rotate(-Math.PI / 2.0);
  }

  private getEngravingTextFontSize(baseFontSize: number): number {
    const t = this.ringData.ringWidth / 2 - 0.5;
    if (t > 2500) return baseFontSize * 2.2;
    if (t < 1500) return baseFontSize * 1.5;
    return baseFontSize * 2.0;
  }

  private getOuterEngravingProfileU(): number {
    const vertices = this.profile.frontVertices;
    if (!vertices.length) return 0.5;
    let minZ = Infinity;
    vertices.forEach(vertex => {
      if (Number.isFinite(vertex.z) && vertex.z < minZ) minZ = vertex.z;
    });
    if (!Number.isFinite(minZ)) return 0.2;

    const outerBand = vertices.filter(vertex => Math.abs(vertex.z - minZ) < 30 && Number.isFinite(vertex.u));
    if (!outerBand.length) return 0.2;
    const u = outerBand.reduce((sum, vertex) => sum + vertex.u, 0) / outerBand.length;
    return Number.isFinite(u) ? u : 0.2;
  }

  private drawExteriorText(ctx: ICanvasRenderingContext, text: string, fontId: number, fontSize: number, y: number, maxWidth: number) {
    if (!text.trim()) return;
    ctx.font = `${fontSize}px "engraving-${fontId}"`;
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.7;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.25;
    const fitScale = metrics.width > maxWidth ? maxWidth / metrics.width : 1.0;
    ctx.save();
    ctx.scale(fitScale, fitScale);
    ctx.fillText(text, -metrics.width / 2, (y / fitScale) + (ascent - descent) / 2);
    ctx.restore();
  }

  private drawExteriorCoordinates(ctx: ICanvasRenderingContext, fontSize: number, y: number, maxWidth: number) {
    const config = this.ringData.exteriorEngraving;
    const text = formatCoordinates(config);
    if (!text) return;
    ctx.font = `${fontSize * 0.72}px Arial`;
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.5;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
    const fitScale = metrics.width > maxWidth ? maxWidth / metrics.width : 1.0;
    ctx.save();
    ctx.scale(fitScale, fitScale);
    ctx.fillText(text, -metrics.width / 2, y + (ascent - descent) / 2);
    ctx.restore();
  }

  private drawExteriorWaveform(ctx: ICanvasRenderingContext, width: number, height: number, y: number, splitIndex: number) {
    const startX = -width / 2;
    const points = 120;
    ctx.lineWidth = Math.max(1.5, height * 0.085);
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = i / points;
      const x = startX + t * width;
      const amp = (
        Math.sin(t * Math.PI * 10.0) * 0.42 +
        Math.sin(t * Math.PI * 23.0 + 0.8) * 0.25 +
        Math.sin(t * Math.PI * 41.0 + 1.7) * 0.13
      );
      const envelope = Math.sin(Math.PI * t);
      const yy = y + amp * envelope * height;
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    if (splitIndex >= 0) {
      ctx.lineWidth = Math.max(1, height * 0.035);
      ctx.beginPath();
      ctx.moveTo(0, y - height * 0.85);
      ctx.lineTo(0, y + height * 0.85);
      ctx.stroke();
    }
  }

  private drawExteriorFingerprint(ctx: ICanvasRenderingContext, width: number, height: number, y: number, splitIndex: number) {
    ctx.lineWidth = Math.max(1.1, height * 0.025);
    const rings = 9;
    for (let i = 0; i < rings; i++) {
      const rx = width * (0.08 + i * 0.035);
      const ry = height * (0.13 + i * 0.045);
      const start = -Math.PI * (0.78 - i * 0.018);
      const end = Math.PI * (0.78 - i * 0.02);
      ctx.beginPath();
      (ctx as unknown as CanvasRenderingContext2D).ellipse(0, y, rx, ry, -0.18, start, end);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const x = -width * 0.22 + i * width * 0.085;
      ctx.beginPath();
      ctx.moveTo(x, y - height * 0.12);
      ctx.quadraticCurveTo(x + width * 0.035, y - height * 0.38, x + width * 0.12, y - height * 0.28);
      ctx.stroke();
    }
    if (splitIndex >= 0) {
      ctx.lineWidth = Math.max(1, height * 0.018);
      ctx.beginPath();
      ctx.moveTo(0, y - height * 0.78);
      ctx.lineTo(0, y + height * 0.78);
      ctx.stroke();
    }
  }

  static interpolate(xPos: number, vecArray: CVertex[], startIndex: number = 0/*, range: number = 50*/): iInterpolateResult //
  {
    let vecArrayIndex = 0, i;
    if (startIndex < 0) startIndex = 0;
    if (startIndex >= vecArray.length - 1) startIndex = 0;
    for (i = startIndex; i < vecArray.length; i++) {
      if (vecArray[i].x > xPos)
        break;
      vecArrayIndex = i;
    }

    let indexA = vecArrayIndex;
    let indexB = vecArrayIndex >= vecArray.length - 1 ? indexA : vecArrayIndex + 1;

    if (indexA == indexB) {
      return {
        x: xPos,
        z: vecArray[indexA].z,
        indexVectorA: indexA,
        indexVectorB: indexB,
        startIndex: startIndex,
        uv_u: vecArray[indexA].u,
      }
    } else {
      let pA = vecArray[indexA];
      let pB = vecArray[indexB];

      let AX = xPos - pA.x;
      let XB = pB.x - xPos;
      let AB = pB.x - pA.x;

      let v1 = TEMP.Vertex_1;
      let scale = AX / AB;
      pA.lerpToRef(pB, scale, v1);

      let fA = AX / AB, fB = XB / AB;
      if (fA < 0.25) {
        if (indexA > 0) {
          indexA--;
        }
      } else if (fB < 0.25) {
        if (indexB < vecArray.length - 1) {
          indexB++;
        }
      }

      return {
        x: v1.x,
        z: v1.z,
        indexVectorA: indexA,
        indexVectorB: indexB,
        startIndex: startIndex,
        uv_u: v1.u,
      }
    }
  }

  static interpolate_distance(xPos: number, vecArray: CVertex[], distance: number): iInterpolateResult //
  {
    let result = cRing.interpolate(xPos, vecArray);

    if (distance > 0) {
      let v = new CVertex(result.x, 0, result.z),
        vB = new CVertex(0, 0, 0),
        maxIndex = vecArray.length,
        indexA,
        indexB = result.indexVectorB;

      while (indexB < maxIndex) {

        vB.x = vecArray[indexB].x;
        vB.z = vecArray[indexB].z;
        if (v.distance(vB) >= distance) {
          indexA = indexB - 1;
          let pA = vecArray[indexA];
          let pB = vecArray[indexB];

          let distance_A = v.distance(pA);
          let distance_B = v.distance(pB);

          let AX = distance - distance_A;
          let XB = distance_B - distance;
          let AB = distance_B - distance_A;

          let v1 = TEMP.Vertex_1;
          let scale = AX / AB;
          pA.lerpToRef(pB, scale, v1);

          let fA = AX / AB, fB = XB / AB;
          if (fA < 0.25) {
            if (indexA > 0) {
              indexA--;
            }
          } else if (fB < 0.25) {
            if (indexB < vecArray.length - 1) {
              indexB++;
            }
          }

          result.x = v1.x;
          result.z = v1.z;
          result.indexVectorA = indexA;
          result.indexVectorB = indexB;
          result.startIndex = 0;
          result.uv_u = v1.u;
          break;
        }

        indexB++;
      }
    } else {
      let v = new CVertex(result.x, 0, result.z),
        vA = new CVertex(0, 0, 0),
        indexA = result.indexVectorA,
        indexB;

      distance = -distance;

      while (indexA > 0) {
        vA.x = vecArray[indexA].x;
        vA.z = vecArray[indexA].z;
        if (v.distance(vA) >= distance) {
          indexB = indexA + 1;
          let pA = vecArray[indexA];
          let pB = vecArray[indexB];

          let distance_A = v.distance(pA);
          let distance_B = v.distance(pB);

          let AX = distance_A - distance;
          let XB = distance - distance_B;
          let AB = distance_A - distance_B;

          let v1 = TEMP.Vertex_1;
          let scale = AX / AB;
          pA.lerpToRef(pB, scale, v1);

          let fA = AX / AB, fB = XB / AB;
          if (fA < 0.25) {
            if (indexA > 0) {
              indexA--;
            }
          } else if (fB < 0.25) {
            if (indexB < vecArray.length - 1) {
              indexB++;
            }
          }

          result.x = v1.x;
          result.z = v1.z;
          result.indexVectorA = indexA;
          result.indexVectorB = indexB;
          result.startIndex = 0;
          result.uv_u = v1.u;

          break;
        }

        indexA--;
      }
    }

    return result;
  }

  static interpolate_distance_2(vecArray: CVertex[], startIndex: number, distance: number): iInterpolateResult {
    let xPos = 0, indexA = 0, indexB = 0;

    if (vecArray.length < startIndex)
      startIndex = 0;

    let vStart = vecArray[startIndex], v1, v2, d1, d2;

    if (distance > 0) {
      for (let i = startIndex + 1, i_l = vecArray.length - 1; i < i_l; i++) {
        v1 = vecArray[i];
        d1 = vStart.distance(v1);
        v2 = vecArray[i + 1];
        d2 = vStart.distance(v2);
        if (d1 <= distance && d2 >= distance) {
          indexA = i;
          indexB = i + 1;
        } else if (d2 <= distance && d1 >= distance) {
          indexA = i + 1;
          indexB = i;
        } else continue;

        let AX = distance - d1;
        // let XB = d2 - distance;
        let AB = d2 - d1;

        let V = TEMP.Vertex_1;
        let scale = AX / AB;
        v1.lerpToRef(v2, scale, V);

        return {
          x: V.x,
          z: V.z,
          indexVectorA: indexA,
          indexVectorB: indexB,
          startIndex: 0,
          uv_u: V.u
        }
      }
    } else {
      distance = -distance;
      for (let i = startIndex - 1; i > 1; i--) {
        v1 = vecArray[i];
        d1 = vStart.distance(v1);
        v2 = vecArray[i - 1];
        d2 = vStart.distance(v2);
        if (d1 <= distance && d2 >= distance) {
          indexA = i;
          indexB = i - 1;
        } else if (d2 <= distance && d1 >= distance) {
          indexA = i - 1;
          indexB = i;
        } else continue;

        let AX = distance - d1;
        // let XB = d2 - distance;
        let AB = d2 - d1;

        let V = TEMP.Vertex_1;
        let scale = AX / AB;
        v1.lerpToRef(v2, scale, V);

        return {
          x: V.x,
          z: V.z,
          indexVectorA: indexA,
          indexVectorB: indexB,
          startIndex: 0,
          uv_u: V.u
        }
      }
    }

    return {
      x: xPos,
      z: vecArray[indexA].z,
      indexVectorA: indexA,
      indexVectorB: indexB,
      startIndex: startIndex,
      uv_u: vecArray[indexA].u,
    }
  }

  private extrude_shape_xy(shape: CVertex[], path: CVertex[], zContour: CVertex[] = this.profile.frontVertices, close: boolean = true, alignY = true) //
  {
    let V1 = TEMP.Vertex_1;
    let V2 = TEMP.Vertex_2;
    let normal = new CVertex(0, 0, 1.0);
    let vX = new CVertex(1, 0, 0);

    let rows = [], row, finalRow, lastPath = path.length - 1, theta = 0, index = 0, i, j, j_l, v, IP;

    for (i = 1; i <= lastPath; i++) {
      path[i].subToRef(path[i - 1], V1);
      CVertex.crossToRef(V1, normal, V2);

      theta = CVertex.angleXY(V2, vX);
      if (V2.y < 0) theta = -theta;

      row = [];
      finalRow = [];
      j_l = shape.length;
      for (j = 0; j < j_l; j++) {
        v = CVertex.fromVertex(shape[j]);
        v.rotateZ(theta);
        v.add(path[i - 1]);

        row.push(v);
      }

      j_l = row.length;
      for (j = 0; j < j_l; j++) {
        v = row[j];
        IP = cRing.interpolate(v.x, zContour, 0);

        if (v.z < IP.z) {
          let p1: iPoint = {x: zContour[IP.indexVectorA].x, y: zContour[IP.indexVectorA].z};
          let p2: iPoint = {x: zContour[IP.indexVectorB].x, y: zContour[IP.indexVectorB].z};
          let p3: iPoint = {x: v.x, y: v.z};
          let p4: iPoint = {
            x: j == j_l - 1 ? row[j - 1].x : row[j + 1].x,
            y: j == j_l - 1 ? row[j - 1].z : row[j + 1].z
          };

          let pI = calculateIntersection(p1, p2, p3, p4);
          if (pI != null) {
            v.x = pI.x;
            v.z = pI.y;
          } else
            continue;
        } else {
          if (j == 0 || j == j_l - 1)
            v.z = IP.z;
        }

        v.u = cRing.interpolate(v.x, zContour).uv_u;
        // Fehler bei Wellenfuge an rechter Ringseite. Die Fuge wurde an den Wellenbergen über den Ringrand hinaus gezeichnet
        // v.u = this.interpolate(v.x, zContour, IP.indexVectorA).uv_u;
        v.v = v.y;

        finalRow.push(v);
      }

      rows.push(finalRow);
    }

    /*
    Richtet die Y-Werte am Pfad aus.
    Die Y-Werte einer Reihe haben alle den selben Wert.
    */

    if (alignY) {
      for (i = 0; i < lastPath; i++) {
        row = rows[i];

        let p1: iPoint = {x: 0, y: path[i].y};
        let p2: iPoint = {x: 100, y: path[i].y};
        let p3: iPoint = {x: 0, y: 0};
        let p4: iPoint = {x: 0, y: 0};

        j_l = row.length;
        for (j = 0; j < j_l; j++) {
          p3.x = row[j].x;
          p3.y = row[j].y;
          try {
            if (i == lastPath - 1) {
              let l = rows[i - 1].length;
              if (j >= l) {
                p4.x = rows[i - 1][l - 1].x;
                p4.y = rows[i - 1][l - 1].y;
              } else {
                p4.x = rows[i - 1][j].x
                p4.y = rows[i - 1][j].y
              }
            } else {
              let l = rows[i + 1].length;
              if (j >= l) {
                p4.x = rows[i + 1][l - 1].x;
                p4.y = rows[i + 1][l - 1].y;
              } else {
                p4.x = rows[i + 1][j].x
                p4.y = rows[i + 1][j].y
              }
            }
          } catch (e) {
            console.log(i, j, rows);
            throw "er";
          }

          let pI = calculateIntersection(p1, p2, p3, p4);

          if (pI) {
            IP = cRing.interpolate(pI.x, zContour);
            row[j].x = pI.x;
            row[j].y = pI.y;
            if (j == 0 || j == j_l - 1)
              row[j].z = IP.z;
          }
        }
      }
    }

    index = 0;
    for (i = 0; i < rows.length; i++) {
      row = rows[i];
      for (j = 0; j < row.length; j++)
        row[j].i = index++;
    }

    if (close) {
      row = [];
      let row_0 = rows[0];
      j_l = row_0.length;
      for (j = 0; j < j_l; j++) {
        v = CVertex.fromVertex(row_0[j]);
        v.sub(path[0]);
        v.add(path[lastPath]);
        v.v = v.y;
        v.i = index++;
        row.push(v);
      }
      rows.push(row);
    }

    return rows;
  }

  private static outline(vec: CVertex[][], ccw: boolean = false, minIndex: number | null = null, maxIndex: number | null = null) //
  {
    let path: CVertex[] = [], i, i_l = vec.length;

    if (minIndex == null) minIndex = 0;
    if (maxIndex == null) maxIndex = 0;

    if (ccw) {
      for (i = 0; i < i_l; i++)
        path.push(vec[i][vec[i].length - 1 - maxIndex]);
      for (i = i_l - 1; i >= 0; i--)
        path.push(vec[i][minIndex]);
    } else {
      for (i = 0; i < i_l; i++)
        path.push(vec[i][minIndex]);
      for (i = i_l - 1; i >= 0; i--)
        path.push(vec[i][vec[i].length - 1 - maxIndex]);
    }

    return path;
  }

  private computeUV_V(vec: CVertex[] | CVertex[][], scale: number) //
  {
    let calc = function (row: CVertex[]) {
      try {
        let i;
        for (i = 0; i < row.length; i++) {
          row[i].v = row[i].y * scale;
        }
      } catch (e) {
        console.log(row);
        throw "error";
      }
    };

    if (Array.isArray(vec[0])) {
      let i;
      for (i = 0; i < vec.length; i++) {
        calc(<CVertex[]>vec[i]);
      }
    } else {
      calc(<CVertex[]>vec);
    }
  }

  private disposeMeshes() //
  {
    this.milgrain?.dispose();

    let i, webgl = WebglComponent.WEBGL;
    for (i = 0; i < this.mesh.length; i++) //
    {
      if (this.mesh[i]) //
      {
        webgl?.scene.removeMesh(this.mesh[i]);
        const meshMaterial = this.mesh[i].material;
        if (meshMaterial && !this.mesh[i].name.includes("instance")) {
          if (meshMaterial.name?.startsWith("stone_color_")) {
            meshMaterial.dispose();
          }
          this.mesh[i].material = null;
        }
        try {
          this.mesh[i].dispose();
        } catch (e) {
          console.log(e);
        }
      }
    }

    this.mesh = [];
    this.meshData = [];
  }

  private isDivMode_h_s(): boolean //
  {
    let divMode = this.ringData.divPreset.slice(0, 1).toLowerCase();
    return (divMode === "s" || divMode === "h");
  }

  // Berechne alle möglichen Designfugenbereiche
  public gapDiv_calc(gapDiv: number[] | null = null, gapDivIndexIgnore: number | null = null): iMinMaxCur[] //
  {
    // Alle Teilungen beziehen sich auf die Mittelposition. Die Fugenbreiten werden in der Berechnung min/max bereits abgezogen.
    let j, pos: number, divMM = [], data = this.ringData;

    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == data.profileName;
    });

    if (!profile) return [];

    pos = 0;
    if (!this.isDivMode_h_s()) {
      for (j = 0; j < data.materialDiv.length - 1; j++) { // letztes Segment ignorieren
        pos += data.materialDiv[j];
        /*
        Die Trennfuge ist hier absichtlich immer 'aktiv'.
        Es wurde ein Fehler festgestellt, wodurch eine inaktive Trennfuge eine freie Fuge ermöglichte und dadurch die
        Materialteilung fehlerhaft erstellt wurde. Eine Designfuge auf der Position einer Trennfuge wurde nicht dargestell´t.
         */
        // if (this.ringData.gapEnabled[j])
        divMM.push(pos * data.ringWidth / 10000);
      }
    }

    divMM.push(data.ringWidth);

    if (!gapDiv)
      gapDiv = data.gapDiv;

    pos = 0;
    for (j = 0; j < gapDiv.length - 1; j++) {  // letztes Segment ignorieren
      pos += gapDiv[j];
      if (gapDivIndexIgnore != j)
        divMM.push(pos * data.ringWidth / 10000);
    }

    divMM.sort(function (a, b) {
      return a - b
    });

    let new_segment = function (min: number, max: number) {
      if (min > max) return;
      let size = max - min, half = Math.trunc(size / 2);
      segments.push({min, max, cur: min + half});
    };

    let gapGapDistance = data.hasWave ? profile.gapGapDistanceWave : profile.gapGapDistance;
    let minSize = data.gapWidth + gapGapDistance,
      segments: iMinMaxCur[] = [],
      min = this.calc.gapSafeLeft + this.calc.wa_mm, max;

    for (j = 0; j < divMM.length - 1; j++) {
      max = divMM[j] - minSize;
      new_segment(min, max);
      min = max + minSize * 2;
    }

    new_segment(min, data.ringWidth - this.calc.gapSafeRight - this.calc.wa_mm);

    return segments;
  }

  // Ermittle die Positionen für die Designfugen; verschiebe oder entferne die Designfuge wenn notwendig
  public normalizeFreeGaps(): void
  {
    this.gapDiv_adapt();
  }

  public setFreeGapDiv(gapDiv: number[]): void
  {
    RingData.setGapDivArray(this.ringData, Array.isArray(gapDiv) ? gapDiv.slice() : []);
    this.gapDiv_adapt();
  }

  private gapDiv_adapt() //
  {
    let data = this.ringData;
    let gapDiv = data.gapDiv.slice(0),
      gapDiv_mm = [] as number[],
      gapDivCount = gapDiv.length;

    let i, j: number, t: number, gapDiv_segments, move: boolean, a, b;

    if (gapDiv.length < 2) {
      RingData.setGapDivArray(data, []);
      this.calc.gapDivMinMax = this.gapDiv_calc([]);
      return;
    }

    // Teilungssumme ermitteln; Diese muss 10000 betragen
    let sum = 0;
    gapDiv.forEach(function (e: number) {
      sum += e;
    });

    // Teilung ggf. korigieren
    if (sum < 10000 || sum > 10000) {
      gapDiv.forEach(function (e: number, i: number) {
        gapDiv[i] = Math.round((10000 * e) / sum);
      })
    }

    j = 0;
    for (i = 0; i < gapDiv.length - 1; i++) {
      t = Math.round(j + gapDiv[i] * data.ringWidth / 10000);
      gapDiv_mm.push(t);
      j = t;
    }

    gapDiv_segments = this.gapDiv_calc([10000]); // 10000

    let gapDiv_new = [];
    t = 0;
    for (i = 0; i < gapDiv_mm.length; i++) {
      move = false;
      for (j = 0; j < gapDiv_segments.length; j++) {

        if (gapDiv_mm[i] >= gapDiv_segments[j].min && gapDiv_mm[i] <= gapDiv_segments[j].max) {
          gapDiv_new.push(gapDiv_mm[i]);
          break;
        } else {
          move = true;
        }
      }

      // kein Segment gefunden...Fugenposition in nächstmögliches Segment verschieben
      if (move) {
        for (j = 0; j < gapDiv_segments.length; j++) {
          if (j < gapDiv_segments.length - 1) {
            if (gapDiv_mm[i] >= gapDiv_segments[j].max && gapDiv_mm[i] <= gapDiv_segments[j + 1].min) {
              a = gapDiv_mm[i] - gapDiv_segments[j].max;
              b = gapDiv_segments[j + 1].min - gapDiv_mm[i];

              gapDiv_new.push(a < b ? gapDiv_segments[j].max : gapDiv_segments[j + 1].min);
              break;
            }
          }
          if (j == 0) {
            if (gapDiv_mm[i] < gapDiv_segments[j].min) {
              gapDiv_new.push(gapDiv_segments[j].min);
              break;
            }
          }
          if (j == gapDiv_segments.length - 1) {
            if (gapDiv_mm[i] > gapDiv_segments[j].max) {
              gapDiv_new.push(gapDiv_segments[j].max);
              break;
            }
          }
        }
      }

      gapDiv_new.sort(function (a, b) {
        return a - b;
      });

      t = 0;
      gapDiv = [];
      gapDiv_new.forEach(function (e) {
        gapDiv.push(Math.round((e - t) * 10000 / data.ringWidth));
        t = e;
      })
      gapDiv.push(Math.round((data.ringWidth - t) * 10000 / data.ringWidth));

      gapDiv_segments = this.gapDiv_calc(gapDiv);
    }

    const baseSegments = this.gapDiv_calc([10000]);
    const normalizedPositions = this.normalizeFreeGapPositions(gapDiv_new, baseSegments);
    this.debugFreeGapNormalization(gapDiv_mm, normalizedPositions, gapDiv, baseSegments);
    gapDiv = this.buildGapDivFromPositions(normalizedPositions);
    gapDiv_segments = this.gapDiv_calc(gapDiv);

    RingData.setGapDivArray(data, gapDiv);
    // this.ringData.gapDiv = gapDiv;
    this.calc.gapDivMinMax = gapDiv_segments;

    if (gapDivCount > data.gapDiv.length)
      Log("info", "Die Anzahl der freien Fugen wurden angepasst.");
    // else if (moved_index.length > 0)
    //   Log("info", "Die freien Fugen wurden verschoben.");
  }

  private normalizeFreeGapPositions(positions: number[], segments: iMinMaxCur[]): number[]
  {
    const data = this.ringData;
    const normalized: number[] = [];
    const baseSegments = segments && segments.length ? segments : this.gapDiv_calc([10000]);
    const minDistance = this.getFreeGapMinimumDistance();

    positions
      .filter(position => Number.isFinite(position))
      .sort((a, b) => a - b)
      .forEach(position => {
        const snapped = this.findNearestValidFreeGapPosition(position, normalized, baseSegments, minDistance);
        if (snapped === null) {
          return;
        }
        if (!normalized.some(existing => Math.abs(existing - snapped) < 1)) {
          normalized.push(snapped);
          normalized.sort((a, b) => a - b);
        }
      });

    return normalized.filter(position => position > 0 && position < data.ringWidth);
  }

  private findNearestValidFreeGapPosition(position: number, accepted: number[], segments: iMinMaxCur[], minDistance: number): number | null
  {
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    segments.forEach(segment => {
      const min = segment.min;
      const max = segment.max;
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
        return;
      }

      const candidates = [
        Math.max(min, Math.min(max, position)),
        min,
        max,
      ];

      accepted.forEach(existing => {
        candidates.push(existing - minDistance);
        candidates.push(existing + minDistance);
      });

      candidates.forEach(candidate => {
        if (candidate < min || candidate > max) {
          return;
        }
        if (accepted.some(existing => Math.abs(existing - candidate) < minDistance)) {
          return;
        }
        const distance = Math.abs(candidate - position);
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      });
    });

    return best;
  }

  private buildGapDivFromPositions(positions: number[]): number[]
  {
    const data = this.ringData;
    if (!positions.length || data.ringWidth <= 0) {
      return [];
    }

    const gapDiv: number[] = [];
    let last = 0;
    positions
      .filter(position => Number.isFinite(position))
      .sort((a, b) => a - b)
      .forEach(position => {
        const current = Math.max(0, Math.min(data.ringWidth, position));
        gapDiv.push(Math.round((current - last) * 10000 / data.ringWidth));
        last = current;
      });

    const sum = gapDiv.reduce((a, b) => a + b, 0);
    gapDiv.push(Math.max(0, 10000 - sum));
    return gapDiv;
  }

  private getFreeGapMinimumDistance(): number
  {
    const data = this.ringData;
    const profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == data.profileName;
    });
    const profileGapDistance = data.hasWave ? profile?.gapGapDistanceWave : profile?.gapGapDistance;
    const fallback = data.gapWidth + (Number.isFinite(profileGapDistance) ? Number(profileGapDistance) : 300);
    const rules = (AppComponent.app.data as unknown as Record<string, unknown>)["featureRules"];
    const freeGapRules = rules && typeof rules === "object" && !Array.isArray(rules)
      ? (rules as Record<string, unknown>)["freeGap"]
      : null;
    const configured = freeGapRules && typeof freeGapRules === "object" && !Array.isArray(freeGapRules)
      ? Number((freeGapRules as Record<string, unknown>)["minDistanceToOtherGap"] ?? (freeGapRules as Record<string, unknown>)["snapTolerance"])
      : NaN;

    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }
    return Number.isFinite(fallback) && fallback > 0 ? fallback : data.gapWidth + 300;
  }

  private debugFreeGapNormalization(rawPositions: number[], finalPositions: number[], gapDiv: number[], segments: iMinMaxCur[]): void
  {
    try {
      if (!AppComponent.app.state.debug
        && !window.location.search.includes("debugFreeGap=1")
        && window.localStorage.getItem("ringconfFreeGapDebug") !== "1") {
        return;
      }
      console.info("[FreeGap]", {
        ringId: this.ringData.index,
        ringWidth: this.ringData.ringWidth,
        rawPositions,
        finalPositions,
        gapDiv,
        finalGapDiv: this.buildGapDivFromPositions(finalPositions),
        segments,
      });
    } catch {
    }
  }

  gapDiv_plus() {
    if (!this.calc.gapDivMinMax.length) return;
    let data = this.ringData,
      calc = this.calc,
      gapDivSegments = calc.gapDivMinMax,
      gapDiv = data.gapDiv,
      gapDivMM: number[] = [] as number[],
      i: number, j: number, t, max = -1, maxIndex = 0;

    j = 0;
    for (i = 0; i < gapDiv.length - 1; i++) {
      t = j + (gapDiv[i] * data.ringWidth / 10000);
      gapDivMM.push(t);
      j = t;
    }

    gapDivSegments.forEach(function (e, index) {
      t = e.max - e.min;
      if (t > max) {
        max = t;
        maxIndex = index;
      }
    })

    gapDivMM.push(gapDivSegments[maxIndex].cur);
    gapDivMM.sort(function (a, b) {
      return a - b
    });

    gapDiv = [];
    j = 0;
    gapDivMM.forEach(function (e) {
      gapDiv.push(Math.round((e - j) * 10000 / data.ringWidth));
      j = e;
    })

    let sum = gapDiv.reduce(function (a, b) {
      return a + b
    });

    gapDiv.push(10000 - sum);

    RingData.setGapDivArray(this.ringData, gapDiv);
    // this.gapDiv_adapt();
    // this.invalidate();
    // this.setLastAction("gapDiv");
  }

  // static handleFreeStone(ringId: number, size: number) //
  // {
  //   /*
  //   Wenn size == 0 Dann wird die Konfiguration geprüft.
  //
  //   Es wird hier die nächstmögliche Einfügeposition für einen Stein mit der angegebenen Größe gesucht.
  //   X ist dabei immer 0.
  //    */
  //   let stoneGroup = cRing.list[ringId].ringData.stone[cRing.curStoneGroup];
  //   if (stoneGroup) {
  //
  //     if (!stoneGroup.freeStones || stoneGroup.freeStones.length == 0) {
  //       if (size === 0)
  //         return;
  //
  //       stoneGroup.freeStones = [] as iFreeStone[];
  //       stoneGroup.freeStones.push({
  //         size: size,
  //         xDiv: 0,
  //         yRad: 0
  //       });
  //
  //       cRing.list[ringId].ringData.isDirty = true;
  //       return;
  //     }
  //
  //     let findStoneMode = function (mode: number) {
  //       let modes = AppComponent.app.data.stoneMode, result = null;
  //       for (let i = 0; i < modes.length; i++) {
  //         if (modes[i].mode === mode) {
  //           result = modes[i];
  //         } else if (modes[i].items) {
  //           // @ts-ignore
  //           for (let j = 0; j < modes[i].items.length; j++) {
  //             // @ts-ignore
  //             if (modes[i].items[j].mode === mode) {
  //               // @ts-ignore
  //               result = modes[i].items[j];
  //               break;
  //             }
  //           }
  //         }
  //
  //         if (result)
  //           break;
  //       }
  //
  //       return result;
  //     }
  //
  //     let that = cRing.list[ringId],
  //       xCenter = that.ringData.ringWidth / 2,
  //       yCenter = that.ringData.ringSize / 2,
  //       stoneMode = findStoneMode(stoneGroup.mode);
  //
  //     interface iXY {
  //       x: number;
  //       y: number;
  //       size: number;
  //     }
  //
  //     let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine
  //
  //     let getMinStonePosition = function (stoneSize: number) {
  //
  //       let step = 10,
  //         loopCount = 1000,
  //         safeDistance = 300,
  //         pos = xCenter - Math.trunc((xCenter - that.calc.stoneSafeLeft - stoneSize / 2) / step) * step,
  //         stoneType = getStoneCuts(AppComponent.app.data).find(e => {
  //           return e.id == 1;
  //         });
  //
  //       // console.log(pos, xCenter, that.calc.stoneSafeLeft, stoneSize / 2);
  //       //
  //       // if (xCenter - that.calc.stoneSafeLeft - stoneSize / 2 - pos < 0)
  //       //   return -1;
  //
  //       while (loopCount--) {
  //         let ipFront = cRing.interpolate(pos - xCenter, that.profile.frontVertices);
  //         let ipBack = cRing.interpolate(pos - xCenter, that.profile.backVertices);
  //         let maxStoneDepth = (ipBack.z - ipFront.z - safeDistance);
  //         let maxStoneSize = maxStoneDepth / (stoneType ? stoneType.sizeDepthFactor : 1);
  //
  //         if (stoneSize > maxStoneSize) {
  //           if (pos < that.ringData.ringWidth / 2)
  //             pos += step;
  //           else
  //             pos -= step;
  //
  //           if (pos < that.ringData.ringWidth / 2)
  //             continue;
  //
  //           pos = -1;
  //         }
  //
  //         break;
  //       }
  //
  //       if (pos != -1)
  //         return map(pos, 0, that.ringData.ringWidth, -xCenter, xCenter);
  //
  //       return pos;
  //     }
  //
  //     // 1. alle x-Werte auf Gültigkeit prüfen und ggf. korrigieren
  //     stoneGroup.freeStones.forEach(function (e, index) {
  //       let min = getMinStonePosition(e.size);
  //       let x = map(e.xDiv, -5000, 5000, -xCenter, xCenter),
  //         y = map(e.yRad, -Math.PI, Math.PI, -yCenter, yCenter);
  //
  //       if (min != -1) {
  //         if (x < 0 && x < min) x = min;
  //         else if (x > 0 && x > -min) x = -min;
  //
  //
  //         POINTS.push({x: x, y: y, size: e.size});
  //       } else {
  //         e.size = 0;
  //       }
  //     })
  //
  //     // 2. alle y-Werte auf Gültigkeit prüfen
  //     // -> sortieren
  //     POINTS.sort(function (a, b): number {
  //       return a.y - b.y;
  //     })
  //
  //     POINTS.forEach(function (e, index) {
  //
  //       if (index == 0)
  //         return;
  //
  //       let x = e.x, y = e.y,
  //         x0 = POINTS[index - 1].x,
  //         y0 = POINTS[index - 1].y;
  //       let minDistance = (e.size + POINTS[index - 1].size) / 2 + (stoneMode ? stoneMode.safeDistY : 0);
  //
  //       let distance = Math.sqrt(Math.pow(x - x0, 2) + Math.pow(y - y0, 2));
  //       if (distance < minDistance) {
  //         y = Math.sqrt(Math.pow(minDistance, 2) - Math.pow(x - x0, 2));
  //         y = e.y < 0 ? y0 - y : y0 + y;
  //         e.y = y;
  //       }
  //     })
  //
  //     let freeStones = [] as iFreeStone[];
  //     POINTS.forEach(e => {
  //       freeStones.push({
  //         size: e.size,
  //         xDiv: map(e.x, -xCenter, xCenter, -5000, 5000),
  //         yRad: map(e.y, -yCenter, yCenter, -Math.PI, Math.PI)
  //       });
  //     })
  //
  //     if (size > 0) {
  //       let yAdd = 0;
  //       if (Math.abs(POINTS[0].y) < Math.abs(POINTS[POINTS.length - 1].y)) {
  //         yAdd = POINTS[0].y - (size + POINTS[0].size) / 2 - (stoneMode ? stoneMode.safeDistY : 0);
  //       } else {
  //         yAdd = POINTS[POINTS.length - 1].y + (size + POINTS[POINTS.length - 1].size) / 2 + (stoneMode ? stoneMode.safeDistY : 0);
  //       }
  //
  //       // console.log(POINTS[0].y, POINTS[POINTS.length-1].y, yAdd);
  //       freeStones.push({
  //         size: size,
  //         xDiv: 0,
  //         yRad: map(yAdd, -yCenter, yCenter, -Math.PI, Math.PI)
  //       });
  //     }
  //
  //     stoneGroup.freeStones = freeStones;
  //     cRing.list[ringId].ringData.isDirty = true;
  //   }
  // }
}
