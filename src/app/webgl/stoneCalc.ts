import {cRing, iVertexArray} from "./cRing";
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {
  iFreeStone,
  iOutlineDataMeasurement,
  iPresetStone, iStoneDistances,
  iStoneMode,
  iStoneSize,
  iStoneCut
} from "../app.interfaces";
import {CMesh, CVertex, extrude, extrude_2, iPathVectors, subdivide, TEMP} from "./threeD";
import {Log} from "../logger/logger.component";
import {getProfile, getRowWidth, getStoneDistances, getStoneMode} from "../app.definitions";
import {getStoneCuts} from "../stone-taxonomy";

export interface iPoint {
  x: number;
  y: number;
}

export interface iStoneCalcData {
  minSize: number;
  maxSize: number;
  maxCount: number;
  maxRows: number;
  rowSizeXSafe?: number;
  coordinates?: iPoint[];
  segmentSizeXSafe?: number[];
}

function getLowerStoneSize_side(stoneType: number, maxSize: number): number {
  let type = getStoneCuts(AppComponent.app.data).find(function (e) {
    return (e.legacyId ?? e.id) === stoneType;
  })
  if (type) {
    let size = 0;
    for (let i = 0; i < type.size.length; i++) {
      if (type.size[i].calcSize) {
        // @ts-ignore
        if (type.size[i].calcSize <= maxSize)
          size = type.size[i].size;
      } else if (type.size[i].size <= maxSize)
        size = type.size[i].size;
    }
    return size;
  }

  return 0;
}

function getLowerStoneSize_front(ringData: RingData, stoneGroup: iPresetStone, stoneMode: iStoneMode, maxSize: number, options: any = null): number[] {
  // [0] = size, [1] = calcSize, [2] = stoneDepth
  // options: useRealStoneSize:boolean => safeDist wird nicht aufgerechnet (nicht gültig bei stoneMode 20)
  // options: stoneRows:number => Die Anzahl der Steinreihen, die zur Berechnung genutzt werden sollen

  // console.log("glss: maxSize: "+maxSize);
  let type = getStoneCuts(AppComponent.app.data).find(function (e) {
    return (e.legacyId ?? e.id) === stoneGroup.type;
  })
  if (type) {
    let size = 0, calcSize = 0, depth = 0;

    for (let i = 0; i < type.size.length; i++) {
      let s: number;

      if (type.size[i].calcSize !== undefined) //
      {
        s = <number>type.size[i].calcSize;
      }
        // else if (type.size[i].lengthFactor) //
        // {
        //   s = Math.sqrt(Math.pow(type.size[i].size, 2) + Math.pow(type.size[i].size * <number>type.size[i].lengthFactor, 2));
      // }
      else
        s = type.size[i].size;

      // if (stoneGroup.mode == 20) s = s * stoneGroup.rows + (stoneGroup.rows + 1) * stoneMode.safeDistX;
      // else
      {
        if (!options || (options && !options.useRealStoneSize))
          s = s + stoneMode.safeDistX * 2;
      }

      if (type.size[i].minRingHeight <= ringData.ringHeight &&
        type.size[i].minRingWidth <= ringData.ringWidth &&
        s <= maxSize) {
        size = type.size[i].size;
        calcSize = s;
        depth = size * type.sizeDepthFactor;
      }
    }

    return [size, calcSize, depth];
  } else console.log("Steintyp nicht erkannt!");

  return [0, 0, 0];
}

function map(value: number, low1: number, high1: number, low2: number, high2: number) {
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

function getStoneSizeItem(stoneType: number, size: number): iStoneSize | null {
  let type = getStoneCuts(AppComponent.app.data).find(function (e) {
    return (e.legacyId ?? e.id) === stoneType;
  })
  if (type) {
    for (let i = 0; i < type.size.length; i++) {
      if (type.size[i].size === size)
        return type.size[i];
    }
  }

  return null;
}

function getStoneTypeItem(stoneType: number) {
  return getStoneCuts(AppComponent.app.data).find(function (e) {
    return (e.legacyId ?? e.id) === stoneType;
  })
}

function get_sin(y: number, maxY: number, factor: number, waveCount: number): number {
  return Math.sin(map(y, 0, maxY, 0, Math.PI * 2 * waveCount)) * factor;
}

function getProfileDepth(x: number, ring: cRing) {
  let front = cRing.interpolate(x, ring.profile.frontVertices);
  let back = cRing.interpolate(x, ring.profile.backVertices);
  return back.z - front.z;
}

export function calcOutlineDataMeasurement(ring: cRing): iOutlineDataMeasurement[] | null {

  let ringData = ring.ringData;

  let profile = AppComponent.app.data.profile.find(e => {
    return e.name == ringData.profileName;
  })
  if (!profile) {
    console.log("Profil nicht erkannt!");
    return null;
  }

  /*
  Ablauf
  - (#1) ermittle alle Fugen- und Zwischenfugensegmente
  - (#2) sortiere diese von links nach rechts
  - (A)
  - (#3) prüfe ob die gewünschte Steingröße für den gewünschten Steintyp und -modus verfügbar ist
  - (#4) ermittle die gewünschte Steinposition
  - (#5) suche das Segment, was dieser Position am nächsten liegt
  - (#6) prüfe, ob die Steingröße in das Segmentpasst
  -   wenn nein: verringere die Steingröße bis es passt
  -   ist keine Steingröße möglich, entferne dieses Segment und beginne wieder bei (A) mit der ursprünglichen Steingröße, Typ und Modus
  -   wenn ja, prüfe, ob die Position das Segment überschneidet und verschiebe die Position entsprechend
  - (#7) prüfe, ob die Steingröße in die Profiltiefe an der gewünschten Position passt
  -   wenn nein: prüfe, ob die Position zur Ringmitte verschoben werden kann und die Profiltiefe dann ausreicht
  -   wenn nein: verringere die Steingröße
   */

  // (#1)
  let outlineDataMeasurement = [] as iOutlineDataMeasurement[];
  let outlineData = ring.calc.outlineFront;
  let profileDepthSafeDistanceToStone = 300;

  // Zwischenfugensegmente
  // console.log("outlineData = ", outlineData);

  outlineData.forEach(function (od, odIndex) {
    let length = od.length,
      halfIndex = length / 2,
      minX,
      maxX;

    let dist = 999999;

    if ((odIndex == 0) || (odIndex == outlineData.length - 1)) {
      for (let i = 0; i < halfIndex; i++) {
        let x1 = od[i].x;
        let x2 = od[length - 1 - i].x;
        let t = x2 - x1;
        if (t < dist) {
          dist = t;
        }
      }

      // dist -= amp100 * amp;
    } else dist = od[length - 1].x - od[0].x;

    if (odIndex == 0) {
      maxX = od[length - 1].x;
      minX = maxX - dist;
    } else if (odIndex == outlineData.length - 1) {
      minX = od[0].x;
      maxX = minX + dist;
    } else {
      minX = od[0].x;
      maxX = od[length - 1].x;
    }
    // console.log("index " + odIndex + ", maxX=" + maxX + ", dist=" + dist);

    let middlePosition = minX + (maxX - minX) / 2;
    let front = cRing.interpolate(middlePosition, ring.profile.frontVertices);
    let back = cRing.interpolate(middlePosition, ring.profile.backVertices);

    // ==>

    for (let i = 0; i < halfIndex; i++) {

    }
    // <==

    outlineDataMeasurement.push({
      minX: minX,
      maxX: maxX,
      distX: maxX - minX,
      // minHorzSafeDist: maxX - minX,
      onGap: false,
      middlePosition: middlePosition,
      middleDepth: back.z - front.z - profileDepthSafeDistanceToStone,
    })
  })

  // (#2) vorsortieren für die Fugensegmente
  outlineDataMeasurement.sort(function (a, b) {
    return a.middlePosition - b.middlePosition;
  });

  // Fugensegmente
  // if (!(stoneGroup.mode == 20 && ringData.gapWidth > 300))
  if (1) {
    outlineData = ring.calc.outlineGap;

    outlineData.forEach(function (od) {
      let length = od.length,
        halfIndex = length / 2,
        minX = 999999,
        maxX = -999999;

      for (let i = 0; i < halfIndex; i++) {
        let x = od[i].x;
        if (x < minX) minX = x;
        x = od[length - 1 - i].x;
        if (x > maxX) maxX = x;
      }

      let middle = minX + (maxX - minX) / 2;

      let frontSegmentLeft: iOutlineDataMeasurement;
      let frontSegmentRight: iOutlineDataMeasurement;

      outlineDataMeasurement.forEach(e => {
        if (e.maxX < middle) frontSegmentLeft = e;
        if (!frontSegmentRight && e.minX >= middle) frontSegmentRight = e;
      })

      // @ts-ignore
      if (!frontSegmentLeft || !frontSegmentRight) {
        // console.log(outlineDataMeasurement, odIndex);
        throw("here");
      }

      let middlePosition = od[0].x + (od[length - 1].x - od[0].x) / 2;
      let absMin = Math.abs(middlePosition - frontSegmentLeft.minX);
      let absMax = Math.abs(frontSegmentRight.maxX - middlePosition);

      if (absMin < absMax) {
        minX = frontSegmentLeft.minX;
        maxX = minX + absMin * 2;
      } else {
        maxX = frontSegmentRight.maxX;
        minX = maxX - absMax * 2;
      }

      let front = cRing.interpolate(middlePosition, ring.profile.frontVertices);
      let back = cRing.interpolate(middlePosition, ring.profile.backVertices);

      outlineDataMeasurement.push({
        minX: minX,
        maxX: maxX,
        distX: maxX - minX,
        // minHorzSafeDist: 99999,
        onGap: true,
        middlePosition: middlePosition,
        middleDepth: back.z - front.z - profileDepthSafeDistanceToStone,
        outline: od,
      })
    })
  }

  // (#2) nachsortieren inkl. Fugensegmente
  outlineDataMeasurement.sort(function (a, b) {
    return a.middlePosition - b.middlePosition;
  });

  // korrigieren der min/max Werte für die Fugen; Abgleich mit linker und rechter Nachbarfuge
  let lastGapSegment: iOutlineDataMeasurement | null = null;
  outlineDataMeasurement.forEach(e => {
    if (e.onGap) {
      if (lastGapSegment) {
        let gapWidthHalf = ringData.gapWidth / 2;
        let t = lastGapSegment.middlePosition + gapWidthHalf;
        if (e.minX < t) {
          e.minX = t;
          e.distX = e.maxX - e.minX;
        }

        t = e.middlePosition - gapWidthHalf;
        if (lastGapSegment.maxX > t) {
          lastGapSegment.maxX = t;
          lastGapSegment.distX = lastGapSegment.maxX - lastGapSegment.minX;
        }
      }

      lastGapSegment = e;
    }
  })

  return outlineDataMeasurement;
}

let getProfileMaxStoneDepth = function (ring: cRing, position: number, profileDepthSafeDistanceToStone: number = 300): number {
  let front = cRing.interpolate(position, ring.profile.frontVertices);
  let back = cRing.interpolate(position, ring.profile.backVertices);
  return back.z - front.z - profileDepthSafeDistanceToStone;
}
let getMaxStoneSizeFromDepth = function (stoneType: iStoneCut, depth: number): number {

  let found: iStoneSize | null = null;

  for (let i = 0; i < stoneType.size.length; i++) {
    let t = stoneType.size[i].size * stoneType.sizeDepthFactor;
    if (t <= depth) found = stoneType.size[i];
  }

  if (found) return found.size;
  return 0;
}

interface iCalcStoneSize {
  size: number;
  sizeY: number;
  calcSize: number;
  safeX: number;
  safeY: number;
  depth: number;
  distances: iStoneDistances;
}

let getStoneSize_2 = function (ringData: RingData, stoneGroup: iPresetStone, stoneType: iStoneCut, stoneSize: number, stoneMode: iStoneMode | undefined = undefined, testSafe: boolean = false): iCalcStoneSize {

  let result = {
    size: 0,
    sizeY: 0,
    calcSize: 0,
    safeX: 0,
    safeY: 0,
    depth: 0,
    distances: <iStoneDistances><unknown>undefined
  }, sizeItem: iStoneSize | null = null;
  if (!stoneType) return result;
  if (!stoneType.size) {
    console.log("no size items", stoneType);
    return result;
  }
  if (!stoneMode) stoneMode = getStoneMode(stoneGroup.mode);
  if (!stoneMode) return result;
  let safeX = stoneMode ? stoneMode.safeDistX : 0,
    safeY = stoneMode ? stoneMode.safeDistY : 0;
  let stoneDistances = getStoneDistances(stoneMode, ringData.profileName);
  if (!stoneDistances) {
    console.log("no distances", stoneMode, ringData.profileName);
    return result;
  }
  result.distances = stoneDistances;

  for (let i = 0; i < stoneType.size.length; i++) {
    // @ts-ignore
    let s = testSafe ? getRowWidth(stoneType.size[i].size, stoneGroup.rows, stoneDistances) : stoneType.size[i].size;
    // let s = testSafe ? stoneType.size[i].size + (stoneDistances.stoneToBevel_x * 2) : stoneType.size[i].size;
    //   let s = testSafe ? stoneType.size[i].size + (stoneType.size[i].safeDistX ? stoneType.size[i].safeDistX * 2 : safeX * 2) : stoneType.size[i].size;
    if (((s <= stoneSize)) &&
      stoneType.size[i].minRingWidth <= ringData.ringWidth &&
      stoneType.size[i].minRingHeight <= ringData.ringHeight) {
      sizeItem = stoneType.size[i];
    }
  }

  if (!sizeItem) return result;

  // if (stoneGroup.mode == 30) {
  //   result.size = sizeItem.size;
  //   result.depth = sizeItem.size * stoneType.sizeDepthFactor;
  //   return result;
  // }

  result.size = sizeItem.size;
  result.sizeY = sizeItem.size;
  if (sizeItem.lengthFactor !== undefined) result.sizeY *= sizeItem.lengthFactor;
  result.calcSize = sizeItem.calcSize ? sizeItem.calcSize : sizeItem.size;
  result.safeX = sizeItem.safeDistX ?? safeX;
  result.safeY = sizeItem.safeDistY ?? safeY;
  result.depth = sizeItem.size * stoneType.sizeDepthFactor;
  return result;
}

export function stoneCalc(ring: cRing, vertexArray: iVertexArray[]): iStoneCalcData | null {

  let ringData = ring.ringData;
  let stoneGroupIndex = 0; // TODO: Gruppenindex hardcoded !!
  let stoneGroup = ringData.stone[stoneGroupIndex];

  if (stoneGroup.mode == 0) return null;
  if (stoneGroup.mode == 11) return stoneCalc_free(ring, vertexArray); // freie Steinaufteilung
  if (stoneGroup.mode == 31) return stoneCalc_crossChannel(ring, vertexArray); // Kanal quer
  if (stoneGroup.mode == 35) return stoneCalc_clamp(ring, vertexArray); // Spannring gerade
  if (stoneGroup.mode >= 40 && stoneGroup.mode < 50) return stoneCalc_side(ring, vertexArray); // seitlich

  let odm = calcOutlineDataMeasurement(ring);
  if (!odm) return null;
  stoneGroup.odm = odm;
  let outlineDataMeasurement = odm;

  let amp = ringData.waveAmp / 100, amp100 = ring.calc.amp100;
  let profile = getProfile(ringData.profileName);
  if (!profile) {
    console.log("Profil nicht erkannt!");
    return null;
  }
  let stoneMode = getStoneMode(stoneGroup.mode);
  if (!stoneMode) {
    console.log("Steinmodus nicht erkannt!");
    return null;
  }
  let minStoneSize = 1000;
  if (ringData.gapWidth >= 1000) minStoneSize = 1300;
  if (ringData.gapWidth >= 1500) minStoneSize = 1900;
  if (ringData.gapWidth >= 2000) minStoneSize = 2700;

  // (A)
  enum eMode {
    onSegment = 0,
    onGap,
    onBoth
  }

  let getOutlineDataSegment = function (position: number, options: any = null): iOutlineDataMeasurement | null {

    let mode = options?.mode ?? eMode.onBoth;
    let gapDistance = options?.gapDistance ?? 0;

    let closestIndex = -1, closestDistance = 99999,
      foundSegmentWeight = 0, segment: iOutlineDataMeasurement | null = null;

    outlineDataMeasurement.forEach(function (e, odIndex) {

      if (mode == eMode.onSegment && e.onGap) return;
      if (mode == eMode.onGap && !e.onGap) return;

      if (e.minX == e.maxX) return;

      // berechne die Mittelposition und berücksichtige die Sicherheitsabstände zum Profilrand bzw. zur Fuge
      // @ts-ignore
      let safeLeft = odIndex == 0 ? 0 : gapDistance;//stoneMode.safeDistX;
      let safeRight = odIndex == outlineDataMeasurement.length - 1 ? 0 : gapDistance;
      // let safeLeft = 0;//stoneMode.safeDistX;
      // let safeRight = safeLeft;


      if (odIndex == 0 && ringData.stepMode != 1 && ringData.stepMode != 3) {
        // @ts-ignore
        safeLeft = profile.sideGapDistance;
      }
      if (odIndex == (outlineDataMeasurement.length - 1) && ringData.stepMode != 2 && ringData.stepMode != 3) {
        // @ts-ignore
        safeRight = profile.sideGapDistance;
      }

      // <=

      let minX = e.minX + safeLeft;
      let maxX = e.maxX - safeRight;

      e.minXSafe = minX;
      e.maxXSafe = maxX;
      e.distXSafe = maxX - minX;

      let t = Math.abs(position - e.middlePosition);
      if (t < closestDistance/* && checkDepth(e)*/) {
        closestDistance = t;
        closestIndex = odIndex;
      }

      // if (e.onGap) {
      //   let gapMin = e.middlePosition - ringData.gapWidth / 2,// - weightStoneSize / 2,
      //     gapMax = e.middlePosition + ringData.gapWidth / 2;// + weightStoneSize / 2;
      //
      //   if (position >= gapMin && position <= gapMax) {
      //     segment = e;
      //     return;
      //   }
      // }

      t = minX + (maxX - minX) / 2;
      if (t > position) t = t - position;
      else t = position - t;
      // if (e.onGap) t *= ringData.gapWidth;
      // else t *= e.distXSafe;


      if (t < foundSegmentWeight) {
        console.log(e, position, minX, maxX);
        segment = e;
        foundSegmentWeight = t;
      }
      // if (position >= minX && position <= maxX/* && (t < foundSegmentWeight)*//* && checkDepth(e)*/) {
      //   console.log(e, position, minX, maxX);
      //   segment = e;
      //   foundSegmentWeight = t;
      // }
    })

    if (segment)
      return segment;

    if (closestIndex > -1)
      return outlineDataMeasurement[closestIndex];

    return null;
  }

  let stoneGroupSave = JSON.parse(JSON.stringify(stoneGroup));
  let odmSegment: iOutlineDataMeasurement | null = null;
  let calcStoneSize: iCalcStoneSize = {
    size: 0,
    sizeY: 0,
    calcSize: 0,
    safeX: 0,
    safeY: 0,
    depth: 0,
    distances: <iStoneDistances><unknown>undefined
  };
  let stonePosition = 0;
  let maxRows = 1;
  let rowSizeXSafe = 0;
  let maxStoneSize = 0;
  let stoneSizeAdaptedToGap = false;

  if (stoneGroup.mode != 20) stoneGroup.rows = 1;

  /**
   * Wenn die Fugenbreite kleiner oder gleich 0.5mm ist, dann nutze beim Einreiber den ganzen Ring.
   * Die Steine können dann Fugen überlappen.
   */
  if (stoneGroup.mode == 10 && ringData.gapWidth <= 500) {
    (function calcNonGapSegment() {
      let segment: iOutlineDataMeasurement = {
        minX: 0, maxX: 0, distX: 0, onGap: false, middlePosition: 0, middleDepth: 0
      };

      let leftSegment = odm[0], rightSegment = odm[odm.length - 1];

      segment.minX = leftSegment.minX;
      // if (ringData.stepMode != 1 && ringData.stepMode != 3) {
      //   segment.minX += profile.sideGapDistance;
      // }
      segment.maxX = rightSegment.maxX;
      // if (ringData.stepMode != 2 && ringData.stepMode != 3) {
      //   // @ts-ignore
      //   segment.maxX -= profile.sideGapDistance;
      // }

      segment.distX = segment.maxX - segment.minX;

      outlineDataMeasurement = [segment];
    }());
  }

  let loopA = true, loopACount = 50;
  while (loopA && loopACount-- > 0) {
    loopA = false;

    // (#3)
    let stoneMode = getStoneMode(stoneGroup.mode);
    if (!stoneMode) {
      stoneGroup.mode = 0;
      console.log("Steinmodus nicht erkannt");
      return null;
    }
    let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
      return (e.legacyId ?? e.id) == stoneGroup.type;
    })
    if (!stoneType || stoneType.allowedStoneMode.indexOf(stoneGroup.mode) == -1) {
      stoneType = getStoneCuts(AppComponent.app.data).find(e => {
        return (e.legacyId ?? e.id) == 1;
      })
      stoneGroup.type = 1;
      if (!stoneType) {
        stoneGroup.mode = 0;
        console.log("Der Steintyp konnte nicht ermittelt werden");
        return null;
      }
      console.log("Steintyp konnte nicht erkannt werden oder ist für den Steinmodus ungültig. Wurde auf 1 angepasst.", stoneType)
    }
    let s = getStoneSize_2(ringData, stoneGroup, stoneType, stoneGroup.size, stoneMode, false);
    if (s.size == 0) {
      console.log("Keine Steingröße gefunden", JSON.parse(JSON.stringify(stoneGroup)), stoneType);
      return null;
    }
    if (s.size != stoneGroup.size) {
      console.log("Steingröße dem Typ angepasst", s);
      stoneGroup.size = s.size;
    }

    let rows = stoneGroup.mode == 20 ? stoneGroup.rows : 1;
    rowSizeXSafe = getRowWidth(s.size, rows, s.distances);// s.size * rows + s.distances.stoneToStone_x * (rows-1) + s.distances.stoneToBevel_x * 2;
    // rowSizeXSafe = s.size * rows + s.safeX * (rows + 1);

    // (#4)
    stonePosition = Math.trunc(stoneGroup.positionDiv[0] * ringData.ringWidth / 10000) - ringData.ringWidth / 2;
    // console.log("stonePosition initial: " + stonePosition);

    // console.log(loopACount, JSON.parse(JSON.stringify(outlineDataMeasurement)));

    // (#5)
    let options = {
      gapDistance: s.distances.stoneToGap_x,
      // gapDistance: stoneMode.safeDistXGap ?? 0,
      // gapDistance: (stoneGroup.mode == 20 || stoneGroup.mode == 30) ? stoneMode.safeDistX : 0
    }
    odmSegment = getOutlineDataSegment(stonePosition, options);
    if (!odmSegment) {

      Log("info", "Nicht genügend Platz für den gewählten Steinbesatz.")
      console.log("Kein Segment gefunden", stonePosition, outlineDataMeasurement);
      return null;
    }

    // (#6)
    // @ts-ignore
    if (odmSegment.distXSafe < rowSizeXSafe) {

      // if (odmSegment.distXSafe < s[0]) {

      // @ts-ignore
      if (odmSegment.distXSafe < 1000) {
        console.log("Segment deaktiviert", odmSegment);
        odmSegment.minX = 0;
        odmSegment.maxX = 0;
        loopA = true;
        continue;
      }

      if (stoneGroup.rows > 1) {
        console.log("Segment für Steingröße (" + s.size + ", " + rowSizeXSafe + ") zu klein (" + odmSegment.distXSafe + "). Versuche Steinreihen zu verringern.");
        stoneGroup.rows--;
        loopA = true;
        continue;
      }

      console.log("Segment für Steingröße (" + s.size + ", " + rowSizeXSafe + ") zu klein (" + odmSegment.distXSafe + "). Versuche Steingröße zu verringern.");
      // console.log(JSON.parse(JSON.stringify(odmSegment)), JSON.parse(JSON.stringify(s)));

      // @ts-ignore
      s = getStoneSize_2(ringData, stoneGroup, stoneType, odmSegment.distXSafe, stoneMode, true);
      // @ts-ignore
      if (s.size == 0) {
        if ((stoneType.legacyId ?? stoneType.id) != 1) {
          stoneType.legacyId = 1;
          loopA = true;
          continue;
        }
        odmSegment.minX = 0;
        odmSegment.maxX = 0;
        console.log("Segment deaktiviert", odmSegment);
      } else {
        console.log("Steingröße geändert: " + stoneGroup.size + " => " + s.size);
        stoneGroup.size = s.size;
      }
      loopA = true;
      continue;
    }

    // keinen Kanal bei Fugenbreiten größer als 500
    if (odmSegment.onGap && stoneGroup.mode == 30 && ringData.gapWidth > 500) {
      odmSegment.minX = 0;
      odmSegment.maxX = 0;
      loopA = true;
      continue;
    }

    if (odmSegment.onGap && s.size < minStoneSize) {
      if (!stoneSizeAdaptedToGap) {
        stoneSizeAdaptedToGap = true;
        console.log("Steingröße und Positon der Fuge angepasst (" + minStoneSize + ")");
        stoneGroup.size = minStoneSize;
        let div0 = (stonePosition + ringData.ringWidth / 2) * 10000 / ringData.ringWidth;
        stoneGroup.positionDiv = [div0, 10000 - div0];
        loopA = true;
        continue;
      }

      odmSegment.minX = 0;
      odmSegment.maxX = 0;
      loopA = true;
      continue;
    }

    // console.log(odmSegment, ""+stonePosition, ""+rowSizeXSafe);

    // prüfe auf Reihen
    if (stoneMode.mode == 20) {

      let max = odmSegment.distXSafe as number;

      maxRows = 0;
      let count = 0;
      while (1) {
        let t = count * s.size + (maxRows - 1) * s.distances.stoneToStone_x + s.distances.stoneToBevel_x * 2;
        // let t = count * s.size + (maxRows + 1) * s.safeX;
        if (t > max) break;
        maxRows = count;
        count++;
      }

      if (stoneGroup.rows > maxRows) {
        console.log("Steinreihen angepasst");
        stoneGroup.rows = maxRows;
      }

      rowSizeXSafe = getRowWidth(s.size, stoneGroup.rows, s.distances);// s.size * stoneGroup.rows + s.distances.stoneToStone_x * (stoneGroup.rows - 1) + s.distances.stoneToBevel_x * 2;
      // rowSizeXSafe = s.size * stoneGroup.rows + s.safeX * (stoneGroup.rows + 1);
    }

    if (odmSegment.onGap) {
      stonePosition = odmSegment.middlePosition;

      // @ts-ignore
      if (odmSegment.minXSafe > stonePosition - rowSizeXSafe / 2) {
        odmSegment.minX = 0;
        odmSegment.maxX = 0;
        loopA = true;
        // console.log("Segment deaktiviert");
        continue;
      }

      // @ts-ignore
      else if (odmSegment.maxXSafe < stonePosition + rowSizeXSafe / 2) {
        odmSegment.minX = 0;
        odmSegment.maxX = 0;
        loopA = true;
        // console.log("Segment deaktiviert");
        continue;
      }

    } else {
      // @ts-ignore
      if (odmSegment.minXSafe > stonePosition - rowSizeXSafe / 2) {
        // @ts-ignore
        let t = odmSegment.minXSafe + rowSizeXSafe / 2;
        // @ts-ignore
        if (odmSegment.maxXSafe < t + rowSizeXSafe / 2) {
          odmSegment.minX = 0;
          odmSegment.maxX = 0;
          // stoneGroup.size -= 50;
          loopA = true;
          continue;
        }
        // @ts-ignore
        stonePosition = odmSegment.minXSafe + rowSizeXSafe / 2;
        // console.log("A");
      }

      // @ts-ignore
      else if (odmSegment.maxXSafe < stonePosition + rowSizeXSafe / 2) {
        // @ts-ignore
        let t = odmSegment.maxXSafe - rowSizeXSafe / 2;
        // @ts-ignore
        if (odmSegment.minXSafe > t - rowSizeXSafe / 2) {
          odmSegment.minX = 0;
          odmSegment.maxX = 0;
          // stoneGroup.size -= 50;
          loopA = true;
          continue;
        }
        // @ts-ignore
        stonePosition = odmSegment.maxXSafe - rowSizeXSafe / 2;
        // console.log("B");
      }
    }

    // (#7)
    let profileMaxStoneDepth = getProfileMaxStoneDepth(ring, stonePosition);
    if (profileMaxStoneDepth < s.depth) {
      if (stonePosition < 0) {
        let pos = stonePosition;
        // @ts-ignore
        let maxPos = odmSegment.maxXSafe - s[0] / 2;
        if (maxPos < 0) {
          let found = false;
          while (pos < maxPos) {
            pos += 10
            if (pos > maxPos) pos = maxPos;
            profileMaxStoneDepth = getProfileMaxStoneDepth(ring, pos);
            if (profileMaxStoneDepth >= s.depth) {
              found = true;
              stonePosition = pos;
              break;
            }
            if (pos == maxPos) break;
            if (!found) {
              stoneGroup.size -= 50;
              loopA = true;
              // continue;
            }
          }
        } else {
          console.log("verringere Steingröße (max)");
          stoneGroup.size -= 50;
          loopA = true;
          continue;
        }
      } else {
        let pos = stonePosition;
        // @ts-ignore
        let minPos = odmSegment.minXSafe + s[0] / 2;
        if (minPos > 0) {
          let found = false;
          while (pos > minPos) {
            pos -= 10
            if (pos < minPos) pos = minPos;
            profileMaxStoneDepth = getProfileMaxStoneDepth(ring, pos);
            if (profileMaxStoneDepth >= s.depth) {
              found = true;
              stonePosition = pos;
              break;
            }
            if (pos == minPos) break;
            if (!found) {
              stoneGroup.size -= 50;
              loopA = true;
              // continue;
            }
          }
        } else {
          console.log("verringere Steingröße (min)")
          stoneGroup.size -= 50;
          loopA = true;
          continue;
        }
      }
    }

    // @ts-ignore
    let t = getStoneSize_2(ringData, stoneGroup, stoneType, odmSegment.distXSafe, stoneMode, true);
    maxStoneSize = getMaxStoneSizeFromDepth(stoneType, profileMaxStoneDepth);
    maxStoneSize = Math.min(t.size, maxStoneSize);
    // console.log("maxStoneSize: " + maxStoneSize);

    stoneGroup.size = s.size;
    RingData.setStonePositionValue(ringData, stoneGroupIndex, stonePosition, true);

    calcStoneSize = s;
  }

  if (!odmSegment) {

    stoneGroup.mode = 0;
    return null;
  }

  let ringRadiusInner = ringData.ringSize / Math.PI / 2,
    ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
    ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
    height = ringData.ringSize,
    maxY = height;

  // let getNextPosition = function (curX: number, curY: number, inc: number, distributionY: number, useAddY: boolean = false): number[] //
  // {
  //   let result = [0, 0, 0], x, y = curY, u, v, d = 0;
  //   let orig_x = get_sin(curY, height, amp100 * amp, ringData.waveCount);
  //   let offset = curX - orig_x;
  //
  //   /*
  //   Es gab Probleme bei der Verteilung auf einer Sinuswelle. Da der Y-Wert beim drehen der Meshes vergrößert wird, muss dies hier berücksichtigt werden.
  //    */
  //   let distY = distributionY / ringRadiusFactor;
  //
  //   if (useAddY) {
  //     y = curY + distributionY;
  //     x = get_sin(y, height, amp100 * amp, ringData.waveCount);
  //     x += offset;
  //     result[0] = x;
  //     result[1] = y;
  //   } else while (1) {
  //     y += inc;
  //     x = get_sin(y, height, amp100 * amp, ringData.waveCount);
  //     u = x - curX + offset;
  //     v = (y - curY) / ringRadiusFactor;
  //     d = Math.sqrt(u * u + v * v);
  //     if (d >= distY) {
  //       // if (d >= distributionY) {
  //       x += offset;
  //       result[0] = x;
  //       result[1] = y;
  //       result[2] = map(y, 0, height, 0, Math.PI * 2 * ringData.waveCount)
  //       break;
  //     }
  //   }
  //
  //   return result;
  // }
  let getNextPosition_2 = function (curX: number, curY: number, inc: number, distributionY: number, options: any = {}): number[] //
  {
    if (options.factor == undefined) options.factor = ringRadiusFactor;

    let result = [0, 0, 0], x, y = curY, u, v, d = 0;
    let orig_x = get_sin(curY, height, amp100 * amp, ringData.waveCount);
    let offset = curX - orig_x;

    if (0) {
      /**
       * Berechnung der Distanz inkrementel.
       */
      let distance = 0;
      while (1) {
        y += inc;
        x = get_sin(y, height, amp100 * amp, ringData.waveCount);
        u = x - curX + (curX - orig_x);
        // u = x - curX + offset;
        v = (y - curY) / options.factor;
        d = Math.sqrt(u * u + v * v);
        distance += d;
        curX = x;
        curY = y;
        if (distance >= distributionY) {
          x += offset;
          result[0] = x;
          result[1] = y;
          result[2] = map(y, 0, height, 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1))
          break;
        }
      }
    } else {
      while (1) {
        y += inc;
        x = get_sin(y, height, amp100 * amp, ringData.waveCount);
        u = x - curX + offset;
        v = (y - curY) / options.factor;
        d = Math.sqrt(u * u + v * v);
        if (d >= distributionY) {
          x += offset;
          result[0] = x;
          result[1] = y;
          result[2] = map(y, 0, height, 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1))
          break;
        }
      }
    }

    return result;
  }

  if (stoneGroup.type != stoneGroupSave.type) Log("info", "Der Steintyp wurde angepasst");
  if (stoneGroup.size != stoneGroupSave.size) Log("info", "Die Steingröße wurde angepasst");
  if (stoneGroup.rows != stoneGroupSave.rows) Log("info", "Die Anzahl der Steinreihen wurde angepasst");

  let stoneCount = stoneGroup.count;
  let stoneCoordinates = [] as iPoint[];
  let maxStones = 100;
  let stoneHelperMesh = new CMesh;
  let thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180; // zusätzliche Rotation des Ringes um die X-Achse

  /**
   * Eingerieben
   */
  if (stoneGroup.mode == 10) //
  {
    // let cutDepth = calcStoneSize.depth * 0.7;
    /**
     * Die '0.25' ist der Abstand von der Steinoberkante bis zum äußersten Rand des Steines in der Z-Achse.
     * Genau sind das 0.19...aber dann ist der Abstand zwischen den Steinen zu gering.
     */
    let channelRadiusFactor = ringRadiusInner / (ringRadiusInner + ringData.ringHeight - calcStoneSize.size * 0.25);
    let distanceX = calcStoneSize.size * 0.88;
    let distanceY = calcStoneSize.size + calcStoneSize.distances.stoneToStone_y;
    let distanceY_betweenStones = 0;
    let width = distanceX;
    let pathDistance = 0;
    let hasCaps = true;

    /**
     * Shape erstellen
     */
    let s = [] as CVertex[], x = 0;
    let shapeX = 0;
    if (1) {
      let frontVertices = ring.profile.frontVertices;
      // links
      x = cRing.interpolate(shapeX - width / 2, frontVertices).x;
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));

      // Steinmittelpunktlinie
      s.push(new CVertex(shapeX, 0, 0));

      // rechts
      x = cRing.interpolate(shapeX + width / 2, frontVertices).x;
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
    }

    /**
     * Ermittle für die aktuelle Steingröße die Pfadlänge und die maximal mögliche Anzahl der Steine auf Steinebene
     * und nutze für den Abstand den 'channelRadiusFactor', da die Y-Werte durch das rotieren der Vertices gestreckt werden.
     */
    if (1) {
      // console.log("==============");

      if (stoneGroup.count == 1) stoneGroup.distribution = 0;

      maxY = height;
      let ar = [33, 50];
      if (ar.indexOf(stoneGroup.distribution) != -1) {
        maxY *= stoneGroup.distribution / 100;
      }
      ar = [5, 10, 20];
      if (ar.indexOf(stoneGroup.distribution) != -1) {
        distanceY += distanceY * stoneGroup.distribution / 10;
      }

      let v1 = new CVertex(stonePosition, 0, 0), v2 = new CVertex(stonePosition, 0, 0);

      /**
       * Der letzte Stein kann maxY erreichen. Ist dies der Fall, würde er den 1. Stein, wenn dieser bei Y-0 beginnt zu
       * 50% überlappen. Deshalb beginnt der 1. Stein bei distanceY.
       */
      let position = getNextPosition_2(stonePosition, 0, 1, distanceY, {factor: channelRadiusFactor});
      v2.x = position[0];
      v2.y = position[1];

      maxStones = 1;
      while (1) {
        position = getNextPosition_2(v2.x, v2.y, 1, distanceY, {factor: channelRadiusFactor});
        if (position[1] > maxY) {
          v2.x = stonePosition;
          v2.y = maxY;
          pathDistance += v1.distance(v2);
          break;
        }

        v2.x = position[0];
        v2.y = position[1];
        pathDistance += v1.distance(v2);
        v2.toRef(v1);

        maxStones++;
      }

      if (stoneGroup.count > maxStones) stoneGroup.count = -100;

      stoneCount = stoneGroup.count;

      if (stoneCount < 0) {
        if (stoneCount == -33.339) stoneCount = Math.round(maxStones / 3);
        else if (stoneCount == -50) stoneCount = Math.round(maxStones / 2);
        else if (stoneCount == -100) stoneCount = maxStones;
      }

      hasCaps = !(stoneGroup.distribution == 100) && !(stoneGroup.distribution < 33 && stoneGroup.count == -100);

      if (hasCaps) {
        if (stoneGroup.distribution < 33) {
          distanceY_betweenStones = distanceY - calcStoneSize.size;
        } else
          distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.size) / (stoneCount - 1);
      } else
        distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.size) / (stoneCount);

      distanceY = calcStoneSize.size;

      // console.log("pathDistance: " + pathDistance);
      // console.log("distanceY: " + distanceY);
      // console.log("distanceY_betweenStones: " + distanceY_betweenStones);
      // console.log("channelRadiusFactor: " + channelRadiusFactor);
      // console.log("maxStones: " + maxStones);
      // console.log("stoneCount: " + stoneCount);
      // console.log("stoneGroup.count: " + stoneGroup.count);
      // console.log("stoneGroup.distribution: " + stoneGroup.distribution);
      // console.log("==============");
    }

    /**
     * Path erstellen
     */
    let p = [] as CVertex[]; // path
    let rowsBetweenStones = 0;
    if (1) {
      let stonesRemaining = stoneCount;
      let y = 0, r = [0, 0, 0], r2: number[], r3: number[];

      if (!hasCaps) {
        r = getNextPosition_2(r[0], r[1], -1, pathDistance / 2, {factor: channelRadiusFactor});
        r = getNextPosition_2(r[0], r[1], 1, (calcStoneSize.size + distanceY_betweenStones) / 2, {factor: channelRadiusFactor});
        // r = getNextPosition_2(r[0], r[1], -1, (pathDistance / 2) / channelRadiusFactor + calcStoneSize.size / 2, {factor: channelRadiusFactor});
      } else if (stoneGroup.distribution >= 33)
        r = getNextPosition_2(r[0], r[1], -1, (pathDistance / 2) / channelRadiusFactor, {factor: channelRadiusFactor});
      else {
        let channelLength = stoneCount * distanceY + (stoneCount - 1) * distanceY_betweenStones;
        r = getNextPosition_2(r[0], r[1], -1, channelLength / 2, {factor: channelRadiusFactor});
      }

      if (distanceY_betweenStones > 250)
        rowsBetweenStones = Math.trunc(distanceY_betweenStones / 250);
      // console.log("rowsBetweenStones: " + rowsBetweenStones);

      p.push(new CVertex(r[0] + stonePosition, r[1], 0));

      while (stonesRemaining > 0) {
        r2 = getNextPosition_2(r[0], r[1], 1, distanceY, {factor: channelRadiusFactor});
        let step = (r2[2] - r[2]) / 4;
        y = r[1];
        /**
         * pro Stein werden 4 Reihen in Y erzeugt. Der Mittelpunkt liegt beim ersten Stein auf Reihe 2
         */
        for (let i = 0; i < 4; i++) {
          x = Math.sin(r[2] + ((i + 1) * step)) * amp100 * amp;
          y = map(r[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
          p.push(new CVertex(x + stonePosition, y, 0));
        }

        if (stonesRemaining == 1 && !hasCaps)
          r3 = getNextPosition_2(0, 0, 1, (pathDistance / 2) / channelRadiusFactor - calcStoneSize.size / 2, {factor: channelRadiusFactor});
        else
          r3 = getNextPosition_2(r2[0], r2[1], 1, distanceY_betweenStones, {factor: channelRadiusFactor});

        if (rowsBetweenStones && (stonesRemaining > 1 || !hasCaps)) {
          step = (r3[2] - r2[2]) / rowsBetweenStones;
          for (let i = 0; i < rowsBetweenStones; i++) {
            x = Math.sin(r2[2] + ((i + 1) * step)) * amp100 * amp;
            y = map(r2[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
            p.push(new CVertex(x + stonePosition, y, 0));
          }
        }

        /**
         * Wurde der r3 Wert aus Ausgangswert für den nächsten Stein genutzt, kam es zu Rundungsfehlern und Steinüberlappungen.
         */
        r = getNextPosition_2(r[0], r[1], 1, distanceY + distanceY_betweenStones, {factor: channelRadiusFactor});

        stonesRemaining--;
      }
    }

    /**
     * Shape entlang des Pfades extrudieren
     */
    let e = extrude(s, p, new CVertex(shapeX, 0, 0), ringData.waveCount > 0 ? ringRadiusFactor : 1.0);

    /**
     * ausrichten des Kanals am Profil
     */
    if (1) {
      e.forEach((a) => {
        a.forEach((b) => {
          let IP = cRing.interpolate(b.x, ring.profile.frontVertices);
          b.z = IP.z;
          b.u = IP.uv_u;
        })
      })
    }

    /**
     * Mesh übergeben
     */
    // if (e.length) {
    //   vertexArray.push({
    //     vertex2DArray: e,
    //     type: "helper",
    //     index: -1,
    //     triangulate_useVectorDist: false,
    //     triangulate_isFrontFace: true,
    //     close_normals: !hasCaps,
    //     no_outline: true,
    //     no_rotate: false,
    //   });
    // }

    /**
     * Steine
     */
    if (1) {
      let e2 = [] as CVertex[][];
      let v: CVertex;
      e.forEach((a) => {
        let row = [] as CVertex[];
        a.forEach((b, bIndex) => {
          if (bIndex > 1 && bIndex < a.length - 2) {
            v = CVertex.fromVertex(b);
            row.push(v);
          }
        })
        e2.push(row);
      })

      stoneHelperMesh.rows = e2;
      stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

      let positions = [] as CVertex[];
      let tangents = [] as CVertex[];
      let normals = [] as CVertex[];
      let binormals = [] as CVertex[];
      let distances = [] as number[];

      let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
      let i, i_l = e2.length, row, j, j_l;

      for (i = 2; i < i_l; i += 4) {

        row = e2[i];
        j_l = row.length;

        for (j = 1; j < j_l - 1; j++) {
          // Position
          P = CVertex.fromVertex(row[j]);

          // Tangente (Y)
          e2[i + 2][j].toRef(v1);
          e2[i - 2][j].toRef(v2);
          T = CVertex.fromVertex(v1).sub(v2);

          // Normal (X) ==> eigentlich ist das die Binormale!!
          row[j - 1].toRef(v1);
          row[j + 1].toRef(v2);
          N = CVertex.fromVertex(v2).sub(v1);

          // Binormal
          B = CVertex.cross(N, T);
          B.normalize();
          // B.scale(cutDepth);
          P.sub(B);

          N.normalize();
          B.normalize();
          T.normalize();

          positions.push(P);
          tangents.push(T);
          normals.push(N);
          binormals.push(B);
        }
        i += rowsBetweenStones;
        // if (distanceY_betweenStones > 250) i += 4;
      }

      let stonePathVectors = {
        distances,
        positions,
        normals,
        binormals,
        tangents
      };

      ring.profile.stonePaths.push(stonePathVectors);

      /**
       * Bevels
       */
      if (1) {
        {
          let distX = calcStoneSize.distances.stoneToBevel_x,
            distY = distX,
            bevelSizeX_half = (calcStoneSize.size + distX) / 2,
            bevelSizeY_half = (calcStoneSize.size + distY) / 2,
            bevelHeight = calcStoneSize.size / 2;
          let rows = [] as CVertex[][], row = [] as CVertex[], index;

          /**
           Die Bevels werden an der Nullposition erstellt und beim Aufbau der
           Scene mit den Steinen ausgerichtet
           */
          switch (stoneGroup.type) {
            case 1: // Brillant
            {
              let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
              if (bevelTesselation < 2) bevelTesselation = 2;
              bevelTesselation *= 4;
              bevelTesselation--;
              let incRad = Math.PI * 2 / bevelTesselation,
                rad,
                dist,
                i,
                /**
                 * Die Bevels erhalten oben einen extra Rand um die Alpha-Fehler zu verdecken.
                 */
                extraBorder = 30;


              stonePathVectors.positions.forEach(function (p, bevelIndex) {
                  rows = [];
                  index = 0;

                  // 1. Reihe
                  row = [];
                  dist = bevelSizeX_half + extraBorder;
                  rad = 0.0;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(dist, 0, 0);
                    v.rotateY(rad);
                    rad -= incRad;
                    v.i = index++;
                    row.push(v)
                  }
                  rows.push(row);

                  // 2. Reihe
                  row = [];
                  dist = bevelSizeX_half;
                  rad = 0.0;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(dist, 0, 0);
                    v.rotateY(rad);
                    rad -= incRad;
                    v.i = index++;
                    row.push(v)
                  }
                  rows.push(row);

                  // Mittelpunkt
                  i = row.length;
                  row = [];
                  while (i--) {
                    v = new CVertex(0, -bevelHeight, 0);
                    v.i = index++;
                    row.push(v)
                  }
                  rows.push(row);

                  vertexArray.push({
                    vertex2DArray: rows,
                    type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
                    index: -1,
                    no_rotate: true,
                  });
                }
              )
              break;
            }
            case 2: // Princess
            case 3: // Princess 45°
            {
              let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
              if (bevelTesselation < 2) bevelTesselation = 2;
              bevelTesselation--;
              let incX = (bevelSizeX_half * 2) / bevelTesselation,
                incY = (bevelSizeY_half * 2) / bevelTesselation,
                x, y, z, i, j, j_l,
                extraBorder = 30;

              stonePathVectors.positions.forEach(function (p, bevelIndex) {
                  rows = [];
                  index = 0;

                  // 1. Reihe
                  row = [];
                  incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
                  incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
                  x = -bevelSizeX_half - extraBorder;
                  y = 0;
                  z = -bevelSizeY_half - extraBorder;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x += incX;
                  }
                  x -= incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z += incY;
                  }
                  z -= incY;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x -= incX;
                  }
                  x += incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z -= incY;
                  }
                  rows.push(row);

                  // 2. Reihe
                  row = [];
                  incX = (bevelSizeX_half * 2) / bevelTesselation;
                  incY = (bevelSizeY_half * 2) / bevelTesselation;
                  x = -bevelSizeX_half;
                  y = 0;
                  z = -bevelSizeY_half;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x += incX;
                  }
                  x -= incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z += incY;
                  }
                  z -= incY;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x -= incX;
                  }
                  x += incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z -= incY;
                  }
                  rows.push(row);

                  // Mittelpunkt
                  i = row.length;
                  row = [];
                  while (i--) {
                    v = new CVertex(0, -bevelHeight, 0);
                    v.i = index++;
                    row.push(v)
                  }
                  rows.push(row);

                  if (stoneGroup.type == 3) // Princess 45°
                  {
                    for (i = 0; i < 3; i++) {
                      row = rows[i];
                      j_l = row.length;
                      for (j = 0; j < j_l; j++)
                        row[j].rotateY(Math.PI / 4);
                    }

                  }

                  vertexArray.push({
                    vertex2DArray: rows,
                    type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
                    index: -1,
                    no_rotate: true,
                  });
                }
              )
              break;
            }
            case 4: // Baguette quer
            case 5: // Baguette längs
            {
              bevelSizeX_half = (calcStoneSize.size + distX) / 2;
              bevelSizeY_half = (calcStoneSize.sizeY + distY) / 2;

              let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
              if (bevelTesselation < 2) bevelTesselation = 2;
              bevelTesselation--;
              let incX = (bevelSizeX_half * 2) / bevelTesselation,
                incY = (bevelSizeY_half * 2) / bevelTesselation,
                x, y, z, i,
                extraBorder = 30;

              stonePathVectors.positions.forEach(function (p, bevelIndex) {
                  rows = [];
                  index = 0;

                  // 1. Reihe
                  row = [];
                  incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
                  incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
                  x = -bevelSizeX_half - extraBorder;
                  y = 0;
                  z = -bevelSizeY_half - extraBorder;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x += incX;
                  }
                  x -= incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z += incY;
                  }
                  z -= incY;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x -= incX;
                  }
                  x += incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z -= incY;
                  }
                  rows.push(row);

                  // 2. Reihe
                  row = [];
                  incX = (bevelSizeX_half * 2) / bevelTesselation;
                  incY = (bevelSizeY_half * 2) / bevelTesselation;
                  x = -bevelSizeX_half;
                  y = 0;
                  z = -bevelSizeY_half;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x += incX;
                  }
                  x -= incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z += incY;
                  }
                  z -= incY;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    x -= incX;
                  }
                  x += incX;
                  for (i = 0; i <= bevelTesselation; i++) {
                    v = new CVertex(x, y, z);
                    v.i = index++;
                    row.push(v)
                    z -= incY;
                  }
                  rows.push(row);

                  // Mittelpunkt
                  i = row.length;
                  row = [];
                  while (i--) {
                    v = new CVertex(0, -bevelHeight, 0);
                    v.i = index++;
                    row.push(v)
                  }
                  rows.push(row);

                  vertexArray.push({
                    vertex2DArray: rows,
                    type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
                    index: -1,
                    no_rotate: true,
                  });
                }
              )
              break;
            }
          }
        }
      }
    }
  }
    //   {
    //   let fn_A = function (curX: number, curY: number, step: number, pathDistance: number, range: number, options: any = {}): number[] {
    //     let result = [0, 0, 0, 0, 0]; // x, y, yRad, numSteps, pathDistance
    //
    //     if (options.pathDistanceIsMaxY == undefined) options.pathDistanceIsMaxY = false;
    //
    //     let x, y = curY, u, v, d = 0;
    //     let orig_x = get_sin(curY, range, amp100 * amp, ringData.waveCount);
    //     let offset = curX - orig_x;
    //     let curPathDistance = 0;
    //     let inc = step > 0 ? 1 : -1;
    //     let absStep = Math.abs(step);
    //     if (pathDistance < 0) pathDistance = -pathDistance;
    //
    //     while (1) {
    //       y += inc;
    //       x = get_sin(y, range, amp100 * amp, ringData.waveCount);
    //       u = x - curX + offset;
    //       v = (y - curY);
    //       d = Math.sqrt(u * u + v * v);
    //       if (d >= absStep) {
    //         curPathDistance += absStep;
    //         if (!options.pathDistanceIsMaxY) {
    //           if (curPathDistance > pathDistance) break;
    //         }
    //
    //         x += offset;
    //         result[0] = x;
    //         result[1] = y;
    //         result[2] = map(y, 0, range, 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1))
    //         result[3]++; // Anzahl der bisherigen Schritte
    //         result[4] = curPathDistance;
    //
    //         curX = x;
    //         curY = y;
    //       }
    //
    //       if (options.pathDistanceIsMaxY) {
    //         if (Math.abs(y) > pathDistance) break;
    //       }
    //
    //     }
    //
    //     return result;
    //   }
    //   // let fn_A = function (curX: number, curY: number, inc: number, distance: number, range: number, options: any = {}): number[] {
    //   //   let result = [0, 0, 0]; // x, y, yRad
    //   //   if (options.factor == undefined) options.factor = 1;
    //   //
    //   //   let x, y = curY, u, v, d = 0;
    //   //   let orig_x = get_sin(curY, range, amp100 * amp, ringData.waveCount);
    //   //   let offset = curX - orig_x;
    //   //
    //   //   if (options.incrementel != undefined) {
    //   //     while (1) {
    //   //       y += inc;
    //   //       x = get_sin(y, range, amp100 * amp, ringData.waveCount);
    //   //       u = x - curX + offset;
    //   //       v = (y - curY) / options.factor;
    //   //       d = Math.sqrt(u * u + v * v);
    //   //       if (d >= distance) {
    //   //         x += offset;
    //   //         result[0] = x;
    //   //         result[1] = y;
    //   //         result[2] = map(y, 0, range, 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1))
    //   //         break;
    //   //       }
    //   //     }
    //   //
    //   //   }
    //   //   else {
    //   //     while (1) {
    //   //       y += inc;
    //   //       x = get_sin(y, range, amp100 * amp, ringData.waveCount);
    //   //       u = x - curX + offset;
    //   //       v = (y - curY) / options.factor;
    //   //       d = Math.sqrt(u * u + v * v);
    //   //       if (d >= distance) {
    //   //         x += offset;
    //   //         result[0] = x;
    //   //         result[1] = y;
    //   //         result[2] = map(y, 0, range, 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1))
    //   //         break;
    //   //       }
    //   //     }
    //   //   }
    //   //
    //   //   return result;
    //   // }
    //
    //   /**
    //    * Die '0.25' ist der Abstand von der Steinoberkante bis zum äußersten Rand des Steines in der Z-Achse.
    //    * Genau sind das 0.19...aber dann ist der Abstand zwischen den Steinen zu gering.
    //    */
    //   let channelRadiusFactor = ringRadiusInner / (ringRadiusInner + ringData.ringHeight - calcStoneSize.size * 0.19);
    //
    //   let stoneSizeY = calcStoneSize.calcSize;
    //   let stoneToStoneY = calcStoneSize.distances.stoneToStone_y;
    //
    //   // let distanceY = calcStoneSize.calcSize + calcStoneSize.distances.stoneToStone_y;
    //   // let distanceY_betweenStones = calcStoneSize.distances.stoneToStone_y;
    //   let pathDistance = 0;
    //   let hasCaps = true;
    //
    //   /**
    //    * Shape erstellen
    //    */
    //   let s = [] as CVertex[], x = 0;
    //   if (1) {
    //     let frontVertices = ring.profile.frontVertices;
    //     // links
    //     x = cRing.interpolate(-calcStoneSize.size / 2, frontVertices).x;
    //     s.push(new CVertex(x, 0, 0));
    //
    //     // Steinmittelpunktlinie
    //     s.push(new CVertex(0, 0, 0));
    //
    //     // rechts
    //     x = cRing.interpolate(+calcStoneSize.size / 2, frontVertices).x;
    //     s.push(new CVertex(x, 0, 0));
    //   }
    //
    //   /**
    //    * Ermittle für die aktuelle Steingröße die Pfadlänge und die maximal mögliche Anzahl der Steine auf Steinebene
    //    * und nutze für den Abstand den 'channelRadiusFactor', da die Y-Werte durch das rotieren der Vertices gestreckt werden.
    //    */
    //   // if (1) {
    //   if (stoneGroup.count == 1) stoneGroup.distribution = 0;
    //
    //   maxY = height / channelRadiusFactor;
    //   let ar = [33, 50];
    //   if (ar.indexOf(stoneGroup.distribution) != -1) {
    //     maxY *= stoneGroup.distribution / 100;
    //   }
    //   ar = [5, 10, 20];
    //   if (ar.indexOf(stoneGroup.distribution) != -1) {
    //     stoneToStoneY = stoneSizeY * stoneGroup.distribution / 10;
    //   }
    //
    //   /**
    //    * Der letzte Stein kann maxY erreichen. Ist dies der Fall, würde er den 1. Stein, wenn dieser bei Y-0 beginnt zu
    //    * 50% überlappen. Deshalb beginnt der 1. Stein bei distanceY.
    //    */
    //     // let position = fn_A(stonePosition, 0, 1, distanceY, maxY);//getNextPosition_2(stonePosition, 0, 1, distanceY, {factor: 1});//channelRadiusFactor});
    //     // v2.x = position[0];
    //     // v2.y = position[1];
    //     // pathDistance += v1.distance(v2);
    //
    //     // maxStones = 1;
    //     // while (1) {
    //     //   position = fn_A(v2.x, v2.y, 1, distanceY, maxY);//getNextPosition_2(v2.x, v2.y, 1, distanceY, {factor: 1});//channelRadiusFactor});
    //     //   if (position[1] > maxY) {
    //     //     v2.x = stonePosition;
    //     //     v2.y = maxY;
    //     //     pathDistance += v1.distance(v2);
    //     //     break;
    //     //   }
    //     //
    //     //   v2.x = position[0];
    //     //   v2.y = position[1];
    //     //   pathDistance += v1.distance(v2);
    //     //   v2.toRef(v1);
    //     //
    //     //   maxStones++;
    //     // }
    //
    //   let initial_fn_A = fn_A(stonePosition, 0, stoneSizeY + stoneToStoneY, maxY, maxY, {pathDistanceIsMaxY: true});
    //   maxStones = initial_fn_A[3];
    //   pathDistance = initial_fn_A[4];
    //   console.log(initial_fn_A);
    //
    //   if (stoneGroup.count > maxStones) stoneGroup.count = -100;
    //
    //   stoneCount = stoneGroup.count;
    //
    //   if (stoneCount < 0) {
    //     if (stoneCount == -33.339) stoneCount = Math.round(maxStones / 3);
    //     else if (stoneCount == -50) stoneCount = Math.round(maxStones / 2);
    //     else if (stoneCount == -100) stoneCount = maxStones;
    //   }
    //
    //
    //   if (stoneGroup.distribution < 33) {
    //     initial_fn_A = fn_A(stonePosition, 0, (stoneSizeY + stoneToStoneY), stoneSizeY * stoneCount + stoneToStoneY * (stoneCount - 1), maxY);
    //   } else if (stoneGroup.distribution >= 33) {
    //     initial_fn_A[4] *= stoneGroup.distribution / 100;
    //   }
    //   console.log(initial_fn_A);
    //
    //
    //   hasCaps = !(stoneGroup.distribution == 100) && !(stoneGroup.distribution < 33 && stoneGroup.count == -100);
    //
    //   // if (hasCaps) {
    //   //   if (stoneGroup.distribution < 33) {
    //   //     distanceY_betweenStones = distanceY - calcStoneSize.calcSize;
    //   //   } else
    //   //     distanceY_betweenStones = pathDistance / (stoneCount - 1) - calcStoneSize.size;
    //   //   // distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.calcSize) / (stoneCount - 1);
    //   // } else
    //   //   distanceY_betweenStones = pathDistance / (stoneCount + 1) - calcStoneSize.size;
    //   // // distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.calcSize) / (stoneCount);
    //   //
    //   // distanceY = calcStoneSize.calcSize;
    //
    //   // console.log("pathDistance: " + pathDistance);
    //   // // console.log("channelRadiusFactor: " + channelRadiusFactor);
    //   // console.log("maxStones: " + maxStones);
    //   // console.log("stoneCount: " + stoneCount);
    //   // console.log("stoneGroup: ", stoneGroup);
    //   // // console.log("stoneGroup.count: " + stoneGroup.count);
    //   // // console.log("stoneGroup.distribution: " + stoneGroup.distribution);
    //   // console.log("==============");
    //   // }
    //
    //   /**
    //    * Path erstellen
    //    */
    //   let p = [] as CVertex[]; // path
    //   let rowsBetweenStones = 0;
    //   if (1) {
    //     let stonesRemaining = stoneCount;
    //     let y = 0, r = [0, 0, 0], r2: number[], r3: number[];
    //
    //
    //
    //
    //     // r = fn_A(stonePosition, 0, stoneSizeY + stoneToStoneY, initial_fn_A[4], maxY);
    //
    //
    //     console.log(r);
    //
    //     // if (!hasCaps)
    //     //   r = fn_A(stonePosition, 0, -(distanceY + distanceY_betweenStones), initial_fn_A[4]/2, maxY);
    //     //   // r = fn_A(r[0], r[1], -1, (pathDistance / 2) /*/ channelRadiusFactor*/ + calcStoneSize.calcSize / 2, maxY, {factor: 1});//channelRadiusFactor});
    //     // // r = getNextPosition_2(r[0], r[1], -1, (pathDistance / 2) /*/ channelRadiusFactor*/ + calcStoneSize.calcSize / 2, {factor: 1});//channelRadiusFactor});
    //     // else if (stoneGroup.distribution >= 33)
    //     //   r = fn_A(r[0], r[1], -1, (pathDistance / 2) /*/ channelRadiusFactor*/, maxY, {factor: 1});//channelRadiusFactor});
    //     // // r = getNextPosition_2(r[0], r[1], -1, (pathDistance / 2) /*/ channelRadiusFactor*/, {factor: 1});//channelRadiusFactor});
    //     // else {
    //     //   let channelLength = stoneCount * distanceY + (stoneCount - 1) * distanceY_betweenStones;
    //     //   r = fn_A(r[0], r[1], -1, channelLength / 2, maxY, {factor: 1});
    //     //   // r = getNextPosition_2(r[0], r[1], -1, channelLength / 2, {factor: channelRadiusFactor});
    //     // }
    //
    //     if (stoneToStoneY > 250)
    //       rowsBetweenStones = Math.trunc(stoneToStoneY / 250);// - 1;
    //     // console.log("rowsBetweenStones: " + rowsBetweenStones);
    //
    //     p.push(new CVertex(r[0] + stonePosition, r[1], 0));
    //
    //     while (stonesRemaining > 0) {
    //       r2 = fn_A(r[0], r[1], stoneSizeY, stoneSizeY, maxY);
    //       let step = (r2[2] - r[2]) / 4;
    //       y = r[1];
    //       /**
    //        * pro Stein werden 3 Reihen in Y erzeugt. Der Mittelpunkt liegt beim ersten Stein auf Reihe 1
    //        */
    //       for (let i = 0; i < 4; i++) {
    //         x = Math.sin(r[2] + ((i + 1) * step)) * amp100 * amp;
    //         y = map(r[2] + ((i + 1) * step) - initial_fn_A[2]/2, 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
    //         p.push(new CVertex(x + stonePosition, y, 0));
    //       }
    //
    //       // if (stonesRemaining == 1 && !hasCaps)
    //       //   r3 = fn_A(0, 0, 1, (pathDistance / 2) /*/ channelRadiusFactor*/ - calcStoneSize.size / 2, maxY, {factor: 1});//channelRadiusFactor});
    //       // // r3 = getNextPosition_2(0, 0, 1, (pathDistance / 2) /*/ channelRadiusFactor*/ - calcStoneSize.size / 2, {factor: 1});//channelRadiusFactor});
    //       // else
    //       //   r3 = fn_A(r2[0], r2[1], 1, distanceY_betweenStones, maxY, {factor: 1});//channelRadiusFactor});
    //       // // r3 = getNextPosition_2(r2[0], r2[1], 1, distanceY_betweenStones, {factor: 1});//channelRadiusFactor});
    //       //
    //       // if (0 && rowsBetweenStones && (stonesRemaining > 1 || !hasCaps)) {
    //       //   step = (r3[2] - r2[2]) / rowsBetweenStones;
    //       //   for (let i = 0; i < rowsBetweenStones; i++) {
    //       //     x = Math.sin(r2[2] + ((i + 1) * step)) * amp100 * amp;
    //       //     y = map(r2[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
    //       //     p.push(new CVertex(x + stonePosition, y, 0));
    //       //   }
    //       // }
    //
    //       /**
    //        * Wurde der r3 Wert aus Ausgangswert für den nächsten Stein genutzt, kam es zu Rundungsfehlern und Steinüberlappungen.
    //        */
    //       r = fn_A(r[0], r[1], stoneSizeY + stoneToStoneY, stoneSizeY + stoneToStoneY, maxY);
    //       // r = fn_A(r[0], r[1], 1, distanceY + distanceY_betweenStones, maxY, {factor: 1});//channelRadiusFactor});
    //       // r = getNextPosition_2(r[0], r[1], 1, distanceY + distanceY_betweenStones, {factor: 1});//channelRadiusFactor});
    //
    //
    //       stonesRemaining--;
    //     }
    //   }
    //
    //   /**
    //    * Shape entlang des Pfades extrudieren
    //    */
    //   let e = extrude_2(s, p, 1, ringData.waveCount > 0 ? ringRadiusFactor : 1.0);
    //
    //   /**
    //    * ausrichten der Hilfsgeometrie am Profil
    //    */
    //   if (1) {
    //     e.forEach((a) => {
    //       a.forEach((b) => {
    //         let IP = cRing.interpolate(b.x, ring.profile.frontVertices);
    //         b.z = IP.z;
    //         b.u = IP.uv_u;
    //       })
    //     })
    //   }
    //
    //   /**
    //    * Die Steinlinie wird linear zwischen der linken und rechten Kante interpoliert...
    //    */
    //   e.forEach((a) => {
    //     CVertex.lerpToRef(a[0], a[a.length - 1], 0.5, a[1]);
    //   })
    //
    //   /**
    //    * DEBUG: Mesh übergeben
    //    */
    //   if (e.length) {
    //     vertexArray.push({
    //       vertex2DArray: e,
    //       type: "helper",
    //       index: -1,
    //       triangulate_useVectorDist: false,
    //       triangulate_isFrontFace: true,
    //       close_normals: false,
    //       no_outline: true,
    //       no_rotate: true,
    //     });
    //   }
    //
    //   /**
    //    * Steine
    //    */
    //   if (1) {
    //     stoneHelperMesh.rows = e;
    //     stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);
    //
    //     let positions = [] as CVertex[];
    //     let tangents = [] as CVertex[];
    //     let normals = [] as CVertex[];
    //     let binormals = [] as CVertex[];
    //     let distances = [] as number[];
    //
    //     let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2, v: CVertex;
    //     let i, i_l = e.length, row, j_l;
    //
    //     for (i = 2; i < i_l; i += 4) {
    //
    //       row = e[i];
    //       j_l = row.length;
    //
    //       // Position
    //       P = CVertex.fromVertex(row[1]);
    //
    //       // Tangente (Y)
    //       e[i + 1][1].toRef(v1);
    //       e[i - 1][1].toRef(v2);
    //       T = CVertex.fromVertex(v1).sub(v2);
    //       T.normalize();
    //
    //       // Normal (X) ==> eigentlich ist das die Binormale!!
    //       row[0].toRef(v1);
    //       row[2].toRef(v2);
    //       N = CVertex.fromVertex(v2).sub(v1);
    //       N.normalize();
    //
    //       // Binormal
    //       B = CVertex.cross(N, T);
    //       B.normalize();
    //
    //       positions.push(P);
    //       tangents.push(T);
    //       normals.push(N);
    //       binormals.push(B);
    //
    //       i += rowsBetweenStones;
    //     }
    //
    //     let stonePathVectors = {
    //       distances,
    //       positions,
    //       normals,
    //       binormals,
    //       tangents
    //     };
    //
    //     ring.profile.stonePaths.push(stonePathVectors);
    //
    //     /**
    //      * Bevels
    //      */
    //     if (1) {
    //       {
    //         let distX = calcStoneSize.distances.stoneToBevel_x,
    //           distY = distX,
    //           bevelSizeX_half = (calcStoneSize.size + distX) / 2,
    //           bevelSizeY_half = (calcStoneSize.size + distY) / 2,
    //           bevelHeight = calcStoneSize.size / 2;
    //         let rows = [] as CVertex[][], row = [] as CVertex[], index;
    //
    //         /**
    //          Die Bevels werden an der Nullposition erstellt und beim Aufbau der
    //          Scene mit den Steinen ausgerichtet
    //          */
    //         switch (stoneGroup.type) {
    //           case 1: // Brillant
    //           {
    //             let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
    //             if (bevelTesselation < 2) bevelTesselation = 2;
    //             bevelTesselation *= 4;
    //             bevelTesselation--;
    //             let incRad = Math.PI * 2 / bevelTesselation,
    //               rad,
    //               dist,
    //               i,
    //               /**
    //                * Die Bevels erhalten oben einen extra Rand um die Alpha-Fehler zu verdecken.
    //                */
    //               extraBorder = 30;
    //
    //
    //             stonePathVectors.positions.forEach(function (p, bevelIndex) {
    //                 rows = [];
    //                 index = 0;
    //
    //                 // 1. Reihe
    //                 row = [];
    //                 dist = bevelSizeX_half + extraBorder;
    //                 rad = 0.0;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(dist, 0, 0);
    //                   v.rotateY(rad);
    //                   rad -= incRad;
    //                   v.i = index++;
    //                   row.push(v)
    //                 }
    //                 rows.push(row);
    //
    //                 // 2. Reihe
    //                 row = [];
    //                 dist = bevelSizeX_half;
    //                 rad = 0.0;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(dist, 0, 0);
    //                   v.rotateY(rad);
    //                   rad -= incRad;
    //                   v.i = index++;
    //                   row.push(v)
    //                 }
    //                 rows.push(row);
    //
    //                 // Mittelpunkt
    //                 i = row.length;
    //                 row = [];
    //                 while (i--) {
    //                   v = new CVertex(0, -bevelHeight, 0);
    //                   v.i = index++;
    //                   row.push(v)
    //                 }
    //                 rows.push(row);
    //
    //                 vertexArray.push({
    //                   vertex2DArray: rows,
    //                   type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
    //                   index: -1,
    //                   no_rotate: true,
    //                 });
    //               }
    //             )
    //             break;
    //           }
    //           case 2: // Princess
    //           case 3: // Princess 45°
    //           {
    //             let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
    //             if (bevelTesselation < 2) bevelTesselation = 2;
    //             bevelTesselation--;
    //             let incX = (bevelSizeX_half * 2) / bevelTesselation,
    //               incY = (bevelSizeY_half * 2) / bevelTesselation,
    //               x, y, z, i, j, j_l,
    //               extraBorder = 30;
    //
    //             stonePathVectors.positions.forEach(function (p, bevelIndex) {
    //                 rows = [];
    //                 index = 0;
    //
    //                 // 1. Reihe
    //                 row = [];
    //                 incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
    //                 incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
    //                 x = -bevelSizeX_half - extraBorder;
    //                 y = 0;
    //                 z = -bevelSizeY_half - extraBorder;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x += incX;
    //                 }
    //                 x -= incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z += incY;
    //                 }
    //                 z -= incY;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x -= incX;
    //                 }
    //                 x += incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z -= incY;
    //                 }
    //                 rows.push(row);
    //
    //                 // 2. Reihe
    //                 row = [];
    //                 incX = (bevelSizeX_half * 2) / bevelTesselation;
    //                 incY = (bevelSizeY_half * 2) / bevelTesselation;
    //                 x = -bevelSizeX_half;
    //                 y = 0;
    //                 z = -bevelSizeY_half;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x += incX;
    //                 }
    //                 x -= incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z += incY;
    //                 }
    //                 z -= incY;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x -= incX;
    //                 }
    //                 x += incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z -= incY;
    //                 }
    //                 rows.push(row);
    //
    //                 // Mittelpunkt
    //                 i = row.length;
    //                 row = [];
    //                 while (i--) {
    //                   v = new CVertex(0, -bevelHeight, 0);
    //                   v.i = index++;
    //                   row.push(v)
    //                 }
    //                 rows.push(row);
    //
    //                 if (stoneGroup.type == 3) // Princess 45°
    //                 {
    //                   for (i = 0; i < 3; i++) {
    //                     row = rows[i];
    //                     j_l = row.length;
    //                     for (j = 0; j < j_l; j++)
    //                       row[j].rotateY(Math.PI / 4);
    //                   }
    //
    //                 }
    //
    //                 vertexArray.push({
    //                   vertex2DArray: rows,
    //                   type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
    //                   index: -1,
    //                   no_rotate: true,
    //                 });
    //               }
    //             )
    //             break;
    //           }
    //           case 4: // Baguette quer
    //           case 5: // Baguette längs
    //           {
    //             bevelSizeX_half = (calcStoneSize.size + distX) / 2;
    //             bevelSizeY_half = (calcStoneSize.sizeY + distY) / 2;
    //
    //             let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
    //             if (bevelTesselation < 2) bevelTesselation = 2;
    //             bevelTesselation--;
    //             let incX = (bevelSizeX_half * 2) / bevelTesselation,
    //               incY = (bevelSizeY_half * 2) / bevelTesselation,
    //               x, y, z, i,
    //               extraBorder = 30;
    //
    //             stonePathVectors.positions.forEach(function (p, bevelIndex) {
    //                 rows = [];
    //                 index = 0;
    //
    //                 // 1. Reihe
    //                 row = [];
    //                 incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
    //                 incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
    //                 x = -bevelSizeX_half - extraBorder;
    //                 y = 0;
    //                 z = -bevelSizeY_half - extraBorder;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x += incX;
    //                 }
    //                 x -= incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z += incY;
    //                 }
    //                 z -= incY;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x -= incX;
    //                 }
    //                 x += incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z -= incY;
    //                 }
    //                 rows.push(row);
    //
    //                 // 2. Reihe
    //                 row = [];
    //                 incX = (bevelSizeX_half * 2) / bevelTesselation;
    //                 incY = (bevelSizeY_half * 2) / bevelTesselation;
    //                 x = -bevelSizeX_half;
    //                 y = 0;
    //                 z = -bevelSizeY_half;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x += incX;
    //                 }
    //                 x -= incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z += incY;
    //                 }
    //                 z -= incY;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   x -= incX;
    //                 }
    //                 x += incX;
    //                 for (i = 0; i <= bevelTesselation; i++) {
    //                   v = new CVertex(x, y, z);
    //                   v.i = index++;
    //                   row.push(v)
    //                   z -= incY;
    //                 }
    //                 rows.push(row);
    //
    //                 // Mittelpunkt
    //                 i = row.length;
    //                 row = [];
    //                 while (i--) {
    //                   v = new CVertex(0, -bevelHeight, 0);
    //                   v.i = index++;
    //                   row.push(v)
    //                 }
    //                 rows.push(row);
    //
    //                 vertexArray.push({
    //                   vertex2DArray: rows,
    //                   type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
    //                   index: -1,
    //                   no_rotate: true,
    //                 });
    //               }
    //             )
    //             break;
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
  /**
   * Verschnitt
   */
  else if (stoneGroup.mode == 20) //
  {
    let cutDepth = calcStoneSize.size * 0.19;
    /**
     * Die '0.25' ist der Abstand von der Steinoberkante bis zum äußersten Rand des Steines in der Z-Achse.
     * Genau sind das 0.19...aber dann ist der Abstand zwischen den Steinen zu gering.
     */
    let channelRadiusFactor = ringRadiusInner / (ringRadiusInner + ringData.ringHeight - calcStoneSize.size * 0.25);
    let distanceX = calcStoneSize.size + calcStoneSize.distances.stoneToStone_x;
    let distanceY = calcStoneSize.size + calcStoneSize.distances.stoneToStone_y;
    let distanceY_betweenStones = 0;
    let pathDistance = 0;
    let hasCaps = true;
    let alphaRad = (function (a = 86, b = cutDepth) {
      // Berechne die Hypotenuse c
      const c = Math.sqrt(a * a + b * b);

      // Berechne den Winkel Alpha in Rad
      return Math.acos(b / c);

      // Berechne den Winkel Alpha in Grad
      // const alphaDeg = (alphaRad * 180) / Math.PI;
    }());
    let gammaLength = Math.sqrt(86 * 86 + cutDepth * cutDepth);
    let width = rowSizeXSafe;

    /**
     * Shape erstellen
     */
    let s = [] as CVertex[], x = 0;
    if (1) {
      let frontVertices = ring.profile.frontVertices;
      // links
      x = cRing.interpolate(-width / 2, frontVertices).x;
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));

      let addVertex = function (x: number, distance = calcStoneSize.size / 3) {
        s.push(new CVertex(x - distance, 0, 0)); // Hilfspunkt zum ausrichten der Steine
        s.push(new CVertex(x, 0, 0));
        s.push(new CVertex(x + distance, 0, 0)); // Hilfspunkt zum ausrichten der Steine
      }

      // Steinmittelpunktlinie
      if (stoneGroup.rows == 1) {
        addVertex(0);
      } else {
        if (stoneGroup.rows % 2 == 0) {
          x = distanceX / 2;
          x += (stoneGroup.rows / 2 - 1) * distanceX;
          x = cRing.interpolate(-x, frontVertices).x;
        } else {
          x = cRing.interpolate(-(stoneGroup.rows - 1) / 2 * distanceX, frontVertices).x;
        }

        for (let i = 0; i < stoneGroup.rows; i++) {
          addVertex(x);
          x = cRing.interpolate(x + distanceX, frontVertices).x;
        }
      }

      // rechts
      x = cRing.interpolate(width / 2, frontVertices).x;
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
    }

    /**
     * Ermittle für die aktuelle Steingröße die Pfadlänge und die maximal mögliche Anzahl der Steine auf Steinebene
     * und nutze für den Abstand den 'channelRadiusFactor', da die Y-Werte durch das rotieren der Vertices gestreckt werden.
     */
    if (1) {
      if (stoneGroup.count == 1) stoneGroup.distribution = 0;

      maxY = height;
      let ar = [33, 50];
      if (ar.indexOf(stoneGroup.distribution) != -1) {
        maxY *= stoneGroup.distribution / 100;
      }
      ar = [5, 10, 20];
      if (ar.indexOf(stoneGroup.distribution) != -1) {
        distanceY += distanceY * stoneGroup.distribution / 10;
      }

      let v1 = new CVertex(stonePosition, 0, 0), v2 = new CVertex(stonePosition, 0, 0);

      /**
       * Der letzte Stein kann maxY erreichen. Ist dies der Fall, würde er den 1. Stein, wenn dieser bei Y-0 beginnt zu
       * 50% überlappen. Deshalb beginnt der 1. Stein bei distanceY.
       */
      v1.x = stonePosition;
      v1.y = 0;
      let position = getNextPosition_2(v1.x, v1.y, 1, distanceY, {factor: channelRadiusFactor});
      v2.x = position[0];
      v2.y = position[1];
      pathDistance = v1.distance(v2);
      v2.toRef(v1);

      maxStones = 1;
      console.log("here");
      while (1) {
        position = getNextPosition_2(v2.x, v2.y, 1, distanceY, {factor: channelRadiusFactor});
        if (position[1] > maxY)
        {
          /*
          20240414: Bei Verschnitt und 2900er Stein kam es zu Überschneidungen
           */
          // v2.x = stonePosition;
          // v2.y = maxY;
          // pathDistance += v1.distance(v2);
          break;
        }

        v2.x = position[0];
        v2.y = position[1];
        pathDistance += v1.distance(v2);
        v2.toRef(v1);

        maxStones++;
      }

      if (stoneGroup.count > maxStones) stoneGroup.count = -100;

      stoneCount = stoneGroup.count;

      if (stoneCount < 0) {
        if (stoneCount == -33.339) stoneCount = Math.round(maxStones / 3);
        else if (stoneCount == -50) stoneCount = Math.round(maxStones / 2);
        else if (stoneCount == -100) stoneCount = maxStones;
      }

      hasCaps = !(stoneGroup.distribution == 100) && !(stoneGroup.distribution < 33 && stoneGroup.count == -100);

      if (hasCaps) {
        if (stoneGroup.distribution < 33) {
          distanceY_betweenStones = distanceY - calcStoneSize.size;
        } else
          distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.size) / (stoneCount - 1);
      } else
        distanceY_betweenStones = ((pathDistance / channelRadiusFactor / stoneCount) - calcStoneSize.size);
      // distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.size) / (stoneCount);

      distanceY = calcStoneSize.size;
    }

    /**
     * Path erstellen
     */
    let p = [] as CVertex[]; // path
    let rowsBetweenStones = 0;
    if (1) {
      let stonesRemaining = stoneCount;
      let y = 0, r = [0, 0, 0], r2: number[], r3: number[];

      if (!hasCaps) {
        r[1] = -height / 2;
        r = getNextPosition_2(r[0], r[1], 1, (distanceY_betweenStones) / 2, {factor: channelRadiusFactor});
        // r = getNextPosition_2(r[0], r[1], -1, pathDistance / 2, {factor: channelRadiusFactor});
        // r = getNextPosition_2(r[0], r[1], 1, (calcStoneSize.size + distanceY_betweenStones) / 2, {factor: channelRadiusFactor});
      } else if (stoneGroup.distribution >= 33)
        r = getNextPosition_2(r[0], r[1], -1, (pathDistance / 2) / channelRadiusFactor, {factor: channelRadiusFactor});
      else {
        let channelLength = stoneCount * distanceY + (stoneCount - 1) * distanceY_betweenStones;
        r = getNextPosition_2(r[0], r[1], -1, channelLength / 2, {factor: channelRadiusFactor});
      }

      if (distanceY_betweenStones > 250)
        rowsBetweenStones = Math.trunc(distanceY_betweenStones / 250);

      p.push(new CVertex(r[0] + stonePosition, r[1], 0));

      while (stonesRemaining > 0) {
        r2 = getNextPosition_2(r[0], r[1], 1, distanceY, {factor: channelRadiusFactor});
        let step = (r2[2] - r[2]) / 4;
        y = r[1];
        /**
         * pro Stein werden 4 Reihen in Y erzeugt. Der Mittelpunkt liegt beim ersten Stein auf Reihe 2
         */
        for (let i = 0; i < 4; i++) {
          x = Math.sin(r[2] + ((i + 1) * step)) * amp100 * amp;
          y = map(r[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
          p.push(new CVertex(x + stonePosition, y, 0));
        }

        if (stonesRemaining == 1 && !hasCaps)
          r3 = getNextPosition_2(0, 0, 1, (pathDistance / 2) / channelRadiusFactor - calcStoneSize.size, {factor: channelRadiusFactor});
        else
          r3 = getNextPosition_2(r2[0], r2[1], 1, distanceY_betweenStones, {factor: channelRadiusFactor});

        if (rowsBetweenStones && (stonesRemaining > 1 || !hasCaps)) {
          step = (r3[2] - r2[2]) / rowsBetweenStones;
          for (let i = 0; i < rowsBetweenStones; i++) {
            x = Math.sin(r2[2] + ((i + 1) * step)) * amp100 * amp;
            y = map(r2[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
            p.push(new CVertex(x + stonePosition, y, 0));
          }
        }

        /**
         * Wurde der r3 Wert aus Ausgangswert für den nächsten Stein genutzt, kam es zu Rundungsfehlern und Steinüberlappungen.
         */
        r = getNextPosition_2(r[0], r[1], 1, distanceY + distanceY_betweenStones, {factor: channelRadiusFactor});

        stonesRemaining--;
      }
    }

    /**
     * Shape entlang des Pfades extrudieren
     */
    let e = extrude(s, p, new CVertex(0, 0, 0), ringData.waveCount > 0 ? ringRadiusFactor : 1.0);

    /**
     * ausrichten des Kanals am Profil
     */
    if (1) {
      e.forEach((a) => {
        a.forEach((b) => {
          let IP = cRing.interpolate(b.x, ring.profile.frontVertices);
          b.z = IP.z;
          b.u = IP.uv_u;
        })
      })
    }

    /**
     * Wenn ringsum, dann Anfans- und Endreihe angleichen (Pfad schließen)
     */
    if (1 && !hasCaps) {
      let r1 = e[0], r2 = e[e.length - 1];
      r2.forEach((a, index) => {
        a.x = r1[index].x;
        a.y = r1[index].y + height;
        a.z = r1[index].z;
        a.u = r1[index].u;
        a.v = a.y;
      })
    }

    /**
     * Die Flanken rechtwinklig zum Profil ausrichten; Steinlinien interpolieren
     */
    if (1) {
      let B = new CVertex(), N = new CVertex(), T = new CVertex();
      let i, lastRowTangent: CVertex[] = [], a = e[e.length - 1];

      /**
       * Sicherung der Tangenten für die letzte Reihe.
       * Da die Vertices vonunten nach oben verschoben werden, ist eine Berechnung der Tangenten für die letzte
       * Reihe im Loop nicht mehr möglich.
       */
      a.forEach((v, index) => {
        v.toRef(T);
        T.sub(e[e.length - 2][index]);
        lastRowTangent.push(CVertex.fromVertex(T));
      })

      /**
       * Steinreihen horizontal linear interpolieren und Flanken eindrehen
       */
      e.forEach((a, aIndex) => {

        let lastRow = aIndex == e.length - 1;
        let lastIndex = a.length - 1;

        a[1].x = a[2].x = a[0].x;
        a[1].y = a[2].y = a[0].y;
        a[1].z = a[2].z = a[0].z;

        a[lastIndex - 1].x = a[lastIndex - 2].x = a[lastIndex].x;
        a[lastIndex - 1].y = a[lastIndex - 2].y = a[lastIndex].y;
        a[lastIndex - 1].z = a[lastIndex - 2].z = a[lastIndex].z;

        for (let r = 0; r < stoneGroup.rows; r++) {
          let ri = 3 * r + 3;

          CVertex.lerpToRef(a[ri], a[ri + 2], 0.5, a[ri + 1]);

          a[ri].toRef(B);
          B.sub(a[ri + 2]);

          if (lastRow) T = lastRowTangent[ri];
          else {
            a[ri].toRef(T);
            T.sub(e[aIndex + 1][ri]);
          }

          CVertex.crossToRef(B, T, N);
          N.normalize();
          if (lastRow) N.scale(-cutDepth);
          else N.scale(cutDepth);

          a[ri].add(N);
          a[ri + 1].add(N);
          a[ri + 2].add(N);

          if (r == 0) {
            a[1].add(N);
            a[2].add(N);
          }
          if (r == stoneGroup.rows - 1) {
            a[lastIndex - 1].add(N);
            a[lastIndex - 2].add(N);
          }
        }
        /**
         * linke Flanke eindrehen
         */
        if (1) {
          a[2].toRef(B);
          B.sub(a[3]);

          a[0].toRef(T);
          if (lastRow) T.sub(e[aIndex - 1][0]);
          else T.sub(e[aIndex + 1][0]);

          CVertex.crossToRef(B, T, N);
          N.normalize();
          if (lastRow) {
            N.scale(-gammaLength);
            N = N.rotateAroundAxis(T, alphaRad);
          } else {
            N.scale(gammaLength);
            N = N.rotateAroundAxis(T, -alphaRad);
          }

          a[1].x = a[2].x = a[0].x;
          a[1].y = a[2].y = a[0].y;
          a[1].z = a[2].z = a[0].z;
          a[1].add(N);
          a[2].add(N);
        }

        /**
         * rechte Flanke eindrehen
         */
        if (1) {
          a[lastIndex - 3].toRef(B);
          B.sub(a[lastIndex - 2]);

          a[lastIndex].toRef(T);
          if (lastRow) T.sub(e[aIndex - 1][lastIndex]);
          else T.sub(e[aIndex + 1][lastIndex]);

          CVertex.crossToRef(B, T, N);
          N.normalize();
          if (lastRow) {
            N.scale(gammaLength);
            N = N.rotateAroundAxis(T, -alphaRad);
          } else {
            N.scale(-gammaLength);
            N = N.rotateAroundAxis(T, alphaRad);
          }

          a[lastIndex - 1].x = a[lastIndex - 2].x = a[lastIndex].x;
          a[lastIndex - 1].y = a[lastIndex - 2].y = a[lastIndex].y;
          a[lastIndex - 1].z = a[lastIndex - 2].z = a[lastIndex].z;
          a[lastIndex - 1].sub(N);
          a[lastIndex - 2].sub(N);
        }
      })
    }

    /**
     * Stützpunkte der Steinlinien extrahieren und gleichmäßig in Y verteilen
     */
    if (1) {
      let P = [] as CVertex[];
      let equalizePoints = function (): CVertex[] {

        const distances: number[] = [0];

        for (let i = 1; i < P.length; i++) {
          const d = P[i].distance(P[i - 1])
          distances.push(distances[i - 1] + d);
        }

        const totalDistance = distances[distances.length - 1];// - (extraCapDistance * 2);

        const equalizedPoints: CVertex[] = [];
        const step = totalDistance / (P.length - 1);

        let interpolate = function (t: number, p1: number, p2: number): number {
          return p1 + (p2 - p1) * t;
        }

        for (let i = 0; i < P.length; i++) {
          let targetDistance = i * step;

          let j = 0;
          while (distances[j] < targetDistance) {
            j++;
          }

          if (j >= P.length) j = P.length - 1;

          if (j === 0) {
            equalizedPoints.push(P[0]);
          } else {
            const t = (targetDistance - distances[j - 1]) / (distances[j] - distances[j - 1]);
            const p1 = P[j - 1];
            const p2 = P[j];

            if (!p1 || !p2)
              console.log(j, p1, p2);
            else {
              const interpolatedX = interpolate(t, p1.x, p2.x);
              const interpolatedY = interpolate(t, p1.y, p2.y);
              const interpolatedZ = interpolate(t, p1.z, p2.z);
              const interpolatedU = interpolate(t, p1.u, p2.u);
              const interpolatedV = interpolate(t, p1.v, p2.v);

              let v = new CVertex(interpolatedX, interpolatedY, interpolatedZ);
              v.u = interpolatedU;
              v.v = interpolatedV;
              equalizedPoints.push(v);
            }
          }
        }

        return equalizedPoints;
      }
      for (let ci = 0; ci < s.length; ci++) {
        P = [];
        e.forEach((a) => {
          P.push(a[ci]);
        })

        let ep = equalizePoints();

        e.forEach((a, index) => {
          a[ci].x = ep[index].x;
          a[ci].y = ep[index].y;
          a[ci].z = ep[index].z;
          a[ci].u = ep[index].u;
          a[ci].v = ep[index].v;
        })
      }
    }

    /**
     * erste und letzte Reihe nach unten / oben erweitern um den Abstand zu den Endkappen zu erweitern
     * Caps erstellen
     */
    if (hasCaps) {
      let V = new CVertex(), T = new CVertex();
      let row0 = e[0];
      let row1 = e[1];
      let scale = calcStoneSize.distances.stoneToBevel_x * channelRadiusFactor;
      // let scale = calcStoneSize.distances.stoneToBevel_x * channelRadiusFactor * 0.5;

      row0.forEach((v, index) => {
        v.toRef(V);
        row1[index].toRef(T);
        V.sub(T);
        V.normalize();
        V.scale(scale);
        v.add(V);
      })

      row0 = e[e.length - 2];
      row1 = e[e.length - 1];

      row1.forEach((v, index) => {
        v.toRef(V);
        row0[index].toRef(T);
        V.sub(T);
        V.normalize();
        V.scale(scale);
        v.add(V);
      })

      /**
       * Caps erstellen wenn notwendig
       */
      let capBottomRows = [] as CVertex[][];
      let capTopRows = [] as CVertex[][];

      let row = [] as CVertex[];
      let B = new CVertex(), N = new CVertex();
      let Vi = 0;
      let lastIndex: number;

      /**
       * unten
       */
      {
        /**
         * Profilreihe
         */
        row = [];
        row.push(e[0][0]);
        row.push(e[0][e[0].length - 1]);
        for (let i = 0; i < 4; i++)
          row = subdivide(row);

        /**
         * Hilfsreihe zur Tengentenberechnung
         */
        let tangentRow = [] as CVertex[];
        tangentRow.push(e[1][0]);
        tangentRow.push(e[1][e[1].length - 1]);
        for (let i = 0; i < 4; i++)
          tangentRow = subdivide(tangentRow);

        /**
         *  am Profil ausrichten
         */
        row.forEach(v => {
          let IP = cRing.interpolate(v.x, ring.profile.frontVertices);
          v.z = IP.z;
          v.u = IP.uv_u;
        })
        tangentRow.forEach(v => {
          let IP = cRing.interpolate(v.x, ring.profile.frontVertices);
          v.z = IP.z;
          v.u = IP.uv_u;
        })

        /**
         * Profilreihe fertig
         */
        capBottomRows.push(row);

        /**
         * Verschnittreihe
         */
        lastIndex = capBottomRows[0].length - 1;
        row = [];

        capBottomRows[0].forEach((v, index) => {
          if (index < lastIndex) {
            v.toRef(B);
            B.sub(capBottomRows[0][index + 1]);
          } else {
            capBottomRows[0][index - 1].toRef(B);
            B.sub(v);
          }

          v.toRef(T);
          T.sub(tangentRow[index]);

          V = CVertex.fromVertex(v);
          CVertex.crossToRef(B, T, N);
          N.normalize();

          if (index < lastIndex) {
            N.scale(cutDepth * 2);
            N = N.rotateAroundAxis(B, alphaRad);
            V.add(N);
          } else {
            N.scale(-cutDepth * 2);
            N = N.rotateAroundAxis(B, alphaRad);
            V.sub(N);
          }

          row.push(V);
        })

        /**
         * Die Verschnittreihe von links nach rechts linear interpolieren, da es zu Verformungen kam.
         */
        if (0) {
          let vA = row[0], vB = row[row.length - 1];

          for (let i = 1; i < row.length - 1; i++) {
            let distA = vA.distance(row[i]);
            let distB = vB.distance(row[i]);
            let distSum = distA + distB;
            CVertex.lerpToRef(vA, vB, distA / distSum, row[i]);
          }
        }

        capBottomRows.push(row);

        // Indices zuweisen
        Vi = 0;
        capBottomRows.forEach(r => {
          r.forEach(v => {
            v.i = Vi++;
          })
        })

        vertexArray.push({
          vertex2DArray: capBottomRows,
          type: "frontCut_" + (capBottomRows[0].length), // codiere die Anzahl der Punkte pro Reihe in den Namen; wird beim zuweisen der Materialien benötigt
          index: -1,
          triangulate_useVectorDist: false,
          triangulate_isFrontFace: true,
          close_normals: false,
          no_outline: true,
          no_rotate: false,
        });
      }
      /**
       * oben
       */
      {
        let eLast_1 = e.length - 1;
        let eLast_2 = e.length - 2;
        /**
         * Profilreihe
         */
        row = [];
        row.push(e[eLast_1][0]);
        row.push(e[eLast_1][e[eLast_1].length - 1]);
        for (let i = 0; i < 4; i++)
          row = subdivide(row);

        /**
         * Hilfsreihe zur Tengentenberechnung
         */
        let tangentRow = [] as CVertex[];
        tangentRow.push(e[eLast_2][0]);
        tangentRow.push(e[eLast_2][e[eLast_2].length - 1]);
        for (let i = 0; i < 4; i++)
          tangentRow = subdivide(tangentRow);

        /**
         *  am Profil ausrichten
         */
        row.forEach(v => {
          let IP = cRing.interpolate(v.x, ring.profile.frontVertices);
          v.z = IP.z;
          v.u = IP.uv_u;
        })
        tangentRow.forEach(v => {
          let IP = cRing.interpolate(v.x, ring.profile.frontVertices);
          v.z = IP.z;
          v.u = IP.uv_u;
        })

        /**
         * Profilreihe fertig
         */
        capTopRows.push(row);

        /**
         * Verschnittreihe
         */
        lastIndex = capTopRows[0].length - 1;
        row = [];

        capTopRows[0].forEach((v, index) => {
          if (index < lastIndex) {
            v.toRef(B);
            B.sub(capTopRows[0][index + 1]);
          } else {
            capTopRows[0][index - 1].toRef(B);
            B.sub(v);
          }

          v.toRef(T);
          T.sub(tangentRow[index]);

          V = CVertex.fromVertex(v);
          CVertex.crossToRef(B, T, N);
          N.normalize();

          if (index < lastIndex) {
            N.scale(-cutDepth * 2);
            N = N.rotateAroundAxis(B, -alphaRad);
            V.add(N);
          } else {
            N.scale(cutDepth * 2);
            N = N.rotateAroundAxis(B, -alphaRad);
            V.sub(N);
          }

          row.push(V);
        })

        /**
         * Die Verschnittreihe von links nach rechts linear interpolieren, da es zu Verformungen kam.
         */
        if (0) {
          let vA = row[0], vB = row[row.length - 1];

          for (let i = 1; i < row.length - 1; i++) {
            let distA = vA.distance(row[i]);
            let distB = vB.distance(row[i]);
            let distSum = distA + distB;
            CVertex.lerpToRef(vA, vB, distA / distSum, row[i]);
          }
        }

        capTopRows.push(row);

        // Indices zuweisen
        Vi = 0;
        capTopRows.forEach(r => {
          r.forEach(v => {
            v.i = Vi++;
          })
        })

        vertexArray.push({
          vertex2DArray: capTopRows,
          type: "frontCut_" + (capTopRows[0].length), // codiere die Anzahl der Punkte pro Reihe in den Namen; wird beim zuweisen der Materialien benötigt
          index: -1,
          triangulate_useVectorDist: false,
          triangulate_isFrontFace: false,
          close_normals: false,
          no_outline: true,
          no_rotate: false,
        });
      }
    }

    /**
     * Steine
     */
    if (1) {
      let e2 = [] as CVertex[][];
      let v: CVertex;
      e.forEach(a => {
        let row = [] as CVertex[];
        a.forEach(b => {
          v = CVertex.fromVertex(b);
          row.push(v);
        })
        e2.push(row);
      })

      stoneHelperMesh.rows = e2;
      stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

      let positions = [] as CVertex[];
      let tangents = [] as CVertex[];
      let normals = [] as CVertex[];
      let binormals = [] as CVertex[];
      let distances = [] as number[];

      let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
      let i, i_l = e2.length, row, j, j_l;

      for (i = 2; i < i_l; i += 4) {

        row = e2[i];
        j_l = row.length - 3;

        for (j = 4; j < j_l; j += 3) {
          // Position
          P = CVertex.fromVertex(row[j]);

          // Tangente (Y)
          e2[i + 2][j].toRef(v1);
          e2[i - 2][j].toRef(v2);
          T = CVertex.fromVertex(v1).sub(v2);
          T.normalize();

          // Normal (X) ==> eigentlich ist das die Binormale!!
          row[j - 1].toRef(v1);
          row[j + 1].toRef(v2);
          N = CVertex.fromVertex(v2).sub(v1);
          N.normalize();

          // Binormal
          B = CVertex.cross(N, T);
          B.normalize();
          B.scale(calcStoneSize.size * 0.18);
          P.sub(B);

          CVertex.crossToRef(N, T, B);
          B.normalize();

          positions.push(P);
          tangents.push(T);
          normals.push(N);
          binormals.push(B);
        }
      }

      ring.profile.stonePaths.push({
        distances,
        positions,
        normals,
        binormals,
        tangents
      });
    }

    /**
     * Die Hilfspunkte für die Steinausrichtung entfernen
     */
    let finalMesh: CVertex[][] = [];
    let index = 0;

    e.forEach((a) => {

      let row: CVertex[] = [];

      row.push(a[0]);
      row.push(a[1]);
      row.push(a[2]);

      for (let r = 0; r < stoneGroup.rows; r++) {
        let ri = 3 * r + 4;
        row.push(a[ri]);
      }

      row.push(a[a.length - 3]);
      row.push(a[a.length - 2]);
      row.push(a[a.length - 1]);

      row.forEach(a => {
        a.i = index++;
      })

      finalMesh.push(row);
    })

    /**
     * Mesh übergeben
     */
    if (e.length) {
      vertexArray.push({
        vertex2DArray: finalMesh,
        type: "frontCut_" + (finalMesh[0].length), // codiere die Anzahl der Punkte pro Reihe in den Namen; wird beim zuweisen der Materialien benötigt
        index: -1,
        triangulate_useVectorDist: false,
        triangulate_isFrontFace: true,
        close_normals: !hasCaps,
        no_outline: true,
        no_rotate: false,
      });
    }
  }
  /**
   * Kanal
   */
  else if (stoneGroup.mode == 30) //
  {
    let cutDepth = calcStoneSize.depth * 0.7;
    /**
     * Die '0.25' ist der Abstand von der Steinoberkante bis zum äußersten Rand des Steines in der Z-Achse.
     * Genau sind das 0.19...aber dann ist der Abstand zwischen den Steinen zu gering.
     */
    let channelRadiusFactor = ringRadiusInner / (ringRadiusInner + ringData.ringHeight - calcStoneSize.size * 0.25);
    let distanceX = calcStoneSize.size * 0.88;
    let distanceY = calcStoneSize.size + calcStoneSize.distances.stoneToStone_y;
    let distanceY_betweenStones = 0;
    let width = distanceX;
    let pathDistance = 0;
    let hasCaps = true;

    /**
     * Shape erstellen
     */
    let s = [] as CVertex[], x = 0;
    let shapeX = 0;
    if (1) {
      let frontVertices = ring.profile.frontVertices;
      // links
      x = cRing.interpolate(shapeX - width / 2, frontVertices).x;
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));

      // Steinmittelpunktlinie
      s.push(new CVertex(shapeX, 0, 0));

      // rechts
      x = cRing.interpolate(shapeX + width / 2, frontVertices).x;
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
      s.push(new CVertex(x, 0, 0));
    }

    /**
     * Ermittle für die aktuelle Steingröße die Pfadlänge und die maximal mögliche Anzahl der Steine auf Steinebene
     * und nutze für den Abstand den 'channelRadiusFactor', da die Y-Werte durch das rotieren der Vertices gestreckt werden.
     */
    if (1) {
      // console.log("==============");

      if (stoneGroup.count == 1) stoneGroup.distribution = 0;

      maxY = height;
      let ar = [33, 50];
      if (ar.indexOf(stoneGroup.distribution) != -1) {
        maxY *= stoneGroup.distribution / 100;
      }
      ar = [5, 10, 20];
      if (ar.indexOf(stoneGroup.distribution) != -1) {
        distanceY += distanceY * stoneGroup.distribution / 10;
      }

      let v1 = new CVertex(stonePosition, 0, 0), v2 = new CVertex(stonePosition, 0, 0);

      /**
       * Der letzte Stein kann maxY erreichen. Ist dies der Fall, würde er den 1. Stein, wenn dieser bei Y-0 beginnt zu
       * 50% überlappen. Deshalb beginnt der 1. Stein bei distanceY.
       */
      let position = getNextPosition_2(stonePosition, 0, 1, distanceY, {factor: channelRadiusFactor});
      v2.x = position[0];
      v2.y = position[1];

      maxStones = 1;
      while (1) {
        position = getNextPosition_2(v2.x, v2.y, 1, distanceY, {factor: channelRadiusFactor});
        if (position[1] > maxY) {
          v2.x = stonePosition;
          v2.y = maxY;
          pathDistance += v1.distance(v2);
          break;
        }

        v2.x = position[0];
        v2.y = position[1];
        pathDistance += v1.distance(v2);
        v2.toRef(v1);

        maxStones++;
      }

      if (stoneGroup.count > maxStones) stoneGroup.count = -100;

      stoneCount = stoneGroup.count;

      if (stoneCount < 0) {
        if (stoneCount == -33.339) stoneCount = Math.round(maxStones / 3);
        else if (stoneCount == -50) stoneCount = Math.round(maxStones / 2);
        else if (stoneCount == -100) stoneCount = maxStones;
      }

      hasCaps = !(stoneGroup.distribution == 100) && !(stoneGroup.distribution < 33 && stoneGroup.count == -100);

      if (hasCaps) {
        if (stoneGroup.distribution < 33) {
          distanceY_betweenStones = distanceY - calcStoneSize.size;
        } else
          distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.size) / (stoneCount - 1);
      } else
        distanceY_betweenStones = (pathDistance / channelRadiusFactor - stoneCount * calcStoneSize.size) / (stoneCount);

      distanceY = calcStoneSize.size;

      // console.log("pathDistance: " + pathDistance);
      // console.log("distanceY: " + distanceY);
      // console.log("distanceY_betweenStones: " + distanceY_betweenStones);
      // console.log("channelRadiusFactor: " + channelRadiusFactor);
      // console.log("maxStones: " + maxStones);
      // console.log("stoneCount: " + stoneCount);
      // console.log("stoneGroup.count: " + stoneGroup.count);
      // console.log("stoneGroup.distribution: " + stoneGroup.distribution);
      // console.log("==============");
    }

    // console.log("hasCaps: " + hasCaps);

    /**
     * Path erstellen
     */
    let p = [] as CVertex[]; // path
    let rowsBetweenStones = 0;
    let extraRowsBeforeStone = 0;
    if (1) {
      let stonesRemaining = stoneCount;
      let y = 0, r = [0, 0, 0], r2: number[], r3: number[];

      if (!hasCaps) {

        // r = getNextPosition_2(r[0], r[1], -1, height / 2);//, {factor: channelRadiusFactor});
        r[1] = -height / 2;
        r = getNextPosition_2(r[0], r[1], 1, (distanceY_betweenStones) / 2, {factor: channelRadiusFactor});

        // r = getNextPosition_2(r[0], r[1], -1, pathDistance / 2, {factor: channelRadiusFactor});
        // r = getNextPosition_2(r[0], r[1], 1, (calcStoneSize.size + distanceY_betweenStones) / 2, {factor: channelRadiusFactor});

        // r = getNextPosition_2(r[0], r[1], -1, (pathDistance / 2) / channelRadiusFactor + calcStoneSize.size / 2, {factor: channelRadiusFactor});
      } else if (stoneGroup.distribution >= 33)
        r = getNextPosition_2(r[0], r[1], -1, (pathDistance / 2) / channelRadiusFactor, {factor: channelRadiusFactor});
      else {
        let channelLength = stoneCount * distanceY + (stoneCount - 1) * distanceY_betweenStones;
        r = getNextPosition_2(r[0], r[1], -1, channelLength / 2, {factor: channelRadiusFactor});
      }

      if (distanceY_betweenStones > 250)
        rowsBetweenStones = Math.trunc(distanceY_betweenStones / 250);
      // console.log("rowsBetweenStones: " + rowsBetweenStones);

      /**
       * Wenn größere Abstände zwischen den Steinen vorhanden sind, kommt es am Anfang und Ende des Pfades zu Fehlern.
       * Füge deshalb weitere Stützpunkte am Anfang und Ende des Pfades ein.
       */

      if (!hasCaps) {
        /**
         * unten
         */
        let t = getNextPosition_2(0, -height / 2, 1, 0, {factor: ringRadiusFactor});
        let numRows = 5;
        let step = (r[2] - t[2]) / numRows;
        extraRowsBeforeStone = numRows - 1;

        for (let i = 0; i < numRows - 1; i++) {
          x = Math.sin(t[2] + ((i + 1) * step)) * amp100 * amp;
          y = map(t[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
          p.push(new CVertex(x + stonePosition, y, 0));
        }
      }

      p.push(new CVertex(r[0] + stonePosition, r[1], 0));

      while (stonesRemaining > 0) {
        r2 = getNextPosition_2(r[0], r[1], 1, distanceY, {factor: channelRadiusFactor});
        let step = (r2[2] - r[2]) / 4;
        y = r[1];
        /**
         * pro Stein werden 4 Reihen in Y erzeugt. Der Mittelpunkt liegt beim ersten Stein auf Reihe 2
         */
        for (let i = 0; i < 4; i++) {
          x = Math.sin(r[2] + ((i + 1) * step)) * amp100 * amp;
          y = map(r[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
          p.push(new CVertex(x + stonePosition, y, 0));
        }

        if (stonesRemaining == 1 && !hasCaps)
          r3 = getNextPosition_2(0, 0, 1, (pathDistance / 2) / channelRadiusFactor - calcStoneSize.size / 2, {factor: channelRadiusFactor});
        else
          r3 = getNextPosition_2(r2[0], r2[1], 1, distanceY_betweenStones, {factor: channelRadiusFactor});

        if (rowsBetweenStones && (stonesRemaining > 1 /*|| !hasCaps*/)) {
          step = (r3[2] - r2[2]) / rowsBetweenStones;
          for (let i = 0; i < rowsBetweenStones; i++) {
            x = Math.sin(r2[2] + ((i + 1) * step)) * amp100 * amp;
            y = map(r2[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
            p.push(new CVertex(x + stonePosition, y, 0));
          }
        }

        /**
         * Wurde der r3 Wert aus Ausgangswert für den nächsten Stein genutzt, kam es zu Rundungsfehlern und Steinüberlappungen.
         */
        r = getNextPosition_2(r[0], r[1], 1, distanceY + distanceY_betweenStones, {factor: channelRadiusFactor});

        stonesRemaining--;
      }

      if (!hasCaps) {
        /**
         * oben
         */
        let t = getNextPosition_2(0, height / 2, -1, 0, {factor: ringRadiusFactor});
        let numRows = 5;
        //@ts-ignore
        let step = (r[2] - t[2]) / (numRows - 1);

        for (let i = 0; i < numRows; i++) {
          //@ts-ignore
          x = Math.sin(r2[2] + ((i + 1) * step)) * amp100 * amp;
          //@ts-ignore
          y = map(r2[2] + ((i + 1) * step), 0, Math.PI * 2 * (ringData.waveCount > 0 ? ringData.waveCount : 1), 0, height);
          p.push(new CVertex(x + stonePosition, y, 0));
        }
      }

    }

    /**
     * Shape entlang des Pfades extrudieren
     */
    let e = extrude(s, p, new CVertex(shapeX, 0, 0), ringData.waveCount > 0 ? ringRadiusFactor : 1.0);

    /**
     * ausrichten des Kanals am Profil
     */
    if (1) {
      e.forEach((a) => {
        a.forEach((b) => {
          let IP = cRing.interpolate(b.x, ring.profile.frontVertices);
          b.z = IP.z;
          b.u = IP.uv_u;
        })
      })
    }

    /**
     * Wenn ringsum, dann Anfans- und Endreihe angleichen (Pfad schließen)
     */

    if (0 && !hasCaps) {
      let r1 = e[0], r2 = e[e.length - 1];
      r2.forEach((a, index) => {
        a.x = r1[index].x;
        a.y = r1[index].y + height;
        a.z = r1[index].z;
        a.u = r1[index].u;
        a.v = a.y;
      })
    }

    /**
     * Die Flanken rechtwinklig zum Profil ausrichten; Steinlinien interpolieren
     */
    if (1) {
      let B = new CVertex(), N = new CVertex(), T = new CVertex();
      e.forEach((a, aIndex) => {

        let lastRow = aIndex == e.length - 1;
        let lastIndex = a.length - 1;

        /**
         * Die Kanalflanken werden parallel in die Tiefe gezogen. Dazu wird die Normale aus dem 1. und letzten Vertex der
         * Reihe ermittelt.
         */

        a[0].toRef(B);
        B.sub(a[lastIndex]);

        /**
         * Die Steinlinie wird linear zwischen der linken und rechten Kanalflanke interpoliert...
         */
        CVertex.lerpToRef(a[0], a[lastIndex], 0.5, a[3]);

        /**
         * ...und für die Tangentenberechnung genutzt
         */
        a[0].toRef(T);
        if (lastRow) {
          T.sub(e[aIndex - 1][0]);
        } else {
          T.sub(e[aIndex + 1][0]);
        }

        CVertex.crossToRef(B, T, N);
        N.normalize();
        if (lastRow)
          N.scale(-cutDepth);
        else
          N.scale(cutDepth);

        a[1].x = a[2].x = a[0].x;
        a[1].y = a[2].y = a[0].y;
        a[1].z = a[2].z = a[0].z;
        a[1].add(N);
        a[2].add(N);

        a[lastIndex - 1].x = a[lastIndex - 2].x = a[lastIndex].x;
        a[lastIndex - 1].y = a[lastIndex - 2].y = a[lastIndex].y;
        a[lastIndex - 1].z = a[lastIndex - 2].z = a[lastIndex].z;
        a[lastIndex - 1].add(N);
        a[lastIndex - 2].add(N);

        a[3].add(N);
      })
    }

    /**
     * Mesh übergeben
     */
    if (e.length) {
      vertexArray.push({
        vertex2DArray: e,
        type: "frontChannel",
        index: -1,
        triangulate_useVectorDist: false,
        triangulate_isFrontFace: true,
        close_normals: !hasCaps,
        no_outline: true,
        no_rotate: false,
      });
    }

    /**
     * Caps erstellen wenn notwendig
     */
    let capBottomRows = [] as CVertex[][];
    let capTopRows = [] as CVertex[][];
    if (1 && hasCaps) {
      let row = [] as CVertex[], Vi = 0;

      /**
       * unten
       */
      {
        row = [];
        row.push(e[0][0]);
        row.push(e[0][e[0].length - 1]);
        for (let i = 0; i < 4; i++)
          row = subdivide(row);

        // am Profil ausrichten
        row.forEach(v => {
          let IP = cRing.interpolate(v.x, ring.profile.frontVertices);
          v.z = IP.z;
          v.u = IP.uv_u;
        })
        capBottomRows.push(row);

        row = [];
        row.push(e[0][1]);
        row.push(e[0][e[0].length - 2]);
        for (let i = 0; i < 4; i++)
          row = subdivide(row);
        capBottomRows.push(row);

        // Indices zuweisen
        Vi = 0;
        capBottomRows.forEach(r => {
          r.forEach(v => {
            v.i = Vi++;
          })
        })

        vertexArray.push({
          vertex2DArray: capBottomRows,
          type: "frontChannel", // codiere die Anzahl der Punkte pro Reihe in den Namen; wird beim zuweisen der Materialien benötigt
          index: -1,
          triangulate_useVectorDist: false,
          triangulate_isFrontFace: true,
          close_normals: false,
          no_outline: true,
          no_rotate: false,
        });
      }
      /**
       * oben
       */
      {
        let lastIndex = e.length - 1;
        row = [];
        row.push(e[lastIndex][0]);
        row.push(e[lastIndex][e[lastIndex].length - 1]);
        for (let i = 0; i < 4; i++)
          row = subdivide(row);

        // am Profil ausrichten
        row.forEach(v => {
          let IP = cRing.interpolate(v.x, ring.profile.frontVertices);
          v.z = IP.z;
          v.u = IP.uv_u;
        })
        capTopRows.push(row);

        row = [];
        row.push(e[lastIndex][1]);
        row.push(e[lastIndex][e[lastIndex].length - 2]);
        for (let i = 0; i < 4; i++)
          row = subdivide(row);
        capTopRows.push(row);

        // Indices zuweisen
        Vi = 0;
        capTopRows.forEach(r => {
          r.forEach(v => {
            v.i = Vi++;
          })
        })

        vertexArray.push({
          vertex2DArray: capTopRows,
          type: "frontChannel", // codiere die Anzahl der Punkte pro Reihe in den Namen; wird beim zuweisen der Materialien benötigt
          index: -1,
          triangulate_useVectorDist: false,
          triangulate_isFrontFace: false,
          close_normals: false,
          no_outline: true,
          no_rotate: false,
        });
      }
    }

    /**
     * Steine
     */
    if (1) {
      let e2 = [] as CVertex[][];
      let v: CVertex;
      e.forEach((a) => {
        let row = [] as CVertex[];
        a.forEach((b, bIndex) => {
          if (bIndex > 1 && bIndex < a.length - 2) {
            v = CVertex.fromVertex(b);
            row.push(v);
          }
        })
        e2.push(row);
      })

      stoneHelperMesh.rows = e2;
      stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

      let positions = [] as CVertex[];
      let tangents = [] as CVertex[];
      let normals = [] as CVertex[];
      let binormals = [] as CVertex[];
      let distances = [] as number[];

      let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
      let i, i_l = e2.length - extraRowsBeforeStone, row, j, j_l;

      for (i = 2 + extraRowsBeforeStone; i < i_l; i += 4) {

        row = e2[i];
        j_l = row.length;

        for (j = 1; j < j_l - 1; j++) {
          // Position
          P = CVertex.fromVertex(row[j]);

          // Tangente (Y)
          e2[i + 2][j].toRef(v1);
          e2[i - 2][j].toRef(v2);
          T = CVertex.fromVertex(v1).sub(v2);

          // Normal (X) ==> eigentlich ist das die Binormale!!
          row[j - 1].toRef(v1);
          row[j + 1].toRef(v2);
          N = CVertex.fromVertex(v2).sub(v1);

          // Binormal
          B = CVertex.cross(N, T);
          B.normalize();
          B.scale(cutDepth);
          P.sub(B);

          N.normalize();
          B.normalize();
          T.normalize();

          positions.push(P);
          tangents.push(T);
          normals.push(N);
          binormals.push(B);
        }
        i += rowsBetweenStones;
        // if (distanceY_betweenStones > 250) i += 4;
      }

      ring.profile.stonePaths.push({
        distances,
        positions,
        normals,
        binormals,
        tangents
      });
    }
  }

  // Prüfung der maximal möglichen Steingröße inkl. Tiefencheck
  // @ts-ignore

  let div0 = (stonePosition + ringData.ringWidth / 2) * 10000 / ringData.ringWidth;
  stoneGroup.positionDiv = [div0, 10000 - div0];

  let segmentSafeSize = [] as number[];
  outlineDataMeasurement.forEach(e => {
    if (e.minX < e.maxX) {
      segmentSafeSize.push(<number>e.distXSafe);
    }
  })

  return {
    minSize: (odmSegment.onGap ? minStoneSize : 1000),
    maxSize: maxStoneSize,
    maxCount: maxStones,
    maxRows: maxRows,
    rowSizeXSafe: rowSizeXSafe,
    coordinates: stoneCoordinates,
    segmentSizeXSafe: segmentSafeSize,
  }
}

function stoneCalc_crossChannel(ring: cRing, vertexArray: iVertexArray[]): iStoneCalcData | null {

  let ringData = ring.ringData;
  let stoneGroup = ringData.stone[0];

  if (stoneGroup.mode != 31) return null;
  if (ring.profile.channelVertices.length == 0) return null;
  if (stoneGroup.type != 1) stoneGroup.type = 1;

  let ringRadiusInner = ringData.ringSize / Math.PI / 2,
    ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
    ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
    stoneMode = getStoneMode(stoneGroup.mode);

  if (!stoneMode) {
    console.log("Steinmodus nicht erkannt!");
    return null;
  }

  let profileDepthSafeDistanceToStone = 300;

  let outlineMin = -ringData.ringWidth / 2;
  let outlineMax = -outlineMin;

  let profile = AppComponent.app.data.profile.find(e => {
    return e.name == ringData.profileName;
  })

  let swLeft = 0, swRight = 0,
    sideCrossChannelDistance = profile ? (profile.sideCrossChannelDistance ?? stoneMode.sideCrossChannelDistance ?? 100) : 100;

  if (ringData.stepMode == 1 || ringData.stepMode == 3)
    swLeft = ringData.stepWidth[0];
  if (ringData.stepMode == 2 || ringData.stepMode == 3)
    swRight = ringData.stepWidth[1];

  if (swLeft < sideCrossChannelDistance) swLeft = sideCrossChannelDistance;
  if (swRight < sideCrossChannelDistance) swRight = sideCrossChannelDistance;

  outlineMin += swLeft;
  outlineMax -= swRight;

  let outlineSize = outlineMax - outlineMin;

  let stoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, stoneGroup.size, {useRealStoneSize: true})[0],
    stoneDepth = 0,
    profileDepth = 0;


  let typeItem = getStoneCuts(AppComponent.app.data).find(function (e) {
    return (e.legacyId ?? e.id) === stoneGroup.type;
  })
  if (!typeItem) return null;
  let sizeItem = typeItem.size.find(e => {
    return e.size == stoneSize;
  })
  if (!sizeItem) return null;

  let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
    return (e.legacyId ?? e.id) == stoneGroup.type;
  })
  if (!stoneType) return null;

  let doWhile_stoneDepthCheck = true;
  let doWhile_stoneDepthCheck_count = 50;

  // ermittle die Steingröße entsprechend der Profiltiefe
  while (doWhile_stoneDepthCheck && doWhile_stoneDepthCheck_count-- > 0) {

    doWhile_stoneDepthCheck = false;

    stoneDepth = stoneSize * typeItem.sizeDepthFactor;

    let doLoop = true;
    let loopCount = 0;

    // ermittle die Steingröße für die Segmentbreite
    while (doLoop && loopCount++ < 50) {
      doLoop = false

      if (stoneSize > outlineSize) {

        let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, outlineSize, {useRealStoneSize: true});

        if (size[0] == 0) {
          console.log("Kein passendes Segment gefunden!");
          return null;
        }

        stoneSize = size[0];
        doLoop = true;
      }
    }

    if (stoneSize == 0) {
      console.log("Steingröße = 0!");
      return null;
    }

    // Prüfung der Steintiefe
    let front = cRing.interpolate(0, ring.profile.frontVertices);
    let back = cRing.interpolate(0, ring.profile.backVertices);
    profileDepth = back.z - front.z - profileDepthSafeDistanceToStone;

    if (stoneDepth > profileDepth) {
      let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, stoneSize - 50, {useRealStoneSize: true})[0];

      // @ts-ignore
      if (size == 0) {
        console.log("Keine passende Steingröße gefunden!");
        return null;
      } else {
        console.log("Profiltiefe nicht ausreichend! Steingröße wird reduziert! (" + stoneSize + " -> " + size + ")");
        stoneSize = size;
      }

      doWhile_stoneDepthCheck = true;
    }
  }

  stoneGroup.size = stoneSize;
  stoneGroup.positionDiv = [5000, 5000];

  // ermittle die linken und rechten Grenzwerte zur Steinverteilung
  doWhile_stoneDepthCheck = true;
  doWhile_stoneDepthCheck_count = 50;

  outlineMin += stoneSize / 2;
  outlineMax -= stoneSize / 2;

  while (doWhile_stoneDepthCheck && doWhile_stoneDepthCheck_count-- > 0) {

    doWhile_stoneDepthCheck = false;

    // Prüfung der Steintiefe
    let front = cRing.interpolate(outlineMin, ring.profile.frontVertices);
    let back = cRing.interpolate(outlineMin, ring.profile.backVertices);
    let depth = back.z - front.z - profileDepthSafeDistanceToStone;

    if (stoneDepth > depth) {
      outlineMin += 10;
      doWhile_stoneDepthCheck = true;
    }

    front = cRing.interpolate(outlineMax, ring.profile.frontVertices);
    back = cRing.interpolate(outlineMax, ring.profile.backVertices);
    depth = back.z - front.z - profileDepthSafeDistanceToStone;

    if (stoneDepth > depth) {
      outlineMax -= 10;
      doWhile_stoneDepthCheck = true;
    }
  }

  outlineSize = outlineMax - outlineMin;

  /**
   * neue Steindistanzen
   */
  let calcStoneSize = getStoneSize_2(ringData, stoneGroup, stoneType, stoneGroup.size, stoneMode, false);
  stoneSize += calcStoneSize.distances.stoneToStone_x;

  let maxStoneCount = Math.trunc((outlineSize + stoneSize) / stoneSize);
  if (stoneGroup.count > maxStoneCount) {
    stoneGroup.count = maxStoneCount;
    console.log("Die Steinanzahl wurde angepasst");
  }

  let stoneCoordinates = [] as iPoint[];

  let distSize = (stoneGroup.count - 1) * stoneSize;
  let middle = outlineMax - (outlineSize / 2);
  for (let x = -distSize / 2, end = distSize / 2; x <= end; x += stoneSize) {
    stoneCoordinates.push({
      x: x + middle,
      y: 0
    })
  }

  // Berechne die Geometriedaten der einzelnen Steine
  let p = [] as iPoint[]; // die untere Kante, Mittelpunkt und obere Kante der Steine

  let stoneSizeY_safe = (stoneSize + (<iStoneMode>stoneMode).safeDistY) * ringRadiusFactor,
    stoneSizeY_half_safe = stoneSizeY_safe / 2;

  stoneCoordinates.forEach(function (e) {
    p.push({x: e.x, y: e.y - stoneSizeY_half_safe * ringRadiusFactor});
    p.push({x: e.x, y: e.y});
    p.push({x: e.x, y: e.y + stoneSizeY_half_safe * ringRadiusFactor});
  })

  let vertexRows = [] as CVertex[][];
  let vertexRow = [] as CVertex[];
  let index = 0;
  let v: CVertex;
  let stoneSizeX_half = stoneSize / 2;

  p.forEach(function (e) {
    v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, ring.profile.channelVertices).z);
    v.i = index++;
    vertexRow.push(v);
    v = new CVertex(e.x, e.y, cRing.interpolate(e.x, ring.profile.channelVertices).z);
    v.i = index++;
    vertexRow.push(v);
    v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, ring.profile.channelVertices).z);
    v.i = index++;
    vertexRow.push(v);

    vertexRows.push(vertexRow);
    vertexRow = [];
  })

  let stoneHelperMesh = new CMesh;
  let thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180; // zusätzliche Rotation des Ringes um die X-Achse

  stoneHelperMesh.rows = vertexRows;
  stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

  // vertexArray.push({
  //   vertex2DArray: vertexRows,
  //   type: "helper",
  //   index: -1,
  //   no_rotate: true,
  //   triangulate_useVectorDist: false,
  // });

  let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
    let positions = [];
    let tangents = [];
    let normals = [];
    let binormals = [];
    let distances = [] as number[];

    let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
    let i, i_l = rows.length, row, j, j_l;

    for (i = 1; i < i_l; i += 3) {

      row = rows[i];
      j_l = row.length;

      for (j = 1; j < j_l; j += 3) {
        // Position
        P = CVertex.fromVertex(row[j]);

        // Tangente
        rows[i + 1][j].toRef(v1);
        rows[i - 1][j].toRef(v2);
        T = CVertex.fromVertex(v1).sub(v2);

        // Normal
        row[j - 1].toRef(v1);
        row[j + 1].toRef(v2);
        N = CVertex.fromVertex(v2).sub(v1);

        // Binormal
        B = CVertex.cross(N, T);

        // Normal again
        CVertex.crossToRef(B, T, N);

        N.normalize();
        B.normalize();
        T.normalize();

        positions.push(P);
        tangents.push(T);
        normals.push(N);
        binormals.push(B);
      }
    }

    return {
      distances,
      positions,
      normals,
      binormals,
      tangents
    }
  };
  let stonePathVectors = computeStonePathVectors(vertexRows);

  ring.profile.stonePaths.push(stonePathVectors);

  // ==> Bevels
  let channelSizeY_half = stoneSize * ringRadiusFactor / 2 * 0.88; // 12% kleiner als Stein: Ticket 1046
  let vertexFront_start: CVertex | null = null;
  let vertexFront_end: CVertex | null = null;

  let computeCrossChannelFront = function () {
    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;
    let slv = ring.profile.stepLeftVertices;
    let srv = ring.profile.stepRightVertices;
    let fv = ring.profile.frontVertices;
    let bv = ring.profile.backVertices;
    let cv = ring.profile.channelVertices;

    /**
     * Die Querkanaltiefe war bei der V1 auf 30% eingestellt. Also hier auch wieder...obwohl die Kanaltiefe normal bei 70% liegt
     */
    let depth = typeItem ? stoneSize * typeItem.sizeDepthFactor * 0.3 : stoneSize * 0.3;

    /**
     * Ermittle die Tiefe des Kanals, wenn Stufen vorhanden sind.
     */
    if (1) {
      let depthLeft = 0, depthRight = 0;
      if (slv && slv.length) depthLeft = slv[slv.length - 1].distance(slv[slv.length - 2]);
      if (srv && srv.length) depthRight = srv[srv.length - 1].distance(srv[srv.length - 2]);

      let d = Math.max(depthLeft, depthRight);
      if (d > depth) depth = d + 100;
    }

    let xStart = -ring.ringData.ringWidth / 2;
    for (let x = xStart; x < 0; x++) {
      let ip_channel = cRing.interpolate(x, cv);
      let ip_front = cRing.interpolate(x, fv);
      if (ip_channel.z + depth > ip_front.z) {
        xStart = ip_channel.x;
        break;
      }
    }
    let y = -channelSizeY_half;
    let yStep = (channelSizeY_half * 2) / 4;
    let xEnd = -xStart;

    // mesh für alpha

    for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half * 2) {
      // step left
      if (slv) {
        for (let i = 0, i_l = slv.length; i < i_l; i++) {
          let x = slv[i].x;
          if (i == 0) x = xStart;
          else {
            if (x < xStart) continue;
          }
          if (x > xEnd) x = xEnd;
          let ip = cRing.interpolate(x, slv);
          v = new CVertex(x, y, ip.z);
          v.i = index++;
          v.u = ip.uv_u;
          v.v = v.y;
          vertexRow.push(v);
          if (x == xEnd) break;
        }
      }

      // front
      for (let i = 0, i_l = fv.length; i < i_l; i++) {
        let x = fv[i].x;
        if (i == 0) x = xStart;
        else {
          if (x < xStart) continue;
        }
        if (x > xEnd) x = xEnd;
        let ip = cRing.interpolate(x, fv);
        v = new CVertex(x, y, ip.z);
        v.i = index++;
        v.u = ip.uv_u;
        v.v = v.y;
        vertexRow.push(v);
        if (x == xEnd) break;
      }

      // step right
      if (srv) {
        for (let i = 0, i_l = srv.length; i < i_l; i++) {
          let x = srv[i].x;
          if (i == 0) x = xStart;
          else {
            if (x < xStart) continue;
          }
          if (x > xEnd) x = xEnd;
          let ip = cRing.interpolate(x, srv);
          v = new CVertex(x, y, ip.z);
          v.i = index++;
          v.u = ip.uv_u;
          v.v = v.y;
          vertexRow.push(v);
          if (x == xEnd) break;
        }
      }
      vertexRows.push(vertexRow);
      vertexRow = [];
    }

    vertexArray.push({
      vertex2DArray: vertexRows,
      type: "crossChannelFront_alpha",
      index: -1,
      triangulate_isFrontFace: true,
      triangulate_useVectorDist: false,
      no_outline: false,
      close_normals: false,
    });

    // mesh für albedo
    vertexRows = [];
    vertexRow = [];
    index = 0;
    // fv = ring.profile.frontVertices;

    xStart = -ringData.ringWidth / 2;
    for (let x = -ringData.ringWidth / 2; x < 0; x++) {
      let ip_back = cRing.interpolate(x, bv, ring.profile.middleVertexBack[0]);
      let ip_channel = cRing.interpolate(x, cv);
      let ip_front = cRing.interpolate(x, fv);
      if (ip_channel.z + depth < ip_front.z) {
        continue;
      }
      if (ip_channel.z + depth > ip_back.z)
        continue;
      if (ip_channel.z + depth <= ip_back.z) {
        xStart = ip_channel.x;
        break;
      }
    }

    xEnd = -xStart;

    for (let i = 0; i < 5; i++) {
      let x = xStart;
      let count = 0;
      while (count++ < 100) {
        let ip_channel = cRing.interpolate(x, cv);
        v = new CVertex(x, y, ip_channel.z + depth);
        v.i = index++;
        v.u = ip_channel.uv_u;
        v.v = v.y;
        vertexRow.push(v);
        if (x == xEnd) {
          break;
        }
        x = cv[ip_channel.indexVectorB].x;
        if (x > xEnd)
          x = xEnd;
      }

      vertexRows.push(vertexRow);
      vertexRow = [];

      y += yStep;
    }

    vertexArray.push({
      vertex2DArray: vertexRows,
      type: "crossChannelFront",
      index: -1,
      triangulate_isFrontFace: true,
      triangulate_useVectorDist: false,
      no_outline: true,
      close_normals: false,
    });

    vertexFront_start = CVertex.fromVertex(vertexRows[0][0]);
    vertexFront_end = CVertex.fromVertex(vertexRows[0][vertexRows[0].length - 1]);
  }
  let computeCrossChannelBack = function () {
    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;
    let v2: CVertex;
    let bv = ring.profile.backVertices;
    let ip;

    if (vertexFront_start && vertexFront_start.z > bv[0].z) {
      // mesh für alpha
      for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
        v = CVertex.fromVertex(bv[0]);
        v.i = index++;
        v.y = y;
        v.v = y;
        v.u = 0.0;
        vertexRow.push(v);

        if (vertexFront_start.x < v.x) {
          v2 = new CVertex(vertexFront_start.x, y, vertexFront_start.z);
          let dist = v.distance(v2);
          ip = cRing.interpolate_distance_2(bv, 0, dist);
          v2.x = ip.x;
          v2.z = ip.z;
          v2.y = y;
          v2.i = index++;
          v2.u = ip.uv_u;
          v2.v = v2.y;
          vertexRow.push(v2);
        } else {
          ip = cRing.interpolate(vertexFront_start.x, bv);
          v2 = new CVertex(ip.x, y, ip.z);
          v2.i = index++;
          v2.u = ip.uv_u;
          v2.v = v2.y;
          vertexRow.push(v2);
        }

        vertexRows.push(vertexRow);
        vertexRow = [];
      }

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelBack_alpha",
        index: -1,
        triangulate_isFrontFace: false,
        triangulate_useVectorDist: false,
        no_outline: true,
        close_normals: false,
      });
    }
    if (1 && vertexFront_end && vertexFront_end.z > bv[bv.length - 1].z) {
      vertexRows = [];
      vertexRow = [];
      index = 0;
      // mesh für alpha

      for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
        v = CVertex.fromVertex(bv[bv.length - 1]);
        v.i = index++;
        v.y = y;
        v.v = y;
        v.u = 1.0;

        if (vertexFront_end.x > v.x) {
          v2 = new CVertex(vertexFront_end.x, y, vertexFront_end.z);
          let dist = v.distance(v2);
          ip = cRing.interpolate_distance_2(bv, bv.length - 1, -dist);
          v2.x = ip.x;
          v2.z = ip.z;
          v2.y = y;
          v2.i = index++;
          v2.u = ip.uv_u;
          v2.v = v2.y;
          vertexRow.push(v2);
        } else {
          ip = cRing.interpolate(vertexFront_end.x, bv);
          v2 = new CVertex(ip.x, y, ip.z);
          v2.i = index++;
          v2.u = ip.uv_u;
          v2.v = v2.y;
          vertexRow.push(v2);
        }

        vertexRow.push(v);

        vertexRows.push(vertexRow);
        vertexRow = [];
      }

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelBack_alpha",
        index: -1,
        triangulate_isFrontFace: false,
        triangulate_useVectorDist: false,
        no_outline: true,
        close_normals: false,
      });
    }
  }
  let computeCrossChannelCaps = function () {

    let slv = ring.profile.stepLeftVertices;
    let srv = ring.profile.stepRightVertices;
    let fv = ring.profile.frontVertices;
    let bv = ring.profile.backVertices;
    let commonZ = bv[ring.profile.middleVertexBack[0]].z;
    let Y = [channelSizeY_half, -channelSizeY_half];

    for (let y = 0; y < 2; y++) {
      let vertexRows = [] as CVertex[][];
      let vertexRow = [] as CVertex[];
      let index = 0;
      let v: CVertex;

      // Front
      for (let i = 0, i_l = slv.length; i < i_l; i++) {
        v = CVertex.fromVertex(slv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }
      for (let i = 0, i_l = fv.length; i < i_l; i++) {
        v = CVertex.fromVertex(fv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }
      for (let i = 0, i_l = srv.length; i < i_l; i++) {
        v = CVertex.fromVertex(srv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);

      // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
      let row_0 = vertexRow;
      vertexRow = [];

      for (let i = 0, i_l = row_0.length; i < i_l; i++) {
        v = new CVertex(row_0[i].x, Y[y], commonZ);
        v.i = index++;
        v.u = row_0[i].u;
        v.v = v.y;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelFront",
        index: -1,
        triangulate_isFrontFace: false,
        triangulate_useVectorDist: false,
        no_outline: false,
        close_normals: false,
      });

      // Back
      vertexRows = [];
      vertexRow = [];
      index = 0;
      for (let i = 0, i_l = bv.length; i < i_l; i++) {
        v = CVertex.fromVertex(bv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);

      // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
      row_0 = vertexRow;
      vertexRow = [];

      for (let i = 0, i_l = row_0.length; i < i_l; i++) {
        v = new CVertex(row_0[i].x, Y[y], commonZ);
        v.i = index++;
        v.u = row_0[i].u;
        v.v = v.y;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelFront",
        index: -1,
        triangulate_isFrontFace: true,
        triangulate_useVectorDist: false,
        no_outline: false,
        close_normals: false,
      });
    }
  }

  computeCrossChannelFront();
  computeCrossChannelBack();
  computeCrossChannelCaps();

  // <== Bevels
  // <== Geometriedaten

  // Prüfung der maximal möglichen Steingröße inkl. Tiefencheck
  let maxStoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, outlineSize)[0];
  stoneDepth = maxStoneSize * typeItem.sizeDepthFactor;
  doWhile_stoneDepthCheck = true;

  while (doWhile_stoneDepthCheck && stoneDepth > profileDepth) {
    doWhile_stoneDepthCheck = false;

    maxStoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, maxStoneSize - 10, {useRealStoneSize: true})[0];
    stoneDepth = maxStoneSize * typeItem.sizeDepthFactor;

    doWhile_stoneDepthCheck = true;
  }

  return {
    minSize: 1000,
    maxSize: maxStoneSize,
    maxCount: maxStoneCount,
    maxRows: 1,
    coordinates: stoneCoordinates
  }
}

// function stoneCalc_crossChannel(ring: cRing, vertexArray: iVertexArray[]): iStoneCalcData | null {
//
//   let ringData = ring.ringData;
//   let stoneGroup = ringData.stone[0];
//
//   if (stoneGroup.mode != 31) return null;
//   if (ring.profile.channelVertices.length == 0) return null;
//   if (stoneGroup.type != 1) stoneGroup.type = 1;
//
//   let ringRadiusInner = ringData.ringSize / Math.PI / 2,
//     ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
//     ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
//     stoneMode = getStoneMode(stoneGroup.mode);
//
//   if (!stoneMode) {
//     console.log("Steinmodus nicht erkannt!");
//     return null;
//   }
//
//   let profileDepthSafeDistanceToStone = 300;
//
//   let outlineMin = -ringData.ringWidth / 2;
//   let outlineMax = -outlineMin;
//
//   let profile = AppComponent.app.data.profile.find(e => {
//     return e.name == ringData.profileName;
//   })
//
//   let swLeft = 0, swRight = 0,
//     sideCrossChannelDistance = profile ? (profile.sideCrossChannelDistance ?? stoneMode.sideCrossChannelDistance ?? 100) : 100;
//
//   if (ringData.stepMode == 1 || ringData.stepMode == 3)
//     swLeft = ringData.stepWidth[0];
//   if (ringData.stepMode == 2 || ringData.stepMode == 3)
//     swRight = ringData.stepWidth[1];
//
//   if (swLeft < sideCrossChannelDistance) swLeft = sideCrossChannelDistance;
//   if (swRight < sideCrossChannelDistance) swRight = sideCrossChannelDistance;
//
//   outlineMin += swLeft;
//   outlineMax -= swRight;
//
//   let outlineSize = outlineMax - outlineMin;
//
//   let stoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, stoneGroup.size, {useRealStoneSize: true})[0],
//     stoneDepth = 0,
//     profileDepth = 0;
//
//
//   let typeItem = getStoneCuts(AppComponent.app.data).find(function (e) {
//     return e.id === stoneGroup.type;
//   })
//   if (!typeItem) return null;
//   let sizeItem = typeItem.size.find(e => {
//     return e.size == stoneSize;
//   })
//   if (!sizeItem) return null;
//
//   let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
//     return e.id == stoneGroup.type;
//   })
//   if (!stoneType) return null;
//
//   let doWhile_stoneDepthCheck = true;
//   let doWhile_stoneDepthCheck_count = 50;
//
//   // ermittle die Steingröße entsprechend der Profiltiefe
//   while (doWhile_stoneDepthCheck && doWhile_stoneDepthCheck_count-- > 0) {
//
//     doWhile_stoneDepthCheck = false;
//
//     stoneDepth = stoneSize * typeItem.sizeDepthFactor;
//
//     let doLoop = true;
//     let loopCount = 0;
//
//     // ermittle die Steingröße für die Segmentbreite
//     while (doLoop && loopCount++ < 50) {
//       doLoop = false
//
//       if (stoneSize > outlineSize) {
//
//         let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, outlineSize, {useRealStoneSize: true});
//
//         if (size[0] == 0) {
//           console.log("Kein passendes Segment gefunden!");
//           return null;
//         }
//
//         stoneSize = size[0];
//         doLoop = true;
//       }
//     }
//
//     if (stoneSize == 0) {
//       console.log("Steingröße = 0!");
//       return null;
//     }
//
//     // Prüfung der Steintiefe
//     let front = cRing.interpolate(0, ring.profile.frontVertices);
//     let back = cRing.interpolate(0, ring.profile.backVertices);
//     profileDepth = back.z - front.z - profileDepthSafeDistanceToStone;
//
//     if (stoneDepth > profileDepth) {
//       let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, stoneSize - 50, {useRealStoneSize: true})[0];
//
//       // @ts-ignore
//       if (size == 0) {
//         console.log("Keine passende Steingröße gefunden!");
//         return null;
//       } else {
//         console.log("Profiltiefe nicht ausreichend! Steingröße wird reduziert! (" + stoneSize + " -> " + size + ")");
//         stoneSize = size;
//       }
//
//       doWhile_stoneDepthCheck = true;
//     }
//   }
//
//   stoneGroup.size = stoneSize;
//   stoneGroup.positionDiv = [5000, 5000];
//
//   // ermittle die linken und rechten Grenzwerte zur Steinverteilung
//   doWhile_stoneDepthCheck = true;
//   doWhile_stoneDepthCheck_count = 50;
//
//   outlineMin += stoneSize / 2;
//   outlineMax -= stoneSize / 2;
//
//   while (doWhile_stoneDepthCheck && doWhile_stoneDepthCheck_count-- > 0) {
//
//     doWhile_stoneDepthCheck = false;
//
//     // Prüfung der Steintiefe
//     let front = cRing.interpolate(outlineMin, ring.profile.frontVertices);
//     let back = cRing.interpolate(outlineMin, ring.profile.backVertices);
//     let depth = back.z - front.z - profileDepthSafeDistanceToStone;
//
//     if (stoneDepth > depth) {
//       outlineMin += 10;
//       doWhile_stoneDepthCheck = true;
//     }
//
//     front = cRing.interpolate(outlineMax, ring.profile.frontVertices);
//     back = cRing.interpolate(outlineMax, ring.profile.backVertices);
//     depth = back.z - front.z - profileDepthSafeDistanceToStone;
//
//     if (stoneDepth > depth) {
//       outlineMax -= 10;
//       doWhile_stoneDepthCheck = true;
//     }
//   }
//
//   outlineSize = outlineMax - outlineMin;
//
//   /**
//    * neue Steindistanzen
//    */
//   let calcStoneSize = getStoneSize_2(ringData, stoneGroup, stoneType, stoneGroup.size, stoneMode, false);
//   stoneSize += calcStoneSize.distances.stoneToStone_x;
//
//   let maxStoneCount = Math.trunc((outlineSize + stoneSize) / stoneSize);
//   if (stoneGroup.count > maxStoneCount) {
//     stoneGroup.count = maxStoneCount;
//     console.log("Die Steinanzahl wurde angepasst");
//   }
//
//   let stoneCoordinates = [] as iPoint[];
//
//   let distSize = (stoneGroup.count - 1) * stoneSize;
//   let middle = outlineMax - (outlineSize / 2);
//   for (let x = -distSize / 2, end = distSize / 2; x <= end; x += stoneSize) {
//     stoneCoordinates.push({
//       x: x + middle,
//       y: 0
//     })
//   }
//
//   // Berechne die Geometriedaten der einzelnen Steine
//   let p = [] as iPoint[]; // die untere Kante, Mittelpunkt und obere Kante der Steine
//
//   let stoneSizeY_safe = (stoneSize + (<iStoneMode>stoneMode).safeDistY) * ringRadiusFactor,
//     stoneSizeY_half_safe = stoneSizeY_safe / 2;
//
//   stoneCoordinates.forEach(function (e) {
//     p.push({x: e.x, y: e.y - stoneSizeY_half_safe * ringRadiusFactor});
//     p.push({x: e.x, y: e.y});
//     p.push({x: e.x, y: e.y + stoneSizeY_half_safe * ringRadiusFactor});
//   })
//
//   let vertexRows = [] as CVertex[][];
//   let vertexRow = [] as CVertex[];
//   let index = 0;
//   let v: CVertex;
//   let stoneSizeX_half = stoneSize / 2;
//
//   p.forEach(function (e) {
//     v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, ring.profile.channelVertices).z);
//     v.i = index++;
//     vertexRow.push(v);
//     v = new CVertex(e.x, e.y, cRing.interpolate(e.x, ring.profile.channelVertices).z);
//     v.i = index++;
//     vertexRow.push(v);
//     v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, ring.profile.channelVertices).z);
//     v.i = index++;
//     vertexRow.push(v);
//
//     vertexRows.push(vertexRow);
//     vertexRow = [];
//   })
//
//   let stoneHelperMesh = new CMesh;
//   let thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180; // zusätzliche Rotation des Ringes um die X-Achse
//
//   stoneHelperMesh.rows = vertexRows;
//   stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);
//
//   // vertexArray.push({
//   //   vertex2DArray: vertexRows,
//   //   type: "helper",
//   //   index: -1,
//   //   no_rotate: true,
//   //   triangulate_useVectorDist: false,
//   // });
//
//   let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
//     let positions = [];
//     let tangents = [];
//     let normals = [];
//     let binormals = [];
//     let distances = [] as number[];
//
//     let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
//     let i, i_l = rows.length, row, j, j_l;
//
//     for (i = 1; i < i_l; i += 3) {
//
//       row = rows[i];
//       j_l = row.length;
//
//       for (j = 1; j < j_l; j += 3) {
//         // Position
//         P = CVertex.fromVertex(row[j]);
//
//         // Tangente
//         rows[i + 1][j].toRef(v1);
//         rows[i - 1][j].toRef(v2);
//         T = CVertex.fromVertex(v1).sub(v2);
//
//         // Normal
//         row[j - 1].toRef(v1);
//         row[j + 1].toRef(v2);
//         N = CVertex.fromVertex(v2).sub(v1);
//
//         // Binormal
//         B = CVertex.cross(N, T);
//
//         // Normal again
//         CVertex.crossToRef(B, T, N);
//
//         N.normalize();
//         B.normalize();
//         T.normalize();
//
//         positions.push(P);
//         tangents.push(T);
//         normals.push(N);
//         binormals.push(B);
//       }
//     }
//
//     return {
//       distances,
//       positions,
//       normals,
//       binormals,
//       tangents
//     }
//   };
//   let stonePathVectors = computeStonePathVectors(vertexRows);
//
//   ring.profile.stonePaths.push(stonePathVectors);
//
//   // ==> Bevels
//   let channelSizeY_half = stoneSize * ringRadiusFactor / 2 * 0.88; // 12% kleiner als Stein: Ticket 1046
//   let vertexFront_start: CVertex | null = null;
//   let vertexFront_end: CVertex | null = null;
//
//   let computeCrossChannelFront = function () {
//     let vertexRows = [] as CVertex[][];
//     let vertexRow = [] as CVertex[];
//     let index = 0;
//     let v: CVertex;
//     let slv = ring.profile.stepLeftVertices;
//     let srv = ring.profile.stepRightVertices;
//     let fv = ring.profile.frontVertices;
//     let bv = ring.profile.backVertices;
//     let cv = ring.profile.channelVertices;
//
//     /**
//      * Die Querkanaltiefe war bei der V1 auf 30% eingestellt. Also hier auch wieder...obwohl die Kanaltiefe normal bei 70% liegt
//      */
//     let depth = typeItem ? stoneSize * typeItem.sizeDepthFactor * 0.3 : stoneSize * 0.3;
//
//     let xStart = -ring.ringData.ringWidth / 2;
//     for (let x = xStart; x < 0; x++) {
//       let ip_channel = cRing.interpolate(x, cv);
//       let ip_front = cRing.interpolate(x, fv);
//       if (ip_channel.z + depth > ip_front.z) {
//         xStart = ip_channel.x;
//         break;
//       }
//     }
//     let y = -channelSizeY_half;
//     let yStep = (channelSizeY_half * 2) / 4;
//     let xEnd = -xStart;
//
//     // mesh für alpha
//
//     for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half * 2) {
//       // step left
//       if (slv) {
//         for (let i = 0, i_l = slv.length; i < i_l; i++) {
//           let x = slv[i].x;
//           if (i == 0) x = xStart;
//           else {
//             if (x < xStart) continue;
//           }
//           if (x > xEnd) x = xEnd;
//           let ip = cRing.interpolate(x, slv);
//           v = new CVertex(x, y, ip.z);
//           v.i = index++;
//           v.u = ip.uv_u;
//           v.v = v.y;
//           vertexRow.push(v);
//           if (x == xEnd) break;
//         }
//       }
//
//       // front
//       for (let i = 0, i_l = fv.length; i < i_l; i++) {
//         let x = fv[i].x;
//         if (i == 0) x = xStart;
//         else {
//           if (x < xStart) continue;
//         }
//         if (x > xEnd) x = xEnd;
//         let ip = cRing.interpolate(x, fv);
//         v = new CVertex(x, y, ip.z);
//         v.i = index++;
//         v.u = ip.uv_u;
//         v.v = v.y;
//         vertexRow.push(v);
//         if (x == xEnd) break;
//       }
//
//       // step right
//       if (srv) {
//         for (let i = 0, i_l = srv.length; i < i_l; i++) {
//           let x = srv[i].x;
//           if (i == 0) x = xStart;
//           else {
//             if (x < xStart) continue;
//           }
//           if (x > xEnd) x = xEnd;
//           let ip = cRing.interpolate(x, srv);
//           v = new CVertex(x, y, ip.z);
//           v.i = index++;
//           v.u = ip.uv_u;
//           v.v = v.y;
//           vertexRow.push(v);
//           if (x == xEnd) break;
//         }
//       }
//
//       vertexRows.push(vertexRow);
//       vertexRow = [];
//     }
//
//     vertexArray.push({
//       vertex2DArray: vertexRows,
//       type: "crossChannelFront_alpha",
//       index: -1,
//       triangulate_isFrontFace: true,
//       triangulate_useVectorDist: false,
//       no_outline: false,
//       close_normals: false,
//     });
//
//     // mesh für albedo
//     vertexRows = [];
//     vertexRow = [];
//     index = 0;
//     // fv = ring.profile.frontVertices;
//
//     xStart = -ringData.ringWidth / 2;
//     for (let x = -ringData.ringWidth / 2; x < 0; x++) {
//       let ip_back = cRing.interpolate(x, bv, ring.profile.middleVertexBack[0]);
//       let ip_channel = cRing.interpolate(x, cv);
//       let ip_front = cRing.interpolate(x, fv);
//       if (ip_channel.z + depth < ip_front.z) {
//         continue;
//       }
//       if (ip_channel.z + depth > ip_back.z)
//         continue;
//       if (ip_channel.z + depth <= ip_back.z) {
//         xStart = ip_channel.x;
//         break;
//       }
//     }
//
//     xEnd = -xStart;
//
//     for (let i = 0; i < 5; i++) {
//       let x = xStart;
//       let count = 0;
//       while (count++ < 100) {
//         let ip_channel = cRing.interpolate(x, cv);
//         v = new CVertex(x, y, ip_channel.z + depth);
//         v.i = index++;
//         v.u = ip_channel.uv_u;
//         v.v = v.y;
//         vertexRow.push(v);
//         if (x == xEnd)
//           break;
//         x = cv[ip_channel.indexVectorB].x;
//         if (x > xEnd)
//           x = xEnd;
//       }
//
//       vertexRows.push(vertexRow);
//       vertexRow = [];
//
//       y += yStep;
//     }
//
//     vertexArray.push({
//       vertex2DArray: vertexRows,
//       type: "crossChannelFront",
//       index: -1,
//       triangulate_isFrontFace: true,
//       triangulate_useVectorDist: false,
//       no_outline: true,
//       close_normals: false,
//     });
//
//     vertexFront_start = CVertex.fromVertex(vertexRows[0][0]);
//     vertexFront_end = CVertex.fromVertex(vertexRows[0][vertexRows[0].length - 1]);
//   }
//   let computeCrossChannelBack = function () {
//     let vertexRows = [] as CVertex[][];
//     let vertexRow = [] as CVertex[];
//     let index = 0;
//     let v: CVertex;
//     let v2: CVertex;
//     let bv = ring.profile.backVertices;
//     let ip;
//
//     if (vertexFront_start && vertexFront_start.z > bv[0].z) {
//       // mesh für alpha
//       for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
//         v = CVertex.fromVertex(bv[0]);
//         v.i = index++;
//         v.y = y;
//         v.v = y;
//         v.u = 0.0;
//         vertexRow.push(v);
//
//         if (vertexFront_start.x < v.x) {
//           v2 = new CVertex(vertexFront_start.x, y, vertexFront_start.z);
//           let dist = v.distance(v2);
//           ip = cRing.interpolate_distance_2(bv, 0, dist);
//           v2.x = ip.x;
//           v2.z = ip.z;
//           v2.y = y;
//           v2.i = index++;
//           v2.u = ip.uv_u;
//           v2.v = v2.y;
//           vertexRow.push(v2);
//         } else {
//           ip = cRing.interpolate(vertexFront_start.x, bv);
//           v2 = new CVertex(ip.x, y, ip.z);
//           v2.i = index++;
//           v2.u = ip.uv_u;
//           v2.v = v2.y;
//           vertexRow.push(v2);
//         }
//
//         vertexRows.push(vertexRow);
//         vertexRow = [];
//       }
//
//       vertexArray.push({
//         vertex2DArray: vertexRows,
//         type: "crossChannelBack_alpha",
//         index: -1,
//         triangulate_isFrontFace: false,
//         triangulate_useVectorDist: false,
//         no_outline: true,
//         close_normals: false,
//       });
//     }
//     if (0 && vertexFront_end && vertexFront_end.z > bv[bv.length - 1].z) {
//       vertexRows = [];
//       vertexRow = [];
//       index = 0;
//       // mesh für alpha
//
//       for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
//         v = CVertex.fromVertex(bv[bv.length - 1]);
//         v.i = index++;
//         v.y = y;
//         v.v = y;
//         v.u = 1.0;
//
//         if (vertexFront_end.x > v.x) {
//           v2 = new CVertex(vertexFront_end.x, y, vertexFront_end.z);
//           let dist = v.distance(v2);
//           ip = cRing.interpolate_distance_2(bv, bv.length - 1, -dist);
//           v2.x = ip.x;
//           v2.z = ip.z;
//           v2.y = y;
//           v2.i = index++;
//           v2.u = ip.uv_u;
//           v2.v = v2.y;
//           vertexRow.push(v2);
//         } else {
//           ip = cRing.interpolate(vertexFront_end.x, bv);
//           v2 = new CVertex(ip.x, y, ip.z);
//           v2.i = index++;
//           v2.u = ip.uv_u;
//           v2.v = v2.y;
//           vertexRow.push(v2);
//         }
//
//         vertexRow.push(v);
//
//         vertexRows.push(vertexRow);
//         vertexRow = [];
//       }
//
//       vertexArray.push({
//         vertex2DArray: vertexRows,
//         type: "crossChannelBack_alpha",
//         index: -1,
//         triangulate_isFrontFace: false,
//         triangulate_useVectorDist: false,
//         no_outline: true,
//         close_normals: false,
//       });
//     }
//   }
//   let computeCrossChannelCaps = function () {
//
//     let slv = ring.profile.stepLeftVertices;
//     let srv = ring.profile.stepRightVertices;
//     let fv = ring.profile.frontVertices;
//     let bv = ring.profile.backVertices;
//     let commonZ = bv[ring.profile.middleVertexBack[0]].z;
//     let Y = [channelSizeY_half, -channelSizeY_half];
//
//     for (let y = 0; y < 2; y++) {
//       let vertexRows = [] as CVertex[][];
//       let vertexRow = [] as CVertex[];
//       let index = 0;
//       let v: CVertex;
//
//       // Front
//       for (let i = 0, i_l = slv.length; i < i_l; i++) {
//         v = CVertex.fromVertex(slv[i]);
//         v.y = Y[y];
//         v.v = v.y;
//         v.i = index++;
//         vertexRow.push(v);
//       }
//       for (let i = 0, i_l = fv.length; i < i_l; i++) {
//         v = CVertex.fromVertex(fv[i]);
//         v.y = Y[y];
//         v.v = v.y;
//         v.i = index++;
//         vertexRow.push(v);
//       }
//       for (let i = 0, i_l = srv.length; i < i_l; i++) {
//         v = CVertex.fromVertex(srv[i]);
//         v.y = Y[y];
//         v.v = v.y;
//         v.i = index++;
//         vertexRow.push(v);
//       }
//
//       vertexRows.push(vertexRow);
//
//       // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//       let row_0 = vertexRow;
//       vertexRow = [];
//
//       for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//         v = new CVertex(row_0[i].x, Y[y], commonZ);
//         v.i = index++;
//         v.u = row_0[i].u;
//         v.v = v.y;
//         vertexRow.push(v);
//       }
//
//       vertexRows.push(vertexRow);
//
//       vertexArray.push({
//         vertex2DArray: vertexRows,
//         type: "crossChannelFront",
//         index: -1,
//         triangulate_isFrontFace: false,
//         triangulate_useVectorDist: false,
//         no_outline: false,
//         close_normals: false,
//       });
//
//       // Back
//       vertexRows = [];
//       vertexRow = [];
//       index = 0;
//       for (let i = 0, i_l = bv.length; i < i_l; i++) {
//         v = CVertex.fromVertex(bv[i]);
//         v.y = Y[y];
//         v.v = v.y;
//         v.i = index++;
//         vertexRow.push(v);
//       }
//
//       vertexRows.push(vertexRow);
//
//       // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
//       row_0 = vertexRow;
//       vertexRow = [];
//
//       for (let i = 0, i_l = row_0.length; i < i_l; i++) {
//         v = new CVertex(row_0[i].x, Y[y], commonZ);
//         v.i = index++;
//         v.u = row_0[i].u;
//         v.v = v.y;
//         vertexRow.push(v);
//       }
//
//       vertexRows.push(vertexRow);
//
//       vertexArray.push({
//         vertex2DArray: vertexRows,
//         type: "crossChannelFront",
//         index: -1,
//         triangulate_isFrontFace: true,
//         triangulate_useVectorDist: false,
//         no_outline: false,
//         close_normals: false,
//       });
//     }
//   }
//
//   computeCrossChannelFront();
//   computeCrossChannelBack();
//   computeCrossChannelCaps();
//
//   // <== Bevels
//   // <== Geometriedaten
//
//   // Prüfung der maximal möglichen Steingröße inkl. Tiefencheck
//   let maxStoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, outlineSize)[0];
//   stoneDepth = maxStoneSize * typeItem.sizeDepthFactor;
//   doWhile_stoneDepthCheck = true;
//
//   while (doWhile_stoneDepthCheck && stoneDepth > profileDepth) {
//     doWhile_stoneDepthCheck = false;
//
//     maxStoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, maxStoneSize - 10, {useRealStoneSize: true})[0];
//     stoneDepth = maxStoneSize * typeItem.sizeDepthFactor;
//
//     doWhile_stoneDepthCheck = true;
//   }
//
//   return {
//     minSize: 1000,
//     maxSize: maxStoneSize,
//     maxCount: maxStoneCount,
//     maxRows: 1,
//     coordinates: stoneCoordinates
//   }
// }

function stoneCalc_clamp(ring: cRing, vertexArray: iVertexArray[]): iStoneCalcData | null {

  let ringData = ring.ringData;
  let stoneGroup = ringData.stone[0];

  if (stoneGroup.mode != 35) return null;
  if (stoneGroup.type != 1) stoneGroup.type = 1;
  stoneGroup.positionDiv = [5000, 5000];

  let ringRadiusInner = ringData.ringSize / Math.PI / 2,
    ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
    ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
    stoneMode = getStoneMode(stoneGroup.mode);

  if (!stoneMode) {
    console.log("Steinmodus nicht erkannt!");
    return null;
  }

  let profileDepthSafeDistanceToStone = 300;

  let outlineMin = -ringData.ringWidth / 2;
  let outlineMax = -outlineMin;

  let profile = AppComponent.app.data.profile.find(e => {
    return e.name == ringData.profileName;
  })

  let swLeft = 0, swRight = 0,
    sideCrossChannelDistance = profile ? (profile.sideCrossChannelDistance ?? stoneMode.sideCrossChannelDistance ?? 100) : 100;

  if (ringData.stepMode == 1 || ringData.stepMode == 3)
    swLeft = ringData.stepWidth[0];
  if (ringData.stepMode == 2 || ringData.stepMode == 3)
    swRight = ringData.stepWidth[1];

  if (swLeft < sideCrossChannelDistance) swLeft = sideCrossChannelDistance;
  if (swRight < sideCrossChannelDistance) swRight = sideCrossChannelDistance;

  outlineMin += swLeft;
  outlineMax -= swRight;

  let outlineSize = outlineMax - outlineMin;

  let stoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, stoneGroup.size, {useRealStoneSize: true})[0],
    stoneDepth = 0,
    profileDepth = 0;

  let typeItem = getStoneCuts(AppComponent.app.data).find(function (e) {
    return (e.legacyId ?? e.id) === stoneGroup.type;
  })
  if (!typeItem) return null;
  let sizeItem = typeItem.size.find(e => {
    return e.size == stoneSize;
  })
  if (!sizeItem) return null;

  let doWhile_stoneDepthCheck = true;
  let doWhile_stoneDepthCheck_count = 50;

  // ermittle die Steingröße entsprechend der Profiltiefe
  while (doWhile_stoneDepthCheck && doWhile_stoneDepthCheck_count-- > 0) {

    doWhile_stoneDepthCheck = false;

    stoneDepth = stoneSize * typeItem.sizeDepthFactor;

    let doLoop = true;
    let loopCount = 0;

    // ermittle die Steingröße für die Segmentbreite
    while (doLoop && loopCount++ < 50) {
      doLoop = false

      if (stoneSize > outlineSize) {

        console.log("outlineSize: " + outlineSize);

        let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, outlineSize, {useRealStoneSize: true});

        if (size[0] == 0) {
          console.log("Kein passendes Segment gefunden!");
          return null;
        }

        stoneSize = size[0];
        doLoop = true;
      }
    }

    if (stoneSize == 0) {
      console.log("Steingröße = 0!");
      return null;
    }

    // Prüfung der Steintiefe
    let front = cRing.interpolate(0, ring.profile.frontVertices);
    let back = cRing.interpolate(0, ring.profile.backVertices);
    profileDepth = back.z - front.z - profileDepthSafeDistanceToStone;

    if (stoneDepth > profileDepth) {
      let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, stoneSize - 10, {useRealStoneSize: true})[0];

      // @ts-ignore
      if (size == 0) {
        console.log("Keine passende Steingröße gefunden!");
        return null;
      } else {
        console.log("Profiltiefe nicht ausreichend! Steingröße wird reduziert! (" + stoneSize + " -> " + size + ")");
        stoneSize = size;
      }

      doWhile_stoneDepthCheck = true;
    }
  }

  stoneGroup.size = stoneSize;

  // ermittle die linken und rechten Grenzwerte zur Steinverteilung
  // doWhile_stoneDepthCheck = true;
  // doWhile_stoneDepthCheck_count = 50;
  //
  // outlineMin += stoneSize / 2;
  // outlineMax -= stoneSize / 2;
  //
  // while (doWhile_stoneDepthCheck && doWhile_stoneDepthCheck_count-- > 0) {
  //
  //   doWhile_stoneDepthCheck = false;
  //
  //   // Prüfung der Steintiefe
  //   let front = cRing.interpolate(outlineMin, ring.profile.frontVertices);
  //   let back = cRing.interpolate(outlineMin, ring.profile.backVertices);
  //   let depth = back.z - front.z - profileDepthSafeDistanceToStone;
  //
  //   if (stoneDepth > depth) {
  //     outlineMin += 10;
  //     doWhile_stoneDepthCheck = true;
  //   }
  //
  //   front = cRing.interpolate(outlineMax, ring.profile.frontVertices);
  //   back = cRing.interpolate(outlineMax, ring.profile.backVertices);
  //   depth = back.z - front.z - profileDepthSafeDistanceToStone;
  //
  //   if (stoneDepth > depth) {
  //     outlineMax -= 10;
  //     doWhile_stoneDepthCheck = true;
  //   }
  // }

  outlineSize = outlineMax - outlineMin;
  let maxStoneCount = 1;
  if (stoneGroup.count > 1) stoneGroup.count = 1;

  let stoneCoordinates = [{x: 0, y: 0}] as iPoint[];

  // Berechne die Geometriedaten der einzelnen Steine
  let p = [] as iPoint[]; // die untere Kante, Mittelpunkt und obere Kante der Steine
  let stoneSizeY_safe = (stoneSize + (<iStoneMode>stoneMode).safeDistY) * ringRadiusFactor,
    stoneSizeY_half_safe = stoneSizeY_safe / 2;

  stoneCoordinates.forEach(function (e) {
    p.push({x: e.x, y: e.y - stoneSizeY_half_safe * ringRadiusFactor});
    p.push({x: e.x, y: e.y});
    p.push({x: e.x, y: e.y + stoneSizeY_half_safe * ringRadiusFactor});
  })

  let vertexRows = [] as CVertex[][];
  let vertexRow = [] as CVertex[];
  let index = 0;
  let v: CVertex;
  let stoneSizeX_half = stoneSize / 2;

  p.forEach(function (e) {
    v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, ring.profile.channelVertices).z);
    v.i = index++;
    vertexRow.push(v);
    v = new CVertex(e.x, e.y, cRing.interpolate(e.x, ring.profile.channelVertices).z);
    v.i = index++;
    vertexRow.push(v);
    v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, ring.profile.channelVertices).z);
    v.i = index++;
    vertexRow.push(v);

    vertexRows.push(vertexRow);
    vertexRow = [];
  })

  let stoneHelperMesh = new CMesh;
  let thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180; // zusätzliche Rotation des Ringes um die X-Achse

  stoneHelperMesh.rows = vertexRows;
  stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

  // vertexArray.push({
  //   vertex2DArray: vertexRows,
  //   type: "helper",
  //   index: -1,
  //   no_rotate: true,
  //   triangulate_useVectorDist: false,
  // });

  let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
    let positions = [];
    let tangents = [];
    let normals = [];
    let binormals = [];
    let distances = [] as number[];

    let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
    let i, i_l = rows.length, row, j, j_l;

    for (i = 1; i < i_l; i += 3) {

      row = rows[i];
      j_l = row.length;

      for (j = 1; j < j_l; j += 3) {
        // Position
        P = CVertex.fromVertex(row[j]);

        // Tangente
        rows[i + 1][j].toRef(v1);
        rows[i - 1][j].toRef(v2);
        T = CVertex.fromVertex(v1).sub(v2);

        // Normal
        row[j - 1].toRef(v1);
        row[j + 1].toRef(v2);
        N = CVertex.fromVertex(v2).sub(v1);

        // Binormal
        B = CVertex.cross(N, T);

        // Normal again
        CVertex.crossToRef(B, T, N);

        N.normalize();
        B.normalize();
        T.normalize();

        positions.push(P);
        tangents.push(T);
        normals.push(N);
        binormals.push(B);
      }
    }

    return {
      distances,
      positions,
      normals,
      binormals,
      tangents
    }
  };
  let stonePathVectors = computeStonePathVectors(vertexRows);

  ring.profile.stonePaths.push(stonePathVectors);

  // ==> Bevels
  let channelSizeY_half = stoneSize * ringRadiusFactor / 2 * 0.88; // 12% kleiner als Stein: Ticket 1046
  let vertexFront_start: CVertex | null = null;
  let vertexFront_end: CVertex | null = null;


  let computeCrossChannelFront = function () {
    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;
    let slv = ring.profile.stepLeftVertices;
    let srv = ring.profile.stepRightVertices;
    let fv = ring.profile.frontVertices;
    let bv = ring.profile.backVertices;
    let cv = ring.profile.channelVertices;

    let depth = typeItem ? stoneSize * typeItem.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023

    let xStart = -ring.ringData.ringWidth / 2;
    // for (let x = -ringData.ringWidth / 2; x < 0; x++) {
    //   let ip_channel = cRing.interpolate(x, cv);
    //   let ip_front = cRing.interpolate(x, fv);
    //   if (ip_channel.z + depth > ip_front.z) {
    //     xStart = ip_channel.x;
    //     break;
    //   }
    // }
    let y = -channelSizeY_half;
    // let y = -stoneSizeY_half - 20;
    let yStep = (channelSizeY_half * 2) / 4;
    let xEnd = -xStart;

    // mesh für alpha
    for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half * 2) {
      // step left
      if (slv) {
        for (let i = 0, i_l = slv.length; i < i_l; i++) {
          let x = slv[i].x;
          if (i == 0) x = xStart;
          else {
            if (x < xStart) continue;
          }
          if (x > xEnd) x = xEnd;
          let ip = cRing.interpolate(x, slv);
          v = new CVertex(x, y, ip.z);
          v.i = index++;
          v.u = ip.uv_u;
          v.v = v.y;
          vertexRow.push(v);
          if (x == xEnd) break;
        }
      }

      // front
      for (let i = 0, i_l = fv.length; i < i_l; i++) {
        let x = fv[i].x;
        if (i == 0) x = xStart;
        else {
          if (x < xStart) continue;
        }
        if (x > xEnd) x = xEnd;
        let ip = cRing.interpolate(x, fv);
        v = new CVertex(x, y, ip.z);
        v.i = index++;
        v.u = ip.uv_u;
        v.v = v.y;
        vertexRow.push(v);
        if (x == xEnd) break;
      }

      // step right
      if (srv) {
        for (let i = 0, i_l = srv.length; i < i_l; i++) {
          let x = srv[i].x;
          if (i == 0) x = xStart;
          else {
            if (x < xStart) continue;
          }
          if (x > xEnd) x = xEnd;
          let ip = cRing.interpolate(x, srv);
          v = new CVertex(x, y, ip.z);
          v.i = index++;
          v.u = ip.uv_u;
          v.v = v.y;
          vertexRow.push(v);
          if (x == xEnd) break;
        }
      }

      vertexRows.push(vertexRow);
      vertexRow = [];
    }

    vertexArray.push({
      vertex2DArray: vertexRows,
      type: "crossChannelFront_alpha",
      index: -1,
      triangulate_isFrontFace: true,
      triangulate_useVectorDist: false,
      no_outline: false,
      close_normals: false,
    });

    // mesh für albedo
    vertexRows = [];
    vertexRow = [];
    index = 0;

    xStart = -stoneSize / 2 * 0.65; // Brücke unter dem Stein darf max 65% der Steingröße entsprechen
    // xStart = -ringData.ringWidth / 2;
    // for (let x = -ringData.ringWidth / 2; x < 0; x++) {
    //   let ip_back = cRing.interpolate(x, bv, ring.middleVertexBack[0]);
    //   let ip_channel = cRing.interpolate(x, cv);
    //   let ip_front = cRing.interpolate(x, fv);
    //   if (ip_channel.z + depth < ip_front.z) {
    //     continue;
    //   }
    //   if (ip_channel.z + depth > ip_back.z)
    //     continue;
    //   if (ip_channel.z + depth <= ip_back.z) {
    //     xStart = ip_channel.x;
    //     break;
    //   }
    // }

    xEnd = -xStart;

    for (let i = 0; i < 5; i++) {
      let x = xStart;

      let ip_back = cRing.interpolate(x, bv);
      v = new CVertex(x, y, ip_back.z);
      v.i = index++;
      v.u = ip_back.uv_u;
      v.v = v.y;
      vertexRow.push(v);

      let make_double = true;

      let count = 0;
      while (count++ < 100) {
        let ip_channel = cRing.interpolate(x, cv);
        v = new CVertex(x, y, ip_channel.z + depth);
        v.i = index++;
        v.u = ip_channel.uv_u;
        v.v = v.y;
        vertexRow.push(v);
        if (make_double) {
          make_double = false;
          v = CVertex.fromVertex(v);
          v.i = index++;
          vertexRow.push(v);
        }
        if (x == xEnd)
          break;
        x = cv[ip_channel.indexVectorB].x;
        if (x > xEnd)
          x = xEnd;
      }

      v = CVertex.fromVertex(v);
      v.i = index++;
      vertexRow.push(v);
      ip_back = cRing.interpolate(xEnd, bv);
      v = new CVertex(xEnd, y, ip_back.z);
      v.i = index++;
      v.u = ip_back.uv_u;
      v.v = v.y;
      vertexRow.push(v);

      vertexRows.push(vertexRow);
      vertexRow = [];

      y += yStep;
    }

    vertexArray.push({
      vertex2DArray: vertexRows,
      type: "crossChannelFront",
      index: -1,
      triangulate_isFrontFace: true,
      triangulate_useVectorDist: false,
      no_outline: true,
      close_normals: false,
    });

    vertexFront_start = CVertex.fromVertex(vertexRows[0][0]);
    vertexFront_end = CVertex.fromVertex(vertexRows[0][vertexRows[0].length - 1]);
  }
  let computeCrossChannelBack = function () {
    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;
    let v2: CVertex;
    let bv = ring.profile.backVertices;
    let ip;

    ip = cRing.interpolate(-stoneSize / 2, bv);

    //if (vertexFront_start && vertexFront_start.z > bv[0].z)
    {
      // mesh für alpha
      for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
        v = CVertex.fromVertex(bv[0]);
        v.i = index++;
        v.y = y;
        v.v = y;
        v.u = 0.0;
        vertexRow.push(v);

        //if (vertexFront_start.x < v.x)
        {
          v2 = new CVertex(ip.x, y, ip.z);
          // v2 = new CVertex(vertexFront_start.x, y, vertexFront_start.z);
          // let dist = v.distance(v2);
          // ip = cRing.interpolate_distance_2(bv, 0, dist);
          // v2.x = ip.x;
          // v2.z = ip.z;
          // v2.y = y;
          v2.i = index++;
          v2.u = ip.uv_u;
          v2.v = v2.y;
          vertexRow.push(v2);
        }
        // else {
        //   ip = cRing.interpolate(vertexFront_start.x, bv);
        //   v2 = new CVertex(ip.x, y, ip.z);
        //   v2.i = index++;
        //   v2.u = ip.uv_u;
        //   v2.v = v2.y;
        //   vertexRow.push(v2);
        // }

        vertexRows.push(vertexRow);
        vertexRow = [];
      }

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelBack_alpha",
        index: -1,
        triangulate_isFrontFace: false,
        triangulate_useVectorDist: false,
        no_outline: true,
        close_normals: false,
      });
    }

    ip = cRing.interpolate(stoneSize / 2, bv);

    //if (vertexFront_end && vertexFront_end.z > bv[bv.length-1].z)
    {
      vertexRows = [];
      vertexRow = [];
      index = 0;
      // mesh für alpha

      for (let y = -channelSizeY_half; y <= channelSizeY_half; y += channelSizeY_half) {
        v = CVertex.fromVertex(bv[bv.length - 1]);
        v.i = index++;
        v.y = y;
        v.v = y;
        v.u = 1.0;

        // if (vertexFront_end.x > v.x)
        {
          v2 = new CVertex(ip.x, y, ip.z);
          // v2 = new CVertex(vertexFront_end.x, y, vertexFront_end.z);
          // let dist = v.distance(v2);
          // ip = cRing.interpolate_distance_2(bv, bv.length - 1, -dist);
          // v2.x = ip.x;
          // v2.z = ip.z;
          // v2.y = y;
          v2.i = index++;
          v2.u = ip.uv_u;
          v2.v = v2.y;
          vertexRow.push(v2);
        }
        // else {
        //   ip = cRing.interpolate(vertexFront_end.x, bv);
        //   v2 = new CVertex(ip.x, y, ip.z);
        //   v2.i = index++;
        //   v2.u = ip.uv_u;
        //   v2.v = v2.y;
        //   vertexRow.push(v2);
        // }

        vertexRow.push(v);

        vertexRows.push(vertexRow);
        vertexRow = [];
      }

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelBack_alpha",
        index: -1,
        triangulate_isFrontFace: false,
        triangulate_useVectorDist: false,
        no_outline: true,
        close_normals: false,
      });
    }

  }
  let computeCrossChannelCaps = function () {

    let slv = ring.profile.stepLeftVertices;
    let srv = ring.profile.stepRightVertices;
    let fv = ring.profile.frontVertices;
    let bv = ring.profile.backVertices;
    let commonZ = bv[ring.profile.middleVertexBack[0]].z;
    let Y = [channelSizeY_half, -channelSizeY_half];

    for (let y = 0; y < 2; y++) {
      let vertexRows = [] as CVertex[][];
      let vertexRow = [] as CVertex[];
      let index = 0;
      let v: CVertex;

      // Front
      for (let i = 0, i_l = slv.length; i < i_l; i++) {
        v = CVertex.fromVertex(slv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }
      for (let i = 0, i_l = fv.length; i < i_l; i++) {
        v = CVertex.fromVertex(fv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }
      for (let i = 0, i_l = srv.length; i < i_l; i++) {
        v = CVertex.fromVertex(srv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);

      // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
      let row_0 = vertexRow;
      vertexRow = [];

      for (let i = 0, i_l = row_0.length; i < i_l; i++) {
        v = new CVertex(row_0[i].x, Y[y], commonZ);
        v.i = index++;
        v.u = row_0[i].u;
        v.v = v.y;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelCap",
        index: -1,
        triangulate_isFrontFace: false,
        triangulate_useVectorDist: false,
        no_outline: false,
        close_normals: false,
      });

      // Back
      vertexRows = [];
      vertexRow = [];
      index = 0;
      for (let i = 0, i_l = bv.length; i < i_l; i++) {
        v = CVertex.fromVertex(bv[i]);
        v.y = Y[y];
        v.v = v.y;
        v.i = index++;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);

      // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
      row_0 = vertexRow;
      vertexRow = [];

      for (let i = 0, i_l = row_0.length; i < i_l; i++) {
        v = new CVertex(row_0[i].x, Y[y], commonZ);
        v.i = index++;
        v.u = row_0[i].u;
        v.v = v.y;
        vertexRow.push(v);
      }

      vertexRows.push(vertexRow);


      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "crossChannelCap",
        index: -1,
        triangulate_isFrontFace: true,
        triangulate_useVectorDist: false,
        no_outline: false,
        close_normals: false,
      });
    }
  }

  computeCrossChannelFront();
  computeCrossChannelBack();
  computeCrossChannelCaps();

  // <== Bevels
  // <== Geometriedaten

  // Prüfung der maximal möglichen Steingröße inkl. Tiefencheck
  let maxStoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, outlineSize)[0];
  stoneDepth = maxStoneSize * typeItem.sizeDepthFactor;
  doWhile_stoneDepthCheck = true;

  while (doWhile_stoneDepthCheck && stoneDepth > profileDepth) {
    doWhile_stoneDepthCheck = false;

    maxStoneSize = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, maxStoneSize - 10, {useRealStoneSize: true})[0];
    stoneDepth = maxStoneSize * typeItem.sizeDepthFactor;

    doWhile_stoneDepthCheck = true;
  }

  return {
    minSize: 1000,
    maxSize: maxStoneSize,
    maxCount: maxStoneCount,
    maxRows: 1,
    coordinates: stoneCoordinates
  }
}

function stoneCalc_side(ring: cRing, vertexArray: iVertexArray[]): iStoneCalcData | null {

  let ringData = ring.ringData;
  let stoneGroupIndex = 0;
  let stoneGroup = ringData.stone[stoneGroupIndex];

  let test = [40, 41, 42, 43, 44, 45];
  if (test.indexOf(stoneGroup.mode) == -1) return null;

  let stoneMode = getStoneMode(stoneGroup.mode);
  if (!stoneMode) return null;
  let stoneType = getStoneTypeItem(stoneGroup.type);
  if (!stoneType) return null;

  let thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180; // zusätzliche Rotation des Ringes um die X-Achse
  let innerCircumference = ringData.ringSize,
    innerRadius = innerCircumference / Math.PI / 2;

  let stoneCoordinates = [] as iPoint[];
  let maxStoneSize = 0, maxStoneCount = 0;
  let hasCaps = !(stoneGroup.distribution < 33 && stoneGroup.count == -100);

  let doLoop_stoneSize = true;

  while (doLoop_stoneSize) {

    doLoop_stoneSize = false;

    let test2 = [40, 42, 44], isLeftSide: boolean = true;
    if (test2.indexOf(stoneGroup.mode) > -1) // links
    {
      maxStoneSize = Math.trunc(ring.profile.sideLength[0] - stoneMode.safeDistX * 2);
    } else // rechts
    {
      isLeftSide = false;
      maxStoneSize = Math.trunc(ring.profile.sideLength[1] - stoneMode.safeDistX * 2);
    }

    maxStoneSize = getLowerStoneSize_side(Number(stoneType.legacyId ?? stoneType.id), maxStoneSize);

    let stoneSizeX = stoneGroup.size,
      stoneSizeY = 0;

    if (stoneSizeX > maxStoneSize) {
      stoneSizeX = getLowerStoneSize_side(stoneGroup.type, maxStoneSize);
      if (!stoneSizeX) {
        if (stoneGroup.type > 1) {
          stoneGroup.type = 1;
          doLoop_stoneSize = true;
          Log("info", "Die Steinart wurde angepasst");
          continue;
        }

        Log("info", "Keine passende Steingröße vorhanden (" + maxStoneSize + ")");
        RingData.resetStonegroup(ringData, stoneGroupIndex);
        stoneGroup.mode = 0;
        return null
      }
      stoneGroup.size = stoneSizeX;
      Log("info", "Die Steingröße wurde angepasst (0x7)");
    }

    stoneSizeY = stoneSizeX;

    switch (stoneGroup.type) {
      // case 2: // Princess gerade
      // case 3: // Princess 45°
      //   let t = stoneSizeX / 2;
      //   t *= t;
      //   stoneSizeX = stoneSizeY = Math.sqrt(t * 2) * 2;
      //   break;
      case 4:
      case 5: // Baguette längs
        let stoneSizeItem = stoneType.size.find(e => {
          return e.size == stoneGroup.size;
        })
        if (stoneSizeItem && stoneSizeItem.lengthFactor) {
          stoneSizeY = stoneSizeX * stoneSizeItem.lengthFactor;
        }
        break;
    }

    // let safeDistX = stoneMode.safeDistX, safeDistY = stoneMode.safeDistY;
    // let stoneSizeItem = stoneType.size.find(e => {
    //   return e.size == stoneGroup.size;
    // })
    // if (stoneSizeItem) {
    //   if (stoneSizeItem.safeDistX)
    //     safeDistX = stoneSizeItem.safeDistX;
    //   if (stoneSizeItem.safeDistY)
    //     safeDistY = stoneSizeItem.safeDistY;
    // }

    // @ts-ignore
    let ringSideRadius = (innerCircumference / Math.PI / 2) - ring.profile.sideMidpoint[isLeftSide ? 0 : 1].z,
      stoneSizeX_half = stoneSizeX / 2;

    // if (stoneGroup.mode === 42 || stoneGroup.mode == 43)
    //   distributionRad = (stoneSizeY * Math.PI * 2) / (Math.PI * ringSideRadius * 2);

    // => 230205
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

    let positionRectangle: iPositionRectangle = {
      radius: ringSideRadius,
      rectWidth: stoneSizeX,
      rectHeight: stoneSizeY,
      safetyMargin: stoneMode.safeDistY,//stoneMode.safeDistY,
      maxRectangles: stoneGroup.count > 0 ? stoneGroup.count : stoneGroup.count / -100,
      circumferenceFactor: 1.0,
      initialAngleRad: AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180,
      out_result: [] as iRectPosition[],
      out_maxRectangles: 0,
      out_angleIncrement: 0,
    };

    switch (stoneGroup.distribution) {
      case 5: // halber Steinabstand
        positionRectangle.safetyMargin = stoneSizeY / 2;
        break;
      case 10: // ganzer Steinabstand
        positionRectangle.safetyMargin = stoneSizeY;
        break;
      case 20: // doppelter Steinabstand
        positionRectangle.safetyMargin = stoneSizeY * 2;
        break;
      case 33: // drittel Ring
        positionRectangle.circumferenceFactor = 0.3339;
        break;
      case 50: // halber Ring
        positionRectangle.circumferenceFactor = 0.5;
        break;
      case 100: // ganzer Ring
        positionRectangle.forceFullCircle = true;
        break;
    }

    if (stoneGroup.count < 0) {
      if (stoneGroup.count == -100) {
        positionRectangle.maxRectangles = 0;
        positionRectangle.circumferenceFactor = 1.0;
      } else if (stoneGroup.count == -50) {
        positionRectangle.maxRectangles = 0;
        positionRectangle.circumferenceFactor = 0.5;
      } else if (stoneGroup.count == -33.339) {
        positionRectangle.maxRectangles = 0;
        positionRectangle.circumferenceFactor = 0.3333;
      }
    }

    let position_rectangles = function (param: iPositionRectangle) {
      if (param.circumferenceFactor > 1.0)
        param.circumferenceFactor = 1.0;
      else if (param.circumferenceFactor < 0.1)
        param.circumferenceFactor = 0.1;

      param.out_result = [] as iRectPosition[];
      /* damit sich die Rechtecke nicht überschneiden. wird der Radius um die halbe Rechteckweite reduziert.
      Der tatsächliche Radius bleibt erhalten.
       */
      let circumference = (2 * Math.PI * param.circumferenceFactor) * (param.radius);
      // let circumference = (2 * Math.PI * param.circumferenceFactor) * (param.radius - param.rectWidth / 2);
      let maxRectangles = Math.trunc(circumference / (param.rectHeight + param.safetyMargin));
      param.out_maxRectangles = maxRectangles;

      let angleIncrement, angleStart;

      if (param.circumferenceFactor < 1.0 || param.forceFullCircle) {
        if (param.maxRectangles >= 1 && maxRectangles > param.maxRectangles) maxRectangles = param.maxRectangles;
        else if (param.maxRectangles > 0.0 && param.maxRectangles < 1.0) maxRectangles = Math.trunc(maxRectangles * param.maxRectangles);

        angleIncrement = (2 * Math.PI * (param.circumferenceFactor ?? 1)) / (maxRectangles - (param.circumferenceFactor < 1.0 ? 1 : 0));
        angleStart = (angleIncrement * (maxRectangles - (param.circumferenceFactor < 1.0 ? 1 : 0))) / 2
      } else {
        angleIncrement = (2 * Math.PI) / (maxRectangles);

        if (param.maxRectangles >= 1 && maxRectangles > param.maxRectangles) maxRectangles = param.maxRectangles;
        else if (param.maxRectangles > 0.0 && param.maxRectangles < 1.0) maxRectangles = Math.trunc(maxRectangles * param.maxRectangles);

        angleStart = (angleIncrement * (maxRectangles - 1)) / 2;
      }

      param.out_angleIncrement = angleIncrement;

      for (let i = 0; i < maxRectangles; i++) {
        let angle = i * angleIncrement - angleStart + param.initialAngleRad;// + Math.PI;
        let x = param.radius * Math.cos(angle);
        let y = param.radius * Math.sin(angle);

        param.out_result.push({
          x: x,
          y: y,
          zRotationRad: angle
        });
      }
    }

    position_rectangles(positionRectangle);
    // console.log(positionRectangle);

    maxStoneCount = positionRectangle.out_maxRectangles;

    // <= 230205

    interface iXYrad {
      x: number;
      y: number;
      rad: number;
    }

    let POINTS = [] as iXYrad[]; // Die Mittelpunktkoordinaten der einzelnen Steine

    positionRectangle.out_result.forEach(e => {
      let v = new CVertex();
      v.x = e.x;
      v.y = e.y - positionRectangle.rectHeight / 2;
      v.rotateZ(e.zRotationRad);
      POINTS.push({x: v.x, y: v.y, rad: e.zRotationRad});

      POINTS.push({x: e.x, y: e.y, rad: e.zRotationRad});

      v.x = e.x;
      v.y = e.y + positionRectangle.rectHeight / 2;
      v.rotateZ(e.zRotationRad);
      POINTS.push({x: v.x, y: v.y, rad: e.zRotationRad});
    })

    if (stoneGroup.count > 0 && stoneGroup.count != POINTS.length / 3) {
      stoneGroup.count = POINTS.length / 3;
      Log("info", "Die Steinanzahl wurde angepasst");
    }

    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;
    // @ts-ignore
    let X = stoneGroup.mode % 2 === 0 ? ring.profile.sideMidpoint[0].x : ring.profile.sideMidpoint[1].x;

    POINTS.forEach(function (e) {
      v = new CVertex(X, e.y, -e.x - stoneSizeX_half);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(X, e.y, -e.x);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(X, e.y, -e.x + stoneSizeX_half);
      v.i = index++;
      vertexRow.push(v);

      vertexRows.push(vertexRow);
      vertexRow = [];
    })

    let mesh = new CMesh;
    mesh.rows = vertexRows;
    // mesh.rotateRows(ringRadiusInner, thetaExtra);

    // out.push({
    //     vertex2DArray: vertexRows,
    //     type: "helper",
    //     index: -1,
    //     no_rotate: true,
    // });

    let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
      let positions = [];
      let tangents = [];
      let normals = [];
      let binormals = [];
      let distances = [] as number[];

      let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
      let i, i_l = rows.length, row, j, j_l;

      for (i = 1; i < i_l; i += 3) {

        row = rows[i];
        j_l = row.length;

        for (j = 1; j < j_l; j += 3) {
          // Position
          P = CVertex.fromVertex(row[j]);

          // Tangente
          rows[i + 1][j].toRef(v1);
          rows[i - 1][j].toRef(v2);
          T = CVertex.fromVertex(v1).sub(v2);

          // Normal
          // row[j - 1].toRef(v1);
          // row[j + 1].toRef(v2);
          // N = CVertex.fromVertex(v2).sub(v1);
          N = new CVertex();

          // Binormal
          // B = CVertex.cross(N, T);
          // B.x=1;
          // B.y=0;
          // B.z=0;
          B = new CVertex(X < 0 ? 1 : -1, 0, 0);

          // Normal again
          CVertex.crossToRef(B, T, N);

          N.normalize();
          B.normalize();
          T.normalize();

          positions.push(P);
          tangents.push(T);
          normals.push(N);
          binormals.push(B);
        }
      }

      return {
        distances,
        positions,
        normals,
        binormals,
        tangents
      }
    };
    let stonePathVectors = computeStonePathVectors(vertexRows);
    ring.profile.stonePaths.push(stonePathVectors);

    // => Bevels
    let computeBevels = function () {
      vertexRow = [];
      vertexRows = [];
      index = 0;
      let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
      if (stoneSizeItem && stoneMode) {
        let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
          distY = stoneMode.bevelDistY || stoneMode.safeDistY;
        let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
          bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
          bevelHeight = stoneSizeItem.size / 2 * 1.2;

        /*
        Die Bevels werden an der Nullposition erstellt und beim Aufbau
        der Scene mit den Steinen ausgerichtet
        */
        switch (stoneGroup.type) {
          case 1: // Brillant
          {
            let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
            if (bevelTesselation < 2) bevelTesselation = 2;
            bevelTesselation *= 4;
            bevelTesselation--;
            let incRad = Math.PI * 2 / bevelTesselation,
              rad,
              dist,
              i,
              extraBorder = 30;

            stonePathVectors.positions.forEach(function (p, bevelIndex) {
                vertexRows = [];
                index = 0;

                // 1. Reihe
                vertexRow = [];
                dist = bevelSizeX_half + extraBorder;
                rad = 0.0;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(dist, -5, 0);
                  v.rotateY(rad);
                  rad -= incRad;
                  v.i = index++;
                  vertexRow.push(v)
                }
                vertexRows.push(vertexRow);

                // 2. Reihe
                vertexRow = [];
                dist = bevelSizeX_half;
                rad = 0.0;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(dist, -5, 0);
                  v.rotateY(rad);
                  rad -= incRad;
                  v.i = index++;
                  vertexRow.push(v)
                }
                vertexRows.push(vertexRow);

                // Mittelpunkt
                i = vertexRow.length;
                vertexRow = [];
                while (i--) {
                  v = new CVertex(0, -bevelHeight, 0);
                  v.i = index++;
                  vertexRow.push(v)
                }
                vertexRows.push(vertexRow);

                vertexArray.push({
                  vertex2DArray: vertexRows,
                  type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
                  index: -1,
                  no_rotate: true,
                });

              }
            )
            break;
          }
          case 2: // Princess
          case 3: // Princess 45°
          {
            let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
            if (bevelTesselation < 2) bevelTesselation = 2;
            bevelTesselation--;
            let incX = (bevelSizeX_half * 2) / bevelTesselation,
              incY = (bevelSizeY_half * 2) / bevelTesselation,
              x, y, z, i, j, j_l,
              extraBorder = 30;

            stonePathVectors.positions.forEach(function (p, bevelIndex) {
                vertexRows = [];
                index = 0;

                // 1. Reihe
                vertexRow = [];
                incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
                incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
                x = -bevelSizeX_half - extraBorder;
                y = 0;
                z = -bevelSizeY_half - extraBorder;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x += incX;
                }
                x -= incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z += incY;
                }
                z -= incY;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x -= incX;
                }
                x += incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z -= incY;
                }
                vertexRows.push(vertexRow);

                // 2. Reihe
                vertexRow = [];
                incX = (bevelSizeX_half * 2) / bevelTesselation;
                incY = (bevelSizeY_half * 2) / bevelTesselation;
                x = -bevelSizeX_half;
                y = 0;
                z = -bevelSizeY_half;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x += incX;
                }
                x -= incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z += incY;
                }
                z -= incY;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x -= incX;
                }
                x += incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z -= incY;
                }
                vertexRows.push(vertexRow);

                // Mittelpunkt
                i = vertexRow.length;
                vertexRow = [];
                while (i--) {
                  v = new CVertex(0, -bevelHeight, 0);
                  v.i = index++;
                  vertexRow.push(v)
                }
                vertexRows.push(vertexRow);

                if (stoneGroup.type == 3) // Princess 45°
                {
                  for (i = 0; i < 3; i++) {
                    vertexRow = vertexRows[i];
                    j_l = vertexRow.length;
                    for (j = 0; j < j_l; j++)
                      vertexRow[j].rotateY(Math.PI / 4);
                  }
                }

                vertexArray.push({
                  vertex2DArray: vertexRows,
                  type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
                  index: -1,
                  no_rotate: true,
                });
              }
            )
            break;
          }
          case 4: // Baguette quer
          case 5: // Baguette längs
          {
            bevelSizeY_half = stoneSizeItem.lengthFactor ? ((stoneSizeItem.size * stoneSizeItem.lengthFactor) + distY) / 2 : bevelSizeX_half;

            let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
            if (bevelTesselation < 2) bevelTesselation = 2;
            bevelTesselation--;
            let incX = (bevelSizeX_half * 2) / bevelTesselation,
              incY = (bevelSizeY_half * 2) / bevelTesselation,
              x, y, z, i,
              extraBorder = 30;

            stonePathVectors.positions.forEach(function (p, bevelIndex) {
                vertexRows = [];
                index = 0;

                // 1. Reihe
                vertexRow = [];
                incX = ((bevelSizeX_half + extraBorder) * 2) / bevelTesselation;
                incY = ((bevelSizeY_half + extraBorder) * 2) / bevelTesselation;
                x = -bevelSizeX_half - extraBorder;
                y = 0;
                z = -bevelSizeY_half - extraBorder;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x += incX;
                }
                x -= incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z += incY;
                }
                z -= incY;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x -= incX;
                }
                x += incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z -= incY;
                }
                vertexRows.push(vertexRow);

                // 2. Reihe
                vertexRow = [];
                incX = (bevelSizeX_half * 2) / bevelTesselation;
                incY = (bevelSizeY_half * 2) / bevelTesselation;
                x = -bevelSizeX_half;
                y = 0;
                z = -bevelSizeY_half;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x += incX;
                }
                x -= incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z += incY;
                }
                z -= incY;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  x -= incX;
                }
                x += incX;
                for (i = 0; i <= bevelTesselation; i++) {
                  v = new CVertex(x, y, z);
                  v.i = index++;
                  vertexRow.push(v)
                  z -= incY;
                }
                vertexRows.push(vertexRow);

                // Mittelpunkt
                i = vertexRow.length;
                vertexRow = [];
                while (i--) {
                  v = new CVertex(0, -bevelHeight, 0);
                  v.i = index++;
                  vertexRow.push(v)
                }
                vertexRows.push(vertexRow);

                vertexArray.push({
                  vertex2DArray: vertexRows,
                  type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
                  index: -1,
                  no_rotate: true,
                });
              }
            )
            break;
          }
        }
      }
    }

    let computeCut = function () {
      vertexRow = [];
      vertexRows = [];
      index = 0;

      let min = 999999, max = -999999;
      if (stoneGroup.distribution < 100 && (positionRectangle.out_maxRectangles > stoneGroup.count)) {
        POINTS.forEach(function (e) {
          if (e.rad < min) min = e.rad;
          if (e.rad > max) max = e.rad;
        })

        let stoneSizeY_rad_half = ((stoneSizeY + (stoneMode ? stoneMode.safeDistY : 0)) * Math.PI * 2) / (Math.PI * ringSideRadius * 2) / 2;

        min -= thetaExtra;
        min -= stoneSizeY_rad_half;
        max -= thetaExtra;
        max += stoneSizeY_rad_half;
      } else {
        min = -Math.PI;
        max = Math.PI;
      }

      let length = max - min, cur = min;

      let PI2 = Math.PI * 2;
      let step = PI2 / 180; // 2 Grad schrittweite
      let numRows = Math.trunc(length / step);
      step = length / (numRows - 1);
      let y, z = -(ringSideRadius - innerRadius);
      // @ts-ignore
      let depth = stoneGroup.size * 0.15;
      if (X < 0) depth = -depth;
      let uv_u, pA, pB, AZ, ZB, AB, scale;

      if (X > 0) {
        pA = ring.profile.backVertices[ring.profile.middleVertexBack[0] + 1];
        pB = ring.profile.backVertices[ring.profile.middleVertexBack[0] - 1];
      } else {
        pA = ring.profile.backVertices[ring.profile.middleVertexBack[1] - 1];
        pB = ring.profile.backVertices[ring.profile.middleVertexBack[1] + 1];
      }

      while (numRows-- > 0) {
        vertexRow = [];

        y = (cur) * innerCircumference / PI2;

        v = new CVertex(X, y, z - stoneSizeX_half);

        AZ = v.z - pA.z;
        ZB = pB.z - v.z;
        AB = pB.z - pA.z;
        scale = AZ / AB;
        uv_u = pA.u + ((pB.u - pA.u) * scale);
        uv_u = (X > 0 ? 1.0 - uv_u : uv_u);

        v.i = index++;
        // v.v = uv_v;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z - stoneSizeX_half);
        v.i = index++;
        // v.v = uv_v;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z - stoneSizeX_half);
        v.i = index++;
        // v.v = uv_v;
        v.u = uv_u;
        vertexRow.push(v);

        v = new CVertex(X - depth, y, z + stoneSizeX_half);

        AZ = v.z - pA.z;
        ZB = pB.z - v.z;
        AB = pB.z - pA.z;
        scale = AZ / AB;
        uv_u = pA.u + ((pB.u - pA.u) * scale)
        uv_u = (X > 0 ? 1.0 - uv_u : uv_u);

        v.i = index++;
        // v.v = uv_v;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z + stoneSizeX_half);
        v.i = index++;
        // v.v = uv_v;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X, y, z + stoneSizeX_half);
        v.i = index++;
        // v.v = uv_v;
        v.u = uv_u;
        vertexRow.push(v);

        vertexRows.push(vertexRow);

        cur += step;
      }

      let mesh = new CMesh;
      mesh.rows = vertexRows;

      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "sideChannel_" + stoneGroupIndex,
        index: -1,
        triangulate_isFrontFace: X > 0,
        triangulate_useVectorDist: false,
      });


      let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
      if (stoneSizeItem && stoneMode) {
        // let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
        //     distY = stoneMode.bevelDistY || stoneMode.safeDistY;
        // let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
        //     bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
        //     bevelHeight = stoneSizeItem.size / 2;

        // TODO ?
        if (stoneGroup.type !== 1) {
          Log("warning", "Steinart nicht möglich! Änderung in der Config vornehmen!");
        } else {
          // let PI2 = Math.PI * 2;
          // let min = minPI * innerCircumference / PI2,
          //     max = maxPI * innerCircumference / PI2;

          // let bevelTesselation = AppComponent.app.data.bevelTesselation;
          // if (bevelTesselation < 2) bevelTesselation = 2;
          // bevelTesselation *= 4;
          // bevelTesselation--;
          // let incRad = Math.PI * 2 / bevelTesselation,
          //     rad,
          //     dist,
          //     i,
          //     extraBorder = 30;
          //
          // console.log(stonePathVectors.positions);
          // stonePathVectors.positions.forEach(function (p, bevelIndex)
          //     {
          //         // vertexRows = [];
          //         // index = 0;
          //         //
          //         // // 1. Reihe
          //         // vertexRow = [];
          //         // dist = bevelSizeX_half + extraBorder;
          //         // rad = 0.0;
          //         // for (i = 0; i <= bevelTesselation; i++)
          //         // {
          //         //     v = new CVertex(dist, -50, 0);
          //         //     v.rotateY(rad);
          //         //     rad -= incRad;
          //         //     v.i = index++;
          //         //     vertexRow.push(v)
          //         // }
          //         // vertexRows.push(vertexRow);
          //         //
          //         // // 2. Reihe
          //         // vertexRow = [];
          //         // dist = bevelSizeX_half;
          //         // rad = 0.0;
          //         // for (i = 0; i <= bevelTesselation; i++)
          //         // {
          //         //     v = new CVertex(dist, -50, 0);
          //         //     v.rotateY(rad);
          //         //     rad -= incRad;
          //         //     v.i = index++;
          //         //     vertexRow.push(v)
          //         // }
          //         // vertexRows.push(vertexRow);
          //         //
          //         // // Mittelpunkt
          //         // i = vertexRow.length;
          //         // vertexRow = [];
          //         // while (i--)
          //         // {
          //         //     v = new CVertex(0, -bevelHeight, 0);
          //         //     v.i = index++;
          //         //     vertexRow.push(v)
          //         // }
          //         // vertexRows.push(vertexRow);
          //         //
          //         // out.push({
          //         //     vertex2DArray: vertexRows,
          //         //     type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
          //         //     index: -1,
          //         // });
          //     }
          // )

        }
      }
    }

    let computeChannel = function () {
      vertexRow = [];
      vertexRows = [];
      index = 0;

      let min = 999999, max = -999999;
      if (stoneGroup.distribution < 100 && (positionRectangle.out_maxRectangles > stoneGroup.count) && stoneGroup.count !== -100) {
        POINTS.forEach(function (e) {
          if (e.rad < min) min = e.rad;
          if (e.rad > max) max = e.rad;
        })

        let stoneSizeY_rad_half = (stoneSizeY * Math.PI * 2) / (Math.PI * ringSideRadius * 2) / 2;

        min -= thetaExtra;
        min -= stoneSizeY_rad_half;
        max -= thetaExtra;
        max += stoneSizeY_rad_half;
      } else {
        min = -Math.PI;
        max = Math.PI;
      }

      let length = max - min, cur = min;

      let PI2 = Math.PI * 2;
      let step = PI2 / 180; // 2 Grad schrittweite
      let numRows = Math.trunc(length / step);
      step = length / (numRows - 1);
      let y, z = -(ringSideRadius - innerRadius);
      let depth = stoneGroup.size * (<iStoneCut>stoneType).sizeDepthFactor * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
      if (X < 0) depth = -depth;
      let uv_u, pA, pB, AZ, ZB, AB, scale;

      if (X < 0) {
        pA = ring.profile.backVertices[ring.profile.middleVertexBack[0] - 1];
        pB = ring.profile.backVertices[ring.profile.middleVertexBack[0] + 1];
      } else {
        pA = ring.profile.backVertices[ring.profile.backVertices.length - 1 - ring.profile.middleVertexBack[1] - 1];
        pB = ring.profile.backVertices[ring.profile.backVertices.length - 1 - ring.profile.middleVertexBack[1] + 1];
      }

      let channelSizeX_half = stoneSizeX_half * 0.88; // 12% kleiner als Stein

      // Mitte
      while (numRows-- > 0) {
        vertexRow = [];

        y = (cur) * innerCircumference / PI2;

        v = new CVertex(X, y, z - channelSizeX_half);

        AZ = v.z - pA.z;
        ZB = pB.z - v.z;
        AB = pB.z - pA.z;
        scale = AZ / AB;
        uv_u = pA.u + ((pB.u - pA.u) * scale);

        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z - channelSizeX_half);
        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z - channelSizeX_half);
        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);

        v = new CVertex(X - depth, y, z + channelSizeX_half);

        AZ = v.z - pA.z;
        ZB = pB.z - v.z;
        AB = pB.z - pA.z;
        scale = AZ / AB;
        uv_u = pA.u + ((pB.u - pA.u) * scale)

        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z + channelSizeX_half);
        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X, y, z + channelSizeX_half);
        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);

        vertexRows.push(vertexRow);

        cur += step;
      }
      vertexArray.push({
        vertex2DArray: vertexRows,
        type: "sideChannel_" + stoneGroupIndex,
        index: -1,
        triangulate_isFrontFace: X > 0,
        triangulate_useVectorDist: false,
      });

      if (hasCaps) {
        // unten
        if (1) {
          vertexRows = [];
          vertexRow = [];
          index = 0;

          y = min * innerCircumference / PI2;

          v = new CVertex(X, y, z - channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale);
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X, y, z);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale);
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X, y, z + channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale);
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          vertexRows.push(vertexRow);

          vertexRow = [];

          v = new CVertex(X - depth, y, z - channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale)
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X - depth, y, z);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale)
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X - depth, y, z + channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale)
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          vertexRows.push(vertexRow);

          vertexArray.push({
            vertex2DArray: vertexRows,
            type: "sideChannel_" + stoneGroupIndex,
            index: -1,
            triangulate_isFrontFace: X > 0,
            triangulate_useVectorDist: false,
            no_outline: true,
          });
        }
        // oben
        if (1) {
          vertexRows = [];
          vertexRow = [];
          index = 0;

          y = max * innerCircumference / PI2;

          v = new CVertex(X - depth, y, z - channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale)
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X - depth, y, z);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale)
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X - depth, y, z + channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale)
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          vertexRows.push(vertexRow);

          vertexRow = [];

          v = new CVertex(X, y, z - channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale);
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X, y, z);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale);
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          v = new CVertex(X, y, z + channelSizeX_half);
          AZ = v.z - pA.z;
          AB = pB.z - pA.z;
          scale = AZ / AB;
          uv_u = pA.u + ((pB.u - pA.u) * scale);
          v.i = index++;
          v.u = uv_u;
          vertexRow.push(v);

          vertexRows.push(vertexRow);

          vertexArray.push({
            vertex2DArray: vertexRows,
            type: "sideChannel_" + stoneGroupIndex,
            index: -1,
            triangulate_isFrontFace: X > 0,
            triangulate_useVectorDist: false,
            no_outline: true,
          });
        }
      }


      // let mesh = new CMesh;
      // mesh.rows = vertexRows;


      let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);
      if (stoneSizeItem && stoneMode) {
        // let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
        //     distY = stoneMode.bevelDistY || stoneMode.safeDistY;
        // let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
        //     bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
        //     bevelHeight = stoneSizeItem.size / 2;

        // TODO ?
        if (stoneGroup.type !== 1) {
          Log("warning", "Steinart nicht möglich! Änderung in der Config vornehmen!");
        } else {
          // let PI2 = Math.PI * 2;
          // let min = minPI * innerCircumference / PI2,
          //     max = maxPI * innerCircumference / PI2;

          // let bevelTesselation = AppComponent.app.data.bevelTesselation;
          // if (bevelTesselation < 2) bevelTesselation = 2;
          // bevelTesselation *= 4;
          // bevelTesselation--;
          // let incRad = Math.PI * 2 / bevelTesselation,
          //     rad,
          //     dist,
          //     i,
          //     extraBorder = 30;
          //
          // console.log(stonePathVectors.positions);
          // stonePathVectors.positions.forEach(function (p, bevelIndex)
          //     {
          //         // vertexRows = [];
          //         // index = 0;
          //         //
          //         // // 1. Reihe
          //         // vertexRow = [];
          //         // dist = bevelSizeX_half + extraBorder;
          //         // rad = 0.0;
          //         // for (i = 0; i <= bevelTesselation; i++)
          //         // {
          //         //     v = new CVertex(dist, -50, 0);
          //         //     v.rotateY(rad);
          //         //     rad -= incRad;
          //         //     v.i = index++;
          //         //     vertexRow.push(v)
          //         // }
          //         // vertexRows.push(vertexRow);
          //         //
          //         // // 2. Reihe
          //         // vertexRow = [];
          //         // dist = bevelSizeX_half;
          //         // rad = 0.0;
          //         // for (i = 0; i <= bevelTesselation; i++)
          //         // {
          //         //     v = new CVertex(dist, -50, 0);
          //         //     v.rotateY(rad);
          //         //     rad -= incRad;
          //         //     v.i = index++;
          //         //     vertexRow.push(v)
          //         // }
          //         // vertexRows.push(vertexRow);
          //         //
          //         // // Mittelpunkt
          //         // i = vertexRow.length;
          //         // vertexRow = [];
          //         // while (i--)
          //         // {
          //         //     v = new CVertex(0, -bevelHeight, 0);
          //         //     v.i = index++;
          //         //     vertexRow.push(v)
          //         // }
          //         // vertexRows.push(vertexRow);
          //         //
          //         // out.push({
          //         //     vertex2DArray: vertexRows,
          //         //     type: "sideBevel_" + stoneGroupIndex + "_" + bevelIndex,
          //         //     index: -1,
          //         // });
          //     }
          // )

        }
      }
    }

    if (stoneGroup.mode === 40 || stoneGroup.mode == 41) // eingerieben
      computeBevels();
    else if (stoneGroup.mode === 42 || stoneGroup.mode == 43) // Kanal
      computeChannel();
    else if (stoneGroup.mode === 44 || stoneGroup.mode == 45) // Verschnitt
      computeCut();
  }

  return {
    minSize: 1000,
    maxSize: maxStoneSize,
    maxCount: maxStoneCount,
    maxRows: 1,
    coordinates: stoneCoordinates
  }
}

function stoneCalc_free(ring: cRing, vertexArray: iVertexArray[]): iStoneCalcData | null {

  let ringData = ring.ringData;
  let stoneGroupIndex = 0; // TODO: Gruppenindex hardcoded !!
  let stoneGroup = ringData.stone[stoneGroupIndex];

  if (stoneGroup.mode != 11) return null;
  let profile = AppComponent.app.data.profile.find(e => {
    return e.name == ringData.profileName;
  })
  if (!profile) {
    console.log("Profil nicht erkannt!");
    return null;
  }

  let odm = calcOutlineDataMeasurement(ring);
  if (!odm) return null;

  let outlineDataMeasurement = [] as iOutlineDataMeasurement[];

  // erstelle ein "Zwischenfugensegment für den kompletten Ring
  (function calcNonGapSegment() {
    let segment: iOutlineDataMeasurement = {
      minX: 0, maxX: 0, distX: 0, onGap: false, middlePosition: 0, middleDepth: 0
    };

    let leftSegment = odm[0], rightSegment = odm[odm.length - 1];

    segment.minX = leftSegment.minX;
    // if (ringData.stepMode != 1 && ringData.stepMode != 3) {
    //   segment.minX += profile.sideGapDistance;
    // }
    segment.maxX = rightSegment.maxX;
    // if (ringData.stepMode != 2 && ringData.stepMode != 3) {
    //   // @ts-ignore
    //   segment.maxX -= profile.sideGapDistance;
    // }

    segment.distX = segment.maxX - segment.minX;

    outlineDataMeasurement.push(segment);

  }());

  if (0) {
    // füge die Fugensegmente ein und erstelle eine Mittellinie der Fugen
    (function calcGapSegments() {
      odm.forEach(function (od) {
        if (od.onGap) {
          if (od.outline) {
            let midline = [] as CVertex[];
            let length = od.outline.length, half = length / 2;
            for (let i = 0; i < half; i++) {
              let left = od.outline[i], right = od.outline[length - 1 - i];
              midline.push(new CVertex(left.x + (right.x - left.x) / 2, left.y, 0));
            }

            od.outline = undefined;
            od.midline = midline;
            od.middlePosition = 0;
            od.middleDepth = 0;
          }

          outlineDataMeasurement.push(od);
        }
      })
    }());
  }

  let stoneMode = getStoneMode(stoneGroup.mode);
  if (!stoneMode) {
    console.log("Steinmodus nicht erkannt!");
    return null;
  }

  let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
    return (e.legacyId ?? e.id) == stoneGroup.type;
  })

  if (!stoneType) {
    console.log("Steintyp nicht erkannt");
    return null;
  }

  let stoneDistances = getStoneDistances(stoneMode, ringData.profileName);

  if (!stoneDistances) {
    console.log("Steinabstände nicht erkannt");
    return null;
  }
  outlineDataMeasurement[0].minX += stoneDistances.stoneToGap_x;
  outlineDataMeasurement[0].minX += stoneDistances.stoneToBevel_x;
  outlineDataMeasurement[0].maxX -= stoneDistances.stoneToGap_x;
  outlineDataMeasurement[0].maxX -= stoneDistances.stoneToBevel_x;
  stoneGroup.odm = outlineDataMeasurement;

  // console.log(outlineDataMeasurement);

  let minStoneSize = 1000;
  if (ringData.gapWidth >= 1000) minStoneSize = 1300;
  if (ringData.gapWidth >= 1500) minStoneSize = 1900;
  if (ringData.gapWidth >= 2000) minStoneSize = 2700;

  let freeStones = stoneGroup.freeStones?.slice() || [];
  stoneGroup.freeStones = [];

  freeStones.forEach(e => {
    stoneCalc_addFreeStone(ring, e.size, {freeStone: e});
  })

  // let profile = AppComponent.app.data.profile.find(e => {
  //   return e.name == ringData.profileName;
  // })
  // if (!profile) {
  //   console.log("Profil nicht erkannt!");
  //   return null;
  // }
  //
  // let
  //   // profileDepthSafeDistanceToStone = 300,
  //   stoneMode = getStoneMode(stoneGroup.mode),
  //   stoneType = getStoneCuts(AppComponent.app.data).find(e => {
  //     return e.id == 1;
  //   }),
  //   height = ringData.ringSize;
  //
  // if (!stoneMode) {
  //   console.log("Steinmodus nicht erkannt!");
  //   return null;
  // }
  //
  // if (!stoneType) {
  //   console.log("Steintyp nicht erkannt!");
  //   return null;
  // }
  //
  // // if (odIndex == 0 && ringData.stepMode != 1 && ringData.stepMode != 3) {
  // //   // @ts-ignore
  // //   safeLeft = profile.sideGapDistance;
  // // }
  // // if (odIndex == (outlineDataMeasurement.length - 1) && ringData.stepMode != 2 && ringData.stepMode != 3) {
  // //   // @ts-ignore
  // //   safeRight = profile.sideGapDistance;
  // // }
  //
  // /*
  // - erstelle Mittellinien der Fugen für die Kollisionsprüfung der Steine
  // - ermittle den Abstand zum Ringrand
  //  */
  //
  //
  // let minStoneSize = 1000;
  // if (ringData.gapWidth >= 1000) minStoneSize = 1300;
  // if (ringData.gapWidth >= 1500) minStoneSize = 1900;
  // if (ringData.gapWidth >= 2000) minStoneSize = 2700;
  //
  // // Zwischenfugensegmente
  // /*
  //   outlineData.forEach(function (od, odIndex) {
  //     let length = od.length,
  //       halfIndex = length / 2,
  //       minHorzDistance = 999999,
  //       minHorzIndex = -1,
  //       minX = 999999,
  //       maxX = -999999;
  //
  //     // berücksichtige den Steinabstand vom Profilrand
  //     if (0) {
  //       if (odIndex == 0) {
  //         for (let i = 0; i < halfIndex; i++) {
  //           od[i].x += (<iProfile>profile).sideGapDistance;
  //         }
  //       }
  //       if (odIndex == outlineData.length - 1) {
  //         for (let i = halfIndex; i < length; i++) {
  //           od[i].x -= (<iProfile>profile).sideGapDistance;
  //         }
  //       }
  //     }
  //     // <<=
  //
  //     for (let i = 0; i < halfIndex; i++) {
  //       let x = od[i].x;
  //       if (x < minX) minX = x;
  //       x = od[length - 1 - i].x;
  //       if (x > maxX) maxX = x;
  //       // let cx = od[length - 1 - i].x - od[i].x;
  //       // if (cx < minHorzDistance) {
  //       //   minHorzDistance = cx;
  //       //   minHorzIndex = i;
  //       // }
  //     }
  //
  //     if (0) {
  //       if (odIndex == 0)
  //         minHorzDistance -= (<iProfile>profile).sideGapDistance;
  //       if (odIndex == outlineData.length - 1)
  //         minHorzDistance -= (<iProfile>profile).sideGapDistance;
  //     }
  //
  //     // minHorzDistance -= (<iStoneMode>stoneMode).safeDistX * 2;
  //     // if (minHorzDistance >= 1000)
  //     {
  //       let middlePosition = minX + (maxX - minX) / 2;
  //       // let middlePosition = 0;
  //       // if (outlineData.length > 1) {
  //       //   if (odIndex == 0) middlePosition = od[length - 1].x - minHorzDistance / 2;
  //       //   else middlePosition = od[0].x + minHorzDistance / 2;
  //       // }
  //
  //       // let middlePosition = (odIndex == 0 && outlineData.length > 1) ? od[length - 1].x - minHorzDistance / 2 : od[0].x + minHorzDistance / 2;
  //       let front = cRing.interpolate(middlePosition, ring.profile.frontVertices);
  //       let back = cRing.interpolate(middlePosition, ring.profile.backVertices);
  //
  //       outlineDataMeasurement.push({
  //         minX: minX,
  //         maxX: maxX,
  //         distX: maxX - minX,
  //         minHorzSafeDist: maxX - minX,//minHorzDistance - (<iStoneMode>stoneMode).safeDistX * 2,
  //         index: minHorzIndex,
  //         onGap: false,
  //         middlePosition: middlePosition,
  //         middleDepth: back.z - front.z - profileDepthSafeDistanceToStone,
  //         outline: od,
  //       })
  //     }
  //   })
  // */
  //
  // // Fugensegmente
  // if (1/*ringData.gapWidth < 500*/) {
  //   // outlineData = ring.calc.outlineGap;
  //   // outlineData.forEach(function (od, odIndex) {
  //   //   let length = od.length,
  //   //     halfIndex = length / 2,
  //   //     minHorzDistance = 999999,
  //   //     minHorzIndex = -1,
  //   //     minX = 999999,
  //   //     maxX = -999999;
  //   //
  //   //   // for (let i = 0; i < halfIndex; i++) {
  //   //   //   let x = od[i].x;
  //   //   //   if (x < minX) minX = x;
  //   //   //   x = od[length-1-i].x;
  //   //   //   if (x > maxX) maxX = x;
  //   //   //
  //   //   //   // let cx = od[length - 1 - i].x - od[i].x;
  //   //   //   // if (cx < minHorzDistance) {
  //   //   //   //   minHorzDistance = cx;
  //   //   //   //   minHorzIndex = i;
  //   //   //   // }
  //   //   // }
  //   //
  //   //   // Der Stein ragt links und rechts über die Fuge hinaus.
  //   //   let frontSegmentLeft = outlineDataMeasurement[odIndex];
  //   //   let frontSegmentRight = outlineDataMeasurement[odIndex + 1];
  //   //   if (!frontSegmentLeft || !frontSegmentRight) {
  //   //     console.log(outlineDataMeasurement, odIndex);
  //   //     throw("");
  //   //   }
  //   //
  //   //   let minHorzDist = Math.min(Math.abs(frontSegmentLeft.minX), Math.abs(frontSegmentRight.maxX));
  //   //   minX = minHorzDist;
  //   //   // let minHorzSafeDist = min(frontSegmentLeft.minHorzSafeDist, frontSegmentRight.minHorzSafeDist);
  //   //
  //   //   minHorzDist *= 2;
  //   //   minHorzDist += ringData.gapWidth;
  //   //
  //   //   let middlePosition = od[0].x + (od[length - 1].x - od[0].x) / 2;
  //   //   let front = cRing.interpolate(middlePosition, ring.profile.frontVertices);
  //   //   let back = cRing.interpolate(middlePosition, ring.profile.backVertices);
  //   //
  //   //   outlineDataMeasurement.push({
  //   //     minX: middlePosition - minHorzDist,
  //   //     maxX: middlePosition + minHorzDist,
  //   //     distX: maxX - minX,
  //   //     minHorzSafeDist: minHorzDist,
  //   //     index: minHorzIndex,
  //   //     onGap: true,
  //   //     middlePosition: middlePosition,
  //   //     middleDepth: back.z - front.z - profileDepthSafeDistanceToStone,
  //   //     outline: od,
  //   //   })
  //   // })
  // }
  //
  // // nach Position sortieren
  // /*
  //   outlineDataMeasurement.sort(function (a, b) {
  //     return a.middlePosition - b.middlePosition;
  //   });
  //
  //   // ermitteln der minHorzSafeDist / maxStoneSize für die Fugen
  //   outlineDataMeasurement.forEach(function (od, odIndex) {
  //     if (od.onGap) {
  //       // Der Stein ragt links und rechts über die Fuge hinaus.
  //       // Ermittle das kleinere Segment links oder rechts
  //       // Begrenze die maximal mögliche Steingröße
  //       let frontSegmentLeft = outlineDataMeasurement[odIndex - 1];
  //       let frontSegmentRight = outlineDataMeasurement[odIndex + 1];
  //       if (frontSegmentLeft && frontSegmentRight) {
  //         od.minHorzSafeDist = Math.min(frontSegmentLeft.minHorzSafeDist, frontSegmentRight.minHorzSafeDist);
  //         od.minHorzSafeDist *= 2;
  //         od.minHorzSafeDist += ringData.gapWidth;
  //       }
  //       od.minStoneSize = minStoneSize;
  //     } else od.minStoneSize = undefined;
  //
  //     od.maxStoneSize = getLowerStoneSize_front(ringData, stoneGroup, <iStoneMode>stoneMode, od.minHorzSafeDist)[0];
  //   })
  // */
  //
  //
  // // console.log(outlineDataMeasurement);
  //
  // // stoneGroup.odm = outlineDataMeasurement;
  //
  // let freeStones = stoneGroup.freeStones?.slice() || [];
  // stoneGroup.freeStones = [];
  //
  // freeStones.forEach(e => {
  //   stoneCalc_addFreeStone(ring, e.size, e);
  // })
  //
  let stoneCoordinates = [] as iPoint[];
  let xCenter = ringData.ringWidth / 2;
  let yCenter = ringData.ringSize / 2;
  let ringRadiusInner = ringData.ringSize / Math.PI / 2,
    ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
    ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
    height = ringData.ringSize,
    maxY = height,
    amp = ringData.waveAmp / 100,
    amp100 = ring.calc.amp100;


  let getNextPosition = function (curX: number, curY: number, inc: number, distributionY: number, useAddY: boolean = false): number[] //
  {
    let result = [0, 0], x, y = curY, u, v, d = 0;
    let orig_x = get_sin(curY, height, amp100 * amp, ringData.waveCount);
    let offset = curX - orig_x;

    // distributionY *= ringRadiusFactor;

    if (useAddY) {
      y = curY + distributionY;
      x = get_sin(y, height, amp100 * amp, ringData.waveCount);
      x += offset;
      result[0] = x;
      result[1] = y;
    } else while (1) {
      y += inc;
      x = get_sin(y, height, amp100 * amp, ringData.waveCount);
      u = x - curX + offset;
      v = y - curY;
      d = Math.sqrt(u * u + v * v);
      if (d >= distributionY) {
        x += offset;
        result[0] = x;
        result[1] = y;
        break;
      }
    }

    return result;
  }

  stoneGroup.freeStones.forEach(function (freeStone, freeStoneIndex) {
    let x = map(freeStone.xDiv, -5000, 5000, -xCenter, xCenter),
      y = map(freeStone.yRad, -Math.PI, Math.PI, -yCenter, yCenter),// + yCenter,
      stoneSizeY_safe = freeStone.size * ringRadiusFactor,
      stoneSizeY_half_safe = stoneSizeY_safe / 2;
    let p = [] as iPoint[]; // die untere Kante, Mittelpunkt und obere Kante der Steine
    if (y < 0) {
      let result = getNextPosition(x, y + ringData.ringSize, -1, stoneSizeY_half_safe)
      result[1] -= ringData.ringSize;
      p.push({x: result[0], y: result[1]});
      p.push({x: x, y: y});
      result = getNextPosition(x, y + ringData.ringSize, 1, stoneSizeY_half_safe)
      result[1] -= ringData.ringSize;
      p.push({x: result[0], y: result[1]});
    } else {
      let result = getNextPosition(x, y, -1, stoneSizeY_half_safe);
      p.push({x: result[0], y: result[1]});
      p.push({x: x, y: y});
      result = getNextPosition(x, y, 1, stoneSizeY_half_safe);
      p.push({x: result[0], y: result[1]});
    }

    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;
    let stoneSizeX_half = freeStone.size / 2;

    p.forEach(function (e) {
      v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, ring.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x, e.y, cRing.interpolate(e.x, ring.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, ring.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);

      vertexRows.push(vertexRow);
      vertexRow = [];
    })

    let stoneHelperMesh = new CMesh;
    let thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180; // zusätzliche Rotation des Ringes um die X-Achse

    stoneHelperMesh.rows = vertexRows;
    stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

    let computeStonePathVectors = function (rows: CVertex[][]): iPathVectors {
      let positions = [];
      let tangents = [];
      let normals = [];
      let binormals = [];
      let distances = [] as number[];

      let P, T, N, B, v1 = TEMP.Vertex_1, v2 = TEMP.Vertex_2;
      let i, i_l = rows.length, row, j, j_l;

      for (i = 1; i < i_l; i += 3) {

        row = rows[i];
        j_l = row.length;

        for (j = 1; j < j_l; j += 3) {
          // Position
          P = CVertex.fromVertex(row[j]);

          // Tangente
          rows[i + 1][j].toRef(v1);
          rows[i - 1][j].toRef(v2);
          T = CVertex.fromVertex(v1).sub(v2);

          // Normal
          row[j - 1].toRef(v1);
          row[j + 1].toRef(v2);
          N = CVertex.fromVertex(v2).sub(v1);

          // Binormal
          B = CVertex.cross(N, T);

          // Normal again
          CVertex.crossToRef(B, T, N);

          N.normalize();
          B.normalize();
          T.normalize();

          positions.push(P);
          tangents.push(T);
          normals.push(N);
          binormals.push(B);
        }
      }

      return {
        distances,
        positions,
        normals,
        binormals,
        tangents
      }
    };
    let stonePathVectors = computeStonePathVectors(vertexRows);

    ring.profile.stonePaths.push(stonePathVectors);

    let computeBevels = function () {
      vertexRow = [];
      vertexRows = [];
      index = 0;
      let stoneSizeItem = getStoneSizeItem(stoneGroup.type, freeStone.size);
      if (stoneSizeItem && stoneMode) {
        let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
          distY = stoneMode.bevelDistY || stoneMode.safeDistY;
        let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
          bevelSizeY_half = (stoneSizeItem.size + distY) / 2,
          bevelHeight = stoneSizeItem.size / 2;

        /*
        Die Bevels werden an der Nullposition erstellt und beim Aufbau der
        Scene mit den Steinen ausgerichtet
        */
        let bevelTesselation = AppComponent.app.data.webglSettings.tesselation[2];
        if (bevelTesselation < 2) bevelTesselation = 2;
        bevelTesselation *= 4;
        bevelTesselation--;
        let incRad = Math.PI * 2 / bevelTesselation,
          rad,
          dist,
          i,
          extraBorder = 30;

        stonePathVectors.positions.forEach(function (p) {
            vertexRows = [];
            index = 0;

            // 1. Reihe
            vertexRow = [];
            dist = bevelSizeX_half + extraBorder;
            rad = 0.0;
            for (i = 0; i <= bevelTesselation; i++) {
              v = new CVertex(dist, 0, 0);
              v.rotateY(rad);
              rad -= incRad;
              v.i = index++;
              vertexRow.push(v)
            }
            vertexRows.push(vertexRow);

            // 2. Reihe
            vertexRow = [];
            dist = bevelSizeX_half;
            rad = 0.0;
            for (i = 0; i <= bevelTesselation; i++) {
              v = new CVertex(dist, 0, 0);
              v.rotateY(rad);
              rad -= incRad;
              v.i = index++;
              vertexRow.push(v)
            }
            vertexRows.push(vertexRow);

            // Mittelpunkt
            i = vertexRow.length;
            vertexRow = [];
            while (i--) {
              v = new CVertex(0, -bevelHeight, 0);
              v.i = index++;
              vertexRow.push(v)
            }
            vertexRows.push(vertexRow);

            vertexArray.push({
              vertex2DArray: vertexRows,
              type: "frontBevel_" + stoneGroupIndex + "_" + freeStoneIndex,
              index: -1,
              no_rotate: true,
            });
          }
        )
      }
    }

    computeBevels();
  })

  let maxSize = (getProfileDepth(0, ring) - 300) / stoneType.sizeDepthFactor;

  // console.log(maxSize);
  return {
    minSize: 1000,
    maxSize: maxSize,
    maxCount: 1,
    maxRows: 1,
    coordinates: stoneCoordinates
  }
}

// export function _stoneCalc_addFreeStone(ring: cRing, size: number, freeStone: iFreeStone | null = null) {
//
//   let ringData = ring.ringData;
//
//   let stoneGroupIndex = 0;
//   let stoneGroup = ringData.stone[stoneGroupIndex];
//   if (stoneGroup.mode != 11) return null;
//   if (!stoneGroup.odm) return null;
//
//   let stoneMode = getStoneMode(stoneGroup.mode);
//   if (!stoneMode) {
//     console.log("Steinmodus nicht erkannt!");
//     return null;
//   }
//   let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
//     return e.id == 1;
//   });
//   if (!stoneType) {
//     console.log("Steintyp nicht erkannt!");
//     return null;
//   }
//
//   let xCenter = ringData.ringWidth / 2,
//     yCenter = ringData.ringSize / 2,
//     ringRadiusInner = ringData.ringSize / Math.PI / 2,
//     ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
//     ringRadiusFactor = ringRadiusInner / ringRadiusOuter;
//
//   // Mindeststeingröße "auf Fuge"
//   let minStoneSize = 1000;
//   if (ringData.gapWidth >= 1000) minStoneSize = 1300;
//   if (ringData.gapWidth >= 1500) minStoneSize = 1900;
//   if (ringData.gapWidth >= 2000) minStoneSize = 2700;
//
//
//   let bounds = stoneGroup.odm[0];
//
//   /**
//    * Liefert den Richtungsvektor der Kollision zurück oder undefined wenn keine Kollision vorliegt.
//    * @param pExist der vorhandene Punkt
//    * @param radiusExist Radius des vorhandenen Punktes
//    * @param pTest der zu testende Punkt
//    * @param radiusTest Radius des Testpunktes
//    * @param distanceSafe Sicherheitsabstand der den beiden Radien aufaddiert wird.
//    */
//   let checkOverlap = function (pExist: CVertex, radiusExist: number, pTest: CVertex, radiusTest: number, distanceSafe: number, fallbackYScale = 1): CVertex | undefined {
//     const distance = Math.sqrt(Math.pow(pExist.x - pTest.x, 2) + Math.pow(pExist.y / ringRadiusFactor - pTest.y / ringRadiusFactor, 2));
//     const r1r2 = (radiusExist + radiusTest + distanceSafe);
//     if (distance < r1r2) {
//       let result = CVertex.fromVertex(pTest);
//       result.sub(pExist);
//       result.normalize();
//       if (result.length() == 0.0)
//         result.y = fallbackYScale;
//       result.scale(r1r2);
//       result.add(pExist);
//       return result;
//     }
//
//     return undefined;
//   }
//
//   size = freeStone ? freeStone.size : size;
//
//   let
//     x = map(freeStone ? freeStone.xDiv : 0, -5000, 5000, -xCenter, xCenter),
//     y = map(freeStone ? freeStone.yRad : 0, -Math.PI, Math.PI, -yCenter, yCenter),
//     r = size / 2,
//     doLoop = true, loopCountMax = 1000, loopCount = loopCountMax,
//     freeStones = [] as iFreeStone[],
//     stoneX = 0, stoneY = 0, stoneSize = 0; // finale Werte
//
//   if (stoneGroup.freeStones) freeStones = stoneGroup.freeStones.slice();
//
//   /**
//    * Wenn der Betrag des Abstand eines bestehenden Steines zum neu einzufügenden 0 ist, muss der neue Stein ober- oder unterhalb
//    * des bereits vorhandenen eingefügt werden. Hier wird ermittelt, ob oben (1) oder unten (-1) erfolgen soll.
//    */
//   let fallbackYScale = 1, yMin = 0, yMax = 0;
//   freeStones.forEach(e => {
//     let y = map(e.yRad, -Math.PI, Math.PI, -yCenter, yCenter);
//     if (y < yMin) yMin = y;
//     else if (y > yMax) yMax = y;
//   })
//   if (Math.abs(yMin) < Math.abs(yMax)) fallbackYScale = -1;
//
//   let calcStoneSize;
//   let checkProfileDepth = function (x: number): boolean {
//     let result = true;
//     while (1) {
//       // @ts-ignore
//       calcStoneSize = getStoneSize_2(ringData, stoneGroup, stoneType, r * 2, stoneMode);
//       if (calcStoneSize.size < r * 2) {
//         size = calcStoneSize.size;
//         r = size / 2;
//       }
//       let maxStoneDepth = getProfileMaxStoneDepth(ring, x);
//
//       if (calcStoneSize.depth > maxStoneDepth) {
//         console.log("stone to big", size);
//         // @ts-ignore
//         size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, size - 50)[0];
//         r = size / 2;
//         // @ts-ignore
//         calcStoneSize = getStoneSize_2(ringData, stoneGroup, stoneType, size, stoneMode);
//         maxStoneDepth = getProfileMaxStoneDepth(ring, x);
//         result = false;
//         continue;
//       }
//       break;
//     }
//     return result;
//   }
//   checkProfileDepth(x);
//
//   // @ts-ignore
//   if (bounds.maxX - bounds.minX - calcStoneSize.distances.stoneToGap_x * 2 <= size) {
//     Log("info", "Nicht genügend Platz für Steinbesatz");
//     return null;
//   }
//
//   // @ts-ignore
//   let v1 = new CVertex(x, y, 0), v2 = new CVertex(), fs, distanceSafe = calcStoneSize.distances.stoneToStone_x;
//
//   while (doLoop && loopCount-- > 0) {
//     doLoop = false;
//
//     for (let i = 0, i_l = freeStones.length; i < i_l; i++) {
//       fs = freeStones[i];
//
//       v2.x = map(fs.xDiv, -5000, 5000, -xCenter, xCenter);
//       v2.y = map(fs.yRad, -Math.PI, Math.PI, -yCenter, yCenter);
//
//       let check = checkOverlap(v2, fs.size / 2, v1, r, distanceSafe, fallbackYScale);
//
//       if (check != undefined) {
//         if (checkProfileDepth(x)) v1 = check;
//         doLoop = true;
//       }
//
//       if (doLoop) break;
//     }
//
//     stoneX = v1.x;
//     stoneY = v1.y;
//
//   }
//
//   // while (doLoop && loopCount-- > 0) {
//   //   doLoop = false;
//   //
//   //   while (y < -yCenter) y += (yCenter * 2);
//   //   while (y > yCenter) y -= (yCenter * 2);
//   //
//   //   size2 = getStoneSize_2(ringData, stoneGroup, stoneType, r * 2, stoneMode);
//   //   safeRadius = (size2.size + size2.distances.stoneToStone_x) / 2;
//   //
//   //   t = checkBounds(x, y, safeRadius);
//   //   if (t == -1) {
//   //     if (goneRight)
//   //     {
//   //       y += (yStep * yDirection);
//   //       doLoop = true;
//   //       // goneRight = false;
//   //       loopCount = loopCountMax;
//   //       continue;
//   //     }
//   //     x++;
//   //   }
//   //   else if (x == 1) {
//   //     if (goneLeft)
//   //     {
//   //       y += (yStep * yDirection);
//   //       doLoop = true;
//   //       // goneLeft = false;
//   //       loopCount = loopCountMax;
//   //       continue;
//   //     }
//   //     x--;
//   //   }
//   //   else if (t == -2) {
//   //     let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, (r * 2) - 50, {
//   //       useRealStoneSize: true
//   //     });
//   //
//   //     if (size[0] > 0) {
//   //       r = size[0] / 2;
//   //       doLoop = true;
//   //       continue;
//   //     }
//   //
//   //     y += (yStep * yDirection);
//   //     doLoop = true;
//   //     continue;
//   //   }
//   //   if (t == 0) {
//   //     console.log("bounds ok");
//   //     stoneX = x;
//   //     stoneY = y;
//   //     stoneSize = size2.size;
//   //
//   //     // let size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, (r * 2) + 1, {useRealStoneSize: true});
//   //
//   //     if (freeStones.length > 0) {
//   //
//   //       for (let i = 0; i < freeStones.length; i++) {
//   //         let fs = freeStones[i];
//   //         let distance = Math.sqrt(Math.pow(x - fs.x, 2) + Math.pow(y - fs.y, 2));
//   //         if (distance < safeRadius + fs.r) {
//   //           if (x == fs.x) {
//   //             y += (yStep * yDirection);
//   //             doLoop = true;
//   //             break;
//   //           }
//   //           if (x < fs.x) {
//   //             x -= xStep;
//   //             goneLeft = true;
//   //             doLoop = true;
//   //             break;
//   //           } else {
//   //             x += xStep;
//   //             goneRight = true;
//   //             doLoop = true;
//   //             break;
//   //           }
//   //         }
//   //       }
//   //
//   //       if (doLoop) continue;
//   //
//   //
//   //       // if (freeStones.every(e => {
//   //       //   return !isOverlapping(x, y, size[1]/2, e.x, e.y, e.r);
//   //       // })) {
//   //       // }
//   //       // else {
//   //       //   y += (yStep * yDirection);
//   //       //   doLoop = true;
//   //       //   continue;
//   //       // }
//   //     }
//   //   }
//   // }
//
//   // {
//   //   size2 = getStoneSize_2(ringData, stoneGroup, stoneType, r * 2, stoneMode);
//   //   safeRadius = (size2.size + size2.distances.stoneToStone_x) / 2;
//   //
//   //   const doesOverlap = (x: number, y: number, r: number): boolean => {
//   //     return freeStones.some(fs => {
//   //       const distanceBetweenCenters = Math.sqrt((fs.x - x) ** 2 + (fs.y - y) ** 2);
//   //       const sumOfRadii = fs.r + r;
//   //       return distanceBetweenCenters < sumOfRadii;
//   //     });
//   //   };
//   //
//   //   const findClosestNonOverlappingPosition = (x: number, y: number, r: number): number[] => {
//   //
//   //     while (doesOverlap(x, y, r)) {
//   //       x += 10;
//   //       y += 10;
//   //     }
//   //
//   //     return [x, y];
//   //   };
//   //
//   //   // Versuche, den neuen Kreis an der gewünschten Position hinzuzufügen
//   //   if (doesOverlap(x, y, safeRadius)) {
//   //     // Wenn Überlappung vorliegt, finde die nächstgelegene nicht überlappende Position
//   //     const xy = findClosestNonOverlappingPosition(x, y, safeRadius);
//   //     stoneX = xy[0];
//   //     stoneY = xy[1];
//   //   }
//   //
//   // }
//
//   // if (stoneSize > 0)
//   {
//     freeStones.push({
//       // @ts-ignore
//       x: stoneX, y: stoneY, r: r, size: size,
//       xDiv: map(stoneX, -xCenter, xCenter, -5000, 5000),
//       yRad: map(stoneY, -yCenter, yCenter, -Math.PI, Math.PI)
//     })
//   }
//
//
//   // let isWithinBounds = function (x: number, y: number, r: number): boolean {
//   //   return (
//   //     x - r >= bounds.minX &&
//   //     x + r <= bounds.maxX &&
//   //     y - r >= -yCenter &&
//   //     y + r <= yCenter
//   //   );
//   // }
//   // let isOverlapping = function (x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
//   //   const distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
//   //   console.log("check overlap: ", x1, y1, r1, x2, y2, r2, distance);
//   //   return distance < r1 + r2;
//   // }
//
//
//   // let placeNonOverlappingStone = function () {
//   //   let final_x = map(final_xDiv, -5000, 5000, -xCenter, xCenter),
//   //     final_y = map(final_yRad, -Math.PI, Math.PI, -yCenter, yCenter),
//   //     final_r = final_size / 2,
//   //     validPositionFound = false;
//   //
//   //   while (!validPositionFound) {
//   //
//   //     if (!isWithinBounds(final_x, final_y, final_r)) {
//   //       if (final_x < 0) final_x = bounds.minX + final_r;
//   //       else final_x = bounds.maxX - final_r;
//   //     }
//   //     if (freeStones.every(e => {
//   //       return !isOverlapping(final_x, final_y, final_r, e.x, e.y, e.r);
//   //     })) {
//   //       validPositionFound = true;
//   //       final_xDiv = map(final_x, -xCenter, xCenter, -5000, 5000);
//   //       final_yRad = map(final_y, -yCenter, yCenter, -Math.PI, Math.PI);
//   //     } else {
//   //       if (Math.abs(minY) < Math.abs(maxY))
//   //         final_y -= 50;
//   //       else final_y += 50;
//   //     }
//   //   }
//   // }
//   //
//   // placeNonOverlappingStone();
//
//   // if (final_size > 0) {
//   //   freeStones.push({
//   //     x: 0, y: 0, r: 1, size: final_size, xDiv: final_xDiv, yRad: final_yRad
//   //   });
//   // }
// //
// // if (freeStone) {
// //
// // }
//
//   stoneGroup.freeStones = freeStones;
//
//
// // let xCenter = ringData.ringWidth / 2,
// //   yCenter = ringData.ringSize / 2,
// //   ringRadiusInner = ringData.ringSize / Math.PI / 2,
// //   ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
// //   ringRadiusFactor = ringRadiusInner / ringRadiusOuter;
// //
// // let getY = function (rad: number): number {
// //   let result = map(rad, -Math.PI, Math.PI, -yCenter, yCenter);
// //   if (result < 0) result += ringData.ringSize;
// //   return result;
// // }
// //
// // let getFreePosition = function (): number[] {
// //
// //   let testX = 0, testY = 0;
// //
// //   let minY = 0, maxY = 0, minSize = 0, maxSize = 0;
// //   if (stoneGroup.freeStones) {
// //     stoneGroup.freeStones.forEach(e => {
// //       if (e.yRad <= minY) {
// //         minY = e.yRad;
// //         minSize = e.size;
// //       }
// //       if (e.yRad >= maxY) {
// //         maxY = e.yRad;
// //         maxSize = e.size;
// //       }
// //     })
// //   }
// //
// //   let absMin = Math.abs(minY);
// //   let absMax = Math.abs(maxY);
// //
// //   minY = getY(minY);
// //   maxY = getY(maxY);
// //
// //   let minDist = minSize ? ((minSize + size) / 2 + (<iStoneMode>stoneMode).safeDistX) * ringRadiusFactor : 0;
// //   let maxDist = maxSize ? ((maxSize + size) / 2 + (<iStoneMode>stoneMode).safeDistX) * ringRadiusFactor : 0;
// //
// //   if (absMin > absMax) testY = maxY + maxDist;
// //   else testY = minY - minDist;
// //
// //   let yRad = (testY / ringData.ringSize * 2 * Math.PI);
// //   while (yRad > Math.PI) yRad -= (Math.PI * 2);
// //   while (yRad < -Math.PI) yRad += (Math.PI * 2);
// //
// //   return [testX, yRad];
// // }
// //
// // let newX = 0, newYrad = 0;
// // if (!freeStone) {
// //   let result = getFreePosition();
// //   newX = result[0];
// //   newYrad = result[1];
// // }
// //
// // console.log("here");
// //
// // let odm: iOutlineDataMeasurement[] | null | undefined = stoneGroup.odm;
// // if (!odm) odm = calcOutlineDataMeasurement(ring);
// // if (!odm) return null;
// // stoneGroup.odm = odm;
// // let outlineDataMeasurement = odm;
// //
// // let profileDepthSafeDistanceToStone = 300,
// //   height = ringData.ringSize,
// //   maxY = height,
// //   amp = ringData.waveAmp / 100,
// //   amp100 = ring.calc.amp100,
// //   outlineData = ring.calc.outlineFront,
// //   stoneCoordinates = [] as iPoint[],
// //   innerCircumference = ringData.ringSize,
// //   thetaExtra = Math.PI * AppComponent.app.data.webglSettings.ringRotationX / 180, // zusätzliche Rotation des Ringes um die X-Achse
// //   Yrad = freeStone ? freeStone.yRad : newYrad,
// //   X = freeStone ? Math.trunc(map(freeStone.xDiv, -5000, 5000, -xCenter, xCenter)) : newX;
// //
// // let freeStones = [] as iFreeStone[];
// // if (stoneGroup.freeStones) freeStones = stoneGroup.freeStones.slice();
// //
// // // Mindeststeingröße "auf Fuge"
// // let minStoneSize = 1000;
// // if (ringData.gapWidth >= 1000) minStoneSize = 1300;
// // if (ringData.gapWidth >= 1500) minStoneSize = 1900;
// // if (ringData.gapWidth >= 2000) minStoneSize = 2700;
// //
// // // ermittle alle Fugenpositionen
// // let gapPositions = [] as number[];
// // outlineDataMeasurement.forEach(e => {
// //   if (e.onGap)
// //     gapPositions.push(e.middlePosition);
// // });
// //
// // // X
// // // Wenn...
// // // - sich die Position der Steine innerhalb der Fuge befindet
// // // oder
// // // - die Fuge zu mindestens 50% vom Stein ausgefüllt wird (Steinposition >= Fugenmitte - Steingröße/2)
// // // ...dann verschiebe die Position des Steines auf die Fugenmittellinie
// //
// // let gapHalf = ringData.gapWidth / 2;
// //
// // let gapXonY = get_sin(getY(Yrad), height, amp100 * amp, ringData.waveCount);
// // let gapIndex: number | null = null;
// //
// // for (let i = 0, il = gapPositions.length; i < il; i++) {
// //   let gX = gapPositions[i];
// //   let shift = gapXonY - gX; // gX ist die Position bei y0. 'shift' ist der Versatz der Fuge auf y-Position des Steines.
// //
// //   let gapMiddle = gX + gapXonY;
// //   // let gapMiddle = gX + shift;
// //
// //   // console.log(X, gX);
// //
// //   if ((X > gapMiddle && X - size / 2 <= gapMiddle) || (X < gapMiddle && X + size / 2 >= gapMiddle)) {
// //
// //     // if ((X >= gapMiddle - gapHalf && X <= gapMiddle + gapHalf) ||
// //     //   (X >= gapMiddle - size / 2 && X <= gapMiddle + size / 2)) {
// //     X = gapMiddle;
// //     //   X = gX + shift;
// //     if (size < minStoneSize) size = minStoneSize;
// //
// //     gapIndex = i;
// //     // console.log("index found:", gapIndex, gapMiddle);
// //     break;
// //   }
// // }
// //
// // // Y
// // // Suche nach Kollisionen mit bereits hinzugefügten Steinen auf der Fuge.
// // // Wenn eine Kollision erkannt wird, dann:
// // // - ermittle, ob sich der neue Stein oberhalb oder unterhalb des vorhandenen befinden soll und verschiebe entsprechend
// // //   die Y-Position nach oben oder unten
// // // - wenn eine erneute Kollision erkannt wird, suche in entgegengesetzter Richtung
// //
// // let checkStoneDepth = function (minStoneSize: number): number {
// //   let profileDepth = getProfileDepth(X, ring) - profileDepthSafeDistanceToStone;
// //   let stoneDepth = size * (<iStoneCut>stoneType).sizeDepthFactor;
// //   // console.log("Profiledepth: "+profileDepth+", stoneDepth: "+stoneDepth+", stoneSize: "+size);
// //
// //   if (stoneDepth > profileDepth) {
// //     if (size > minStoneSize) {
// //       // reduziere die Steingröße
// //       while (1) {
// //         size = getLowerStoneSize_front(ringData, stoneGroup, <iStoneMode>stoneMode, size - 10, {useRealStoneSize: true})[0];
// //         if (size > 0 && size >= minStoneSize) {
// //           stoneDepth = size * (<iStoneCut>stoneType).sizeDepthFactor;
// //           if (stoneDepth <= profileDepth) break;
// //         } else {
// //           size = 0;
// //           break;
// //         }
// //       }
// //     } else
// //       size = 0;
// //   }
// //
// //   if (size == 0) console.log("kein passender Stein");
// //   return size;
// // }
// //
// // if (gapIndex != null) //
// // {
// //   if (size < minStoneSize) size = minStoneSize;
// //   let yDirection = 0; // 1 = up, 2 = down
// //   if (freeStones.length == 0) // es ist noch kein Stein in der Liste...
// //   {
// //     size = checkStoneDepth(minStoneSize);
// //   } else // Kollisionsprüfung "auf Fuge"
// //   {
// //     for (let stoneIndex = 0, stoneLength = freeStones.length; stoneIndex < stoneLength; stoneIndex++) {
// //       let e = freeStones[stoneIndex];
// //       let doLoop = true, loopCount = 50;
// //       while (doLoop && loopCount-- > 0) {
// //         doLoop = false;
// //
// //         if (checkStoneDepth(minStoneSize) == 0) break;
// //
// //         let eX = map(e.xDiv, -5000, 5000, -xCenter, xCenter);
// //         let x = X - eX;
// //         let PI2 = Math.PI * 2;
// //         let _Y = Yrad % PI2;
// //         if (_Y > Math.PI) _Y = -(PI2 - _Y);
// //         let _eY = e.yRad % PI2;
// //         if (_eY > Math.PI) _eY = -(PI2 - _eY);
// //
// //
// //         let dist = Math.abs(_Y - _eY);
// //         let U = dist * (ringData.ringSize / PI2);
// //         dist = Math.sqrt(x * x + U * U);
// //
// //         // let min = Math.min(Yrad, e.yRad) % (Math.PI*2);
// //         // let max = Math.max(Yrad, e.yRad) % (Math.PI*2);
// //         // let U = (max - min) * (ringData.ringSize / (2 * Math.PI));
// //         // let dist = Math.sqrt(x * x + U * U);
// //         let minDist = ((e.size + size) / 2 + (<iStoneMode>stoneMode).safeDistX) * ringRadiusFactor;
// //         // minDist = minDist / ringData.ringSize * (2*Math.PI);
// //
// //         // let eY = map(e.yRad, -Math.PI, Math.PI, -yCenter, yCenter);
// //         // if (eY < 0) eY += ringData.ringSize;
// //         // let min1 = Y - eY, min2 = ringData.ringSize - min1, sMin = Math.min(min1, min2);
// //         // let dist = Math.sqrt(x * x + sMin * sMin);
// //         // let minDist = ((e.size + size) / 2 + (<iStoneMode>stoneMode).safeDistX) * ringRadiusFactor;
// //
// //         if (yDirection == 0) {
// //           if (_Y - _eY > 0) yDirection = 1;
// //           else yDirection = 2;
// //           // if (Yrad < e.yRad || Yrad + Math.PI > e.yRad) yDirection = 2;
// //           // // if (min1 > min2) yDirection = 2;
// //           // else yDirection = 1;
// //         }
// //
// //         // console.log(dist, minDist);
// //         if (dist < minDist) {
// //           let Y = getY(Yrad);
// //           if (yDirection == 2) Y -= 100;
// //           else Y += 100;
// //           Yrad = (Y / ringData.ringSize * 2 * Math.PI);//) % (Math.PI * 2);
// //           gapXonY = get_sin(Y, height, amp100 * amp, ringData.waveCount);
// //           let gX = gapPositions[<number>gapIndex];
// //           let shift = gapXonY - gX;
// //           X = gapXonY + gX;
// //           // X = gX + shift;
// //           doLoop = true;
// //           stoneIndex = -1; // wenn diese while-Schleife den richtigen Abstand ermittelt hat, fange von vorne an
// //         }
// //       }
// //     }
// //   }
// // } else if (1) // suche Zwischenfugensegment
// // {
// //   let isPointInPoly = function (x: number, y: number, polygon: CVertex[], safeDist_X: number = 0): boolean | number[] {
// //     let isInside = false;
// //     // let minX = polygon[0].x, maxX = polygon[0].x;
// //     // let minY = polygon[0].y, maxY = polygon[0].y;
// //     // for (let n = 1; n < polygon.length; n++) {
// //     //   let q = polygon[n];
// //     //   minX = Math.min(q.x, minX);
// //     //   maxX = Math.max(q.x, maxX);
// //     //   minY = Math.min(q.y, minY);
// //     //   maxY = Math.max(q.y, maxY);
// //     // }
// //
// //     // if (x < minX + safeDist_X || x > maxX - safeDist_X || y < minY || y > maxY) {
// //     //   return [minX + safeDist_X, maxX - safeDist_X];//, Math.min(Math.abs(x - minX), Math.abs(x - maxX))];
// //     // }
// //
// //     let i = 0, j = polygon.length - 1, lengthHalf = polygon.length / 2, ix, jx;
// //     for (; i < polygon.length; j = i++) {
// //       ix = polygon[i].x;
// //       if (i < lengthHalf) ix += safeDist_X;
// //       else ix -= safeDist_X;
// //       jx = polygon[j].x;
// //       if (j < lengthHalf) jx += safeDist_X;
// //       else jx -= safeDist_X;
// //
// //       if ((polygon[i].y > y) != (polygon[j].y > y) &&
// //         x < (jx - ix) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + ix) {
// //         isInside = !isInside;
// //       }
// //     }
// //
// //     return isInside;
// //     // if (isInside)
// //     //   return true;
// //     //
// //     // return [minX, maxX];//, Math.min(Math.abs(x - minX), Math.abs(x - maxX))];
// //   }
// //
// //   let checkLoopCount = 0;
// //
// //   let checkOverlap = function (outline: CVertex[]): number[] | null // [x, y, scale, (0=Kreis|1=Polygon)] of overlapping point
// //   {
// //     // let testAngles = [] as number[];
// //     // let angleInc = Math.PI / 4;
// //     // let angleStart = Math.PI / 2;
// //     // let PI2 = Math.PI * 2;
// //     // for (let a = 0; a < 8; a++) testAngles.push((angleStart + a * angleInc) % PI2);
// //
// //
// //     // Überprüfe, ob der Kreis sich mit anderen Kreisen überlappt
// //     for (let stoneIndex = 0, stoneLength = freeStones.length; stoneIndex < stoneLength; stoneIndex++) {
// //       let e = freeStones[stoneIndex];
// //       let eX = map(e.xDiv, -5000, 5000, -xCenter, xCenter);
// //       let x = X - eX;
// //       let PI2 = Math.PI * 2;
// //       let _Y = Yrad % PI2;
// //       if (_Y > Math.PI) _Y = -(PI2 - _Y);
// //       let _eY = e.yRad % PI2;
// //       if (_eY > Math.PI) _eY = -(PI2 - _eY);
// //
// //       let alpha = _Y,
// //         beta = _eY,
// //         pi2SubAlpha = PI2 - alpha,
// //         pi2SubBeta = PI2 - beta,
// //         minAlpha = Math.min(alpha, pi2SubAlpha),
// //         minBeta = Math.min(beta, pi2SubBeta),
// //         rad = Math.abs(alpha - beta),
// //         dist = rad / ringRadiusFactor;
// //
// //       let U = dist * (ringData.ringSize / PI2);
// //       dist = Math.sqrt(x * x + U * U);
// //
// //       let minDist = ((e.size + size) / 2 + (<iStoneMode>stoneMode).safeDistX);
// //
// //       // console.log(dist, minDist);
// //
// //       let eY = map(_eY, -Math.PI, Math.PI, -yCenter, yCenter);
// //       let __Y = map(_Y, -Math.PI, Math.PI, -yCenter, yCenter);
// //
// //
// //       let t = dist / minDist;
// //       if (t >= 0.995 && t <= 1.005) continue;
// //
// //       if (dist < (<iStoneMode>stoneMode).safeDistX) {
// //         // let rand = Math.random() % 4;
// //         let x = 0, y = 0;
// //         // if (rand == 0) { x = eX + 1; y = eY + 1;}
// //         // else if (rand == 1) { x = eX - 1; y = eY + 1;}
// //         // else if (rand == 2) { x = eX - 1; y = eY - 1;}
// //         // else { x = eX + 1; y = eY - 1;}
// //
// //         // if (eX < X) x = 1;
// //         // else x = -1;
// //         if (eY < __Y) y = 1;
// //         else y = -1;
// //
// //         // x += (Math.random() % 100) / 1000;
// //         // y += (Math.random() % 100) / 1000;
// //
// //
// //         let r = [x, y, minDist, 0];
// //         // eX < X ? eX - 1 : eX + 1,
// //         // // eY < _Y ? eY - 1 : eY + 1,
// //         // beta < alpha ? eY - 1 : eY + 1,
// //         // minDist, 0];
// //         console.log("same position", eX, eY, dist, minDist, r);
// //         return r;
// //       }
// //       if (dist < minDist) {
// //         // let x = eX, y = eY;
// //         // if (x == 0 || y == 0) {
// //         //   x = eX > X ? eX - 1 : eX + 1;
// //         //
// //         //   if (_Y < eY)
// //         //     y = eY - 1;
// //         //   else y = eY + 1;
// //         //
// //         //   // y = eY > _Y ? eY - 1 : eY + 1;
// //         // }
// //         // let r = [x, y, minDist / dist, 0];
// //         // console.log("dist to low", stoneIndex, eX, eY, dist, minDist, minDist / dist);
// //         // return r;
// //         return [eX, beta < alpha ? eY - 1 : eY + 1, minDist / dist, 0];
// //         // return [eX, eY + 10, minDist / dist, 0];
// //         // return [eX, eY, minDist / dist];
// //       }// Überlappung mit Kreis gefunden
// //       // else
// //       //   console.log("no kollision: "+dist+"("+minDist+")");
// //     }
// //
// //     // >> NEU
// //     // let newX = 0;
// //     // let pointInsidePolygon = function (x: number, y: number, outline: CVertex[], safetyDistance: number): boolean {
// //     //   // Verschiebe den Punkt um den Sicherheitsabstand, um den Rand zu berücksichtigen
// //     //   if (x < 0) x -= safetyDistance;
// //     //   else x += safetyDistance;
// //     //   // y += safetyDistance;
// //     //
// //     //   const numVertices = outline.length;
// //     //   let inside = false;
// //     //   newX = outline[numVertices - 1].x - safetyDistance;
// //     //
// //     //   for (let i = 0, j = numVertices - 1; i < numVertices; j = i++) {
// //     //     const vertexI = outline[i];
// //     //     const vertexJ = outline[j];
// //     //
// //     //     // Überprüfe, ob die Linie von Punkt nach rechts die Kante des Polygons schneidet
// //     //     if (((vertexI.y > y) !== (vertexJ.y > y)) && (x < (vertexJ.x - vertexI.x) * (y - vertexI.y) / (vertexJ.y - vertexI.y) + vertexI.x)) {
// //     //       inside = !inside;
// //     //       if (!inside) {
// //     //         newX = (vertexJ.x - vertexI.x) / 2;
// //     //       }
// //     //     }
// //     //   }
// //     //
// //     //   if (!inside) console.log("point outside polygon!", x, newX);
// //     //   return inside;
// //     // }
// //     //
// //     // if (!pointInsidePolygon(X, getY(Yrad), outline, size / 2 + (<iStoneMode>stoneMode).safeDistX)) {
// //     //   if (checkLoopCount++ < 100) {
// //     //     X = newX;
// //     //     return checkOverlap(outline);
// //     //   } else {
// //     //     size = 0;
// //     //     console.log("Keine Anpassung möglich");
// //     //   }
// //     // }
// //
// //     // <<
// //
// //     // Überprüfe, ob der Kreis sich innerhalb des Polygons befindet
// //     if (1) {
// //       for (const point of outline) {
// //         let e = point;
// //         let eX = e.x;
// //         let x = X - eX;
// //         let PI2 = Math.PI * 2;
// //         let _Y = Yrad % PI2;
// //         if (_Y > Math.PI) _Y = -(PI2 - _Y);
// //         let _eY = map(e.y, 0, ringData.ringSize, -Math.PI, Math.PI);
// //         if (_eY > Math.PI) _eY = -(PI2 - _eY);
// //
// //         let alpha = _Y,
// //           beta = _eY,
// //           pi2SubAlpha = PI2 - alpha,
// //           pi2SubBeta = PI2 - beta,
// //           minAlpha = Math.min(alpha, pi2SubAlpha),
// //           minBeta = Math.min(beta, pi2SubBeta),
// //           rad = Math.abs(alpha - beta),
// //           dist = rad / ringRadiusFactor;
// //
// //         let U = dist * (ringData.ringSize / PI2);
// //         dist = Math.sqrt(x * x + U * U);
// //
// //         let minDist = size / 2 + (<iStoneMode>stoneMode).safeDistX;
// //
// //         // console.log(dist, minDist);
// //
// //         let eY = map(_eY, -Math.PI, Math.PI, -yCenter, yCenter);
// //
// //         let t = dist / minDist;
// //         if (t >= 0.995 && t <= 1.005) continue;
// //
// //         if (dist < (<iStoneMode>stoneMode).safeDistX) {
// //           let rand = Math.random() % 4;
// //           let x = 0, y = 0;
// //           if (rand == 0) {
// //             x = eX + 1;
// //             y = eY + 1;
// //           } else if (rand == 1) {
// //             x = eX - 1;
// //             y = eY + 1;
// //           } else if (rand == 2) {
// //             x = eX - 1;
// //             y = eY - 1;
// //           } else {
// //             x = eX + 1;
// //             y = eY - 1;
// //           }
// //           let r = [x, y, minDist, 0];
// //           // eX < X ? eX - 1 : eX + 1,
// //           // // eY < _Y ? eY - 1 : eY + 1,
// //           // beta < alpha ? eY - 1 : eY + 1,
// //           // minDist, 0];
// //           console.log("same position (polygon)", eX, eY, dist, minDist, r);
// //           return r;
// //         }
// //         if (dist < minDist) {
// //           // let x = eX, y = eY;
// //           // if (x == 0 || y == 0) {
// //           //   x = eX > X ? eX - 1 : eX + 1;
// //           //
// //           //   if (_Y < eY)
// //           //     y = eY - 1;
// //           //   else y = eY + 1;
// //           //
// //           //   // y = eY > _Y ? eY - 1 : eY + 1;
// //           // }
// //           // let r = [x, y, minDist / dist, 0];
// //           console.log("dist to low", eX, eY, dist, minDist, minDist / dist);
// //           // return r;
// //           return [eX, beta < alpha ? eY - 1 : eY + 1, minDist / dist, 0];
// //           // return [eX, eY + 10, minDist / dist, 0];
// //           // return [eX, eY, minDist / dist];
// //         }// Überlappung mit Kreis gefunden
// //         // else
// //         //   console.log("no kollision: "+dist+"("+minDist+")");
// //       }
// //     }
// //
// //     let minDist = size / 2 + (<iStoneMode>stoneMode).safeDistX;
// //
// //     // Überprüfe, ob der Kreis sich innerhalb des Polygons befindet
// //     // @ts-ignore
// //     if (0) {
// //       for (const point of outline) {
// //
// //         const dx = X - point.x;
// //         // const y = map(point.y, 0, ringData.ringSize, -yCenter, yCenter);
// //         const dy = (getY(Yrad) - point.y);// / ringRadiusFactor;
// //         const dist = Math.sqrt(dx * dx + dy * dy);
// //         let t = dist / minDist;
// //         if (t >= 0.9999 && t <= 1.0001) continue;
// //         if (dist < minDist) {
// //           let x = 0, y = 0;
// //           if (point.x < X) x = point.x + 1;
// //           else x = point.y - 1;
// //           if (point.y < getY(Yrad)) y = point.y - y;
// //           else y = point.y + 1;
// //           return [x, y, minDist / dist, 1]; // Überlappung mit dem Polygon gefunden
// //           // return [point.x, point.y + 10, minDist / dist, 1]; // Überlappung mit dem Polygon gefunden
// //         }
// //       }
// //     }
// //
// //     return null; // Keine Überlappung gefunden
// //   }
// //
// //   // let checkOverlap = function (outline: CVertex[]): number[] | null // [x, y, scale, (0=Kreis|1=Polygon)] of overlapping point
// //   // {
// //   //   // Überprüfe, ob der Kreis sich mit anderen Kreisen überlappt
// //   //   for (let stoneIndex = 0, stoneLength = freeStones.length; stoneIndex < stoneLength; stoneIndex++) {
// //   //     let e = freeStones[stoneIndex];
// //   //     let eX = map(e.xDiv, -5000, 5000, -xCenter, xCenter);
// //   //     let x = X - eX;
// //   //     let PI2 = Math.PI * 2;
// //   //     let _Y = Yrad % PI2;
// //   //     if (_Y > Math.PI) _Y = -(PI2 - _Y);
// //   //     let _eY = e.yRad % PI2;
// //   //     if (_eY > Math.PI) _eY = -(PI2 - _eY);
// //   //
// //   //     let dist = Math.abs(_Y - _eY) / ringRadiusFactor;
// //   //     let U = dist * (ringData.ringSize / PI2);
// //   //     dist = Math.sqrt(x * x + U * U);
// //   //
// //   //     let minDist = ((e.size + size) / 2 + (<iStoneMode>stoneMode).safeDistX);
// //   //
// //   //     let eY = map(_eY, -Math.PI, Math.PI, -yCenter, yCenter);
// //   //
// //   //     let t = dist / minDist;
// //   //     if (t >= 0.995 && t <= 1.005) continue;
// //   //
// //   //     if (dist < (<iStoneMode>stoneMode).safeDistX) {
// //   //       let r = [
// //   //         eX < X ? eX - 1 : eX + 1,
// //   //         eY < _Y ? eY - 1 : eY + 1,
// //   //         minDist, 0];
// //   //       // console.log("same position", eX, eY, dist, minDist, r);
// //   //       return r;
// //   //     }
// //   //     if (dist < minDist) {
// //   //       // let x = eX, y = eY;
// //   //       // if (x == 0 || y == 0) {
// //   //       //   x = eX > X ? eX - 1 : eX + 1;
// //   //       //
// //   //       //   if (_Y < eY)
// //   //       //     y = eY - 1;
// //   //       //   else y = eY + 1;
// //   //       //
// //   //       //   // y = eY > _Y ? eY - 1 : eY + 1;
// //   //       // }
// //   //       // let r = [x, y, minDist / dist, 0];
// //   //       // console.log("dist to low", stoneIndex, eX, eY, dist, minDist, minDist / dist);
// //   //       // return r;
// //   //       return [eX, eY + 10, minDist / dist, 0];
// //   //       // return [eX, eY, minDist / dist];
// //   //     }// Überlappung mit Kreis gefunden
// //   //     // else
// //   //     //   console.log("no kollision: "+dist+"("+minDist+")");
// //   //   }
// //   //
// //   //   let minDist = size / 2 + (<iStoneMode>stoneMode).safeDistX;
// //   //
// //   //   // Überprüfe, ob der Kreis sich innerhalb des Polygons befindet
// //   //   // @ts-ignore
// //   //   for (const point of outline) {
// //   //     const dx = X - point.x;
// //   //     const dy = (getY(Yrad) - point.y);// / ringRadiusFactor;
// //   //     const dist = Math.sqrt(dx * dx + dy * dy);
// //   //     let t = dist / minDist;
// //   //     if (t >= 0.9999 && t <= 1.0001) continue;
// //   //     if (dist < minDist) {
// //   //       return [point.x, point.y + 10, minDist / dist, 1]; // Überlappung mit dem Polygon gefunden
// //   //     }
// //   //   }
// //   //
// //   //   return null; // Keine Überlappung gefunden
// //   // }
// //
// //   let getPolygonHorizontalDistance = function (polygon: CVertex[], y: number): number[] {
// //     let length = polygon.length, lengthHalf = length / 2, iy, jy;
// //     for (let i = 0; i < lengthHalf; i++) {
// //       iy = polygon[i].y;
// //       jy = polygon[length - 1 - i].y;
// //       if (iy >= y)
// //         return [polygon[i].x, polygon[length - 1 - i].x, polygon[length - 1 - i].x - polygon[i].x];
// //       // return polygon[length - 1 - i].x - polygon[i].x;
// //     }
// //
// //     return [0, 0, 0];
// //   }
// //
// //   let odmSegment: iOutlineDataMeasurement | null = null;
// //
// //   for (let i = 0; i < outlineDataMeasurement.length; i++) {
// //     if (isPointInPoly(X, getY(Yrad), <CVertex[]>outlineDataMeasurement[i].outline)) {
// //       odmSegment = outlineDataMeasurement[i];
// //       break;
// //     }
// //   }
// //
// //   if (odmSegment) {
// //     // console.log("in segment");
// //     let outline = JSON.parse(JSON.stringify(<CVertex[]>odmSegment.outline));
// //
// //     // if (odmSegment == outlineDataMeasurement[0]) // linke Ringseite
// //     // {
// //     //   let minX = -xCenter + ring.calc.stoneSafeLeft;
// //     //   let halfLength = outline.length / 2;
// //     //   for (let i = 0; i < halfLength; i++) outline[i].x = minX;
// //     // } //
// //     // else if (odmSegment == outlineDataMeasurement[outlineDataMeasurement.length - 1]) // rechte Ringseite
// //     // {
// //     //   let maxX = xCenter - ring.calc.stoneSafeRight;
// //     //   let halfLength = outline.length / 2;
// //     //   for (let i = halfLength; i < outline.length; i++) outline[i].x = maxX;
// //     // }
// //
// //     let doLoop = true, loopCount = 50, lastCollisionType = -1, stoneCollisionCount = 0, polygonCollisionCount = 0;
// //     while (doLoop && loopCount-- > 0) {
// //       // console.log("loop no: " + loopCount);
// //       doLoop = false;
// //
// //       let horzDist = getPolygonHorizontalDistance(outline, getY(Yrad))[2];
// //       // console.log("horzDist: " + horzDist + ", Y: " + getY(Yrad));
// //
// //       // if (odmSegment == outlineDataMeasurement[0] ||
// //       //   odmSegment == outlineDataMeasurement[outlineDataMeasurement.length - 1]) horzDist -= stoneMode.safeDistX;
// //       // else horzDist -= stoneMode.safeDistX * 2;
// //       // console.log("horzDist, size", horzDist, size, Yrad);
// //
// //       if (horzDist < size) {
// //         size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, horzDist, {useRealStoneSize: true})[0];
// //         // console.log("horzDist < size", horzDist, size);
// //         doLoop = true;
// //       }
// //
// //       let result = checkOverlap(outline);
// //       if (result) {
// //         // console.log(result);
// //         let x = (<number[]><unknown>result)[0];
// //         let y = (<number[]><unknown>result)[1];
// //         let scale = (<number[]><unknown>result)[2];
// //         let type = (<number[]><unknown>result)[3];
// //         if (type == 0) stoneCollisionCount++;
// //         else polygonCollisionCount++;
// //
// //         if (type == 1) // polygon
// //         {
// //           // teste auf Randbegrenzung
// //           let horzDist = getPolygonHorizontalDistance(outline, getY(Yrad));
// //           if (horzDist[2] > size + stoneMode.safeDistX * 2) {
// //             console.log("horzDist middle", horzDist, size, size + stoneMode.safeDistX * 2);
// //             X = (X - x) * scale + x;
// //             // X = horzDist[0] + horzDist[2] / 2;
// //             doLoop = true;
// //           } else {
// //             size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, horzDist[2] - stoneMode.safeDistX * 2, {useRealStoneSize: true})[0];
// //             console.log("horzDist < size", horzDist, size);
// //             doLoop = true;
// //           }
// //         } else
// //           X = (X - x) * scale + x;
// //
// //         let Y = map(Yrad, -Math.PI, Math.PI, -yCenter, yCenter);
// //         Y = (Y - y) * scale + y;
// //
// //         Yrad = (Y / ringData.ringSize * 2 * Math.PI);
// //
// //         doLoop = true;
// //       }
// //     }
// //   } else size = 0;
// //
// //   // size = checkStoneDepth(0);
// // }
// //
// // // freien Stein hinzufügen
// // // if (Y < 0) Y += ringData.ringSize;
// // // if (Y > yCenter) Y -= ringData.ringSize;
// //
// // while (Yrad > Math.PI) Yrad -= (Math.PI * 2);
// // while (Yrad < -Math.PI) Yrad += (Math.PI * 2);
// //
// // // console.log(Yrad);
// //
// // if (size > 0) {
// //   freeStones.push({
// //     xDiv: map(X, -xCenter, xCenter, -5000, 5000),
// //     yRad: Yrad,//map(Y, -yCenter, yCenter, -Math.PI, Math.PI),
// //     size: size
// //   });
// //   stoneGroup.freeStones = freeStones;
// // }
// //
// //
// // // // Prüfe auf Kollision mit bereits vorhandenen Steinen.
// // // // Der neue Stein wird entsprechend des Richtungsvektors verschoben, wenn notwendig.
// // // // 2. Möglichkeit wäre, die Steingröße zu reduzieren.
// // // if (stoneGroup.freeStones) {
// // //
// // //   let doLoop = true, loopCount = 50;
// // //   let minY = 0, maxY = 0;
// // //   stoneGroup.freeStones.forEach(e => {
// // //     if (e.yRad < minY) minY = e.yRad;
// // //     if (e.yRad > maxY) maxY = e.yRad;
// // //   })
// // //
// // //   minY = Math.abs(minY);
// // //   maxY = Math.abs(maxY);
// // //
// // //   while (doLoop && loopCount-- > 0) {
// // //     doLoop = false;
// // //     for (let i = 0; i < stoneGroup.freeStones.length; i++) {
// // //       let e = stoneGroup.freeStones[i];
// // //       let eX = map(e.xDiv, -5000, 5000, -xCenter, xCenter);
// // //       let x = X - eX;
// // //       let eY = map(e.yRad, -Math.PI, Math.PI, -yCenter, yCenter);
// // //       if (eY < 0) eY += ringData.ringSize;
// // //
// // //       // let eY = map(e.yRad, -Math.PI, Math.PI, -yCenter, yCenter) + yCenter;
// // //       let y = Y - eY;
// // //       // let y = (Y-yCenter) - eY;
// // //       let dist = Math.sqrt(x * x + y * y);
// // //       let targetDist = e.size / 2 + size / 2 + stoneMode.safeDistX;
// // //
// // //       // console.log(Y, eY);
// // //       if (dist < targetDist) {
// // //         // console.log(dist, targetDist);
// // //         let f = targetDist / dist;
// // //         if ((Y == eY) || (Y == 0) || ((f >= 0.999999) && (f <= 1.000001))) {
// // //           // if (Y == yCenter || ((f >= 0.999999) && (f <= 1.000001))) {
// // //           if (minY < maxY) Y += size / 2;
// // //           else Y += -size / 2;
// // //         } else {
// // //           let V = TEMP.Vertex_1;
// // //           V.x = X - eX;
// // //           V.y = Y - eY;
// // //           V.z = 0;
// // //           V.scale(f);
// // //           X = eX + V.x;
// // //           Y = eY + V.y;
// // //
// // //           let safeLeft = -xCenter+ring.calc.stoneSafeLeft;
// // //           let safeRight = xCenter-ring.calc.stoneSafeRight;
// // //
// // //           if (X + size / 2 > safeRight) {
// // //             X = safeRight - size/2;
// // //             if (minY < maxY) Y -= 200;
// // //             else Y += 200;
// // //             console.log("safe right touched", safeRight);
// // //           } else if (X - size / 2 < safeLeft) {
// // //             X = safeLeft + size/2;
// // //             if (minY < maxY) Y -= 200;
// // //             else Y += 200;
// // //             console.log("safe left touched", safeLeft);
// // //           }
// // //         }
// // //         // console.log("teste neue Position: "+X,", "+Y,", "+f);
// // //         doLoop = true;
// // //         // loopCount = 50;
// // //         break;
// // //       }
// // //     }
// // //   }
// // // }
// // //
// // // let isPointInPoly = function (x: number, y: number, polygon: CVertex[], safeDist_X: number = 0): boolean | number[] {
// // //   let isInside = false;
// // //   // let minX = polygon[0].x, maxX = polygon[0].x;
// // //   // let minY = polygon[0].y, maxY = polygon[0].y;
// // //   // for (let n = 1; n < polygon.length; n++) {
// // //   //   let q = polygon[n];
// // //   //   minX = Math.min(q.x, minX);
// // //   //   maxX = Math.max(q.x, maxX);
// // //   //   minY = Math.min(q.y, minY);
// // //   //   maxY = Math.max(q.y, maxY);
// // //   // }
// // //
// // //   // if (x < minX + safeDist_X || x > maxX - safeDist_X || y < minY || y > maxY) {
// // //   //   return [minX + safeDist_X, maxX - safeDist_X];//, Math.min(Math.abs(x - minX), Math.abs(x - maxX))];
// // //   // }
// // //
// // //   let i = 0, j = polygon.length - 1, lengthHalf = polygon.length / 2, ix, jx;
// // //   for (; i < polygon.length; j = i++) {
// // //     ix = polygon[i].x;
// // //     if (i < lengthHalf) ix += safeDist_X;
// // //     else ix -= safeDist_X;
// // //     jx = polygon[j].x;
// // //     if (j < lengthHalf) jx += safeDist_X;
// // //     else jx -= safeDist_X;
// // //
// // //     if ((polygon[i].y > y) != (polygon[j].y > y) &&
// // //       x < (jx - ix) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + ix) {
// // //       isInside = !isInside;
// // //     }
// // //   }
// // //
// // //   return isInside;
// // //   // if (isInside)
// // //   //   return true;
// // //   //
// // //   // return [minX, maxX];//, Math.min(Math.abs(x - minX), Math.abs(x - maxX))];
// // // }
// // //
// // // let odmSegment: iOutlineDataMeasurement | null = null;
// // //
// // // outlineDataMeasurement.forEach(od => {
// // //   if (!od.outline) return;
// // //   let result = isPointInPoly(X, Y, od.outline, 0);
// // //   if (result === true) {
// // //     if (!od.onGap) {
// // //       result = isPointInPoly(X, Y, od.outline, size / 2 + (stoneMode ? (stoneMode.bevelDistX ? stoneMode.bevelDistX : stoneMode.safeDistX) : 0));
// // //       let leftSide = 0, rightSide = 0, max = od.outline.length - 1, half = od.outline.length / 2;
// // //       let y = Y;//-yCenter;
// // //       // if (y < 0) y += ringData.ringSize;
// // //       for (let i = 1; i < half; i++) {
// // //         if (od.outline[i - 1].y <= y && od.outline[i].y >= y) leftSide = od.outline[i].x;
// // //         if (od.outline[max - i + 1].y <= y && od.outline[max - i].y >= y) rightSide = od.outline[max - i].x;
// // //       }
// // //
// // //       let width = rightSide - leftSide;
// // //       console.log("size: " + size + ", width: " + width);
// // //       if (size > width) {
// // //         console.log("stone to big", size, rightSide - leftSide, y);
// // //       }
// // //       // @ts-ignore
// // //       while (size + stoneMode.safeDistX * 2 > width) {
// // //         // @ts-ignore
// // //         size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, width)[0];
// // //       }
// // //       if (!result) {
// // //         if (Math.abs(X - leftSide) < Math.abs(rightSide - X)) {
// // //           X = leftSide + size / 2;
// // //         } else {
// // //           X = rightSide - size / 2;
// // //         }
// // //       }
// // //     }
// // //     odmSegment = od;
// // //   }
// // // })
// // //
// // // if (odmSegment !== null) {
// // //
// // //   let od = <iOutlineDataMeasurement>odmSegment;
// // //   let x = get_sin(Y, height, amp100 * amp, ringData.waveCount);
// // //
// // //   if (od.onGap) {
// // //     if (od.minStoneSize && size < od.minStoneSize) size = od.minStoneSize;
// // //     else if (od.maxStoneSize && size > od.maxStoneSize) size = od.maxStoneSize;
// // //
// // //     console.log("position on gap: " + X + " => " + x);
// // //     X = x + od.middlePosition;
// // //   } else {
// // //
// // //     // if (od.maxStoneSize && size > od.maxStoneSize) size = od.maxStoneSize;
// // //     //
// // //     // let min = x + od.middlePosition - od.minHorzSafeDist/2 + size/2,
// // //     //   max = x + od.middlePosition + od.minHorzSafeDist/2 - size/2;
// // //     //
// // //     // if (X < min) {
// // //     //   console.log("limit min: "+X+", "+min);
// // //     //   X = min;
// // //     // }
// // //     // else if (X > max) {
// // //     //   console.log("limit max: "+X+", "+max);
// // //     //   X = max;
// // //     // }
// // //
// // //     console.log("position on segment: " + X + " => " + x);
// // //   }
// // //
// // //   if (Y > yCenter) Y -= ringData.ringSize;
// // //   let xDiv = map(X, -xCenter, xCenter, -5000, 5000);
// // //   let yRad = map(Y, -yCenter, yCenter, -Math.PI, Math.PI);
// // //   // let yRad = map(Y - yCenter, -yCenter, yCenter, -Math.PI, Math.PI);
// // //
// // //   let freeStones;
// // //
// // //   if (stoneGroup.freeStones) freeStones = stoneGroup.freeStones.slice();
// // //   else freeStones = [] as iFreeStone[];
// // //
// // //   freeStones.push({
// // //     xDiv: xDiv,
// // //     yRad: yRad,
// // //     size: size
// // //   });
// // //
// // //   stoneGroup.freeStones = freeStones;
// // //
// // // } else console.log("no odmSegment");
// // //
//   return null;
// }

/**
 *
 * @param ring
 * @param size
 * @param options
 *            testPosition:boolean
 *            freeStone:iFreeStone
 */
export function stoneCalc_addFreeStone(ring: cRing, size: number, options: any = {}): boolean {

  if (options.testPosition == undefined) options.testPosition = false;

  let ringData = ring.ringData;

  let stoneGroupIndex = 0;
  let stoneGroup = ringData.stone[stoneGroupIndex];
  if (stoneGroup.mode != 11) return false;
  if (!stoneGroup.odm) return false;

  let stoneMode = getStoneMode(stoneGroup.mode);
  if (!stoneMode) {
    console.log("Steinmodus nicht erkannt!");
    return false;
  }
  let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
    return (e.legacyId ?? e.id) == 1;
  });
  if (!stoneType) {
    console.log("Steintyp nicht erkannt!");
    return false;
  }

  let xCenter = ringData.ringWidth / 2,
    yCenter = ringData.ringSize / 2,
    ringRadiusInner = ringData.ringSize / Math.PI / 2,
    ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
    ringRadiusFactor = ringRadiusInner / ringRadiusOuter;

  // Mindeststeingröße "auf Fuge"
  // let minStoneSize = 1000;
  // if (ringData.gapWidth >= 1000) minStoneSize = 1300;
  // if (ringData.gapWidth >= 1500) minStoneSize = 1900;
  // if (ringData.gapWidth >= 2000) minStoneSize = 2700;

  // console.log(stoneGroup.odm);

  let bounds = stoneGroup.odm[0];
  let
    x = map(options.freeStone ? options.freeStone.xDiv : 0, -5000, 5000, -xCenter, xCenter),
    xFinal = x,
    y = map(options.freeStone ? options.freeStone.yRad : 0, -Math.PI, Math.PI, -yCenter, yCenter),
    yFinal = y,
    freeStones: iFreeStone[] = stoneGroup.freeStones || [];

  /**
   * Wenn der Betrag des Abstand eines bestehenden Steines zum neu einzufügenden 0 ist, muss der neue Stein ober- oder unterhalb
   * des bereits vorhandenen eingefügt werden. Hier wird ermittelt, ob oben (1) oder unten (-1) erfolgen soll.
   */
  let fallbackYScale = 1, yMin = 0, yMax = 0;
  freeStones.forEach(e => {
    let y = map(e.yRad, -Math.PI, Math.PI, -yCenter, yCenter);
    if (y < yMin) yMin = y;
    else if (y > yMax) yMax = y;
  })
  if (Math.abs(yMin) < Math.abs(yMax)) fallbackYScale = -1;

  /**
   * Liefert den Richtungsvektor der Kollision zurück oder undefined wenn keine Kollision vorliegt.
   * @param pExist der vorhandene Punkt
   * @param radiusExist Radius des vorhandenen Punktes
   * @param pTest der zu testende Punkt
   * @param radiusTest Radius des Testpunktes
   * @param distanceSafe Sicherheitsabstand der den beiden Radien aufaddiert wird.
   */
  let checkOverlap = function (pExist: CVertex, radiusExist: number, pTest: CVertex, radiusTest: number, distanceSafe: number, fallbackYScale = 1): CVertex | boolean {
    const distance = Math.sqrt(Math.pow(pExist.x - pTest.x, 2) + Math.pow(pExist.y / ringRadiusFactor - pTest.y / ringRadiusFactor, 2));
    const r1r2 = (radiusExist + radiusTest + distanceSafe);
    if (distance < r1r2) {

      if (options.testPosition) return false;

      let result = CVertex.fromVertex(pTest);
      result.sub(pExist);
      result.normalize();
      if (result.length() == 0.0)
        result.y = fallbackYScale;
      result.scale(r1r2);
      result.add(pExist);
      return result;
    }

    return true;
  }

  let doLoop = true, doLoopCount = 0;
  let checkedXY: number[][] = [];

  while (doLoop && doLoopCount++ < 1000) {

    doLoop = false;

    let calcStoneSize: iCalcStoneSize;
    let checkProfileDepth = function (x: number): boolean {
      let result = true;
      while (1) {
        // @ts-ignore
        calcStoneSize = getStoneSize_2(ringData, stoneGroup, stoneType, size, stoneMode);
        if (calcStoneSize.size < size) size = calcStoneSize.size;

        let maxStoneDepth = getProfileMaxStoneDepth(ring, x);

        if (calcStoneSize.depth > maxStoneDepth) {
          // console.log("stone to big", size);
          // @ts-ignore
          size = getLowerStoneSize_front(ringData, stoneGroup, stoneMode, size - 50)[0];
          // r = size / 2;
          // @ts-ignore
          calcStoneSize = getStoneSize_2(ringData, stoneGroup, stoneType, size, stoneMode);
          // maxStoneDepth = getProfileMaxStoneDepth(ring, x);
          result = false;
          continue;
        }
        break;
      }
      return result;
    }
    checkProfileDepth(x);

    let r = size / 2;

    // @ts-ignore
    let leftToRight = bounds.maxX - bounds.minX;// - calcStoneSize.distances.stoneToGap_x * 2;
    if (leftToRight < size) {
      Log("info", "Nicht genügend Platz für Steinbesatz"); // TODO: Steingröße verringern
      return false;
    }
    let checkBounds = function (): boolean {
      let result = true;
      // @ts-ignore
      if (xFinal - r < bounds.minX/* + calcStoneSize.distances.stoneToGap_x*/) {
        xFinal = bounds.minX/* + calcStoneSize.distances.stoneToGap_x*/ + r;
        result = false;
      }
      // @ts-ignore
      if (xFinal + r > bounds.maxX/* - calcStoneSize.distances.stoneToGap_x*/) {
        xFinal = bounds.maxX/* - calcStoneSize.distances.stoneToGap_x*/ - r;
        result = false;
      }

      return result;
    }

    checkBounds();

    let v1 = new CVertex(xFinal, yFinal, 0), v2 = new CVertex(), vLast = new CVertex(), fs,
      // @ts-ignore
      distanceSafe = calcStoneSize.distances.stoneToStone_x;

    for (let i = 0, i_l = freeStones.length; i < i_l; i++) {

      fs = freeStones[i];

      v2.x = map(fs.xDiv, -5000, 5000, -xCenter, xCenter);
      v2.y = map(fs.yRad, -Math.PI, Math.PI, -yCenter, yCenter);

      let check = checkOverlap(v2, fs.size / 2, v1, r, distanceSafe, fallbackYScale);

      if (check === false) return false;

      if (check != true) {

        if (options.freeStone) {
          check.x += map(Math.random(), 0, 1, -1, 1) * (doLoopCount+1)*100;
          check.y += map(Math.random(), 0, 1, -1, 1) * (doLoopCount+1)*100;
        }
        else {
          check.x = 0;
          check.y += 100 * fallbackYScale;
        }


        // console.log("overlapping: ", doLoopCount);

        // if (checkProfileDepth(v1.x))
        {
          xFinal = check.x;
          yFinal = check.y;
        }

        let exists = checkedXY.find((e: number[]) => {
          return ((e[0] == xFinal) && (e[1] == yFinal));
        })

        if (exists) {
          // console.log("exists: ", exists);
          // if (xFinal == 0)
          {
            xFinal += map(Math.random(), 0, 1, -1, 1) * 10;
          }
          let s = new CVertex(xFinal, yFinal, 0);
          s.scale(1.5);
          xFinal = s.x;
          yFinal = s.y;
        } else {
          checkedXY.push([xFinal, yFinal]);
        }


        // x = xFinal;
        // checkBounds();
        // if (x != xFinal) xFinal = 0;

        v1.x = xFinal;
        v1.y = yFinal;
        i = -1;
        continue;
        // doLoop = true;
      }

      if (!checkBounds()) {
        doLoop = true;
      }

      if (doLoop) break;
    }

    checkProfileDepth(xFinal);
  }

  if (options.testPosition) return true;

  freeStones.push({
    x: xFinal, y: yFinal, r: size / 2, size: size,
    xDiv: map(xFinal, -xCenter, xCenter, -5000, 5000),
    yRad: map(yFinal, -yCenter, yCenter, -Math.PI, Math.PI)
  })

  stoneGroup.freeStones = freeStones;

  return true;
}
