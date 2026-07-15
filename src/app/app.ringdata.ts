import {AppComponent} from "./app.component";
import {array_closest, array_closest_lower} from "./app.helper";
import {
  iFreeStone,
  iGapMode,
  iMaterial, iMaterialExclude,
  iPresetStone,
  iProfile, iStepMode,
  iStoneDistribution,
  iStoneMode,
  iStoneQuality,
  iStoneSize,
  iStoneCut, iSurface
  , ExteriorEngravingType
} from "./app.interfaces";
import {Log} from "./logger/logger.component";
import {
  findStoneCut,
  getAllowedStoneSizes,
  getStoneColorById,
  getStoneCutId,
  getStoneSettingMode,
  mapQualityToLegacyIndex,
  normalizeStoneSelection
} from "./stone-taxonomy";
import {
  cloneExteriorEngravingConfig,
  hasActiveStoneGroups,
  normalizeExteriorEngravingConfig,
  parseCoordinateInput
} from "./exterior-engraving";

export class RingData {
  static list: RingData[] = [];

  constructor() {
    this._index = RingData.list.length;
    RingData.list.push(this);

    this.name = (this._index == 0) ? "Damenring" : ((this._index == 1) ? "Herrenring" : "");
    RingData.reset(this);
  }

  clone(other: RingData) {
    this._blockDirty = true;
    for (let otherKey in other) {
      if (otherKey in this) { // @ts-ignore
        this[otherKey] = other[otherKey];
      }
    }
    this._profileName = RingData.validateProfile(this._profileName);
    this._stone.forEach(stoneGroup => {
      normalizeStoneSelection(stoneGroup, AppComponent.app.data, {
        stoneMode: stoneGroup.mode,
        settingMode: getStoneSettingMode(stoneGroup.mode),
      });
    });
    this._exteriorEngraving = normalizeExteriorEngravingConfig(this._exteriorEngraving);
    this._blockDirty = false;
    this.isDirty = true;
  }

  static reset(that: RingData) {
    that._materialDiv = [5000];
    that._gapDiv = [] as number[];
    that._gapWidth = 300;
    that._gapMode = 3;
    that._gapSurface = 0;
    that._gapEnabled = [1, 1, 1, 1];
    that._gapPearlingEnabled = false;
    that._gapPearlingSize = 500;
    that._stepPearlingEnabled = false;
    that._stepPearlingSize = 500;
    that._ringWidth = 5000;
    that._ringHeight = 1600;
    that._ringSize = that._index == 0 ? 54000 : 64000;
    that._stepMode = 0;
    RingData.setStepWidth(that, 0, 0);
    RingData.setStepWidth(that, 1, 0);
    that.profileName = "P3";
    that._material = [0, 5, 0, 1, 0];
    that._surface = [0, 1, 0, 0, 0];
    that._fineness = [333, 333, 333, 333, 333];
    that.divPreset = "-:1";
    that._cartActive = true;
    that._waveAmp = 60;
    that._waveCount = 5;
    if (AppComponent.app.state.debug) {
      that._engraving = "Build " + AppComponent.app.state.build;
    } else
    that._engraving = "";
    that._engravingFont = 0;
    that._exteriorEngraving = cloneExteriorEngravingConfig();
    that._stone =
      [{
        mode: that._index == 0 ? 10 : 0,
        count: 1,
        countReal: 1,
        rows: 1,
        type: 1,
        stoneCut: "brilliant",
        stoneType: "natural-diamond",
        size: 1900,
        distribution: 0,
        quality: 0,
        stoneQuality: "diamond-g-si1",
        stoneColor: null,
        colorId: null,
        color: null,
        colorName: null,
        colorHex: null,
        positionValue: 0.0,
        positionDiv: [5000, 5000]
      }];

    this.resetStonegroup(that, 0);

    that._isDirty = true;
  }

  name = "unnamed";

  protected _isDirty = true;
  protected _blockDirty = false;

  get isDirty() {
    return this._isDirty;
  }

  set isDirty(value: boolean) {
    if (!value)
      this._isDirty = false;
    else {
      if (!this._blockDirty)
        this._isDirty = true;
    }
  }

  set blockDirty(value: boolean) {
    this._blockDirty = value;
  }

  protected _cartActive = true;
  get cartActive(): boolean {
    return this._cartActive;
  }

  set cartActive(value: boolean) {
    let list = RingData.list;

    if (!value) {
      let i = 0;

      if (this._index == 0)
        i = 1;

      if (list[i].cartActive)
        this._cartActive = false;
    } else
      this._cartActive = true;

    if (list[0].cartActive && !list[1].cartActive) {
      AppComponent.app.state.configMode = 0;
    } else if (!list[0].cartActive && list[1].cartActive) {
      AppComponent.app.state.configMode = 1;
    }

    this.isDirty = true;
  }

  protected _index = -1;
  get index(): number {
    return this._index;
  }

  protected _price = 9999.00;
  get price(): number {
    return this._price;
  }

  set price(value: number) {
    this._price = value;
  }

  public calcTime = 0;

  protected _profileName = "";
  get profileName(): string {
    return this._profileName;
  }

  set profileName(value: string) {
    value = RingData.validateProfile(value);

    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == value;
    })

    if (profile) {
      this._blockDirty = true;
      this._profileName = value;
      let temp = this._ringWidth;
      this.ringWidth = this._ringWidth;
      if (this._ringWidth != temp) Log("info", "Die Ringbreite wurde angepasst");
      temp = this._ringHeight;
      this.ringHeight = this._ringHeight;
      if (this._ringHeight != temp) Log("info", "Die Ringhöhe wurde angepasst");
      if (this._stepMode > 0 && !profile.sw) Log("info", "Bei dem gewählten Profil sind keine Stufen möglich");
      this._stepMode = profile.sw ? this._stepMode : 0;
      this._stepDepth = profile.sd ?? 0;
      this._blockDirty = false;
      this.isDirty = true;
    }
  }

  static validateProfile(value:string):string {
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == value;
    })

    if (profile != undefined) return value;
    return AppComponent.app.data.profile[0].name;
  }

  protected _ringWidth = 1.0;
  get ringWidth(): number {
    return this._ringWidth;
  }

  set ringWidth(value: number) {
    let that = this;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == that._profileName;
    })

    if (profile) {
      let rw = AppComponent.app.data.ringWidth;
      if (profile.rw)
        rw = profile.rw;
      if (value < rw.min)
        value = rw.min;
      else if (value > rw.max)
        value = rw.max;

      if (this._ringWidth != value) {
        this._ringWidth = value;
        if (profile.syncRwRh && this._ringHeight != this._ringWidth) {
          this.ringHeight = value;
        }
        this.isDirty = true;
      }
    } else
      this.profileName = AppComponent.app.data.profile[0].name;
  }

  protected _ringHeight = 1.5;
  get ringHeight(): number {
    return this._ringHeight;
  }

  set ringHeight(value: number) {
    let that = this;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == that._profileName;
    })

    if (profile) {
      let rh = AppComponent.app.data.ringHeight;
      if (profile.rh)
        rh = profile.rh;
      if (value < rh.min)
        value = rh.min;
      else if (value > rh.max)
        value = rh.max;

      if (this._ringHeight != value) {
        this._ringHeight = value;
        if (profile.syncRwRh && this._ringWidth != this._ringHeight) {
          this.ringWidth = value;
        }
        this.isDirty = true;
      }
    } else
      this.profileName = AppComponent.app.data.profile[0].name;
  }

  protected _ringSize = 56;
  get ringSize(): number {
    return this._ringSize;
  }

  set ringSize(value: number) {
    if (value != this._ringSize) {
      let rs = AppComponent.app.data.ringSize;
      if (value < rs.min)
        value = rs.min;
      else if (value > rs.max)
        value = rs.max;

      if (this._ringSize != value) {
        this._ringSize = value;
        this.isDirty = true;
      }
    }
  }

  protected _divPreset = ""
  get divPreset(): string {
    return this._divPreset;
  }

  set divPreset(value: string) {
    let div = value.split(':');
    if (div) {
      this._blockDirty = true;
      let isH = div[0].toUpperCase() == "H";

      if (isNaN(Number.parseFloat(div[0])))
        div.shift();

      let floatDiv = [] as number[];
      div.forEach(e => {
        floatDiv.push(parseFloat(e));
      })

      let sum = floatDiv.reduce(function (a, b) {
        return a + b;
      });

      floatDiv.forEach(function (e, index) {
        floatDiv[index] = Math.floor(e * 10000 / sum);
      })

      this._divPreset = value;
      this._materialDiv = floatDiv;

      /*
      Horizontal geteilter Ring ist innen immer poliert
       */
      if (isH) RingData.setSurface(this, 1, 0);

      /*
      Wenn Fugenmodus auf "Keine" ist, dann soll eine U-Fuge mit 0.3mm eingestellt werden
       */
      if (this._gapMode == 0) {
        this._gapWidth = 300;
        this.gapMode = 3;
      }


      RingData.checkWave(this);

      this._blockDirty = false;
      this.isDirty = true;
    }
  }

  get hasWave() {
    let char = this.divPreset.substring(0, 1).toLowerCase();
    return char == "w" || char == "d";
  }

  get hasFreeDiv() {
    let char = this.divPreset.substring(0, 1).toLowerCase();
    if (char == "f") return true;
    char = this.divPreset.substring(1, 2).toLowerCase();
    return char == "f";
  }

  static checkWaveLoop = false;
  static checkWave(that: RingData) {

    if (this.checkWaveLoop) return;

    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == that.profileName;
    })

    if (!profile) {

      this.checkWaveLoop = true;
      that.divPreset = "-:1";
      this.checkWaveLoop = false;
      Log("error", "Profil nicht gefunden");
      return;
    }

    let mode = that._divPreset.split(":")[0].toUpperCase();

    if (mode == "D" || mode == "DF") {
      that._waveCount = 1;
      if (that._waveAmp < profile.wa.min) {
        that._waveAmp = profile.wa.min;
        Log("info", "Die Schrägenhöhe wurde angepasst");
      } else if (that._waveAmp > profile.wa.max) {
        that._waveAmp = profile.wa.max;
        Log("info", "Die Schrägenhöhe wurde angepasst");
      }
    } else if (mode == "W" || mode == "WF") {
      if (that._waveAmp < profile.wa.min) {
        that._waveAmp = profile.wa.min;
        Log("info", "Die Wellenhöhe wurde angepasst");
      } else if (that._waveAmp > profile.wa.max) {
        that._waveAmp = profile.wa.max;
        Log("info", "Die Wellenhöhe wurde angepasst");
      }

      let min = Math.max(2, profile.wc.min);
      if (that._waveCount < min) {
        that._waveCount = min;
        Log("info", "Die Wellenanzahl wurde angepasst");
      } else if (that._waveCount > profile.wc.max) {
        that._waveCount = profile.wc.max;
        Log("info", "Die Wellenanzahl wurde angepasst");
      }
    } else //if (mode == "S" || mode == "H")
    {
      that._waveAmp = 0;
      that._waveCount = 0;
    }
  }

  protected _materialDiv = [1];
  get materialDiv(): number[] {
    return this._materialDiv;
  }

  set materialDiv(value: number[]) {
    let max = Math.min(this._materialDiv.length, value.length);
    for (let i = 0; i < max; i++)
      this._materialDiv[i] = value[i];
    this.isDirty = true;
  }

  protected _material = [0, 5, 0, 1, 0];
  get material(): number[] {
    return this._material.slice(0);
  }

  static setMaterial(that: RingData, index: number, materialId: number) {

    const numMaterialsInUse = that.divPreset.split(':').length - 1;
    const testMaterials = that._material.slice(0, numMaterialsInUse);

    let excluded = AppComponent.app.data.materialExclude;
    if (numMaterialsInUse> 1 && excluded != null) {
      for (let i = 0; i < excluded.length; i++) {
        if (excluded[i].id_a == materialId) {
          if (testMaterials.indexOf(excluded[i].id_b) != -1) {
            Log("info", "Diese Materialkombination ist nicht zulässig");
            return;
          }
        }
        if (excluded[i].id_b == materialId) {
          if (testMaterials.indexOf(excluded[i].id_a) != -1) {
            Log("info", "Diese Materialkombination ist nicht zulässig");
            return;
          }
        }
      }
    }

    that._material[index] = materialId;
    RingData.setFineness(that, index, that._fineness[index])

    if (numMaterialsInUse < that._material.length) {
      that._material.fill(materialId, numMaterialsInUse);
      that._fineness.fill(that._fineness[index], numMaterialsInUse);
    }
  }

  protected _surface = [0, 0, 0, 0, 0];
  get surface(): number[] {
    return this._surface.slice(0);
  }

  static setSurface(that: RingData, index: number, surfaceId: number) {
    let surface = AppComponent.app.data.surface.find(function (e: iSurface) {
      return e.id == surfaceId;
    })

    if (surface) {
      that._surface[index] = surfaceId;
      RingData.checkSurface(that);
      that.isDirty = true;
    }
  }

  static checkSurface(that: RingData): string {
    let i: number, count = that.materialDiv.length, surface, S = that.surface, size = [] as number[],
      rw = that.ringWidth, result = "material";

    that.materialDiv.forEach(function (e) {
      size.push(e * rw / 10000);
    });

    for (i = 0; i < count; i++) {
      surface = AppComponent.app.data.surface.find(function (e) {
        return e.id == S[i];
      });

      if (surface) {
        if ((surface.minSegmentWidth && surface.minSegmentWidth > size[i]) ||
          (surface.maxDivision && surface.maxDivision < count)) {
          that._surface[i] = 0;
          that.isDirty = true;
          Log("info", "Die Oberfläche wurde angepasst " + surface.minSegmentWidth + " " + size[i]);
        }
        if (surface.forceGap) { // Trennfuge erzwingen?
          if (that.gapMode == 0) {
            Log("info", "Die gewählte Oberfläche erfordert aktive Trennfugen.");
            that.gapMode = 3;
          }
          if (!that.gapEnabled[i]) {
            RingData.setGapEnabled(that, i, true);
            Log("info", "Die Trennfuge " + (i + 1) + " muss aktiv bleiben.");
            result = "all";
          }
        }
      } else {
        that._surface[i] = 0;
        Log("error", "Die Oberfläche wurde nicht gefunden");
      }
    }

    return result;
  }

  protected _fineness = [333, 585, 333, 333, 333];
  get fineness(): number[] {
    return this._fineness.slice(0);
  }

  static setFineness(that: RingData, index: number, fineness: number) {
    that._blockDirty = true;

    let M = that.material;
    let materialId = M[index];
    let material = AppComponent.app.data.material.find(function (e: iMaterial) {
      return e.id == materialId;
    });

    if (!material) {
      this.setMaterial(that, index, AppComponent.app.data.material[0].id);
      return; // setMaterial() ruft diese Funktion wieder auf...
    }

    if (material.fineness.findIndex(function (e: number) {
      return e == fineness;
    }) == -1) {
      fineness = array_closest(material.fineness, fineness);
    }

    let F = that.fineness;
    // suche nach gleichem Feingehalt in den anderen Materialien und setze diesen gleich
    F.forEach(function (e, index) {
      materialId = M[index];
      material = AppComponent.app.data.material.find(function (e: iMaterial) {
        return e.id == materialId;
      }) || AppComponent.app.data.material[0];

      if (M[index] != material.id) {
        RingData.setMaterial(that, index, material.id);
      }
      if (material.fineness.find(function (e: number) {
        return e == fineness;
      })) {
        // Feingehalt ist in diesem Material möglich, setze diesen
        that._fineness[index] = fineness;
      }
    })

    that._blockDirty = false;
    that.isDirty = true;
  }

  protected _waveAmp = 1;
  get waveAmp(): number {
    return this._waveAmp;
  }

  set waveAmp(value: number) {
    let prf = this.profileName;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == prf;
    })

    if (profile) {
      if (value < profile.wa.min) value = profile.wa.min;
      else if (value > profile.wa.max) value = profile.wa.max;

      if (this._waveAmp != value) {
        this._waveAmp = value;
        RingData.checkWave(this);
        this.isDirty = true;
      }
    } else
      this._waveAmp = 0;
  }

  protected _waveCount = 1;
  get waveCount(): number {
    return this._waveCount;
  }

  set waveCount(value: number) {
    let prf = this.profileName;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == prf;
    })

    if (profile) {
      if (value < profile.wc.min) value = profile.wc.min;
      else if (value > profile.wc.max) value = profile.wc.max;

      if (this._waveCount != value) {
        this._waveCount = value;
        RingData.checkWave(this);
        this.isDirty = true;
      }
    } else
      this._waveCount = 0;
  }

  protected _gapDiv = [1];
  get gapDiv(): number[] {
    return this._gapDiv;
  }

  set gapDiv(value: number[]) {
    let max = Math.min(this._gapDiv.length, value.length);
    for (let i = 0; i < max; i++)
      this._gapDiv[i] = value[i];
    this.isDirty = true;
  }

  static setGapDivArray(that: RingData, ar: number[]) {
    that._gapDiv = ar;
    that.isDirty = true;
  }

  protected _gapMode = 3;
  get gapMode() {
    return this._gapMode;
  }

  set gapMode(value: number) {
    if (value == 0 && RingData.getForceGap(this) == true) {
      Log("info", "Die gewählte Oberfläche erfordert aktive Trennfugen.");
      return;
    }

    let gapMode = AppComponent.app.data.gapMode.find(function (e: iGapMode) {
      return e.id == value;
    })
    if (gapMode) {
      this._gapMode = value;
      this._gapDepth = gapMode.depth;
      this._gapWidth = array_closest(gapMode.width, this._gapWidth);
      this._gapSurface = array_closest(gapMode.surface, this._gapSurface);

      if (value == 0) {
        this._gapDiv = [1];
      }

      this.isDirty = true;
    }
  }

  protected _gapWidth = 300;
  get gapWidth() {
    return this._gapWidth;
  }

  set gapWidth(value: number) {
    let gapModeId = this._gapMode;
    let gapMode = AppComponent.app.data.gapMode.find(function (e: iGapMode) {
      return e.id == gapModeId;
    })
    if (!gapMode) {
      this._gapMode = AppComponent.app.data.gapMode[0].id;
      gapMode = AppComponent.app.data.gapMode[0];
    }

    this._gapWidth = array_closest_lower(gapMode.width, value);
    if (this._gapWidth !== value) Log("info", "Die Fugenbreite wurde angepasst");
    this.isDirty = true;
  }

  protected _gapDepth = 0;
  get gapDepth() {
    return this._gapDepth;
  }

  protected _gapSurface = 0;
  get gapSurface() {
    return this._gapSurface;
  }

  set gapSurface(value: number) {
    let gapModeId = this._gapMode;
    let gapMode = AppComponent.app.data.gapMode.find(function (e: iGapMode) {
      return e.id == gapModeId;
    })
    if (gapMode) {
      this._gapSurface = array_closest(gapMode.surface, value);
      this.isDirty = true;
    }
  }

  protected _gapEnabled = [1, 1, 1, 1];
  get gapEnabled() {
    return this._gapEnabled;
  }

  protected _gapPearlingEnabled = false;
  get gapPearlingEnabled(): boolean {
    return this._gapPearlingEnabled;
  }

  set gapPearlingEnabled(value: boolean) {
    const next = value === true;
    if (this._gapPearlingEnabled !== next) {
      this._gapPearlingEnabled = next;
      this.isDirty = true;
    }
  }

  protected _gapPearlingSize = 500;
  get gapPearlingSize(): number {
    return this._gapPearlingSize;
  }

  set gapPearlingSize(value: number) {
    const next = Number(value);
    if (Number.isFinite(next) && this._gapPearlingSize !== next) {
      this._gapPearlingSize = next;
      this.isDirty = true;
    }
  }

  protected _stepPearlingEnabled = false;
  get stepPearlingEnabled(): boolean {
    return this._stepPearlingEnabled;
  }

  set stepPearlingEnabled(value: boolean) {
    const next = value === true;
    if (this._stepPearlingEnabled !== next) {
      this._stepPearlingEnabled = next;
      this.isDirty = true;
    }
  }

  protected _stepPearlingSize = 500;
  get stepPearlingSize(): number {
    return this._stepPearlingSize;
  }

  set stepPearlingSize(value: number) {
    const next = Number(value);
    if (Number.isFinite(next) && this._stepPearlingSize !== next) {
      this._stepPearlingSize = next;
      this.isDirty = true;
    }
  }

  static getForceGap(that: RingData): boolean {
    // auf erzwungene Fugen prüfen
    let divCount = that.divPreset.split(":").length - 1;
    let forceGap = false;

    for (let i = 0; i < divCount; i++) {

      let surface = AppComponent.app.data.surface.find(function (e) {
        return e.id == that.surface[i];
      })
      if (surface && surface.forceGap) {
        forceGap = true;
        break;
      }
    }

    return forceGap;
  }

  static setGapEnabled(that: RingData, index: number, enabled: boolean) {
    if (!enabled) {
      // auf erzwungene Fugen prüfen
      // let divCount = that.divPreset.split(":").length - 1;
      // let forceGap = false;
      //
      // for (let i = 0; i < divCount; i++) {
      //
      //   let surface = AppComponent.app.data.surface.find(function (e) {
      //     return e.id == that.surface[i];
      //   })
      //   if (surface && surface.forceGap) {
      //     forceGap = true;
      //     break;
      //   }
      // }

      let forceGap = RingData.getForceGap(that);

      if (forceGap) {
        Log("info", "Die gewählte Oberfläche erfordert aktive Trennfugen.");
        return;
      }
    }

    if (index >= 0 && index < 4) {
      that._gapEnabled[index] = enabled ? 1 : 0;
      that.isDirty = true;
    }
  }

  protected _stepMode = 0;
  get stepMode() {
    return this._stepMode;
  }

  set stepMode(value: number) {
    let that = this;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == that.name;
    })
    if (profile && !profile.sw) {
      if (this._stepMode != 0) {
        this._stepMode = 0;
        Log("info", "Das gewähöte Profil erlaubt keine Stufen");
        return;
      }
      return;
    }
    let stepMode = AppComponent.app.data.stepMode.find(function (e: iStepMode) {
      return e.id == value;
    })
    if (stepMode) {
      this._stepMode = value;
      this.isDirty = true;
    }
  }

  protected _stepWidth = [300, 300];
  get stepWidth() {
    return this._stepWidth;
  }

  static setStepWidth(that: RingData, index: number, width: number) {
    if (that._stepMode == 0)
      return;

    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == that.profileName;
    })
    if (profile && profile.sw) {
      let ar = [] as number[];
      for (let i = profile.sw.min; i <= profile.sw.max; i += profile.sw.step)
        ar.push(i);

      that.stepWidth[index] = array_closest(ar, width);
    } else
      that.stepMode = 0;

    that.isDirty = true;
  }

  protected _stepDepth = 300;
  get stepDepth() {
    return this._stepDepth;
  }

  protected _engraving = "";
  get engraving() {
    return this._engraving;
  }

  set engraving(value: string) {
    this._engraving = value;
    this.isDirty = true;
  }

  protected _engravingFont = 0;
  get engravingFont() {
    return this._engravingFont;
  }

  set engravingFont(value: number) {
    this._engravingFont = value;
    this.isDirty = true;
  }

  protected _exteriorEngraving = cloneExteriorEngravingConfig();
  get exteriorEngraving() {
    return this._exteriorEngraving;
  }

  set exteriorEngraving(value) {
    this._exteriorEngraving = normalizeExteriorEngravingConfig(value);
    this.isDirty = true;
  }

  get hasExteriorEngraving(): boolean {
    return this._exteriorEngraving.enabled && this._exteriorEngraving.type !== "none";
  }

  get hasActiveStoneSetting(): boolean {
    return hasActiveStoneGroups(this._stone);
  }

  protected _stone = [] as iPresetStone[];
  get stone() {
    return this._stone
  };

  static setExteriorEngravingType(that: RingData, type: ExteriorEngravingType) {
    const next = cloneExteriorEngravingConfig(that._exteriorEngraving);
    next.enabled = type !== "none";
    next.type = type;
    if (type === "none") {
      that._exteriorEngraving = cloneExteriorEngravingConfig();
    } else {
      if ((type === "text" || type === "coordinates") && next.placement === "split-pair") {
        next.placement = "single-ring";
      }
      if (type === "waveform") {
        next.previewAssetId = "waveform-sample";
        next.customerAssetRequiredAfterOrder = true;
      } else if (type === "fingerprint") {
        next.previewAssetId = "fingerprint-sample";
        next.customerAssetRequiredAfterOrder = true;
      } else {
        next.previewAssetId = null;
        next.customerAssetRequiredAfterOrder = false;
      }
      that._exteriorEngraving = normalizeExteriorEngravingConfig(next);
    }
    that.isDirty = true;
  }

  static setExteriorEngravingPlacement(that: RingData, placement: "single-ring" | "both-identical" | "split-pair") {
    const next = cloneExteriorEngravingConfig(that._exteriorEngraving);
    next.placement = placement;
    that._exteriorEngraving = normalizeExteriorEngravingConfig(next);
    that.isDirty = true;
  }

  static setExteriorEngravingText(that: RingData, text: string) {
    const maxLength = AppComponent.app.data.engraving?.exterior?.maxTextLength ?? AppComponent.app.data.engraving.maxLength;
    const nextText = String(text ?? "").slice(0, maxLength);
    if (!nextText.trim()) {
      that._exteriorEngraving = cloneExteriorEngravingConfig();
      that.isDirty = true;
      return;
    }
    const next = cloneExteriorEngravingConfig(that._exteriorEngraving);
    next.text = nextText;
    next.type = "text";
    next.enabled = true;
    that._exteriorEngraving = normalizeExteriorEngravingConfig(next);
    that.isDirty = true;
  }

  static setExteriorEngravingFont(that: RingData, fontId: number | string) {
    const next = cloneExteriorEngravingConfig(that._exteriorEngraving);
    next.fontId = fontId;
    that._exteriorEngraving = normalizeExteriorEngravingConfig(next);
    that.isDirty = true;
  }

  static setExteriorCoordinates(that: RingData, latitudeInput: string, longitudeInput: string, showShipWheel: boolean) {
    const next = cloneExteriorEngravingConfig(that._exteriorEngraving);
    next.type = "coordinates";
    next.enabled = true;
    next.latitudeInput = latitudeInput;
    next.longitudeInput = longitudeInput;
    next.latitude = parseCoordinateInput(latitudeInput, -90, 90);
    next.longitude = parseCoordinateInput(longitudeInput, -180, 180);
    next.showShipWheel = showShipWheel;
    that._exteriorEngraving = normalizeExteriorEngravingConfig(next);
    that.isDirty = true;
  }

  static setStoneMode(that: RingData, group: number, mode: iStoneMode) {
    if (group < 0 || group >= that.stone.length)
      return;
    if (mode.mode != undefined) {
      let G = that.stone[group];
      let prevMode = G.mode;

      if (mode.mode == 11) {
        if (G.mode != 11) G.freeStones = [] as iFreeStone[];
      } else
        G.freeStones = [] as iFreeStone[];

      G.mode = mode.mode;

      if (mode.mode == 1 || mode.mode == 20 || mode.mode == 42 || mode.mode == 43 || mode.mode == 44 || mode.mode == 45) {
        G.distribution = 0;
        if (G.count < 0 && G.count > -100) {
          G.count = 1;
          Log("info", "Die gewählte Steinanzahl muss neu gewählt werden.");
        }
        G.type = 1;
      }
      if (mode.mode == 31) {
        if (mode.mode != prevMode) {
          G.distribution = 0;
          G.size = 1000;
          G.count = 99;
          G.type = 1;
        }
      }
      if (mode.mode == 35) {
        G.distribution = 0;
        G.count = 1;
        G.type = 1;
        G.positionDiv = [5000, 5000];
      }

      that.isDirty = true;
    }
  }

  static setStoneCut(that: RingData, group: number, type: iStoneCut) {
    if (group < 0 || group >= that.stone.length)
      return;
    let G = that.stone[group];
    G.stoneCut = getStoneCutId(type);
    G.type = Number(type.legacyId ?? type.id);

    // prüfe ob die vorhandene Steingröße beim gewählten Typ möglich ist

    if (type.size[0].size > G.size)
      G.size = type.size[0].size;

    that.isDirty = true;
  }

  static clearStonegroup(that: RingData, group: number) {
    if (group < 0 || group >= that.stone.length)
      return;
    const G = that.stone[group];
    G.mode = 0;
    G.count = 0;
    G.countReal = 0;
    G.rows = 1;
    G.freeStones = [];
    that.isDirty = true;
  }

  static setStoneType(that: RingData, group: number, stoneType: string) {
    if (group < 0 || group >= that.stone.length)
      return;
    const G = that.stone[group];
    G.stoneType = stoneType;
    normalizeStoneSelection(G, AppComponent.app.data, {
      stoneMode: G.mode,
      settingMode: getStoneSettingMode(G.mode),
    });
    that.isDirty = true;
  }

  static setStoneSize(that: RingData, group: number, size: iStoneSize) {
    if (group < 0 || group >= that.stone.length)
      return;
    let G = that.stone[group];
    G.size = size.size;
    normalizeStoneSelection(G, AppComponent.app.data, {
      stoneMode: G.mode,
      settingMode: getStoneSettingMode(G.mode),
    });
    that.isDirty = true;
  }

  static setStoneQuality(that: RingData, group: number, quality: iStoneQuality) {
    if (group < 0 || group >= that.stone.length)
      return;
    let G = that.stone[group];
    G.stoneQuality = String(quality.id);
    G.quality = mapQualityToLegacyIndex(AppComponent.app.data, G.stoneQuality, G.quality);
    that.isDirty = true;
  }

  static setStoneColor(that: RingData, group: number, color: string | null) {
    if (group < 0 || group >= that.stone.length)
      return;
    if (color !== null && !getStoneColorById(AppComponent.app.data, color))
      return;
    let G = that.stone[group];
    const colorDef = color ? getStoneColorById(AppComponent.app.data, color) : null;
    G.stoneColor = colorDef?.id ?? null;
    G.colorId = colorDef?.id ?? null;
    G.color = colorDef?.name ?? null;
    G.colorName = colorDef?.name ?? null;
    G.colorHex = colorDef?.hex ? colorDef.hex.toUpperCase() : null;
    that.isDirty = true;
  }

  static setStoneDistribution(that: RingData, group: number, distribution: iStoneDistribution) {
    if (group < 0 || group >= that.stone.length)
      return;
    let G = that.stone[group];
    G.distribution = distribution.id;
    G.lastSetting = "distribution";
    that.isDirty = true;
  }

  static setStoneCount(that: RingData, group: number, count: number) {
    if (group < 0 || group >= that.stone.length)
      return;
    let G = that.stone[group];
    G.count = count;
    G.lastSetting = "count";
    // if (count < 0 && G.distribution >= 33) {
    //   G.distribution = 0;
    // }
    that.isDirty = true;
  }

  static setStoneRows(that: RingData, group: number, rows: number) {
    if (group < 0 || group >= that.stone.length)
      return;
    let G = that.stone[group];
    G.rows = rows;
    that.isDirty = true;
  }

  // static setStonePositionMode(that: RingData, group: number, position: iStonePosition)
  // {
  //   let G = that.stone[group];
  //   G.positionId = position.id;
  //   let value = 0.0;
  //   if (position.id != 2) value = position.id;
  //   G.positionValue = value;
  //   that.isDirty = true;
  // }
  static setStonePositionValue(that: RingData, group: number, position: number, noDirtyMessage: boolean = false) {
    if (group < 0 || group >= that.stone.length)
      return;
    let G = that.stone[group];
    // G.positionValue = position;
    // let ar = [position];
    let ar = [Math.trunc(position * 10000 / that.ringWidth)];
    ar.push(10000 - ar[0]);
    G.positionDiv = ar;
    if (!noDirtyMessage)
      that.isDirty = true;
  }

  static setStonePositionDiv(that: RingData, group: number, position: number[]) {
    if (position.length != 2)
      return;
    if (group < 0 || group >= that.stone.length)
      return;

    let sum = position.reduce(function (a, b) {
      return a + b;
    })

    let ar = [Math.trunc(position[0] * 10000 / sum), 0];
    ar[1] = 10000 - ar[0];

    let G = that.stone[group];
    G.positionDiv = ar;
    that.isDirty = true;
  }

  static resetStonegroup(that: RingData, group: number) {
    if (group < 0 || group >= that.stone.length)
      return;

    let G = that.stone[group];
    G.mode = that._index == 0 ? 10 : 0;
    G.count = 1;
    G.countReal = 1;
    G.rows = 1;
    G.type = 1;
    G.stoneCut = "brilliant";
    G.stoneType = "natural-diamond";
    G.size = 1900;
    G.distribution = 0;
    G.quality = 0;
    G.stoneQuality = "diamond-g-si1";
    G.stoneColor = null;
    G.colorId = null;
    G.color = null;
    G.colorName = null;
    G.colorHex = null;
    G.positionValue = 0.0;
    G.positionDiv = [5000, 5000];
  }
}

