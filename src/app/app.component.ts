import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {lastValueFrom} from 'rxjs';
import packageInfo from '../../package.json';

import {environment} from '../environments/environment';
import {iAppData, iDBSaveItem} from './app.interfaces';
import {RingData} from './app.ringdata';
import {Log} from './logger/logger.component';
import {collectRingScreenshots, createScreenshot} from './webgl/webgl.component';
import {createDefaultPearlingSizes} from './pearling-size';

@Component({
  selector: 'x-app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  host: { 'id': 'ONE' },
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})

export class AppComponent implements OnInit {
  static app: AppComponent;

  state = {
    build: packageInfo.version,
    appDataVersionLabel: "unversioned",
    appDataHash: "",
    configMode: 2,
    ready: false,
    saveLoad: false,
    dbSaveItems: [] as iDBSaveItem[],
    toolsMenu: false,
    ringDetails: false,
    logVisible: false,
    urlParams: {} as Record<string, string>,
    mobile: false,
    debug: false,
    admin: false,
    diamond: false,
    freeStones: false,
    preset_id: "",
    browsertab_id: "",
  };

  log = [] as string[];

  data: iAppData =
    {
      "profile": [
        {
          "name": "P1",
          "wa": {
            "min": 30,
            "max": 50,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "sw": {
            "min": 300,
            "max": 1000,
            "step": 100
          },
          "sd": 300,
          "rhMaxFactor": 0.8,
          "sideGapDistance": 800,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4
        },
        {
          "name": "P2",
          "rw": {
            "min": 2000,
            "max": 12000,
            "step": 500
          },
          "rh": {
            "min": 1300,
            "max": 4000,
            "step": 100
          },
          "rs": {
            "min": 45000,
            "max": 78000,
            "step": 500
          },
          "wa": {
            "min": 30,
            "max": 50,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "sw": {
            "min": 300,
            "max": 1000,
            "step": 100
          },
          "sd": 300,
          "rhMaxFactor": 0.8,
          "sideGapDistance": 500,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4
        },
        {
          "name": "P3",
          "wa": {
            "min": 30,
            "max": 50,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "sw": {
            "min": 300,
            "max": 1000,
            "step": 100
          },
          "sd": 300,
          "rhMaxFactor": 0.8,
          "sideGapDistance": 500,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4
        },
        {
          "name": "P4",
          "wa": {
            "min": 30,
            "max": 50,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "sw": {
            "min": 300,
            "max": 1000,
            "step": 100
          },
          "sd": 300,
          "rhMaxFactor": 0.8,
          "sideGapDistance": 300,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36,
            40,
            41,
            42,
            43,
            44,
            45
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4
        },
        {
          "name": "P5",
          "wa": {
            "min": 30,
            "max": 40,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "rhMaxFactor": 0.8,
          "sideGapDistance": 500,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36,
            40,
            41,
            42,
            43,
            44,
            45
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4,
          "sideCrossChannelDistance": 500
        },
        {
          "name": "P6",
          "wa": {
            "min": 30,
            "max": 50,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "sw": {
            "min": 300,
            "max": 1000,
            "step": 100
          },
          "sd": 300,
          "rhMaxFactor": 0.8,
          "sideGapDistance": 500,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36,
            40,
            41,
            42,
            43,
            44,
            45
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4
        },
        {
          "name": "P7",
          "rw": {
            "min": 3000,
            "max": 12000,
            "step": 500
          },
          "wa": {
            "min": 30,
            "max": 50,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "rhMaxFactor": 0.5,
          "sideGapDistance": 800,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4,
          "sideCrossChannelDistance": 500
        },
        {
          "name": "P11",
          "rh": {
            "min": 1200,
            "max": 4000,
            "step": 100
          },
          "wa": {
            "min": 30,
            "max": 50,
            "step": 10
          },
          "wc": {
            "min": 1,
            "max": 6,
            "step": 1
          },
          "sw": {
            "min": 300,
            "max": 1000,
            "step": 100
          },
          "sd": 300,
          "rhMaxFactor": 0.8,
          "sideGapDistance": 300,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            11,
            20,
            30,
            31,
            35,
            36,
            40,
            41,
            42,
            43,
            44,
            45
          ],
          "maxWaveAmpMultipleWaves": 40,
          "maxWaveCountMultipleWaves": 4
        },
        {
          "name": "P12",
          "rw": {
            "min": 1500,
            "max": 5000,
            "step": 100
          },
          "rh": {
            "min": 1500,
            "max": 5000,
            "step": 100
          },
          "wa": {
            "min": 0,
            "max": 0,
            "step": 0
          },
          "wc": {
            "min": 0,
            "max": 0,
            "step": 0
          },
          "rhMaxFactor": 1,
          "sideGapDistance": 800,
          "gapGapDistance": 300,
          "gapGapDistanceWave": 400,
          "stoneModes": [
            10,
            20,
            30
          ],
          "maxWaveAmpMultipleWaves": 0,
          "maxWaveCountMultipleWaves": 0,
          "syncRwRh": true
        }
      ],
      "ringWidth": {
        "min": 2000,
        "max": 12000,
        "step": 500
      },
      "ringHeight": {
        "min": 1300,
        "max": 3000,
        "step": 100
      },
      "ringSize": {
        "min": 45000,
        "max": 78000,
        "step": 500
      },
      "divPreset": [
        {
          "name": "Einfarbig",
          "img": "div-einfarbig.svg",
          "divPreset": "-:1"
        },
        {
          "name": "Zweifarbig",
          "img": "div-zweifarbig.svg",
          "items": [
            {
              "img": "div-vertical-1-1.svg",
              "divPreset": "-:1:1"
            },
            {
              "img": "div-vertical-1-2.svg",
              "divPreset": "-:1:2"
            },
            {
              "img": "div-vertical-1-3.svg",
              "divPreset": "-:1:3"
            },
            {
              "img": "div-vertical-1-4.svg",
              "divPreset": "-:1:4",
              "rwMin": 2500
            },
            {
              "img": "div-sine-1-1.svg",
              "divPreset": "W:1:1",
              "rwMin": 2500
            },
            {
              "img": "div-diagonal-1-1.svg",
              "divPreset": "D:1:1",
              "rwMin": 2500
            },
            {
              "img": "div-segment-1-1.svg",
              "divPreset": "S:1:1"
            },
            {
              "img": "div-horizontal-1-1.svg",
              "divPreset": "H:1:1",
              "rhMin": 1600,
              "notProfile": [
                "P1",
                "P5"
              ]
            }
          ]
        },
        {
          "name": "Dreifarbig",
          "img": "div-dreifarbig.svg",
          "items": [
            {
              "img": "div-vertical-1-1-1.svg",
              "divPreset": "-:1:1:1"
            },
            {
              "img": "div-vertical-2-1-1.svg",
              "divPreset": "-:2:1:1",
              "rwMin": 2500
            },
            {
              "img": "div-vertical-3-1-1.svg",
              "divPreset": "-:3:1:1",
              "rwMin": 3000
            },
            {
              "img": "div-vertical-4-1-1.svg",
              "divPreset": "-:4:1:1",
              "rwMin": 4000
            },
            {
              "img": "div-vertical-1-2-1.svg",
              "divPreset": "-:1:2:1",
              "rwMin": 2500
            },
            {
              "img": "div-vertical-1-3-1.svg",
              "divPreset": "-:1:3:1",
              "rwMin": 3000
            },
            {
              "img": "div-vertical-1-4-1.svg",
              "divPreset": "-:1:4:1",
              "rwMin": 4000
            },
            {
              "img": "div-vertical-2-1-2.svg",
              "divPreset": "-:2:1:2",
              "rwMin": 3000
            },
            {
              "img": "div-diagonal-1-1-1.svg",
              "divPreset": "D:1:1:1",
              "rwMin": 3000
            },
            {
              "img": "div-diagonal-2-1-2.svg",
              "divPreset": "D:2:1:2",
              "rwMin": 3000
            },
            {
              "img": "div-diagonal-1-2-1.svg",
              "divPreset": "D:1:2:1",
              "rwMin": 3000
            },
            {
              "img": "div-sine-1-1-1.svg",
              "divPreset": "W:1:1:1",
              "rwMin": 3000
            },
            {
              "img": "div-sine-2-1-2.svg",
              "divPreset": "W:2:1:2",
              "rwMin": 3000
            },
            {
              "img": "div-sine-1-2-1.svg",
              "divPreset": "W:1:2:1",
              "rwMin": 3000
            }
          ]
        },
        {
          "name": "Frei",
          "img": "div-frei.svg",
          "items": [
            {
              "img": "div-vertical-frei-1.svg",
              "divPreset": "F:1:1"
            },
            {
              "img": "div-vertical-frei-2.svg",
              "divPreset": "F:1:1:1",
              "rwMin": 2500
            },
            {
              "img": "div-vertical-frei-3.svg",
              "divPreset": "F:1:1:1:1",
              "rwMin": 3000
            },
            {
              "img": "div-vertical-frei-4.svg",
              "divPreset": "F:1:1:1:1:1",
              "rwMin": 3500
            },
            {
              "img": "div-sine-frei-1.svg",
              "divPreset": "WF:1:1",
              "rwMin": 2500
            },
            {
              "img": "div-sine-frei-2.svg",
              "divPreset": "WF:1:1:1",
              "rwMin": 3500
            },
            {
              "img": "div-diagonal-frei-1.svg",
              "divPreset": "DF:1:1",
              "rwMin": 2500
            },
            {
              "img": "div-diagonal-frei-2.svg",
              "divPreset": "DF:1:1:1",
              "rwMin": 2500
            }
          ]
        }
      ],
      "material": [
        {
          "id": 0,
          "name": "Gelbgold",
          "symbol": "Au",
          "fineness": [
            333,
            375,
            585,
            750
          ],
          "color3d": "#f2b04e",
          "colorHtml": "#f2b04e",
          "asfProfileIndex": [
            2,
            6,
            10,
            14
          ],
          "processingFee": [
            10,
            17,
            10,
            10
          ],
          "pricePerGramm": 57,
          "calcFactor": 1.94
        },
        {
          "id": 1,
          "name": "Weißgold",
          "symbol": "Au",
          "fineness": [
            333,
            375,
            585,
            750
          ],
          "color3d": "#c7c7c7",
          "colorHtml": "#c7c7c7",
          "asfProfileIndex": [
            5,
            9,
            13,
            17
          ],
          "processingFee": [
            10,
            17,
            10,
            10
          ],
          "pricePerGramm": 57,
          "calcFactor": 1.94
        },
        {
          "id": 2,
          "name": "Rosegold",
          "symbol": "Au",
          "fineness": [
            333,
            375,
            585,
            750
          ],
          "color3d": "#eb925e",
          "colorHtml": "#eb925e",
          "asfProfileIndex": [
            4,
            8,
            12,
            16
          ],
          "processingFee": [
            10,
            17,
            10,
            10
          ],
          "pricePerGramm": 57,
          "calcFactor": 1.94
        },
        {
          "id": 3,
          "name": "Rotgold",
          "symbol": "Au",
          "fineness": [
            333,
            375,
            585,
            750
          ],
          "color3d": "#d66e49",
          "colorHtml": "#d66e49",
          "asfProfileIndex": [
            3,
            7,
            11,
            15
          ],
          "processingFee": [
            10,
            17,
            10,
            10
          ],
          "pricePerGramm": 57,
          "calcFactor": 1.94
        },
        {
          "id": 4,
          "name": "Platin",
          "symbol": "Pt",
          "fineness": [
            600,
            950
          ],
          "color3d": "#828282",
          "colorHtml": "#828282",
          "asfProfileIndex": [
            20,
            21
          ],
          "processingFee": [
            10,
            11
          ],
          "pricePerGramm": 44,
          "calcFactor": 2.09
        },
        {
          "id": 5,
          "name": "Palladium",
          "symbol": "Pd",
          "fineness": [
            585,
            950
          ],
          "color3d": "#616161",
          "colorHtml": "#616161",
          "asfProfileIndex": [
            18,
            19
          ],
          "processingFee": [
            10,
            15
          ],
          "pricePerGramm": 90,
          "calcFactor": 2.13
        },
        {
          "id": 6,
          "name": "Silber",
          "symbol": "Ag",
          "fineness": [
            925
          ],
          "color3d": "#c7c7c7",
          "colorHtml": "#c7c7c7",
          "asfProfileIndex": [
            5,
            9,
            13,
            17
          ],
          "processingFee": [
            10,
            17,
            10,
            10
          ],
          "pricePerGramm": 57,
          "calcFactor": 1.94
        }
      ],
      "materialExclude": [
        {
          id_a: 1,
          id_b: 4
        },
        {
          id_a: 1,
          id_b: 5
        },
        {
          id_a: 1,
          id_b: 6
        },
        {
          id_a: 5,
          id_b: 6
        }
      ],
      "surface": [
        {
          "id": 0,
          "name": "poliert",
          "img": "icon-poliert.svg",
          "material": {
            "metallic": 1,
            "roughness": 0
          }
        },
        {
          "id": 1,
          "name": "sandmatt fein",
          "img": "icon-sandmatt-fein.svg",
          "material": {
            "file": "tex-sandmatt-fein.jpg",
            "uScale": 0.4,
            "vScale": 0.4,
            "invertX": true,
            "invertY": true,
            "metallic": 1,
            "roughness": 0.3
          }
        },
        {
          "id": 2,
          "name": "sandmatt grob",
          "img": "icon-sandmatt-grob.svg",
          "material": {
            "file": "tex-sandmatt-grob.jpg",
            "uScale": 0.15,
            "vScale": 0.15,
            "invertX": true,
            "invertY": true,
            "metallic": 1,
            "roughness": 0.3
          }
        },
        {
          "id": 3,
          "name": "längsmatt",
          "img": "icon-laengsmatt.svg",
          "material": {
            "file": "tex-laengsmatt.jpg",
            "uScale": 0.05,
            "vScale": 0.05,
            "invertX": true,
            "invertY": true,
            "metallic": 0.95,
            "roughness": 0.35
          }
        },
        {
          "id": 4,
          "name": "quermatt",
          "img": "icon-quermatt.svg",
          "material": {
            "file": "tex-quermatt.jpg",
            "uScale": 0.05,
            "vScale": 0.05,
            "invertX": true,
            "invertY": true,
            "metallic": 0.95,
            "roughness": 0.35
          }
        },
        {
          "id": 5,
          "name": "schrägmatt",
          "img": "icon-schraegmatt.svg",
          "material": {
            "file": "tex-schraegmatt.jpg",
            "uScale": 0.07,
            "vScale": 0.07,
            "invertX": true,
            "invertY": true,
            "metallic": 0.95,
            "roughness": 0.35
          }
        },
        {
          "id": 6,
          "name": "x-matt",
          "img": "icon-x-matt.svg",
          "material": {
            "file": "tex-xmatt.jpg",
            "uScale": 0.15,
            "vScale": 0.15,
            "invertX": true,
            "invertY": true,
            "metallic": 0.95,
            "roughness": 0.25
          },
          "minSegmentWidth": 2000,
          "forceGap": true
        },
        {
          "id": 7,
          "name": "eismatt",
          "img": "icon-eismatt.svg",
          "material": {
            "file": "tex-eismatt.jpg",
            "uScale": 0.18,
            "vScale": 0.18,
            "invertX": true,
            "invertY": true,
            "metallic": 0.88,
            "roughness": 0.18
          },
          "minSegmentWidth": 300,
          "forceGap": true
        },
        {
          "id": 8,
          "name": "hammer-poliert",
          "img": "icon-hammer-poliert.svg",
          "material": {
            "file": "tex-hammerschlag-poliert.jpg",
            "uScale": 0.142857142,
            "vScale": 0.142857142,
            "invertX": true,
            "invertY": true,
            "metallic": 1,
            "roughness": 0
          },
          "minSegmentWidth": 3000,
          "maxDivision": 2,
          "forceGap": true,
          "surcharge": 30
        },
        {
          "id": 9,
          "name": "hammer-matt",
          "img": "icon-hammer-matt.svg",
          "material": {
            "file": "tex-hammerschlag-poliert.jpg",
            "uScale": 0.142857142,
            "vScale": 0.142857142,
            "invertX": true,
            "invertY": true,
            "metallic": 1,
            "roughness": 0.3
          },
          "minSegmentWidth": 3000,
          "maxDivision": 2,
          "forceGap": true,
          "surcharge": 30
        }
      ],
      "gapMode": [
        {
          "id": 0,
          "name": "Ohne",
          "img": "icon-stufe-ohne.svg",
          "width": [
            0
          ],
          "surface": [
            0
          ],
          "depth": 0.0
        },
        {
          "id": 3,
          "name": "U",
          "img": "icon-u-fuge.svg",
          "width": [
            300,
            500,
            1000,
            1500,
            2000
          ],
          "surface": [
            0,
            1
          ],
          "depth": 0.5
        },
        {
          "id": 1,
          "name": "Eckig",
          "img": "icon-eckige-fuge.svg",
          "width": [
            300,
            500,
            1000,
            1500,
            2000
          ],
          "surface": [
            0,
            1
          ],
          "depth": 300
        },
        {
          "id": 2,
          "name": "V",
          "img": "icon-v-fuge.svg",
          "width": [
            300,
            500,
            1000,
            1500
          ],
          "surface": [
            0,
            1
          ],
          "depth": 0.5
        }
      ],
      "stepMode": [
        {
          "id": 0,
          "name": "Ohne",
          "img": "icon-stufe-ohne.svg"
        },
        {
          "id": 3,
          "name": "Beide",
          "img": "icon-stufe-beide.svg"
        },
        {
          "id": 1,
          "name": "Links",
          "img": "icon-stufe-links.svg"
        },
        {
          "id": 2,
          "name": "Rechts",
          "img": "icon-stufe-rechts.svg"
        }
      ],
      "pearlingSize": createDefaultPearlingSizes(),
      "stepDepthOptions": [
        200,
        300,
        400
      ],
      "featureRules": {
        "global": {
          "unit": "micrometer",
          "defaultAction": "block",
          "autoAdjustAllowed": true,
          "minFeatureDistance": 300,
          "logViolations": false
        },
        "gapPearling": {
          "enabled": true,
          "allowedGapModes": [
            1,
            2,
            3
          ],
          "allowedSizes": [
            500,
            1000
          ],
          "minDistanceToStone": 500,
          "minDistanceToOtherGap": 300,
          "snapTolerance": 200
        },
        "stepPearling": {
          "enabled": true,
          "allowedSides": [
            "left",
            "right",
            "both"
          ],
          "allowedSizes": [
            500,
            1000
          ],
          "singleRowOnly": true
        },
        "freeGap": {
          "minDistanceToOtherGap": 300,
          "snapTolerance": 200
        },
        "combinations": []
      },
      "stoneMode": [
        {
          "mode": 0,
          "name": "Ohne",
          "img": "icon-stone-none.svg",
          "safeDistX": 200,
          "safeDistY": 200
        },
        {
          "mode": 10,
          "name": "Eingerieben",
          "img": "icon-stone-bezel.svg",
          "safeDistX": 200,
          "safeDistY": 200,
          "bevelDistX": 100,
          "bevelDistY": 100,
          "stoneDistances": [
            {
              "profile": [
                "P1",
                "P2",
                "P3",
                "P4",
                "P5"
              ],
              "stoneToStone_x": 500,
              "stoneToStone_y": 200,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 100
            },
            {
              "profile": [
                "P6",
                "P11"
              ],
              "stoneToStone_x": 300,
              "stoneToStone_y": 200,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 100
            },
            {
              "profile": [
                "P7",
                "P12"
              ],
              "stoneToStone_x": 800,
              "stoneToStone_y": 200,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 100
            }
          ]
        },
        {
          "mode": 20,
          "name": "Verschnitt",
          "img": "icon-stone-section.svg",
          "safeDistX": 100,
          "safeDistY": 100,
          "safeDistXGap": 150,
          "distribution": 0,
          "maxWaveCount": 3,
          "maxGapWidth": 300,
          "stoneDistances": [
            {
              "profile": [
                "P1",
                "P2",
                "P3",
                "P4",
                "P5"
              ],
              "stoneToStone_x": 80,
              "stoneToStone_y": 120,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 100
            },
            {
              "profile": [
                "P6",
                "P11"
              ],
              "stoneToStone_x": 80,
              "stoneToStone_y": 120,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 150
            },
            {
              "profile": [
                "P7",
                "P12"
              ],
              "stoneToStone_x": 80,
              "stoneToStone_y": 120,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 150
            }
          ]
        },
        {
          "mode": 30,
          "name": "Kanal",
          "img": "icon-stone-channel-open.svg",
          "safeDistX": 0,
          "safeDistY": 0,
          "safeDistXGap": 0,
          "maxGapWidth": 300,
          "stoneDistances": [
            {
              "profile": [
                "P1",
                "P2",
                "P3",
                "P4",
                "P5",
                "P6",
                "P11",
                "P7",
                "P12"
              ],
              "stoneToStone_x": 0,
              "stoneToStone_y": 50,
              "stoneToGap_x": 100,
              "stoneToBevel_x": -0.12
            }
          ]
        },
        {
          "mode": 31,
          "name": "Kanal quer",
          "img": "icon-stone-channel-cross.svg",
          "safeDistX": 200,
          "safeDistY": 200,
          "sideCrossChannelDistance": 150,
          "maxGapWidth": 300,
          "stoneDistances": [
            {
              "stoneToStone_x": 50,
              "stoneToStone_y": 0,
              "stoneToGap_x": 0,
              "stoneToBevel_x": -0.12
            }
          ]
        },
        {
          "mode": 35,
          "name": "Spannring",
          "img": "icon-stone-clamp.svg",
          "safeDistX": 200,
          "safeDistY": 200,
          "sideCrossChannelDistance": 150,
          "maxGapWidth": 300,
          "stoneDistances": [
            {
              "profile": [
                "P1",
                "P2",
                "P3",
                "P4",
                "P5"
              ],
              "stoneToStone_x": 0,
              "stoneToStone_y": 0,
              "stoneToGap_x": 500,
              "stoneToBevel_x": 0.88
            },
            {
              "profile": [
                "P6",
                "P11"
              ],
              "stoneToStone_x": 0,
              "stoneToStone_y": 0,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 0.88
            },
            {
              "profile": [
                "P7",
                "P12"
              ],
              "stoneToStone_x": 0,
              "stoneToStone_y": 0,
              "stoneToGap_x": 800,
              "stoneToBevel_x": 0.88
            }
          ],
          "defaultStoneSize": 1900
        },
        {
          "name": "Seitlich",
          "img": "icon-stone-side-bezel-left.svg",
          "items": [
            {
              "mode": 40,
              "name": "Eingerieben (links)",
              "img": "icon-stone-side-bezel-left.svg",
              "safeDistX": 200,
              "safeDistY": 300,
              "sideIndex": 0,
              "stoneDistances": [
                {
                  "stoneToStone_x": 0,
                  "stoneToStone_y": 200,
                  "stoneToGap_x": 0,
                  "stoneToBevel_x": 100
                }
              ]
            },
            {
              "mode": 41,
              "name": "Eingerieben (rechts)",
              "img": "icon-stone-side-bezel-right.svg",
              "safeDistX": 200,
              "safeDistY": 200,
              "bevelDistX": 50,
              "bevelDistY": 50,
              "sideIndex": 1,
              "stoneDistances": [
                {
                  "stoneToStone_x": 0,
                  "stoneToStone_y": 200,
                  "stoneToGap_x": 0,
                  "stoneToBevel_x": 100
                }
              ]
            },
            {
              "mode": 42,
              "name": "Kanal (links)",
              "img": "icon-stone-side-channel-left.svg",
              "safeDistX": 200,
              "safeDistY": 10,
              "sideIndex": 0,
              "stoneDistances": [
                {
                  "stoneToStone_x": 0,
                  "stoneToStone_y": 0,
                  "stoneToGap_x": 0,
                  "stoneToBevel_x": 0.88
                }
              ]
            },
            {
              "mode": 43,
              "name": "Kanal (rechts)",
              "img": "icon-stone-side-channel-right.svg",
              "safeDistX": 200,
              "safeDistY": 10,
              "sideIndex": 1,
              "stoneDistances": [
                {
                  "stoneToStone_x": 0,
                  "stoneToStone_y": 0,
                  "stoneToGap_x": 0,
                  "stoneToBevel_x": 0.88
                }
              ]
            },
            {
              "mode": 44,
              "name": "Verschnitt (links)",
              "img": "icon-stone-side-section-left.svg",
              "safeDistX": 200,
              "safeDistY": 200,
              "sideIndex": 0,
              "distribution": 0,
              "stoneDistances": [
                {
                  "stoneToStone_x": 0,
                  "stoneToStone_y": 200,
                  "stoneToGap_x": 0,
                  "stoneToBevel_x": 150
                }
              ]
            },
            {
              "mode": 45,
              "name": "Verschnitt (rechts)",
              "img": "icon-stone-side-section-right.svg",
              "safeDistX": 200,
              "safeDistY": 200,
              "sideIndex": 1,
              "distribution": 0,
              "stoneDistances": [
                {
                  "stoneToStone_x": 0,
                  "stoneToStone_y": 200,
                  "stoneToGap_x": 0,
                  "stoneToBevel_x": 150
                }
              ]
            }
          ],
          "safeDistX": 0,
          "safeDistY": 0
        },
        {
          "mode": 11,
          "name": "Freie Aufteilung",
          "img": "icon-stone-free.svg",
          "safeDistX": 200,
          "safeDistY": 200,
          "bevelDistX": 100,
          "bevelDistY": 100,
          "minRingWidth": 3000,
          "maxGapWidth": 500,
          "stoneDistances": [
            {
              "profile": [
                "P1",
                "P2",
                "P3",
                "P4",
                "P5"
              ],
              "stoneToStone_x": 200,
              "stoneToStone_y": 200,
              "stoneToGap_x": 500,
              "stoneToBevel_x": 100
            },
            {
              "profile": [
                "P6",
                "P11"
              ],
              "stoneToStone_x": 200,
              "stoneToStone_y": 200,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 100
            },
            {
              "profile": [
                "P7",
                "P12"
              ],
              "stoneToStone_x": 200,
              "stoneToStone_y": 200,
              "stoneToGap_x": 300,
              "stoneToBevel_x": 100
            }
          ]
        }
      ],
      "stoneType": [
        {
          "id": 1,
          "name": "Brillant",
          "img": "icon-brillant.svg",
          "obj": "brillant.obj",
          "allowedStoneMode": [
            10,
            11,
            20,
            30,
            31,
            35,
            36,
            40,
            41,
            42,
            43,
            44,
            45
          ],
          "size": [
            {
              "size": 1000,
              "carat": 0.005,
              "minRingWidth": 1500,
              "minRingHeight": 1200,
              "priceFactor": 2.3,
              "surcharge": 5,
              "price": [
                465,
                595,
                785,
                600
              ]
            },
            {
              "size": 1300,
              "carat": 0.01,
              "minRingWidth": 1500,
              "minRingHeight": 1200,
              "priceFactor": 2.7,
              "surcharge": 5,
              "price": [
                325,
                450,
                635,
                300
              ]
            },
            {
              "size": 1500,
              "carat": 0.015,
              "minRingWidth": 2000,
              "minRingHeight": 1200,
              "priceFactor": 2.8,
              "surcharge": 5,
              "price": [
                325,
                450,
                635,
                200
              ]
            },
            {
              "size": 1700,
              "carat": 0.02,
              "minRingWidth": 2000,
              "minRingHeight": 1300,
              "priceFactor": 2.9,
              "surcharge": 5,
              "price": [
                305,
                425,
                610,
                150
              ]
            },
            {
              "size": 1900,
              "carat": 0.03,
              "minRingWidth": 2500,
              "minRingHeight": 1400,
              "priceFactor": 2.9,
              "surcharge": 5,
              "price": [
                350,
                450,
                615,
                100
              ]
            },
            {
              "size": 2100,
              "carat": 0.04,
              "minRingWidth": 2500,
              "minRingHeight": 1500,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                415,
                500,
                660,
                75
              ]
            },
            {
              "size": 2300,
              "carat": 0.05,
              "minRingWidth": 2500,
              "minRingHeight": 1700,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                415,
                500,
                660,
                60
              ]
            },
            {
              "size": 2500,
              "carat": 0.06,
              "minRingWidth": 3000,
              "minRingHeight": 1800,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                415,
                500,
                660,
                50
              ]
            },
            {
              "size": 2600,
              "carat": 0.07,
              "minRingWidth": 3000,
              "minRingHeight": 1900,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                415,
                500,
                660,
                42
              ]
            },
            {
              "size": 2700,
              "carat": 0.08,
              "minRingWidth": 3000,
              "minRingHeight": 2000,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                570,
                655,
                895,
                37
              ]
            },
            {
              "size": 2900,
              "carat": 0.09,
              "minRingWidth": 3500,
              "minRingHeight": 2000,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                615,
                705,
                975,
                33
              ]
            },
            {
              "size": 3000,
              "carat": 0.1,
              "minRingWidth": 3500,
              "minRingHeight": 2200,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                615,
                805,
                1015,
                30
              ]
            },
            {
              "size": 3200,
              "carat": 0.12,
              "minRingWidth": 4000,
              "minRingHeight": 2300,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                615,
                830,
                1140,
                25
              ]
            },
            {
              "size": 3400,
              "carat": 0.15,
              "minRingWidth": 4000,
              "minRingHeight": 2500,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                655,
                865,
                1255,
                20
              ]
            },
            {
              "size": 3700,
              "carat": 0.18,
              "minRingWidth": 4500,
              "minRingHeight": 2600,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                700,
                920,
                1310,
                16
              ]
            },
            {
              "size": 3800,
              "carat": 0.2,
              "minRingWidth": 5000,
              "minRingHeight": 2800,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                755,
                975,
                1500,
                15
              ]
            },
            {
              "size": 3900,
              "carat": 0.23,
              "minRingWidth": 5000,
              "minRingHeight": 2800,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                800,
                1125,
                1675,
                13
              ]
            },
            {
              "size": 4100,
              "carat": 0.25,
              "minRingWidth": 5500,
              "minRingHeight": 2900,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                875,
                1280,
                1800,
                12
              ]
            },
            {
              "size": 4300,
              "carat": 0.3,
              "minRingWidth": 6000,
              "minRingHeight": 3200,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                1320,
                1510,
                1790,
                10
              ]
            }
          ],
          "sizeDepthFactor": 0.6
        },
        {
          "id": 2,
          "name": "Princess",
          "obj": "princess.obj",
          "img": "icon-princess.svg",
          "allowedStoneMode": [
            10,
            40,
            41
          ],
          "size": [
            {
              "size": 1800,
              "carat": 0.03,
              "minRingWidth": 2500,
              "minRingHeight": 1600,
              "calcSize": 2000,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                100
              ]
            },
            {
              "size": 1900,
              "carat": 0.04,
              "minRingWidth": 2500,
              "minRingHeight": 1700,
              "calcSize": 2100,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                75
              ]
            },
            {
              "size": 2100,
              "carat": 0.05,
              "minRingWidth": 2500,
              "minRingHeight": 1800,
              "calcSize": 2300,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                60
              ]
            },
            {
              "size": 2500,
              "carat": 0.09,
              "minRingWidth": 3000,
              "minRingHeight": 2200,
              "calcSize": 2700,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                100
              ]
            },
            {
              "size": 2700,
              "carat": 0.12,
              "minRingWidth": 3000,
              "minRingHeight": 2300,
              "calcSize": 2900,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                75
              ]
            },
            {
              "size": 3000,
              "carat": 0.15,
              "minRingWidth": 3500,
              "minRingHeight": 2600,
              "calcSize": 3200,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                60
              ]
            },
            {
              "size": 3500,
              "carat": 0.25,
              "minRingWidth": 4500,
              "minRingHeight": 3100,
              "calcSize": 3700,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                800,
                850,
                970,
                12
              ]
            },
            {
              "size": 3800,
              "carat": 0.3,
              "minRingWidth": 5000,
              "minRingHeight": 3500,
              "calcSize": 4000,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                1065,
                1145,
                1385,
                10
              ]
            }
          ],
          "sizeDepthFactor": 0.73
        },
        {
          "id": 3,
          "name": "Princess 45°",
          "obj": "princess_45.obj",
          "img": "icon-princess-45.svg",
          "allowedStoneMode": [
            10
          ],
          "size": [
            {
              "size": 1800,
              "carat": 0.03,
              "minRingWidth": 3600,
              "minRingHeight": 1600,
              "calcSize": 2546,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                100
              ]
            },
            {
              "size": 1900,
              "carat": 0.04,
              "minRingWidth": 3600,
              "minRingHeight": 1700,
              "calcSize": 2687,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                75
              ]
            },
            {
              "size": 2100,
              "carat": 0.05,
              "minRingWidth": 3600,
              "minRingHeight": 1800,
              "calcSize": 2970,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                60
              ]
            },
            {
              "size": 2500,
              "carat": 0.09,
              "minRingWidth": 4300,
              "minRingHeight": 2200,
              "calcSize": 3536,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                100
              ]
            },
            {
              "size": 2700,
              "carat": 0.12,
              "minRingWidth": 4300,
              "minRingHeight": 2300,
              "calcSize": 3818,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                75
              ]
            },
            {
              "size": 3000,
              "carat": 0.15,
              "minRingWidth": 5000,
              "minRingHeight": 2600,
              "calcSize": 4243,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                535,
                580,
                670,
                60
              ]
            },
            {
              "size": 3500,
              "carat": 0.25,
              "minRingWidth": 6400,
              "minRingHeight": 3100,
              "calcSize": 4950,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                800,
                850,
                970,
                12
              ]
            },
            {
              "size": 3800,
              "carat": 0.3,
              "minRingWidth": 7100,
              "minRingHeight": 3500,
              "calcSize": 5374,
              "priceFactor": 2.2,
              "surcharge": 5,
              "price": [
                1065,
                1145,
                1385,
                10
              ]
            }
          ],
          "sizeDepthFactor": 0.73
        },
        {
          "id": 4,
          "name": "Baguette quer",
          "obj": "baguette.obj",
          "img": "icon-baguette.svg",
          "allowedStoneMode": [
            10,
            40,
            41
          ],
          "size": [
            {
              "size": 3100,
              "calcSize": 1811,
              "safeDistY": -500,
              "carat": 0.05,
              "minRingWidth": 4000,
              "minRingHeight": 1600,
              "lengthFactor": 0.584327,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                390,
                480,
                660,
                60
              ]
            },
            {
              "size": 3200,
              "calcSize": 1870,
              "carat": 0.08,
              "minRingWidth": 4000,
              "minRingHeight": 1800,
              "lengthFactor": 0.584327,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                860,
                920,
                985,
                37
              ]
            },
            {
              "size": 3500,
              "calcSize": 2046,
              "carat": 0.1,
              "minRingWidth": 4500,
              "minRingHeight": 1900,
              "lengthFactor": 0.584327,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                1020,
                1090,
                1180,
                30
              ]
            },
            {
              "size": 3800,
              "calcSize": 2221,
              "carat": 0.12,
              "minRingWidth": 5000,
              "minRingHeight": 2200,
              "lengthFactor": 0.584327,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                1155,
                1265,
                1395,
                25
              ]
            }
          ],
          "sizeDepthFactor": 0.39,
          "maxWaveCount": 3
        },
        {
          "id": 5,
          "name": "Baguette längs",
          "obj": "baguette_90.obj",
          "img": "icon-baguette-90.svg",
          "allowedStoneMode": [
            10,
            40,
            41
          ],
          "size": [
            {
              "size": 1600,
              "carat": 0.05,
              "minRingWidth": 4000,
              "minRingHeight": 1600,
              "lengthFactor": 1.71138,
              "calcSize": 2739,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                390,
                480,
                660,
                60
              ]
            },
            {
              "size": 1800,
              "carat": 0.06,
              "minRingWidth": 3500,
              "minRingHeight": 1700,
              "lengthFactor": 1.71138,
              "calcSize": 3081,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                400,
                490,
                670,
                50
              ]
            },
            {
              "size": 1900,
              "carat": 0.07,
              "minRingWidth": 3500,
              "minRingHeight": 1800,
              "lengthFactor": 1.71138,
              "calcSize": 3252,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                700,
                750,
                850,
                42
              ]
            },
            {
              "size": 2000,
              "carat": 0.08,
              "minRingWidth": 4000,
              "minRingHeight": 1800,
              "lengthFactor": 1.71138,
              "calcSize": 3423,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                860,
                920,
                985,
                37
              ]
            },
            {
              "size": 2100,
              "carat": 0.1,
              "minRingWidth": 4500,
              "minRingHeight": 1900,
              "lengthFactor": 1.71138,
              "calcSize": 3594,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                1020,
                1090,
                1180,
                30
              ]
            },
            {
              "size": 2300,
              "carat": 0.12,
              "minRingWidth": 5000,
              "minRingHeight": 2200,
              "lengthFactor": 1.71138,
              "calcSize": 3937,
              "priceFactor": 2.5,
              "surcharge": 5,
              "price": [
                1155,
                1265,
                1395,
                25
              ]
            }
          ],
          "sizeDepthFactor": 0.653,
          "maxWaveCount": 2
        }
      ],
      "stoneQuality": [
        {
          "id": 0,
          "name": "G-SI (Feines Weiß, kleine Einschlüsse)"
        },
        {
          "id": 1,
          "name": "G-VS (Feines Weiß, sehr kleine Einschlüsse)"
        },
        {
          "id": 2,
          "name": "E-IF (Hochfeines Weiß, lupenrein)"
        },
        {
          "id": 3,
          "name": "Zirkonia AAA (Weiß, sehr gut)"
        }
      ],
      "stoneDistribution": [
        {
          "id": 0,
          "name": "aneinander"
        },
        {
          "id": 5,
          "name": "halber Steinabstand"
        },
        {
          "id": 10,
          "name": "ganzer Steinabstand"
        },
        {
          "id": 20,
          "name": "doppelter Steinabstand"
        },
        {
          "id": 33,
          "name": "drittel Ring"
        },
        {
          "id": 50,
          "name": "halber Ring"
        },
        {
          "id": 100,
          "name": "ganzer Ring"
        }
      ],
      "stonePosition": [
        {
          "id": -1,
          "name": "Links",
          "img": "icon-position-left.svg"
        },
        {
          "id": 0,
          "name": "Mittig",
          "img": "icon-position-middle.svg"
        },
        {
          "id": 1,
          "name": "Rechts",
          "img": "icon-position-right.svg"
        }
      ],
      "stoneRowsMax": 5,
      "stoneCount": [
        {
          "id": -33.339,
          "name": "drittel"
        },
        {
          "id": -50,
          "name": "halb"
        },
        {
          "id": -100,
          "name": "voll"
        }
      ],
      "engraving": {
        "maxLength": 30,
        "symbols": [
          {
            "unicode": "\u00F0",
            "img": "icon-symbol-heart.svg"
          },
          {
            "unicode": "\u00F1",
            "img": "icon-symbol-double-heart.svg"
          },
          {
            "unicode": "\u00F2",
            "img": "icon-symbol-double-ring.svg"
          },
          {
            "unicode": "\u00F3",
            "img": "icon-symbol-infinity.svg"
          }
        ],
        "color": "#333333",
        "alpha": 0.6
      },
      "webglSettings": {
        "maxTextureSize": 2048,
        "maxAlphaTextureSize": 4096,
        "tesselation": [
          150,
          100,
          20
        ],
        "ringRotationX": 27,
        "ringRotationY": [
          42,
          0
        ],
        "ringOffsetZ": [
          -2.5,
          0
        ],
        "camera": [
          -1.8830285392434571,
          1.1869035161232264,
          30
        ],
        "cameraMinOrthoSize": 20,
        "forceFrames": 15,
        "maxFps": 40,
        "environmentPreset": {
          "refSampler_reflect": 1.636,
          "refSampler_camRad": 0.992,
          "refSampler_factor": 0.947,
          "tri1_reflect": 1.022,
          "tri1_camRad": 1.067,
          "tri1_factor": 0.184,
          "tri2_reflect": 0.903,
          "tri2_camRad": 0.753,
          "tri2_factor": 0.109,
          "high_reflect": 0.962,
          "high_camRad": 0.588,
          "high_factor": 1.112,
          "sparkle_reflect": 0.001,
          "sparkle_camRad": 0.001,
          "sparkle_factor": 0.001,
          "fire_reflect": 0.124,
          "fire_camRad": 2.19,
          "fire_factor": 0.079,
          "envTexture_yaw": 0.18999999999999997,
          "envTexture_pitch": 0.9999999999999999,
          "envTexture_roll": 0,
          "scene_exposure": 2.204,
          "scene_contrast": 1.8,
          "refSampler_image": "diamondMap_1.jpg"
        },

        environmentPresetId: undefined
      }
    }

  dataSafeJson: string = "";

  env = environment;

  constructor(public http: HttpClient) {
    if (!window.location.pathname.endsWith('/')) {
      window.location.pathname += '/';
      return;
    }

    this.state.browsertab_id = "_" + Math.floor(Math.random() * 1000000);

    this.dataSafeJson = JSON.stringify(this.data);

    AppComponent.app = this;

    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(navigator.userAgent)) {
      this.state.mobile = true;
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera material(obi|ini)/.test(navigator.userAgent)) {
      this.state.mobile = true;
    }

    if (document.location.toString().indexOf('?') !== -1) {
      let query = document.location
        .toString()
        .replace(/^.*?\?/, '')
        .replace(/#.*$/, '')
        .split('&');

      for (let i = 0, l = query.length; i < l; i++) {
        const aux = decodeURIComponent(query[i]).split('=');
        this.state.urlParams[aux[0].toLowerCase()] = aux[1] || "1";
      }

      if (this.state.urlParams["id"]) this.state.urlParams["id"] = this.state.urlParams["id"].toUpperCase();
    }

    if (!this.state.mobile && this.state.urlParams["mobile"] !== undefined && this.state.urlParams["mobile"] !== "0")
      this.state.mobile = true;
    this.state.debug = this.state.urlParams["debug"] !== undefined && this.state.urlParams["debug"] !== "0";
    this.state.admin = this.state.urlParams["admin"] !== undefined && this.state.urlParams["admin"] !== "0";
    this.state.diamond = this.state.urlParams["diamond"] !== undefined && this.state.urlParams["diamond"] !== "0";
    this.state.freeStones = this.state.urlParams["freeStones"] !== undefined && this.state.urlParams["freeStones"] !== "0";

    new RingData();
    new RingData();
  }

  ngOnInit() {
    dbGetAppData().then(function (data: any) {
      if (data == null) Log("error", "Keine App Daten vorhanden!");
      else AppComponent.app.data = data;

      if (AppComponent.app.state.urlParams["id"] !== undefined && AppComponent.app.state.urlParams["id"].match(/\w{4}-\w{4}/g)) {
        if (AppComponent.app.state.debug) console.log("use url-id: ", AppComponent.app.state.urlParams["id"]);
        AppComponent.app.state.preset_id = AppComponent.app.state.urlParams["id"];
      } else AppComponent.app.state.preset_id = "0000-0000";

      AppComponent.app.state.ready = true;
    })
  }

  setConfigMode(mode: number) {
    if (mode == 0) {
      if (!RingData.list[0].cartActive)
        mode = 1;
    }

    if (mode == 1) {
      if (!RingData.list[1].cartActive)
        mode = 0;
    }

    this.state.configMode = mode;
  }

  getDetails(): iDetails[] | null {
    if (RingData.list.length < 2) return null;
    let preset_0 = RingData.list[0];
    let preset_1 = RingData.list[1];
    let result = [] as iDetails[];

    let that = this;
    let data = [] as iDetailData[];

    // Profil und Maße
    data.push({col_0: "Profil", col_1: preset_0.profileName, col_2: preset_1.profileName});
    data.push({
      col_0: "Ringbreite",
      col_1: preset_0.ringWidth / 1000 + " mm",
      col_2: preset_1.ringWidth / 1000 + " mm"
    });
    data.push({
      col_0: "Ringhöhe",
      col_1: preset_0.ringHeight / 1000 + " mm",
      col_2: preset_1.ringHeight / 1000 + " mm"
    });
    data.push({col_0: "Ringgröße", col_1: preset_0.ringSize / 1000 + " mm", col_2: preset_1.ringSize / 1000 + " mm"});

    result.push({section: "Profil und Maße", data: data});

    // Material
    data = [];

    let aufteilung = function (ringData: RingData) {
      let ar = [];

      ar = ringData.divPreset.split(':');
      let count = ar.length - 1;
      let result = "";

      if (count == 1) return "Einfarbig";
      if (count == 2) result = "Zweifarbig";
      if (count == 3) result = "Dreifarbig";
      if (count == 4) result = "Vierfarbig";
      if (count == 5) result = "Fünffarbig";

      let mode = ar[0].toLowerCase();
      if (mode == "w") {
        result += " Welle (" + ar.slice(1).join(':') + ")";
        return result;
      } else if (mode == "d") {
        result += " Diagonal (" + ar.slice(1).join(':') + ")";
        return result;
      } else if (mode == "wf") result += " Welle, frei";
      else if (mode == "df") result += " Diagonal, frei";
      else if (mode == "h") {
        result += " Horizontal (1:1)";
        return result;
      } else if (mode == "s") {
        result += " Segment (1:1)";
        return result;
      }

      result += " (";
      ar = ringData.materialDiv.slice(0);
      ar.forEach(function (e, i) {
        if (i > 0) result += ":";
        result += (e * ringData.ringWidth / 10000000).toFixed(2) + "mm";
      });

      result += ")";

      return result;
    }
    data.push({col_0: "Aufteilung", col_1: aufteilung(preset_0), col_2: aufteilung(preset_1)});

    let farbe = function (ringData: RingData) {
      let ar = [];

      ar = ringData.divPreset.split(':').slice(1);
      let result = "";

      ar.forEach(function (e, i) {
        let material = that.data.material.find(function (e) {
          return e.id == ringData.material[i];
        })
        if (material) {
          if (result.length > 0)
            result += " | ";
          result += ringData.fineness[i] + " " + material.name;
        }
      })

      return result;
    }
    data.push({col_0: "Farbe", col_1: farbe(preset_0), col_2: farbe(preset_1)});

    let oberflaeche = function (ringData: RingData) {
      let ar = ringData.divPreset.split(':').slice(1);
      let count = ar.length;
      let result = "";

      for (let i = 0; i < count; i++) {
        let surface = that.data.surface.find(function (e) {
          return e.id == ringData.surface[i];
        })
        if (surface) {
          if (result.length > 0)
            result += " | ";
          result += surface.name;
        }
      }

      return result;
    }
    data.push({col_0: "Oberfläche", col_1: oberflaeche(preset_0), col_2: oberflaeche(preset_1)});

    result.push({section: "Material", data: data});

    // Trennfugen
    data = [];

    let fugenart = function (ringData: RingData) {
      if (ringData.divPreset.split(':').slice(1).length == 1)
        return "Ohne";

      let result = "";

      let gap = that.data.gapMode.find(function (e) {
        return e.id == ringData.gapMode;
      })

      if (gap)
        result += gap.name

      let surface = that.data.surface.find(function (e) {
        return e.id == ringData.gapSurface;
      })

      if (surface)
        result += " / " + surface.name;

      return result;
    }
    data.push({col_0: "Art der Fuge", col_1: fugenart(preset_0), col_2: fugenart(preset_1)});

    let trennfugenbreite = function (ringData: RingData) {
      let matCount = ringData.divPreset.split(':').slice(1).length;
      if (matCount == 1)
        return "-";
      matCount--;
      let result = "";
      for (let i = 0; i < matCount; i++) {
        if (i > 0)
          result += " | ";
        if (ringData.gapEnabled[i])
          result += (ringData.gapWidth / 1000).toFixed(1) + " mm";
        else
          result += " Keine ";
      }

      return result;
    }
    data.push({col_0: "Breite", col_1: trennfugenbreite(preset_0), col_2: trennfugenbreite(preset_1)});

    result.push({section: "Trennfugen", data: data});

    // Freie Fugen
    data = [];
    let freieFugen = function (ringData: RingData) {
      let gapDiv = ringData.gapDiv.slice(0)
      if (gapDiv.length < 2)
        return "Ohne";
      let result = "";
      let sum = 0;
      gapDiv.pop();
      gapDiv.forEach(function (e, i) {
        if (i > 0)
          result += " | ";
        sum += e;
        result += (sum * ringData.ringWidth / 10000000).toFixed(2) + " mm";
      })

      return result;
    }
    data.push({col_0: "Position", col_1: freieFugen(preset_0), col_2: freieFugen(preset_1)});

    let freiefugenbreite = function (ringData: RingData) {
      if (ringData.gapDiv.length < 2)
        return "-";

      return (ringData.gapWidth / 1000).toFixed(1) + " mm";
    }
    data.push({col_0: "Breite", col_1: freiefugenbreite(preset_0), col_2: freiefugenbreite(preset_1)});

    result.push({section: "Freie Fugen", data: data});

    // Stufen
    data = [];
    let stufenModus = function (ringData: RingData) {
      let sm = that.data.stepMode.find(function (e) {
        return e.id == ringData.stepMode;
      })
      if (sm)
        return sm.name;
      return "";
    }
    data.push({col_0: "Position", col_1: stufenModus(preset_0), col_2: stufenModus(preset_1)});

    let stufenBreite = function (ringData: RingData) {
      switch (ringData.stepMode) {
        case 1:
          return (ringData.stepWidth[0] / 1000).toFixed(1) + " mm";
        case 2:
          return (ringData.stepWidth[1] / 1000).toFixed(1) + " mm"
        case 3:
          return (ringData.stepWidth[0] / 1000).toFixed(1) + " mm | " + (ringData.stepWidth[1] / 1000).toFixed(1) + " mm";
      }

      return "-";
    }
    data.push({col_0: "Breite", col_1: stufenBreite(preset_0), col_2: stufenBreite(preset_0)});

    result.push({section: "Stufen", data: data});

    // Steinbesatz
    data = [];
    let steinbesatz = function (ringData: RingData) {
      let result = "";

      ringData.stone.forEach(stoneGroup => {

        if (stoneGroup.mode == 0)
          return;

        let quality = that.data.stoneQuality.find(e => {
          return e.id == stoneGroup.quality;
        })
        let type = that.data.stoneType.find(e => {
          return e.id == stoneGroup.type;
        })
        let size = null;
        if (type) size = type.size.find(e => {
          return e.size == stoneGroup.size;
        })
        let mode = that.data.stoneMode.find(e => {
          return e.mode == stoneGroup.mode;
        })
        let distribution = that.data.stoneDistribution.find(e => {
          return e.id == stoneGroup.distribution;
        })

        let position = "";
        stoneGroup.positionDiv.forEach(function (e, i) {
          if (i > 0) position += ":";
          position += (e * ringData.ringWidth / 10000000).toFixed(2) + "mm";
        });

        if (result != "")
          result += "<br/>";

        if (mode && quality && type && stoneGroup.mode == 11) // freie Steinaufteilung
        {
          result = mode.name + ", ";
          let stoneSizes = [] as { count: number, carat: number }[];

          stoneGroup.freeStones?.forEach(function (e) {
            if (stoneSizes[<any>"" + e.size])
              stoneSizes[<any>"" + e.size].count++;
            else {
              let carat = type?.size.find(f => {
                return f.size == e.size;
              })?.carat || 0;
              stoneSizes[<any>"" + e.size] = {count: 1, carat: carat};
            }
          })

          stoneSizes.forEach(function (e, index) {
            result += e.count + " x " + e.carat + "ct.,";
          })

          result += quality.name + ", " + type.name

        } else if (quality && type && size && mode && distribution) {
          result += stoneGroup.countReal / stoneGroup.rows + " x " + size.carat + "ct., " + quality.name + ", " + type.name + ", " + mode.name + ", " + distribution.name + ", " + position;
        }
      })

      return result;
    }
    data.push({col_0: " ", col_1: steinbesatz(preset_0), col_2: steinbesatz(preset_1)});

    result.push({section: "Steinbesatz", data: data});

    // Gravur
    data = [];
    let gravurText = function (ringData: RingData) {
      if (ringData.engraving.length > 0)
        return decodeURI(ringData.engraving);
      return "-"
    }
    data.push({
      col_0: "Gravurtext",
      col_1: gravurText(preset_0),
      col_2: gravurText(preset_1),
      class: "engraving-0"
    });
    data.push({col_0: "Schriftart", col_1: "" + preset_0.engravingFont, col_2: "" + preset_1.engravingFont});

    result.push({section: "Gravur", data: data});

    return result;
  }

  async createPdf() {
    if (RingData.list.length < 2) return;

    try {
      await dbSavePreset();

      let details = this.getDetails();
      if (!details) {
        Log("error", "PDF konnte nicht erstellt werden: Keine Ringdetails vorhanden.");
        return;
      }

      let screenshots = await collectRingScreenshotsAsync(800, 622);
      let payload = {
        requestVersion: 1,
        presetId: AppComponent.app.state.preset_id,
        build: AppComponent.app.state.build,
        channel: getRuntimeChannel(),
        appDataVersion: AppComponent.app.state.appDataVersionLabel,
        appDataHash: AppComponent.app.state.appDataHash,
        configMode: AppComponent.app.state.configMode,
        isActive: [RingData.list[0].cartActive, RingData.list[1].cartActive],
        rings: RingData.list.slice(0, 2),
        details: details,
        screenshots: {
          ring1: screenshots[0] || "",
          ring2: screenshots[1] || "",
        },
        meta: {
          createdAt: new Date().toISOString(),
          sourceUrl: window.location.href,
          embedReferrer: document.referrer || "",
          license: "",
        },
      };

      let blob = await lastValueFrom(this.http.post(getPdfEndpoint(), payload, {
        headers: makeJsonHttpHeaders(),
        responseType: 'blob',
      }));

      downloadBlob(blob, AppComponent.app.state.preset_id + ".pdf");
    } catch (err) {
      console.log("error in createPdf(): ", err);
      Log("error", await getPdfErrorMessage(err));
    }
  }


  getPriceTotal(): number {
    let total = 0.0;
    RingData.list.forEach(e => {
      if (e.cartActive)
        total += e.price;
    })
    return total;
  }

  static getCookie(name: string): string {
    let result = "";
    name = name + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return result;
  }

  static setCookie(name: string, value: string) {
    let exdays = 1;
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
  }

  static checkCookie(name: string): string | false {
    let value = AppComponent.getCookie(name);
    if (value != "")
      return value;

    return false;
  }
}

export const cyrb53 = (str: string, seed: number = 0) => {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export interface iDetailData {
  col_0: string;
  col_1: string;
  col_2: string;
  class?: string;
}

export interface iDetails {
  section: string;
  data: iDetailData[];
}

function makeHttpHeaders(): HttpHeaders {
  return new HttpHeaders({
    'Content-Type': 'application/x-www-form-urlencoded',
  });
}

function makeJsonHttpHeaders(): HttpHeaders {
  return new HttpHeaders({
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  });
}

function getPdfEndpoint(): string {
  let configured = environment.pdfEndpoint;
  if (configured && configured.startsWith("http")) return configured;
  if (configured) return window.location.origin + configured;
  return window.location.origin + "/3d-konfigurator/pdf/create.php";
}

function getRuntimeChannel(): string {
  let path = window.location.pathname;
  if (path.indexOf("/builds/development/") >= 0) return "development";
  if (path.indexOf("/builds/releases/") >= 0) return "releases";
  return environment.isWooCommerce ? "woocommerce" : "development";
}

function collectRingScreenshotsAsync(width: number, height: number): Promise<string[]> {
  return new Promise((resolve) => {
    collectRingScreenshots(width, height, (data: string[]) => resolve(data));
  });
}

function downloadBlob(blob: Blob, filename: string) {
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function getPdfErrorMessage(err: any): Promise<string> {
  let fallback = "PDF konnte nicht erstellt werden.";
  let body = err?.error;

  try {
    if (body instanceof Blob) {
      let text = await body.text();
      if (!text) return fallback;
      let parsed = JSON.parse(text);
      return parsed?.error?.message || fallback;
    }

    if (typeof body === "string") {
      let parsed = JSON.parse(body);
      return parsed?.error?.message || fallback;
    }

    return body?.error?.message || err?.message || fallback;
  } catch {
    return err?.message || fallback;
  }
}

function makeHttpParams(rpc: string, rpp: any[]): HttpParams {
  return new HttpParams({
    fromObject: {
      "rpc": rpc,
      "rpp": JSON.stringify(rpp),
      "tabId": AppComponent.app.state.browsertab_id,
    }
  })
}

function getDistRootUrl() {
  let result = window.location.protocol + '//' + window.location.host + window.location.pathname;

  if (!window.location.pathname.endsWith('/'))
    result += '/';

  result += 'api.php';

  return result;
}

async function dbGetId(): Promise<string> {
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbGetId", []);
  let response = AppComponent.app.http.post(url, params, {headers});

  let id: string = "";
  await lastValueFrom(response).then(function (data: any) {
    id = data.id;
  })

  return id;
}

export async function dbCheckIdExist(id: string): Promise<boolean> {
  if (id.length < 9) return false;
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbCheckIdExist", [id]);
  let response = AppComponent.app.http.post(url, params, {headers});

  let result = false;
  await lastValueFrom(response).then(function (data: any) {
    result = data.result !== 0;
  })

  return result;
}

async function dbGetAppData(): Promise<any> {
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbGetAPPDATA", [null, AppComponent.app.state.build]);

  let response = await AppComponent.app.http.post(url, params, {headers});

  let result: any;
  let failed = false;

  await lastValueFrom(response).then(function (data: any) {
    if (data?.ok === false) {
      Log("error", data.error?.message ?? "AppData konnte nicht geladen werden.");
      failed = true;
      result = null;
      return;
    }

    if (data?.ok === true && data.data !== undefined) {
      result = data.data;
      AppComponent.app.state.appDataVersionLabel = data.meta?.appDataVersionLabel ?? "unversioned";
      AppComponent.app.state.appDataHash = data.meta?.appDataHash ?? "";
      return;
    }

    result = data;
  })

  if (failed) {
    return null;
  }

  if (result == null) {
    dbSetAppData().then();
    result = AppComponent.app.data;
  }

  return result;
}

export async function dbSetAppData() {
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbSetAPPDATA", [AppComponent.app.dataSafeJson]);
  let response = AppComponent.app.http.post(url, params, {headers});
  await lastValueFrom(response).then();
}

export async function dbSetCurrentAppData() {
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbSetAPPDATA", [JSON.stringify(AppComponent.app.data)]);
  let response = AppComponent.app.http.post(url, params, {headers});
  await lastValueFrom(response).then();
}

export async function dbSavePreset(addToCart: boolean = false) {
  let imgData = "";
  await createScreenshot(600).then(function (data) {
    imgData = data;
  }).catch(err => {
    console.log("error in dbSavePreset_2(): ", err);
  });

  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  RingData.list[0].stone[0].odm = undefined;
  RingData.list[1].stone[0].odm = undefined;
  let params = makeHttpParams("dbSavePreset", [AppComponent.app.state.preset_id, RingData.list[0], RingData.list[1], imgData, false]);
  let response = AppComponent.app.http.post(url, params, {headers});
  await lastValueFrom(response).then(function (data: any) {
    if (data)
      AppComponent.app.state.preset_id = data.id;

    localStorage.setItem("ringconfId", data.id);

    let dbSaveItem = AppComponent.app.state.dbSaveItems.find(function (e) {
      return e.id === data.id;
    })

    if (!dbSaveItem) {
      let item = {
        id: data.id,
        preset_0: JSON.stringify(RingData.list[0]),
        preset_1: JSON.stringify(RingData.list[1]),
        img: imgData
      };

      AppComponent.app.state.dbSaveItems.push(item)
    }
  });
}

export async function dbLoadPreset(id: string): Promise<iDBSaveItem | undefined> {
  if (id.length < 9)
    return;

  if (id == "0000-0000" && AppComponent.app.state.urlParams["id"] != undefined) {
    id = AppComponent.app.state.urlParams["id"];
  }

  let item = AppComponent.app.state.dbSaveItems.find(function (e) {
    return e.id === id;
  });

  if (item && item.id && item.preset_0 && item.preset_1) {
    AppComponent.app.state.preset_id = item.id;
    RingData.list[0].clone(JSON.parse(item.preset_0));
    RingData.list[1].clone(JSON.parse(item.preset_1));
    return item;
  }

  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbLoadPreset", [id]);
  let response = AppComponent.app.http.post(url, params, {headers});
  let newItem = undefined;
  await lastValueFrom(response).then(function (data: any) {
    if (data.errorCode == 0) {
      newItem = {
        id: id,
        preset_0: data.preset_0,
        preset_1: data.preset_1,
        img: JSON.parse(data.img)
      };

      RingData.list[0].clone(JSON.parse(data.preset_0));
      RingData.list[1].clone(JSON.parse(data.preset_1));

      if (id !== "0000-0000") {
        AppComponent.app.state.preset_id = id;
        AppComponent.app.state.dbSaveItems = [];

        interface iDBItem // returned DB Item from PHP
        {
          id: string;
        }

        if (data.dbItems) {
          let items = data.dbItems as iDBItem[];
          items.forEach(function (e) {
            let params = makeHttpParams("dbLoadPreset", [e.id]);
            let response = AppComponent.app.http.post(url, params, {headers});
            lastValueFrom(response).then(function (data: any) {
              AppComponent.app.state.dbSaveItems.push({
                id: e.id,
                preset_0: data.preset_0,
                preset_1: data.preset_1,
                img: JSON.parse(data.img)
              });
            })
          })
        }

        AppComponent.app.state.ready = true;
      } else {
        dbGetId().then(function (id: string) {
          AppComponent.app.state.preset_id = id;
          AppComponent.app.state.dbSaveItems = [];
          AppComponent.app.state.ready = true;
        })
      }
    } else {

      switch (data.errorCode) {
        case -1: // Standardpreset nicht vorhanden
          Log("error", data.error);
          Log("info", "Fehlerhafte Datenbank. Standardkonfiguration wurde nicht in der Datenbank gefunden.", "ACHTUNG");
          dbResetStdPreset().then(f => {
            dbGetId().then(function (getId) {
              id = getId;
              AppComponent.app.state.preset_id = id;
              AppComponent.app.state.dbSaveItems = [];
              AppComponent.app.state.ready = true;
            })
          });
          break;
        case -2: // "Preset nicht gefunden! Es wurde das Standardpreset geladen.";
          Log("info", data.info);
          RingData.list[0].clone(JSON.parse(data.preset_0));
          RingData.list[1].clone(JSON.parse(data.preset_1));
          RingData.list[0].isDirty = true;
          RingData.list[1].isDirty = true;
          id = data.id;
          AppComponent.app.state.preset_id = id;
          AppComponent.app.state.dbSaveItems = [];
          AppComponent.app.state.ready = true;
          break;
      }
    }
  })

  return newItem;

}

export async function calcPrice(ringData: RingData): Promise<number> {
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("calcPrice", [ringData]);
  let response = AppComponent.app.http.post(url, params, {headers});

  let result = 0;
  await lastValueFrom(response).then(function (data: any) {
    result = data.price;
  })

  return result;
}

export async function dbSaveStdPreset() {
  RingData.list[0].stone[0].odm = undefined;
  RingData.list[1].stone[0].odm = undefined;
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbSavePreset", ["0000-0000", RingData.list[0], RingData.list[1], "", true]);
  let response = AppComponent.app.http.post(url, params, {headers});
  await lastValueFrom(response).then(function (data: any) {
    if (data.errorCode === 0)
      Log("info", "Standardpreset gesetzt.")
    else
      Log("error", "Standardpreset konnte nicht gesetzt werden. Errorcode " + data.errorCode);
  });
}

async function dbResetStdPreset() {
  Log("info", "Es wird versucht, das Standardtemplate wieder herzustellen", "Datenbankfehler");

  RingData.reset(RingData.list[0]);
  RingData.reset(RingData.list[1]);

  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbSavePreset", ["0000-0000", RingData.list[0], RingData.list[1], "", true]);
  let response = AppComponent.app.http.post(url, params, {headers});
  await lastValueFrom(response).then(function (data: any) {
    if (data.errorCode == 0) {
      Log("info", "Standardtemplate gesetzt");
      RingData.list[0].isDirty = true;
      RingData.list[1].isDirty = true;
    } else {
      console.log(data);
      Log("error", "Das Standardtemplate konnte nicht wiederhergestellt werden!");
    }
  })
}

export async function uploadFile(path: string, filename: string, formData: FormData, formDataSelector: string) {
  let url = getDistRootUrl();
  let headers = new HttpHeaders();

  formData.append("rpc", "uploadFile");
  formData.append("rpp", JSON.stringify([path, filename, formDataSelector]));
  let response = AppComponent.app.http.post(url, formData, {headers});
  await lastValueFrom(response).then();
}

export async function restoreEnvTexture() {
  let url = getDistRootUrl();
  let headers = new HttpHeaders();

  let params = makeHttpParams("restoreEnvTexture", []);
  let response = AppComponent.app.http.post(url, params, {headers});
  await lastValueFrom(response).then(function (data: any) {
    if (data.errorCode == 0) {
      Log("info", "Ok. Bitte Seite neuladen (Strg + F5)");
    } else {
      console.log(data);
      Log("error", "Die Umgebungsmap konnte nicht wieder hergestellt werden!");
    }
  })
}

export async function dbSaveEnvironmentPreset(name: string, json_iEnvironmentPreset: string) {
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbSaveEnvironmentPreset", [name, json_iEnvironmentPreset]);
  let response = AppComponent.app.http.post(url, params, {headers});
  await lastValueFrom(response).then(function (data: any) {
    if (data.errorCode === 0)
      Log("info", "Environment-Preset gespeichert")
    else
      Log("error", "Environment-Preset konnte nicht gespeichert werden. Errorcode " + data.errorCode);
  });
}

export async function dbGetEnvironmentPresetList() {
  let url = getDistRootUrl();
  let headers = makeHttpHeaders();
  let params = makeHttpParams("dbGetEnvironmentPresetList", []);
  let response = AppComponent.app.http.post(url, params, {headers});

  let result: any;

  await lastValueFrom(response).then(function (data: any) {
    result = data;
  })

  return result;
}

export async function addToCart() {
  await dbSavePreset(true);

  if (environment.isWooCommerce) {
    window.dispatchEvent(new CustomEvent('oneringconf:add-to-cart', {
      detail: {
        presetId: AppComponent.app.state.preset_id,
        rings: RingData.list
      }
    }));
  }

  Log("info", "Konfiguration gespeichert");
}
