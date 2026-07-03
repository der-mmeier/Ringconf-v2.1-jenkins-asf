import {Component, ElementRef, Input, ViewChild, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {iDivPreset, iMaterial, iProfile, iSurface} from "../app.interfaces";
import {onRingDataPropertyChange} from "../property-sync-dialog/property-sync-dialog.component";
import {environment} from "../../environments/environment";
import {DropdownComponent} from "../dropdown/dropdown.component";

@Component({
    selector: 'x-config-material',
    templateUrl: './config-material.component.html',
    styleUrls: ['./config-material.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})

export class ConfigMaterialComponent {
  @Input() ringId: number = 0;
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  items = [] as iDivPreset[];
  curPresetTitle = "";
  curPreset: iDivPreset | null = null;
  curMaterialIndex = 0;

  @ViewChild("materialDropDown") materialDropDown!: DropdownComponent;

  constructor() {
    this.closePresets();
  }

  isActive_preset(preset: iDivPreset) {
    let result = null;

    if (preset.divPreset == this.ringData[this.ringId].divPreset) {
      result = preset;
    }

    if (!result && preset.items) {
      let items = preset.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].divPreset == this.ringData[this.ringId].divPreset) {
          result = items[i];
          break;
        }
      }
    }

    this.curPreset = result;
    return this.curPreset ? true : false;
  }

  isDisabled_preset(preset: iDivPreset) {
    let ringData = this.ringData[this.ringId];

    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == ringData.profileName;
    })
    let gapMode = AppComponent.app.data.gapMode.find(e => {
      return e.id == ringData.gapMode;
    })

    if (preset.divPreset && !preset.divPreset.toUpperCase().startsWith("S") && !preset.divPreset.toUpperCase().startsWith("H") && profile && gapMode) {

      let div = preset.divPreset.split(":");
      div.shift();
      let mLength = div.length - 1;
      if ((profile.sideGapDistance * 2 + profile.gapGapDistance * mLength + gapMode.width[0] * mLength) >= ringData.ringWidth)
        return true;
    }

    if (preset.rwMin && preset.rwMin > ringData.ringWidth)
      return true;
    if (preset.rhMin && preset.rhMin > ringData.ringHeight)
      return true;


    if (preset.divPreset && preset.divPreset.charAt(0).toLowerCase() === 'w') {
      let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
        return e.name == ringData.profileName;
      })
      if (profile && (profile.wa.max < 1 || profile.wc.max < 1))
        return true;
    }

    if (preset.divPreset && preset.notProfile && preset.notProfile.indexOf(ringData.profileName) != -1)
      return true;

    return false;
  }

  selectPreset(item: iDivPreset) {
    if (item.items && item.name) {
      this.items = item.items;
      this.curPresetTitle = item.name;
    } else if (item.divPreset) {
      this.ringData[this.ringId].divPreset = item.divPreset;
      this.closePresets();

      onRingDataPropertyChange(this.ringId, "divPreset");
    }
  }

  closePresets() {
    this.items = this.app.data.divPreset;
    this.curPresetTitle = "Aufteilung";
  }

  isDiv_s(): boolean {
    let t = this.ringData[this.ringId].divPreset.split(":")[0].toUpperCase();
    return t == "D" || t == "DF";
  }

  isDiv_w(): boolean {
    let t = this.ringData[this.ringId].divPreset.split(":")[0].toUpperCase();
    return t == "W" || t == "WF";
  }

  isEnabled_surfaceSelector(): Boolean {
    let t = this.ringData[this.ringId].divPreset.split(":")[0].toUpperCase();
    if (t == "H" && this.curMaterialIndex > 0) return false;
    return true;
  }

  getOptions_wc(): number[] {
    let result = [] as number[];
    let prf = this.ringData[this.ringId].profileName;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == prf;
    })
    if (profile) {
      let i = profile.wc.min;
      let max = profile.wc.max;
      if (this.ringData[this.ringId].hasWave) {
        i = 2;
        max = profile.maxWaveCountMultipleWaves;
      }

      for (; i <= max; i += profile.wc.step)
        result.push(i);
    }
    return result;
  }

  setOption_wc(value: number) {
    this.ringData[this.ringId].waveCount = value;
    onRingDataPropertyChange(this.ringId, "waveCount");
  }

  getOptions_wa(): number[] {
    let result = [] as number[];
    let prf = this.ringData[this.ringId].profileName;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name == prf;
    })
    if (profile) {
      let max = profile.wa.max;
      if (this.ringData[this.ringId].hasWave)
        max = profile.maxWaveAmpMultipleWaves;

      for (let i = profile.wa.min; i <= max; i += profile.wa.step)
        result.push(i);
    }
    return result;
  }

  setOption_wa(value: number) {
    this.ringData[this.ringId].waveAmp = value;
    onRingDataPropertyChange(this.ringId, "waveAmp");
  }

  onValueFormat_wa(value: number): string {
    return value.toFixed(0) + " %";
  }

  /*
  gibt ein Array mit den Farbwerten zurück
   */
  getOptions_materialColor(): string[] {
    let ringData = this.ringData[this.ringId];
    let count = ringData.divPreset.split(':').length - 1;

    if (this.curMaterialIndex >= count)
      this.curMaterialIndex = 0;

    let result = [];
    for (let i = 0; i < count; i++) {
      let material = this.app.data.material.find(function (e: iMaterial) {
        return e.id == ringData.material[i];
      })
      if (material)
        result.push(material.colorHtml);
    }
    return result;
  }

  getValue_material(): iMaterial | undefined {
    let M = this.ringData[this.ringId].material[this.curMaterialIndex];
    return this.app.data.material.find(function (e: iMaterial) {
      return e.id == M;
    })
  }

  setValue_material(value: iMaterial) {
    RingData.setMaterial(this.ringData[this.ringId], this.curMaterialIndex, value.id);
    this.materialDropDown.value = this.getValue_material();
    let that = this;
    onRingDataPropertyChange(this.ringId, "material", function (index, data) {
      RingData.setMaterial(that.ringData[index], that.curMaterialIndex, data[that.curMaterialIndex]);
    })
  }

  onValueFormat_material(material: iMaterial) {
    return "<div class='icon' style='background-color:" + material.colorHtml + "'></div>" + material.name;
  }

  getOptions_surface(): iSurface[] {
    let ringData = this.ringData[this.ringId];
    let mDiv = ringData.materialDiv;

    let size = mDiv[this.curMaterialIndex] * ringData.ringWidth / 10000;

    let result = [] as iSurface[];

    this.app.data.surface.forEach(function (e: iSurface) {
      if (e.minSegmentWidth && e.minSegmentWidth > size) return;
      if (e.maxDivision && e.maxDivision < mDiv.length) return;
      result.push(e);
    })

    return result;
  }

  getValue_surface(): iSurface | undefined {
    let S = this.ringData[this.ringId].surface[this.curMaterialIndex];
    return this.app.data.surface.find(function (e: iSurface) {
      return e.id == S;
    })
  }

  setValue_surface(value: iSurface) {
    RingData.setSurface(this.ringData[this.ringId], this.curMaterialIndex, value.id);
    let that = this;
    onRingDataPropertyChange(this.ringId, "surface", function (index, data) {
      RingData.setSurface(that.ringData[index], that.curMaterialIndex, data[that.curMaterialIndex]);
    })
  }

  onValueFormat_surface(surface: iSurface) {
    return "<div class='icon' style='background-image:url(" + environment.assetFolderLocation + "/assets/imgui/" + surface.img + ")'></div>" + surface.name;
  }

  getValue_fineness(): number[] {
    return this.app.data.material[this.ringData[this.ringId].material[this.curMaterialIndex]].fineness;
  }

  isActive_fineness(value: number) {
    return this.ringData[this.ringId].fineness[this.curMaterialIndex] == value;
  }

  setValue_fineness(value: number) {
    RingData.setFineness(this.ringData[this.ringId], this.curMaterialIndex, value);
    let that = this;
    onRingDataPropertyChange(this.ringId, "fineness", function (index, data) {
      RingData.setFineness(that.ringData[index], that.curMaterialIndex, data[that.curMaterialIndex]);
    })
  }

  // sobald die Materialaufteilung bei den Ringen unterschiedlich ist, wird kein PropertySync mehr angeboten
  canPropertySync(): boolean {
    let result = true;
    let materialCount = this.ringData[this.ringId].materialDiv.length;

    RingData.list.forEach(f => {
      if (f.materialDiv.length != materialCount)
        result = false;
    });

    return result;
  }

  trackByFn(index: number, item: any) {
    return index;
  }


  // mts-horizontal
  // getValueGapArray(): number[] {
  //   return this.ringData[this.ringId].gapDiv.slice();
  // }

  onValueGapArrayChanged(value: number[]) {
    this.ringData[this.ringId].materialDiv = value;
  }

  // getRingWidth():number {
  //   return this.ringData[this.ringId].ringWidth;
  // }


}
