import {Log} from "../logger/logger.component";
import {CMesh, CVertex, iPathVectors, TEMP} from "./threeD";
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";

test = [11]; // freie Steine
if (test.indexOf(stoneGroup.mode) !== -1) {
  let stoneMode = findStoneMode(stoneGroup.mode);
  if (!stoneMode) return;

  if (stoneMode.minRingWidth && stoneMode.minRingWidth > that.ringData.ringWidth) {
    stoneGroup.mode = 0;
    Log("info", "Der gewählte Steinbesatz ist bei dieser Ringbreite nicht möglich");
    return;
  }

  interface iXY {
    x: number;
    y: number;
    size: number;
  }

  let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine

  cRing.handleFreeStone(that.ringData.index, 0); // size = 0: Nur testen...

  if (stoneGroup.freeStones) {
    stoneGroup.freeStones.forEach(function (e, index) {
      let x = map(e.xDiv, -5000, 5000, -xCenter, xCenter),
        y = map(e.yRad, -Math.PI, Math.PI, -yCenter, yCenter);
      POINTS.push({x: x, y: y, size: e.size});
    });

    // berechne Geometriedaten...
    let p = [] as iXY[];
    let stoneSizeY_half_safe;
    let getPoint = function (curX: number, curY: number, distance: number, inc: number): iXY {
      let result = {x: 0, y: 0, size: 0}, x, y = curY, u, v, d = 0;
      let height = that.ringData.ringSize;
      let orig_x = get_sin(curY, height, 1);
      let offset = curX - orig_x;

      // if (testY) {
      //   y = curY + distance;
      //   result.x = get_sin(y, height, amp100 * amp);
      //   result.y = y;
      //   return result;
      // }

      while (1) {
        y += inc;
        x = get_sin(y, height, 1);
        u = x - curX + offset;
        v = y - curY;
        d = Math.sqrt(u * u + v * v);
        if (d >= distance) {
          x += offset;
          result.x = x;
          result.y = y;
          break;
        }
      }

      return result;
    }
    // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
    POINTS.forEach(function (e) {
      stoneSizeY_half_safe = e.size / 2;
      if (e.y < 0) {
        let result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, -1)
        result.y -= that.ringData.ringSize;
        p.push(result);
        p.push({x: e.x, y: e.y, size: e.size});
        result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, 1)
        result.y -= that.ringData.ringSize;
        p.push(result);
      } else {
        p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
        p.push({x: e.x, y: e.y, size: e.size});
        p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
      }
    })


    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;
    let stoneSizeX_half;

    p.forEach(function (e) {
      stoneSizeX_half = e.size / 2;
      v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x, e.y, cRing.interpolate(e.x, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);

      vertexRows.push(vertexRow);
      vertexRow = [];
    })

    let stoneHelperMesh = new CMesh;
    stoneHelperMesh.rows = vertexRows;
    let ringRadiusInner = innerCircumference / Math.PI / 2;

    stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

    // out.push({
    //     vertex2DArray: vertexRows,
    //     type: "helper",
    //     index: -1,
    //     no_rotate: true,
    //     triangulate_useVectorDist: false,
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

    that.profile.stonePaths.push(stonePathVectors);

    let computeBevels = function () {
      vertexRow = [];
      vertexRows = [];
      index = 0;

      /*
            Die Bevels werden an der Nullposition erstellt und beim Aufbau der Scene mit den Steinen
            ausgerichtet
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

      stonePathVectors.positions.forEach(function (p, bevelIndex) {
          vertexRows = [];
          index = 0;

          let stoneSizeItem = getStoneSizeItem(stoneGroup.type, POINTS[bevelIndex].size);
          if (stoneSizeItem && stoneMode) {
            let distX = stoneMode.bevelDistX || stoneMode.safeDistX,
              distY = stoneMode.bevelDistY || stoneMode.safeDistY;
            let bevelSizeX_half = (stoneSizeItem.size + distX) / 2,
              bevelHeight = stoneSizeItem.size / 2;

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
              type: "frontBevel_" + stoneGroupIndex + "_" + bevelIndex,
              index: -1,
              no_rotate: true,
            });
          }
        }
      )
    }

    computeBevels();
  }
}

test = [31]; // Kanal quer, nur Brillant gültig
if (test.indexOf(stoneGroup.mode) !== -1) {
  let stoneMode = findStoneMode(stoneGroup.mode);
  let stoneType = getStoneTypeItem(stoneGroup.type);

  if (!stoneMode || !stoneType)
    return;

  let loopStoneSize = true;
  let loopStoneSizeCount = 50;

  while (loopStoneSize && loopStoneSizeCount-- > 0) {
    loopStoneSize = false;

    let stoneSize = stoneGroup.size;
    let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);

    if (stoneSizeItem) {
      let x = stoneSizeItem.size, y;
      if (stoneSizeItem.lengthFactor) {
        y = x * stoneSizeItem.lengthFactor;
        stoneSize = Math.sqrt(x * x + y * y);
      } else if (stoneSizeItem.calcSize) {
        stoneSize = stoneSizeItem.calcSize;
      }
      // else: ...Fallback zur stoneSize wurde oben schon definiert...

    }

    let ringRadiusInner = innerCircumference / Math.PI / 2,
      ringRadiusOuter = ringRadiusInner + that.ringData.ringHeight,
      ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
      stoneSizeX_safe = stoneSize + stoneMode.safeDistX,
      stoneSizeX_half = stoneSize / 2,
      stoneSizeY_safe = (stoneSize + stoneMode.safeDistY) * ringRadiusFactor,
      stoneSizeY = stoneSize * ringRadiusFactor,
      stoneSizeY_half = stoneSizeY / 2,
      stoneSizeY_half_safe = stoneSizeY_safe / 2,
      distributionY = stoneSizeY_safe,
      stoneCount = stoneGroup.count,
      height = that.ringData.ringSize,
      yCenter = height / 2,
      heightFactor = 1.0,
      maxY: number,

      // amp = that.ringData.waveAmp / 100,
      // amp100 = that.calc.amp100,

      stoneSafeLeft = -xCenter + that.calc.stoneSafeLeft,
      stoneSafeRight = xCenter - that.calc.stoneSafeRight,

      maxStoneCount = 0;

    /*
            ermittle
            den
            nächsten
            Y - Wert
            im
            Abstand
            von
            'distance';
            'inc'
            kann
            positiv
            oder
            negativ
            sein
            */
    // let debug_getPoint = false;
    let getPoint = function (curX: number, curY: number, distance: number, inc: number, testY: boolean = false): iXY {
      if (inc < 0) distance = -distance;
      return {x: curX, y: curY + distance};
      // let result = {x: 0, y: 0}, x, y = curY, u, v, d = 0;
      // let orig_x = get_sin(curY, height, 1);
      // let offset = curX - orig_x;
      //
      // if (testY)
      // {
      //   y = curY + distance;
      //   result.x = get_sin(y, height, 1);
      //   result.y = y;
      //   return result;
      // }
      //
      // while (1)
      // {
      //   y += inc;
      //   x = get_sin(y, height, 1);
      //   u = x - curX + offset;
      //   v = y - curY;
      //   d = Math.sqrt(u * u + v * v);
      //   if (d >= distance)
      //   {
      //     x += offset;
      //     result.x = x;
      //     result.y = y;
      //     break;
      //   }
      // }
      //
      // return result;
    }
    //
    // let getMaxStoneCount = function (): number
    // {
    //   let countMax = 1, p = getPoint(0, -maxY, stoneSizeY_half_safe, 1);
    //
    //   while (1)
    //   {
    //     p = getPoint(p.x, p.y, distributionY, 1);
    //     if (p.y > maxY)
    //       break;
    //
    //     if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
    //     {
    //       console.log(p.x, stoneSizeX_half, stoneSafeLeft, stoneSafeRight, distributionY);
    //       break;
    //     }
    //
    //     countMax++;
    //   }
    //
    //   return countMax;
    // }
    //
    // let loop = 0;
    // while (loop++ < 2) // 2 Durchläufe sind hier notwendig weil sich innerhalb dieser Schleife die Verteilung ändern kann
    // {
    //   distributionY = stoneSizeY_safe;
    //
    //   switch (stoneGroup.distribution)
    //   {
    //     case 0: // aneinander
    //       break;
    //     case 5: // halber Steinabstand
    //       distributionY *= 1.5;
    //       break;
    //     case 10: // ganzer Steinabstand
    //       distributionY *= 2.0;
    //       break;
    //     case 20: // doppelter Steinabstand
    //       distributionY *= 3.0;
    //       break;
    //     case 33: // drittel Ring
    //       heightFactor = 0.33;
    //       break;
    //     case 50: // halber Ring
    //       heightFactor = 0.5;
    //       break;
    //     case 100: // ganzer Ring
    //       heightFactor = 1.0;
    //       break;
    //   }
    //
    //   maxY = yCenter * heightFactor;
    //
    //   // if (stoneGroup.distribution == 100)
    //   // {
    //   //   maxY -= stoneSizeY / 2;
    //   // }
    //
    //   maxStoneCount = getMaxStoneCount();
    //
    //   if (stoneGroup.distribution >= 33 && stoneGroup.count < 0)
    //     stoneGroup.count = stoneCount = maxStoneCount;
    //
    //   if (stoneGroup.count < 0)
    //   {
    //     switch (stoneGroup.count)
    //     {
    //       case -33.339:
    //         stoneCount = Math.trunc(maxStoneCount / 3);
    //         break;
    //       case -50:
    //         stoneCount = Math.trunc(maxStoneCount / 2);
    //         break;
    //       case -100:
    //         stoneCount = maxStoneCount;
    //         stoneGroup.distribution = 100;
    //         break;
    //     }
    //   }
    //
    //   if (stoneCount > maxStoneCount)
    //     stoneCount = maxStoneCount;
    //
    //   if (stoneGroup.mode === 20)
    //   {
    //     if (stoneCount === maxStoneCount)
    //       stoneGroup.distribution = 100;
    //     else
    //       stoneGroup.distribution = 0;
    //   }
    //   else
    //   {
    //     stoneGroup.rows = 1;
    //   }
    // }
    //
    // that.calc.stone[stoneGroupIndex].maxCount = maxStoneCount;
    //
    // let loopDistribution = true;

    interface iXY {
      x: number;
      y: number;
    }

    let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine

    let testStoneSizeRingHeight_doLoopStoneSize = true;

    let testStoneSizeRingHeight = function (position: iXY, safeDistance = 1000): boolean {
      let stoneType = getStoneTypeItem(stoneGroup.type);
      if (stoneType) {
        let sizeLeft, sizeRight;

        if (stoneGroup.mode == 20 || stoneGroup.mode == 30) {
          let interpolationFront = cRing.interpolate(position.x - stoneSize / 2, that.profile.frontVertices);
          let interpolationBack = cRing.interpolate(position.x - stoneSize / 2, that.profile.backVertices);

          sizeLeft = -(interpolationFront.z - interpolationBack.z) - safeDistance;

          interpolationFront = cRing.interpolate(position.x + stoneSize / 2, that.profile.frontVertices);
          interpolationBack = cRing.interpolate(position.x + stoneSize / 2, that.profile.backVertices);

          sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
        } else {
          let interpolationFront = cRing.interpolate(position.x, that.profile.frontVertices);
          let interpolationBack = cRing.interpolate(position.x, that.profile.backVertices);

          sizeLeft = sizeRight = -(interpolationFront.z - interpolationBack.z);// - safeDistance;
        }

        let maxStoneSize = Math.min(sizeLeft, sizeRight) / stoneType.sizeDepthFactor;

        if (stoneGroup.size > maxStoneSize) {
          if (testStoneSizeRingHeight_doLoopStoneSize) {
            stoneGroup.size = getLowerStoneSize(stoneGroup.type, maxStoneSize);
            that.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
            loopStoneSize = true;
            Log("info", "Die Steingröße wurde angepasst (0x6)");
          }
          return false;
        }
      }
      return true;
    }

    POINTS = [{x: 0, y: 0}];
    testStoneSizeRingHeight(POINTS[0]);

    if (stoneGroup.count > 1) {
      let minX = 100000,
        maxX = -100000,
        i,
        i_l = POINTS.length / 2,
        i1 = 0,
        p1,
        p1_last: iXY | null = null,
        i2 = (POINTS.length === 2) ? 1 : (POINTS.length % 2 === 0) ? 2 : 1,
        p2,
        u,
        v,
        d,
        stoneShift = stoneSize,//_safe,
        stoneDiameter = stoneSizeY,//_safe,
        recalcStoneShift = true,
        doLoop = true,
        loopCount = 100,
        maxRows = 9999,
        numRows = stoneGroup.count, // verwende den Algorithmus von oben für die horizontale Teilung
        POINTS_ROWS = [] as iXY[],
        safeProfileSideDist = 0;//stoneMode.safeProfileSideDist ? stoneMode.safeProfileSideDist : 0;

      for (i = 0; i < i_l; i++) {
        p1 = POINTS[i];
        if (p1.x < minX) minX = p1.x;
        if (p1.x > maxX) maxX = p1.x;
      }
      console.log(minX, maxX);

      minX = -minX;
      minX = that.ringData.ringWidth / 2 - minX - safeProfileSideDist;// - that.calc.stoneSafeLeft;
      maxX = that.ringData.ringWidth / 2 - maxX - safeProfileSideDist;// - that.calc.stoneSafeRight;

      console.log(minX, maxX);

      if (POINTS.length > 1) {
        p1 = POINTS[i1];
        p2 = POINTS[i2];
        v = p2.y - p1.y;

        while (doLoop && loopCount-- > 0) {
          doLoop = false;
          u = p1.x + stoneShift - p2.x;
          d = Math.sqrt(u * u + v * v);
          if (d < stoneDiameter) {
            stoneShift += 100;
            doLoop = true;
          }
        }
      }

      if (stoneShift < stoneDiameter)
        stoneShift = stoneDiameter;

      while (recalcStoneShift) {
        recalcStoneShift = false;
        POINTS_ROWS = [];
        p1_last = null;

        maxRows = Math.trunc((Math.min(minX, maxX) * 2) / stoneShift);// + 1;
        that.calc.stone[stoneGroupIndex].maxRow = maxRows;
        if (numRows > maxRows) {
          Log("info", "max Steinanzahl angepasst:" + maxRows);
          numRows = stoneGroup.count = maxRows;
        }

        let shiftPoints = ((numRows - 1) * stoneShift) / 2;

        i_l = POINTS.length;
        for (i = 0; i < i_l;) {
          p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
          POINTS_ROWS.push(p1);
          for (let j = 0; j < numRows - 1; j++) {
            p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
            // Abstand zum vorherigen p1...
            if (p1_last) {
              u = p2.x - p1_last.x;
              v = p2.y - p1_last.y;
              d = Math.sqrt(u * u + v * v);
              if (d < stoneDiameter) {
                stoneShift += 100;
                recalcStoneShift = true;
                break;
              }
            }
            // Abstand zum nächsten p1...
            let inc = (i === 0 && i_l % 2 !== 0) ? 1 : 2;
            if (i < i_l - inc) {
              u = p2.x - POINTS[i + inc].x - shiftPoints;
              v = p2.y - POINTS[i + inc].y;
              d = Math.sqrt(u * u + v * v);
              if (d < stoneDiameter) {
                stoneShift += 100;
                recalcStoneShift = true;
                break;
              }
            }
            POINTS_ROWS.push(p2);
            p1_last = p1;
          }
          if (recalcStoneShift)
            break;
          if (i === 0 && i_l % 2 !== 0) i++;
          else i += 2;
        }
        i = (i_l % 2 === 0) ? 1 : 2;
        for (i; i < i_l; i += 2) {
          p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
          POINTS_ROWS.push(p1);
          for (let j = 0; j < numRows - 1; j++) {
            p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
            POINTS_ROWS.push(p2);
          }
        }
      }

      POINTS = POINTS_ROWS;

      // nochmal sortieren
      POINTS.sort(function (a, b): number {
        return (a.y - b.y);
      })
    }

    let testStoneSizeForRingHeight = true;
    POINTS.forEach(e => {
      if (!testStoneSizeRingHeight(e))
        testStoneSizeForRingHeight = false;
    });

    if (!testStoneSizeForRingHeight) {
      continue;
    }


    // berechne Geometriedaten...
    let p = [] as iXY[];
    // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
    POINTS.forEach(function (e) {
      if (e.y < 0) {
        let result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half, -1)
        // let result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, -1)
        result.y -= that.ringData.ringSize;
        p.push(result);
        p.push({x: e.x, y: e.y});
        result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half, 1)
        // result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, 1)
        result.y -= that.ringData.ringSize;
        p.push(result);
      } else {
        p.push(getPoint(e.x, e.y, stoneSizeY_half, -1));
        // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
        p.push({x: e.x, y: e.y});
        p.push(getPoint(e.x, e.y, stoneSizeY_half, 1));
        // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
      }
    })

    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;

    p.forEach(function (e) {
      v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x, e.y, cRing.interpolate(e.x, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);

      vertexRows.push(vertexRow);
      vertexRow = [];
    })

    let stoneHelperMesh = new CMesh;
    stoneHelperMesh.rows = vertexRows;

    stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

    // out.push({
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
          if (i == 1) {
            row[j - 1].toRef(v1); // Stein war falsch gedreht
            // row[j].toRef(v1);
            row[j + 1].toRef(v2);
          } else if (i == i_l - 2) {
            row[j - 1].toRef(v1);
            row[j].toRef(v2);
          } else {
            row[j - 1].toRef(v1);
            row[j + 1].toRef(v2);
          }

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

    that.profile.stonePaths.push(stonePathVectors);

    let vertexFront_start: CVertex | null = null;
    let vertexFront_end: CVertex | null = null;

    let channelSizeY_half = stoneSizeY_half * 0.88; // 12% kleiner als Stein: Ticket 1046

    let computeCrossChannelFront = function () {
      let vertexRows = [] as CVertex[][];
      let vertexRow = [] as CVertex[];
      let index = 0;
      let v: CVertex;
      let slv = that.profile.stepLeftVertices;
      let srv = that.profile.stepRightVertices;
      let fv = that.profile.frontVertices;
      let bv = that.profile.backVertices;
      let cv = that.profile.channelVertices;

      let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
      // let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor : stoneSize * 0.5;

      let xStart = -that.ringData.ringWidth / 2;
      for (let x = -that.ringData.ringWidth / 2; x < 0; x++) {
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
      fv = that.profile.frontVertices;

      xStart = -that.ringData.ringWidth / 2;
      for (let x = -that.ringData.ringWidth / 2; x < 0; x++) {
        let ip_back = cRing.interpolate(x, bv, that.profile.middleVertexBack[0]);
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
          if (x == xEnd)
            break;
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
      let cv = that.profile.channelVertices;
      let bv = that.profile.backVertices;
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
      if (vertexFront_end && vertexFront_end.z > bv[bv.length - 1].z) {
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

      let slv = that.profile.stepLeftVertices;
      let srv = that.profile.stepRightVertices;
      let fv = that.profile.frontVertices;
      let bv = that.profile.backVertices;
      let commonZ = bv[that.profile.middleVertexBack[0]].z;
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
  }
}

test = [35]; // Spannring, nur Brillant gültig
if (test.indexOf(stoneGroup.mode) !== -1) {
  let stoneMode = findStoneMode(stoneGroup.mode);
  let stoneType = getStoneTypeItem(stoneGroup.type);

  if (!stoneMode || !stoneType)
    return;

  let loopStoneSize = true;
  let loopStoneSizeCount = 50;

  while (loopStoneSize && loopStoneSizeCount-- > 0) {
    loopStoneSize = false;

    let stoneSize = stoneGroup.size;
    let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);

    if (stoneSizeItem) {
      let x = stoneSizeItem.size, y;
      if (stoneSizeItem.lengthFactor) {
        y = x * stoneSizeItem.lengthFactor;
        stoneSize = Math.sqrt(x * x + y * y);
      } else if (stoneSizeItem.calcSize) {
        stoneSize = stoneSizeItem.calcSize;
      }
      // else: ...Fallback zur stoneSize wurde oben schon definiert...

    }

    let ringRadiusInner = innerCircumference / Math.PI / 2,
      ringRadiusOuter = ringRadiusInner + that.ringData.ringHeight,
      ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
      // stoneSizeX_safe = stoneSize + stoneMode.safeDistX,
      stoneSizeX_half = stoneSize / 2,
      // stoneSizeY_safe = (stoneSize + stoneMode.safeDistY) * ringRadiusFactor,
      stoneSizeY = stoneSize * ringRadiusFactor,
      stoneSizeY_half = stoneSizeY / 2,
      channelSizeY_half = stoneSizeY_half * 0.88
      // stoneSizeY_half_safe = stoneSizeY_safe / 2,
      // distributionY = stoneSizeY_safe,
      // stoneCount = stoneGroup.count,
      // height = that.ringData.ringSize,
      // yCenter = height / 2,
      // heightFactor = 1.0,
      // maxY: number,

      // amp = that.ringData.waveAmp / 100,
      // amp100 = that.calc.amp100,

      // stoneSafeLeft = -xCenter + that.calc.stoneSafeLeft,
      // stoneSafeRight = xCenter - that.calc.stoneSafeRight,
      //
      // maxStoneCount = 0
    ;

    /*
            ermittle
            den
            nächsten
            Y - Wert
            im
            Abstand
            von
            'distance';
            'inc'
            kann
            positiv
            oder
            negativ
            sein
            */
    // let debug_getPoint = false;
    let getPoint = function (curX: number, curY: number, distance: number, inc: number, testY: boolean = false): iXY {
      if (inc < 0) distance = -distance;
      return {x: curX, y: curY + distance};
      // let result = {x: 0, y: 0}, x, y = curY, u, v, d = 0;
      // let orig_x = get_sin(curY, height, 1);
      // let offset = curX - orig_x;
      //
      // if (testY)
      // {
      //   y = curY + distance;
      //   result.x = get_sin(y, height, 1);
      //   result.y = y;
      //   return result;
      // }
      //
      // while (1)
      // {
      //   y += inc;
      //   x = get_sin(y, height, 1);
      //   u = x - curX + offset;
      //   v = y - curY;
      //   d = Math.sqrt(u * u + v * v);
      //   if (d >= distance)
      //   {
      //     x += offset;
      //     result.x = x;
      //     result.y = y;
      //     break;
      //   }
      // }
      //
      // return result;
    }
    //
    // let getMaxStoneCount = function (): number
    // {
    //   let countMax = 1, p = getPoint(0, -maxY, stoneSizeY_half_safe, 1);
    //
    //   while (1)
    //   {
    //     p = getPoint(p.x, p.y, distributionY, 1);
    //     if (p.y > maxY)
    //       break;
    //
    //     if (p.x - stoneSizeX_half < stoneSafeLeft || p.x + stoneSizeX_half > stoneSafeRight) // Begrenzung der Steinverteilung am "Rand"
    //     {
    //       console.log(p.x, stoneSizeX_half, stoneSafeLeft, stoneSafeRight, distributionY);
    //       break;
    //     }
    //
    //     countMax++;
    //   }
    //
    //   return countMax;
    // }
    //
    // let loop = 0;
    // while (loop++ < 2) // 2 Durchläufe sind hier notwendig weil sich innerhalb dieser Schleife die Verteilung ändern kann
    // {
    //   distributionY = stoneSizeY_safe;
    //
    //   switch (stoneGroup.distribution)
    //   {
    //     case 0: // aneinander
    //       break;
    //     case 5: // halber Steinabstand
    //       distributionY *= 1.5;
    //       break;
    //     case 10: // ganzer Steinabstand
    //       distributionY *= 2.0;
    //       break;
    //     case 20: // doppelter Steinabstand
    //       distributionY *= 3.0;
    //       break;
    //     case 33: // drittel Ring
    //       heightFactor = 0.33;
    //       break;
    //     case 50: // halber Ring
    //       heightFactor = 0.5;
    //       break;
    //     case 100: // ganzer Ring
    //       heightFactor = 1.0;
    //       break;
    //   }
    //
    //   maxY = yCenter * heightFactor;
    //
    //   // if (stoneGroup.distribution == 100)
    //   // {
    //   //   maxY -= stoneSizeY / 2;
    //   // }
    //
    //   maxStoneCount = getMaxStoneCount();
    //
    //   if (stoneGroup.distribution >= 33 && stoneGroup.count < 0)
    //     stoneGroup.count = stoneCount = maxStoneCount;
    //
    //   if (stoneGroup.count < 0)
    //   {
    //     switch (stoneGroup.count)
    //     {
    //       case -33.339:
    //         stoneCount = Math.trunc(maxStoneCount / 3);
    //         break;
    //       case -50:
    //         stoneCount = Math.trunc(maxStoneCount / 2);
    //         break;
    //       case -100:
    //         stoneCount = maxStoneCount;
    //         stoneGroup.distribution = 100;
    //         break;
    //     }
    //   }
    //
    //   if (stoneCount > maxStoneCount)
    //     stoneCount = maxStoneCount;
    //
    //   if (stoneGroup.mode === 20)
    //   {
    //     if (stoneCount === maxStoneCount)
    //       stoneGroup.distribution = 100;
    //     else
    //       stoneGroup.distribution = 0;
    //   }
    //   else
    //   {
    //     stoneGroup.rows = 1;
    //   }
    // }
    //
    // that.calc.stone[stoneGroupIndex].maxCount = maxStoneCount;
    //
    // let loopDistribution = true;

    interface iXY {
      x: number;
      y: number;
    }

    let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine

    let testStoneSizeRingHeight_doLoopStoneSize = true;

    let testStoneSizeRingHeight = function (position: iXY, safeDistance = 1000): boolean {
      let stoneType = getStoneTypeItem(stoneGroup.type);
      if (stoneType) {
        let sizeLeft, sizeRight;

        if (stoneGroup.mode == 20 || stoneGroup.mode == 30) {
          let interpolationFront = cRing.interpolate(position.x - stoneSize / 2, that.profile.frontVertices);
          let interpolationBack = cRing.interpolate(position.x - stoneSize / 2, that.profile.backVertices);

          sizeLeft = -(interpolationFront.z - interpolationBack.z) - safeDistance;

          interpolationFront = cRing.interpolate(position.x + stoneSize / 2, that.profile.frontVertices);
          interpolationBack = cRing.interpolate(position.x + stoneSize / 2, that.profile.backVertices);

          sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
        } else {
          let interpolationFront = cRing.interpolate(position.x, that.profile.frontVertices);
          let interpolationBack = cRing.interpolate(position.x, that.profile.backVertices);

          sizeLeft = sizeRight = -(interpolationFront.z - interpolationBack.z);// - safeDistance;
        }

        let maxStoneSize = Math.min(sizeLeft, sizeRight) / stoneType.sizeDepthFactor;

        if (stoneGroup.size > maxStoneSize) {
          if (testStoneSizeRingHeight_doLoopStoneSize) {
            stoneGroup.size = getLowerStoneSize(stoneGroup.type, maxStoneSize);
            that.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
            loopStoneSize = true;
            Log("info", "Die Steingröße wurde angepasst (0x6)");
          }
          return false;
        }
      }
      return true;
    }

    POINTS = [{x: 0, y: 0}];
    testStoneSizeRingHeight(POINTS[0]);

    if (stoneGroup.count > 1) {
      let minX = 100000,
        maxX = -100000,
        i,
        i_l = POINTS.length / 2,
        i1 = 0,
        p1,
        p1_last: iXY | null = null,
        i2 = (POINTS.length === 2) ? 1 : (POINTS.length % 2 === 0) ? 2 : 1,
        p2,
        u,
        v,
        d,
        stoneShift = stoneSize,//_safe,
        stoneDiameter = stoneSizeY,//_safe,
        recalcStoneShift = true,
        doLoop = true,
        loopCount = 100,
        maxRows = 9999,
        numRows = stoneGroup.count, // verwende den Algorithmus von oben für die horizontale Teilung
        POINTS_ROWS = [] as iXY[],
        safeProfileSideDist = stoneMode.safeProfileSideDist ? stoneMode.safeProfileSideDist : 0;

      for (i = 0; i < i_l; i++) {
        p1 = POINTS[i];
        if (p1.x < minX) minX = p1.x;
        else if (p1.x > maxX) maxX = p1.x;
      }

      minX = -minX;
      minX = that.ringData.ringWidth / 2 - minX - safeProfileSideDist;// - that.calc.stoneSafeLeft;
      maxX = that.ringData.ringWidth / 2 - maxX - safeProfileSideDist;// - that.calc.stoneSafeRight;

      if (POINTS.length > 1) {
        p1 = POINTS[i1];
        p2 = POINTS[i2];
        v = p2.y - p1.y;

        while (doLoop && loopCount-- > 0) {
          doLoop = false;
          u = p1.x + stoneShift - p2.x;
          d = Math.sqrt(u * u + v * v);
          if (d < stoneDiameter) {
            stoneShift += 100;
            doLoop = true;
          }
        }
      }

      if (stoneShift < stoneDiameter)
        stoneShift = stoneDiameter;

      while (recalcStoneShift) {
        recalcStoneShift = false;
        POINTS_ROWS = [];
        p1_last = null;

        maxRows = Math.trunc((Math.min(minX, maxX) * 2 - stoneDiameter) / stoneShift) + 1;
        that.calc.stone[stoneGroupIndex].maxRow = maxRows;
        if (numRows > maxRows) {
          Log("info", "max Steinanzahl angepasst:" + maxRows);
          numRows = stoneGroup.count = maxRows;
        }

        let shiftPoints = ((numRows - 1) * stoneShift) / 2;

        i_l = POINTS.length;
        for (i = 0; i < i_l;) {
          p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
          POINTS_ROWS.push(p1);
          for (let j = 0; j < numRows - 1; j++) {
            p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
            // Abstand zum vorherigen p1...
            if (p1_last) {
              u = p2.x - p1_last.x;
              v = p2.y - p1_last.y;
              d = Math.sqrt(u * u + v * v);
              if (d < stoneDiameter) {
                stoneShift += 100;
                recalcStoneShift = true;
                break;
              }
            }
            // Abstand zum nächsten p1...
            let inc = (i === 0 && i_l % 2 !== 0) ? 1 : 2;
            if (i < i_l - inc) {
              u = p2.x - POINTS[i + inc].x - shiftPoints;
              v = p2.y - POINTS[i + inc].y;
              d = Math.sqrt(u * u + v * v);
              if (d < stoneDiameter) {
                stoneShift += 100;
                recalcStoneShift = true;
                break;
              }
            }
            POINTS_ROWS.push(p2);
            p1_last = p1;
          }
          if (recalcStoneShift)
            break;
          if (i === 0 && i_l % 2 !== 0) i++;
          else i += 2;
        }
        i = (i_l % 2 === 0) ? 1 : 2;
        for (i; i < i_l; i += 2) {
          p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
          POINTS_ROWS.push(p1);
          for (let j = 0; j < numRows - 1; j++) {
            p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
            POINTS_ROWS.push(p2);
          }
        }
      }

      POINTS = POINTS_ROWS;

      // nochmal sortieren
      POINTS.sort(function (a, b): number {
        return (a.y - b.y);
      })
    }

    let testStoneSizeForRingHeight = true;
    POINTS.forEach(e => {
      if (!testStoneSizeRingHeight(e))
        testStoneSizeForRingHeight = false;
    });

    if (!testStoneSizeForRingHeight) {
      continue;
    }


    // berechne Geometriedaten...
    let p = [] as iXY[];
    // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
    POINTS.forEach(function (e) {
      if (e.y < 0) {
        let result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half, -1)
        // let result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, -1)
        result.y -= that.ringData.ringSize;
        p.push(result);
        p.push({x: e.x, y: e.y});
        result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half, 1)
        // result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, 1)
        result.y -= that.ringData.ringSize;
        p.push(result);
      } else {
        p.push(getPoint(e.x, e.y, stoneSizeY_half, -1));
        // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
        p.push({x: e.x, y: e.y});
        p.push(getPoint(e.x, e.y, stoneSizeY_half, 1));
        // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
      }
    })

    let vertexRows = [] as CVertex[][];
    let vertexRow = [] as CVertex[];
    let index = 0;
    let v: CVertex;

    p.forEach(function (e) {
      v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x, e.y, cRing.interpolate(e.x, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);
      v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, that.profile.frontVertices).z);
      v.i = index++;
      vertexRow.push(v);

      vertexRows.push(vertexRow);
      vertexRow = [];
    })

    let stoneHelperMesh = new CMesh;
    stoneHelperMesh.rows = vertexRows;

    stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

    // out.push({
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
          if (i == 1) {
            row[j - 1].toRef(v1); // Stein war falsch gedreht
            // row[j].toRef(v1);
            row[j + 1].toRef(v2);
          } else if (i == i_l - 2) {
            row[j - 1].toRef(v1);
            row[j].toRef(v2);
          } else {
            row[j - 1].toRef(v1);
            row[j + 1].toRef(v2);
          }
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

    that.profile.stonePaths.push(stonePathVectors);

    let vertexFront_start: CVertex | null = null;
    let vertexFront_end: CVertex | null = null;

    let computeCrossChannelFront = function () {
      let vertexRows = [] as CVertex[][];
      let vertexRow = [] as CVertex[];
      let index = 0;
      let v: CVertex;
      let slv = that.profile.stepLeftVertices;
      let srv = that.profile.stepRightVertices;
      let fv = that.profile.frontVertices;
      let bv = that.profile.backVertices;
      let cv = that.profile.channelVertices;

      let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
      // let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor : stoneSize * 0.5;

      let xStart = -that.ringData.ringWidth / 2;
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
      fv = that.profile.frontVertices;

      xStart = -stoneSize / 2 * 0.65; // Brücke unter dem Stein darf max 65% der Steingröße entsprechen
      // xStart = -ringData.ringWidth / 2;
      // for (let x = -ringData.ringWidth / 2; x < 0; x++) {
      //   let ip_back = cRing.interpolate(x, bv, that.middleVertexBack[0]);
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
      let cv = that.profile.channelVertices;
      let bv = that.profile.backVertices;
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

      let slv = that.profile.stepLeftVertices;
      let srv = that.profile.stepRightVertices;
      let fv = that.profile.frontVertices;
      let bv = that.profile.backVertices;
      let commonZ = bv[that.profile.middleVertexBack[0]].z;
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
  }
}

/*
                test = [36]; // Spannring schräg, nur Brillant gültig
                if (test.indexOf(stoneGroup.mode) !== -1) {
                  let stoneMode = findStoneMode(stoneGroup.mode);
                  let stoneType = getStoneTypeItem(stoneGroup.type);

                  if (!stoneMode || !stoneType)
                    return;

                  let loopStoneSize = true;
                  let loopStoneSizeCount = 50;

                  while (loopStoneSize && loopStoneSizeCount-- > 0) {
                    loopStoneSize = false;

                    let stoneSize = stoneGroup.size;
                    let stoneSizeItem = getStoneSizeItem(stoneGroup.type, stoneGroup.size);

                    if (stoneSizeItem) {
                      let x = stoneSizeItem.size, y;
                      if (stoneSizeItem.lengthFactor) {
                        y = x * stoneSizeItem.lengthFactor;
                        stoneSize = Math.sqrt(x * x + y * y);
                      } else if (stoneSizeItem.calcSize) {
                        stoneSize = stoneSizeItem.calcSize;
                      }
                      // else: ...Fallback zur stoneSize wurde oben schon definiert...

                    }

                    let ringRadiusInner = innerCircumference / Math.PI / 2,
                      ringRadiusOuter = ringRadiusInner + that.ringData.ringHeight,
                      ringRadiusFactor = ringRadiusOuter / ringRadiusInner,
                      // ringRadiusFactor = ringRadiusInner / ringRadiusOuter,
                      // stoneSizeX_safe = stoneSize + stoneMode.safeDistX,
                      stoneSizeX_half = stoneSize / 2,
                      // stoneSizeY_safe = (stoneSize + stoneMode.safeDistY) * ringRadiusFactor,
                      stoneSizeY = stoneSize * ringRadiusFactor,
                      stoneSizeY_half = stoneSizeY / 2,
                      channelSizeY_half = stoneSizeY_half * 0.88
                      // stoneSizeY_half_safe = stoneSizeY_safe / 2,
                      // distributionY = stoneSizeY_safe,
                      // stoneCount = stoneGroup.count,
                      // height = that.ringData.ringSize,
                      // yCenter = height / 2,
                      // heightFactor = 1.0,
                      // maxY: number,

                      // amp = that.ringData.waveAmp / 100,
                      // amp100 = that.calc.amp100,

                      // stoneSafeLeft = -xCenter + that.calc.stoneSafeLeft,
                      // stoneSafeRight = xCenter - that.calc.stoneSafeRight,
                      //
                      // maxStoneCount = 0
                    ;

                    // ermittle den nächsten Y - Wert im Abstand von 'distance'; 'inc' kann positiv oder negativ sein
                    let getPoint = function (curX: number, curY: number, distance: number, inc: number, testY: boolean = false): iXY {
                      if (inc < 0) distance = -distance;
                      return {x: curX, y: curY + distance};
                      // let result = {x: 0, y: 0}, x, y = curY, u, v, d = 0;
                      // let orig_x = get_sin(curY, height, 1);
                      // let offset = curX - orig_x;
                      //
                      // if (testY)
                      // {
                      //   y = curY + distance;
                      //   result.x = get_sin(y, height, 1);
                      //   result.y = y;
                      //   return result;
                      // }
                      //
                      // while (1)
                      // {
                      //   y += inc;
                      //   x = get_sin(y, height, 1);
                      //   u = x - curX + offset;
                      //   v = y - curY;
                      //   d = Math.sqrt(u * u + v * v);
                      //   if (d >= distance)
                      //   {
                      //     x += offset;
                      //     result.x = x;
                      //     result.y = y;
                      //     break;
                      //   }
                      // }
                      //
                      // return result;
                    }

                    interface iXY {
                      x: number;
                      y: number;
                    }

                    let POINTS = [] as iXY[]; // Die Mittelpunktkoordinaten der einzelnen Steine

                    let testStoneSizeRingHeight_doLoopStoneSize = true;

                    let testStoneSizeRingHeight = function (position: iXY, safeDistance = 1000): boolean {
                      let stoneType = getStoneTypeItem(stoneGroup.type);
                      if (stoneType) {
                        let sizeLeft, sizeRight;

                        if (stoneGroup.mode == 20 || stoneGroup.mode == 30) {
                          let interpolationFront = cRing.interpolate(position.x - stoneSize / 2, that.profile.frontVertices);
                          let interpolationBack = cRing.interpolate(position.x - stoneSize / 2, that.profile.backVertices);

                          sizeLeft = -(interpolationFront.z - interpolationBack.z) - safeDistance;

                          interpolationFront = cRing.interpolate(position.x + stoneSize / 2, that.profile.frontVertices);
                          interpolationBack = cRing.interpolate(position.x + stoneSize / 2, that.profile.backVertices);

                          sizeRight = -(interpolationFront.z - interpolationBack.z) - safeDistance;
                        } else {
                          let interpolationFront = cRing.interpolate(position.x, that.profile.frontVertices);
                          let interpolationBack = cRing.interpolate(position.x, that.profile.backVertices);

                          sizeLeft = sizeRight = -(interpolationFront.z - interpolationBack.z);// - safeDistance;
                        }

                        let maxStoneSize = Math.min(sizeLeft, sizeRight) / stoneType.sizeDepthFactor;

                        if (stoneGroup.size > maxStoneSize) {
                          if (testStoneSizeRingHeight_doLoopStoneSize) {
                            stoneGroup.size = getLowerStoneSize(stoneGroup.type, maxStoneSize);
                            that.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;
                            loopStoneSize = true;
                            Log("info", "Die Steingröße wurde angepasst (0x6)");
                          }
                          return false;
                        }
                      }
                      return true;
                    }

                    POINTS = [{x: 0, y: 0}];
                    testStoneSizeRingHeight(POINTS[0]);

                    if (stoneGroup.count > 1) {
                      let minX = 100000,
                        maxX = -100000,
                        i,
                        i_l = POINTS.length / 2,
                        i1 = 0,
                        p1,
                        p1_last: iXY | null = null,
                        i2 = (POINTS.length === 2) ? 1 : (POINTS.length % 2 === 0) ? 2 : 1,
                        p2,
                        u,
                        v,
                        d,
                        stoneShift = stoneSize,//_safe,
                        stoneDiameter = stoneSizeY,//_safe,
                        recalcStoneShift = true,
                        doLoop = true,
                        loopCount = 100,
                        maxRows = 9999,
                        numRows = stoneGroup.count, // verwende den Algorithmus von oben für die horizontale Teilung
                        POINTS_ROWS = [] as iXY[],
                        safeProfileSideDist = stoneMode.safeProfileSideDist ? stoneMode.safeProfileSideDist : 0;

                      for (i = 0; i < i_l; i++) {
                        p1 = POINTS[i];
                        if (p1.x < minX) minX = p1.x;
                        else if (p1.x > maxX) maxX = p1.x;
                      }

                      minX = -minX;
                      minX = that.ringData.ringWidth / 2 - minX - safeProfileSideDist;// - that.calc.stoneSafeLeft;
                      maxX = that.ringData.ringWidth / 2 - maxX - safeProfileSideDist;// - that.calc.stoneSafeRight;

                      if (POINTS.length > 1) {
                        p1 = POINTS[i1];
                        p2 = POINTS[i2];
                        v = p2.y - p1.y;

                        while (doLoop && loopCount-- > 0) {
                          doLoop = false;
                          u = p1.x + stoneShift - p2.x;
                          d = Math.sqrt(u * u + v * v);
                          if (d < stoneDiameter) {
                            stoneShift += 100;
                            doLoop = true;
                          }
                        }
                      }

                      if (stoneShift < stoneDiameter)
                        stoneShift = stoneDiameter;

                      while (recalcStoneShift) {
                        recalcStoneShift = false;
                        POINTS_ROWS = [];
                        p1_last = null;

                        maxRows = Math.trunc((Math.min(minX, maxX) * 2 - stoneDiameter) / stoneShift) + 1;
                        that.calc.stone[stoneGroupIndex].maxRow = maxRows;
                        if (numRows > maxRows) {
                          Log("info", "max Steinanzahl angepasst:" + maxRows);
                          numRows = stoneGroup.count = maxRows;
                        }

                        let shiftPoints = ((numRows - 1) * stoneShift) / 2;

                        i_l = POINTS.length;
                        for (i = 0; i < i_l;) {
                          p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
                          POINTS_ROWS.push(p1);
                          for (let j = 0; j < numRows - 1; j++) {
                            p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
                            // Abstand zum vorherigen p1...
                            if (p1_last) {
                              u = p2.x - p1_last.x;
                              v = p2.y - p1_last.y;
                              d = Math.sqrt(u * u + v * v);
                              if (d < stoneDiameter) {
                                stoneShift += 100;
                                recalcStoneShift = true;
                                break;
                              }
                            }
                            // Abstand zum nächsten p1...
                            let inc = (i === 0 && i_l % 2 !== 0) ? 1 : 2;
                            if (i < i_l - inc) {
                              u = p2.x - POINTS[i + inc].x - shiftPoints;
                              v = p2.y - POINTS[i + inc].y;
                              d = Math.sqrt(u * u + v * v);
                              if (d < stoneDiameter) {
                                stoneShift += 100;
                                recalcStoneShift = true;
                                break;
                              }
                            }
                            POINTS_ROWS.push(p2);
                            p1_last = p1;
                          }
                          if (recalcStoneShift)
                            break;
                          if (i === 0 && i_l % 2 !== 0) i++;
                          else i += 2;
                        }
                        i = (i_l % 2 === 0) ? 1 : 2;
                        for (i; i < i_l; i += 2) {
                          p1 = {x: POINTS[i].x - shiftPoints, y: POINTS[i].y};
                          POINTS_ROWS.push(p1);
                          for (let j = 0; j < numRows - 1; j++) {
                            p2 = {x: p1.x + (j + 1) * stoneShift, y: p1.y};
                            POINTS_ROWS.push(p2);
                          }
                        }
                      }

                      POINTS = POINTS_ROWS;

                      // nochmal sortieren
                      POINTS.sort(function (a, b): number {
                        return (a.y - b.y);
                      })
                    }

                    let testStoneSizeForRingHeight = true;
                    POINTS.forEach(e => {
                      if (!testStoneSizeRingHeight(e))
                        testStoneSizeForRingHeight = false;
                    });

                    if (!testStoneSizeForRingHeight) {
                      continue;
                    }


                    // berechne Geometriedaten...
                    let p = [] as iXY[];
                    // p sind hier die untere Kante, Mittelpunkt und obere Kante der Steine
                    POINTS.forEach(function (e) {
                      if (e.y < 0) {
                        let result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half, -1)
                        // let result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, -1)
                        result.y -= that.ringData.ringSize;
                        p.push(result);
                        p.push({x: e.x, y: e.y});
                        result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half, 1)
                        // result = getPoint(e.x, e.y + that.ringData.ringSize, stoneSizeY_half_safe, 1)
                        result.y -= that.ringData.ringSize;
                        p.push(result);
                      } else {
                        p.push(getPoint(e.x, e.y, stoneSizeY_half, -1));
                        // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, -1));
                        p.push({x: e.x, y: e.y});
                        p.push(getPoint(e.x, e.y, stoneSizeY_half, 1));
                        // p.push(getPoint(e.x, e.y, stoneSizeY_half_safe, 1));
                      }
                    })

                    let vertexRows = [] as CVertex[][];
                    let vertexRow = [] as CVertex[];
                    let index = 0;
                    let v: CVertex;

                    p.forEach(function (e) {
                      v = new CVertex(e.x - stoneSizeX_half, e.y, cRing.interpolate(e.x - stoneSizeX_half, that.profile.frontVertices).z);
                      v.i = index++;
                      vertexRow.push(v);
                      v = new CVertex(e.x, e.y, cRing.interpolate(e.x, that.profile.frontVertices).z);
                      v.i = index++;
                      vertexRow.push(v);
                      v = new CVertex(e.x + stoneSizeX_half, e.y, cRing.interpolate(e.x + stoneSizeX_half, that.profile.frontVertices).z);
                      v.i = index++;
                      vertexRow.push(v);

                      vertexRows.push(vertexRow);
                      vertexRow = [];
                    })

                    let stoneHelperMesh = new CMesh;
                    stoneHelperMesh.rows = vertexRows;

                    stoneHelperMesh.rotateRows(ringRadiusInner, thetaExtra);

                    // out.push({
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
                          if (i == 1) {
                            row[j - 1].toRef(v1); // Stein war falsch gedreht
                            // row[j].toRef(v1);
                            row[j + 1].toRef(v2);
                          } else if (i == i_l - 2) {
                            row[j - 1].toRef(v1);
                            row[j].toRef(v2);
                          } else {
                            row[j - 1].toRef(v1);
                            row[j + 1].toRef(v2);
                          }
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

                    that.profile.stonePaths.push(stonePathVectors);

                    let vertexFront_start: CVertex | null = null;
                    let vertexFront_end: CVertex | null = null;

                    let alpha = 45, beta = 90 - alpha;
                    let getDistanceY = function (x: number): number {
                      return Math.sin(alpha * Math.PI / 180) * x / Math.sin(beta * Math.PI / 180);
                    }
                    let channelSizeY_rot = channelSizeY_half / Math.sin(beta * Math.PI / 180);

                    let computeCrossChannelFront = function () {
                      let vertexRows = [] as CVertex[][];
                      let vertexRow = [] as CVertex[];
                      let index = 0;
                      let v: CVertex;
                      let slv = that.profile.stepLeftVertices;
                      let srv = that.profile.stepRightVertices;
                      let fv = that.profile.frontVertices;
                      let bv = that.profile.backVertices;
                      let cv = that.profile.channelVertices;

                      let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor * 0.7 : stoneSize * 0.7; // wieder auf Werte der V1 gesetzt am 11.03.2023
                      // let depth = stoneType ? stoneSize * stoneType.sizeDepthFactor : stoneSize * 0.5;

                      let xStart = -that.ringData.ringWidth / 2;
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

                      // if (fv[0].x > bv[0].x) fv = bv;

                      // mesh für alpha
                      for (let y = -channelSizeY_rot; y <= channelSizeY_rot; y += channelSizeY_rot * 2) {
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
                            v = new CVertex(x, getDistanceY(x), ip.z);
                            v.y += y;
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
                          v = new CVertex(x, getDistanceY(x) + y, ip.z);

                          let outerRadius = ringRadiusInner + ip.z;
                          let factor = outerRadius / ringRadiusInner;
                          v.y *= factor;
                          // let radiusFactor = ringRadiusInner / (ringRadiusInner - ip.z);
                          // v.y /= radiusFactor;

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
                            v = new CVertex(x, getDistanceY(x), ip.z);
                            v.y += y;
                            v.i = index++;
                            v.u = ip.uv_u;
                            v.v = v.y;
                            vertexRow.push(v);
                            if (x == xEnd) break;
                          }
                        }

                        let v0 = vertexRow[0];
                        let v1 = vertexRow[1];
                        v0.u -= v1.u - v0.u;
                        v0.y -= v1.y - v0.y;
                        v0 = vertexRow[vertexRow.length - 1];
                        v1 = vertexRow[vertexRow.length - 2];
                        v0.u += v0.u - v1.u;
                        v0.y += v0.y - v1.y;
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
                      fv = that.profile.frontVertices;

                      let arY = [-channelSizeY_rot, 0, channelSizeY_rot];
                      let arX = [], arXe = [];
                      v = new CVertex(-stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);
                      v.x = -stoneSize * 0.65 / 2;
                      v.y = 0;
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);
                      v.x = -stoneSize * 0.65 / 2;
                      v.y = stoneSize * 0.88 / 2;
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);

                      v = new CVertex(stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
                      v.rotateZ(alpha * Math.PI / 180);
                      arXe.push(v.x);
                      v.x = stoneSize * 0.65 / 2;
                      v.y = 0;
                      v.rotateZ(alpha * Math.PI / 180);
                      arXe.push(v.x);
                      v.x = stoneSize * 0.65 / 2;
                      v.y = stoneSize * 0.88 / 2;
                      v.rotateZ(alpha * Math.PI / 180);
                      arXe.push(v.x);

                      for (let i = 0; i < 3; i++) {
                        let x = arX[i];
                        let y = arY[i];

                        let ip_back = cRing.interpolate(x, bv);
                        v = new CVertex(x, getDistanceY(x) + y, ip_back.z);
                        v.i = index++;
                        v.u = ip_back.uv_u;
                        v.v = v.y;
                        vertexRow.push(v);

                        let make_double = true;

                        let count = 0;
                        while (count++ < 100) {
                          let ip_channel = cRing.interpolate(x, cv);
                          v = new CVertex(x, getDistanceY(x) + y, ip_channel.z + depth);
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
                          if (x == arXe[i])
                            break;
                          x = cv[ip_channel.indexVectorB].x;
                          if (x > arXe[i] - 100)
                            x = arXe[i];
                        }

                        v = CVertex.fromVertex(v);
                        v.i = index++;
                        vertexRow.push(v);

                        ip_back = cRing.interpolate(x, bv);
                        v = new CVertex(x, getDistanceY(x) + y, ip_back.z);
                        v.i = index++;
                        v.u = ip_back.uv_u;
                        v.v = v.y;
                        vertexRow.push(v);

                        vertexRows.push(vertexRow);
                        vertexRow = [];
                      }

                      vertexArray.push({
                        vertex2DArray: vertexRows,
                        type: "crossChannelFront",
                        index: -1,
                        triangulate_isFrontFace: true,
                        triangulate_useVectorDist: true,
                        no_outline: true,
                        close_normals: false,
                      });
                      //
                      // vertexFront_start = CVertex.fromVertex(vertexRows[0][0]);
                      // vertexFront_end = CVertex.fromVertex(vertexRows[0][vertexRows[0].length - 1]);
                    }

                    let computeCrossChannelBack = function () {
                      let vertexRows = [] as CVertex[][];
                      let vertexRow = [] as CVertex[];
                      let index = 0;
                      let v: CVertex;
                      let v2: CVertex;
                      let fv = that.profile.frontVertices;
                      let cv = that.profile.channelVertices;
                      let bv = that.profile.backVertices;
                      let ip;

                      let xStart = -that.ringData.ringWidth / 2;

                      let arY = [-channelSizeY_rot, 0, channelSizeY_rot];
                      let arX = [];
                      v = new CVertex(-stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);
                      v.x = -stoneSize * 0.65 / 2;
                      v.y = 0;
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);
                      v.x = -stoneSize * 0.65 / 2;
                      v.y = stoneSize * 0.88 / 2;
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);

                      //let vertexCount = Math.trunc(that.ringData.ringWidth / 2 / 100);
                      let numVertices = [
                        cRing.interpolate(arX[0], bv).indexVectorB,
                        cRing.interpolate(arX[1], bv).indexVectorB,
                        cRing.interpolate(arX[2], bv).indexVectorB];
                      let vertexCount = Math.max(numVertices[0], numVertices[1], numVertices[1]);

                      // mesh für alpha links
                      for (let iY = 0; iY < 3; iY++) {
                        let y = arY[iY];
                        let xStep = Math.abs((xStart - arX[iY]) / (vertexCount - 1));
                        let x = xStart;
                        for (let i = 0; i < vertexCount; i++) {
                          let ip = cRing.interpolate(x, bv);
                          v = new CVertex(x, getDistanceY(x) + y, ip.z);

                          let outerRadius = ringRadiusInner + ip.z;
                          let factor = outerRadius / ringRadiusInner;
                          v.y *= factor;

                          v.i = index++;
                          v.u = ip.uv_u;
                          // v.v = v.y;
                          vertexRow.push(v);
                          x += xStep;
                        }
                        vertexRow[0].u = 0;
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

                      // mesh für alpha rechts
                      arX = [];
                      v = new CVertex(stoneSize * 0.65 / 2, -stoneSize * 0.88 / 2, 0);
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);
                      v.x = stoneSize * 0.65 / 2;
                      v.y = 0;
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);
                      v.x = stoneSize * 0.65 / 2;
                      v.y = stoneSize * 0.88 / 2;
                      v.rotateZ(alpha * Math.PI / 180);
                      arX.push(v.x);
                      vertexRows = [];
                      vertexRow = [];
                      index = 0;
                      for (let iY = 0; iY < 3; iY++) {
                        let y = arY[iY];
                        let xStep = Math.abs((-xStart - arX[iY]) / (vertexCount - 1));
                        let x = arX[iY];
                        for (let i = 0; i < vertexCount; i++) {
                          let ip = cRing.interpolate(x, bv);
                          v = new CVertex(x, getDistanceY(x) + y, ip.z);

                          let outerRadius = ringRadiusInner + ip.z;
                          let factor = outerRadius / ringRadiusInner;
                          v.y *= factor;

                          v.i = index++;
                          v.u = ip.uv_u;
                          v.v = v.y;
                          vertexRow.push(v);
                          x += xStep;
                        }
                        vertexRow[vertexRow.length - 1].u = 1.0;
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
                    let computeCrossChannelCaps = function () {

                      let slv = that.profile.stepLeftVertices;
                      let srv = that.profile.stepRightVertices;
                      let fv = that.profile.frontVertices;
                      let bv = that.profile.backVertices;
                      let commonZ = bv[that.profile.middleVertexBack[0]].z;
                      let Y = [-channelSizeY_rot, channelSizeY_rot];

                      for (let y = 0; y < 2; y++) {
                        let vertexRows = [] as CVertex[][];
                        let vertexRow = [] as CVertex[];
                        let index = 0;
                        let v: CVertex;

                        // Front
                        for (let i = 0, i_l = slv.length; i < i_l; i++) {
                          v = CVertex.fromVertex(slv[i]);
                          v.y = getDistanceY(v.x) + Y[y];
                          v.v = v.y;
                          v.i = index++;
                          vertexRow.push(v);
                        }
                        for (let i = 0, i_l = fv.length; i < i_l; i++) {
                          v = CVertex.fromVertex(fv[i]);
                          // if (i == 0 && bv[0].x < v.x) v.x = bv[0].x;
                          // else if (i == i_l-1 && bv[bv.length-1].x > v.x) v.x = bv[bv.length-1].x;
                          v.y = getDistanceY(v.x) + Y[y];

                          let outerRadius = ringRadiusInner + v.z;
                          let factor = outerRadius / ringRadiusInner;
                          v.y *= factor;

                          v.v = v.y;
                          v.i = index++;
                          vertexRow.push(v);
                        }
                        for (let i = 0, i_l = srv.length; i < i_l; i++) {
                          v = CVertex.fromVertex(srv[i]);
                          v.y = getDistanceY(v.x) + Y[y];
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
                          v.y = getDistanceY(v.x) + Y[y];

                          let outerRadius = ringRadiusInner + v.z;
                          let factor = outerRadius / ringRadiusInner;
                          v.y *= factor;

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
                          v.y = getDistanceY(v.x) + Y[y];

                          let outerRadius = ringRadiusInner + v.z;
                          let factor = outerRadius / ringRadiusInner;
                          v.y *= factor;

                          v.v = v.y;
                          v.i = index++;
                          vertexRow.push(v);
                        }

                        vertexRows.push(vertexRow);

                        // Trennlinie zwischen Front und Back. Diese ist identisch mit der horizontalen Materialtrennlinie.
                        row_0 = vertexRow;
                        vertexRow = [];

                        for (let i = 0, i_l = row_0.length; i < i_l; i++) {
                          v = new CVertex(row_0[i].x, getDistanceY(row_0[i].x) + Y[y], commonZ);

                          let outerRadius = ringRadiusInner + v.z;
                          let factor = outerRadius / ringRadiusInner;
                          v.y *= factor;

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
                  }
                }
      */

// side
test = [40, 41, 42, 43, 44, 45];
if (test.indexOf(stoneGroup.mode) !== -1) {
  let stoneMode = findStoneMode(stoneGroup.mode);
  if (!stoneMode)
    return;

  let loopStoneSize = true;
  while (loopStoneSize) {
    loopStoneSize = false;

    let stoneType = getStoneTypeItem(stoneGroup.type);
    if (!stoneType)
      return;

    let maxStoneSize = 0;
    let test2 = [40, 42, 44], isLeftSide: boolean = true;
    if (test2.indexOf(stoneGroup.mode) > -1) // links
    {
      maxStoneSize = Math.trunc(that.profile.sideLength[0] - stoneMode.safeDistX * 2);
    } else // rechts
    {
      isLeftSide = false;
      maxStoneSize = Math.trunc(that.profile.sideLength[1] - stoneMode.safeDistX * 2);
    }

    maxStoneSize = getLowerStoneSize(stoneType.id, maxStoneSize, true);

    that.calc.stone[stoneGroupIndex].maxSize = maxStoneSize;

    let stoneSizeX = stoneGroup.size,
      stoneSizeY = 0;

    if (stoneSizeX > maxStoneSize) {
      stoneSizeX = getLowerStoneSize(stoneGroup.type, maxStoneSize, true);
      if (!stoneSizeX) {
        if (stoneGroup.type > 1) {
          stoneGroup.type = 1;
          loopStoneSize = true;
          Log("info", "Die Steinart wurde angepasst");
          continue;
        }

        Log("info", "Keine passende Steingröße vorhanden (" + maxStoneSize + ")");
        RingData.resetStonegroup(that.ringData, stoneGroupIndex);
        stoneGroup.mode = 0;
        return;
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
    let ringSideRadius = (innerCircumference / Math.PI / 2) - that.profile.sideMidpoint[isLeftSide ? 0 : 1].z,
      stoneSizeX_half = stoneSizeX / 2,
      stoneSizeY_half = stoneSizeY / 2,
      stoneSizeY_safe = stoneSizeY + stoneMode.safeDistY,
      stoneCount = stoneGroup.count,
      // distributionRad = (stoneSizeY_safe * Math.PI * 2) / (Math.PI * ringSideRadius * 2),
      maxPI = 0,
      minPI = 0;

    // if (stoneGroup.mode === 42 || stoneGroup.mode == 43)
    //   distributionRad = (stoneSizeY * Math.PI * 2) / (Math.PI * ringSideRadius * 2);

    // => 230205
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

    cRing.position_rectangles(positionRectangle);

    // <= 230205

    interface iXYrad {
      x: number;
      y: number;
      rad: number;
    }

    let POINTS = [] as iXYrad[]; // Die Mittelpunktkoordinaten der einzelnen Steine

    that.calc.stone[stoneGroupIndex].maxCount = positionRectangle.out_maxRectangles;

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
    let X = stoneGroup.mode % 2 === 0 ? that.profile.sideMidpoint[0].x : that.profile.sideMidpoint[1].x;

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
    that.profile.stonePaths.push(stonePathVectors);

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
                Die
                Bevels
                werden
                an
                der
                Nullposition
                erstellt
                und
                beim
                Aufbau
                der
                Scene
                mit
                den
                Steinen
                ausgerichtet
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
        pA = that.profile.backVertices[that.profile.middleVertexBack[0] + 1];
        pB = that.profile.backVertices[that.profile.middleVertexBack[0] - 1];
      } else {
        pA = that.profile.backVertices[that.profile.middleVertexBack[1] - 1];
        pB = that.profile.backVertices[that.profile.middleVertexBack[1] + 1];
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
      // @ts-ignore
      let depth = stoneType.sizeDepthFactor * stoneGroup.size;
      if (X < 0) depth = -depth;
      let uv_u, pA, pB, AZ, ZB, AB, scale;

      if (X < 0) {
        pA = that.profile.backVertices[that.profile.middleVertexBack[0] - 1];
        pB = that.profile.backVertices[that.profile.middleVertexBack[0] + 1];
      } else {
        pA = that.profile.backVertices[that.profile.backVertices.length - 1 - that.profile.middleVertexBack[1] - 1];
        pB = that.profile.backVertices[that.profile.backVertices.length - 1 - that.profile.middleVertexBack[1] + 1];
      }

      let channelSizeX_half = stoneSizeX_half * 0.88; // 12% kleiner als Stein

      while (numRows-- > 0) {
        vertexRow = [];

        y = (cur) * innerCircumference / PI2;

        v = new CVertex(X, y, z - channelSizeX_half);
        // v = new CVertex(X, y, z - stoneSizeX_half);

        AZ = v.z - pA.z;
        ZB = pB.z - v.z;
        AB = pB.z - pA.z;
        scale = AZ / AB;
        uv_u = pA.u + ((pB.u - pA.u) * scale);

        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z - channelSizeX_half);
        // v = new CVertex(X - depth, y, z - stoneSizeX_half);
        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z - channelSizeX_half);
        // v = new CVertex(X - depth, y, z - stoneSizeX_half);
        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);

        v = new CVertex(X - depth, y, z + channelSizeX_half);
        // v = new CVertex(X - depth, y, z + stoneSizeX_half);

        AZ = v.z - pA.z;
        ZB = pB.z - v.z;
        AB = pB.z - pA.z;
        scale = AZ / AB;
        uv_u = pA.u + ((pB.u - pA.u) * scale)

        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X - depth, y, z + channelSizeX_half);
        // v = new CVertex(X - depth, y, z + stoneSizeX_half);
        v.i = index++;
        v.u = uv_u;
        vertexRow.push(v);
        v = new CVertex(X, y, z + channelSizeX_half);
        // v = new CVertex(X, y, z + stoneSizeX_half);
        v.i = index++;
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

    if (stoneGroup.mode === 40 || stoneGroup.mode == 41) // eingerieben
      computeBevels();
    else if (stoneGroup.mode === 42 || stoneGroup.mode == 43) // Kanal
      computeChannel();
    else if (stoneGroup.mode === 44 || stoneGroup.mode == 45) // Verschnitt
      computeCut();
  }
}
