import {Component, ElementRef, Input, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {iGapMode, iProfile, iSurface} from "../app.interfaces";
import {onRingDataPropertyChange} from "../property-sync-dialog/property-sync-dialog.component";
import {environment} from "../../environments/environment";
import {cRing} from "../webgl/cRing";
import {ConfigStoneComponent} from "../config-stone/config-stone.component";
import {getStoneMode} from "../app.definitions";

@Component({
  selector: 'x-config-gap',
  templateUrl: './config-gap.component.html',
  styleUrls: ['./config-gap.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class ConfigGapComponent
{
  @Input() ringId: number = 0;
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  constructor(private elem: ElementRef)
  {
  }
  isDisabled_gapMode(value: number):boolean {

    if (this.ringData[this.ringId].waveCount > 1 && value == 2)
      return true;

    if (value == 0 && RingData.getForceGap(this.ringData[this.ringId]) == true)
      return true;

    return false;
  }
  setValue_gapMode(value: number)
  {
    this.ringData[this.ringId].gapMode = value;
    onRingDataPropertyChange(this.ringId, "gapMode");
  }
  isVisible_gapSettings():boolean {
    let gapModeId = this.ringData[this.ringId].gapMode;
    if (gapModeId == 0) return false;
    return true;
  }
  getOptions_gapWidth()
  {
    let gapModeId = this.ringData[this.ringId].gapMode;
    let gapMode = this.app.data.gapMode.find(function (e: iGapMode)
    {
      return e.id == gapModeId;
    })
    if (gapMode)
    {
      return gapMode.width;
    }

    return [];
  }
  setOption_gapWidth(value: number)
  {
    this.ringData[this.ringId].gapWidth = value;
    onRingDataPropertyChange(this.ringId, "gapWidth");
  }
  onValueFormat_gapWidth(value: number)
  {
    return (value / 1000).toFixed(1) + " mm";
  }
  onValueHidden_gapWidth(that: ConfigStoneComponent, value:number) {
    let ringData = that.ringData[that.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];
    let stoneMode = getStoneMode(stoneGroup.mode);
    let maxGapWidth = 10000;
    let ring = cRing.list.find(e => {
      return e.ringData.index == that.ringId;
    })
    if (ring) maxGapWidth = ring.calc.gwMax;

    if (stoneMode) {
      if (stoneMode.maxGapWidth !== undefined && stoneMode.maxGapWidth > 0) {
        if (stoneMode.maxGapWidth < maxGapWidth) maxGapWidth = stoneMode.maxGapWidth;
      }
    }

    return value > maxGapWidth;
  }
  getOptions_gapSurface()
  {
    let gapModeId = this.ringData[this.ringId].gapMode;
    let gapMode = this.app.data.gapMode.find(function (e: iGapMode)
    {
      return e.id == gapModeId;
    })
    if (gapMode)
    {
      return gapMode.surface;
    }

    return [];
  }
  setOption_gapSurface(value: number)
  {
    this.ringData[this.ringId].gapSurface = value;
    onRingDataPropertyChange(this.ringId, "gapSurface");
  }
  onValueFormat_gapSurface(value: number)
  {
    let surface = AppComponent.app.data.surface.find(function (e: iSurface)
    {
      return e.id == value;
    })
    if (surface)
      return "<div class='icon' style='background-image:url(" + environment.assetFolderLocation + "/assets/imgui/" + surface.img + ")'></div>" + surface.name;

    return value;
  }
  isHidden_gapElement(index: number)
  {
    let divMode = this.ringData[this.ringId].divPreset.slice(0, 1).toLowerCase();
    let numDiv = this.ringData[this.ringId].materialDiv.length;

    // Segmentiert oder horizontal geteilt
    if (divMode == "s" || divMode == "h" || numDiv < 2) return true;

    if (index >= numDiv - 1)
      return true;

    return false;
  }
  onToggleGapEnabled(index: number)
  {
    let gapEnabledAr = this.ringData[this.ringId].gapEnabled;
    RingData.setGapEnabled(this.ringData[this.ringId], index, gapEnabledAr[index] == 0 ? true : false);
  }
  getGapPositionString(index: number)
  {
    let ringData = this.ringData[this.ringId];

    let R = [], i, pos = 0, gapDiv = ringData.gapDiv;

    for (i = 0; i < gapDiv.length - 1; i++)
    {
      pos += gapDiv[i];
      R.push((pos * ringData.ringWidth / 10000000).toFixed(2) + ' mm');
    }

    if (index >= 0 && index < R.length)
      return R[index];
    return "";
  }
  onDeleteGap(index: number)
  {
    let gapDiv = this.ringData[this.ringId].gapDiv;
    if (index < 0 || index > gapDiv.length - 1) return;

    if (gapDiv.length == 2)
      gapDiv = [];
    else if (gapDiv.length > 2)
    {
      let t = gapDiv[index];
      gapDiv.splice(index, 1);
      gapDiv[index] += t;
    }

    RingData.setGapDivArray(this.ringData[this.ringId], gapDiv);
  }
  canAddGaps(): boolean
  {
    let that = this;
    // let ring = Ring3D.list.find(function (e: Ring3D)
    let ring = cRing.list.find(function (e)
    {
      return e.ringData.index == that.ringId;
    });
    // let ring = WebglRing.list.find(function (e: WebglRing)
    // {
    //   return e.ringData.index == that.ringId;
    // });

    if (ring)
      return ring.calc.gapDivMinMax.length > 0;

    return false;
  }
  onAddGap()
  {
    let that = this;
    let ring = cRing.list.find(function (e)
    {
      return e.ringData.index == that.ringId;
    });
    // let ring = WebglRing.list.find(function (e: WebglRing)
    // {
    //   return e.ringData.index == that.ringId;
    // });
    if (ring)
      ring.gapDiv_plus();
  }
  onGapChanging(index: number, value: number, ringId:number)
  {
    let gapItem = <HTMLDivElement> document.querySelector('.gap-item[data-index="' + index + '"][data-ringId="'+ringId+'"] .title .position');
    if (gapItem)
      gapItem.innerText = (value / 1000).toFixed(2) + " mm";
  }
  canSteps(): boolean
  {
    let profileName = this.ringData[this.ringId].profileName;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile)
    {
      return e.name == profileName;
    })
    if (profile)
    {
      if (profile.sw != undefined)
        return true;
    }

    return false;
  }
  setValue_stepMode(value: number)
  {
    this.ringData[this.ringId].stepMode = value;
    onRingDataPropertyChange(this.ringId, "stepMode");
  }
  getOptions_stepWidth(): number[]
  {
    let profileName = this.ringData[this.ringId].profileName;
    let profile = AppComponent.app.data.profile.find(function (e: iProfile)
    {
      return e.name == profileName;
    })
    if (profile)
    {
      if (profile.sw)
      {
        let maxStepWidth = (this.ringData[this.ringId].ringWidth - 1.0)/2 - profile.gapGapDistance;
        if (maxStepWidth > profile.sw.max) maxStepWidth = profile.sw.max;
        let result = [];
        for (let i = profile.sw.min; i <= profile.sw.max, i <= maxStepWidth; i += profile.sw.step)
          result.push(i);
        return result;
      }
    }

    return [];
  }
  onValueFormat_stepWidth(value: number)
  {
    return (value / 1000).toFixed(1) + " mm";
  }
  onSelect_stepWidth(index: number, value: number)
  {
    RingData.setStepWidth(this.ringData[this.ringId], index, value);

    let doSync = false;
    let targetId = this.ringId == 0 ? 1 : 0;
    if (index == 0) // linke Stufe
    {
      let stepMode = RingData.list[targetId].stepMode;
      if (stepMode == 1 || stepMode == 3)
      {
        let data = this.ringData[this.ringId].stepWidth;
        onRingDataPropertyChange(this.ringId, "stepWidth_left", function (id)
        {
          RingData.setStepWidth(RingData.list[id], 0, data[0]);
        })
      }
    }
    else if (index == 1) // rechte Stufe
    {
      let stepMode = RingData.list[targetId].stepMode;
      if (stepMode == 2 || stepMode == 3)
      {
        let data = this.ringData[this.ringId].stepWidth;
        onRingDataPropertyChange(this.ringId, "stepWidth_right", function (id)
        {
          RingData.setStepWidth(RingData.list[id], 1, data[1]);
        })
      }
    }
  }
  trackByFn(index:number, item:any) {
    return index;
  }
  forceGap(): boolean {
    return RingData.getForceGap(this.ringData[this.ringId]);
  }
  onValueFreeGapArrayChanged(value: number[]) {
    this.ringData[this.ringId].gapDiv = value;
  }

}

// interface iItem_mDiv
// {
//   id: number;
//   active: boolean;
// }
//
// interface iItem_gapDiv
// {
//   id: number;
//   pos: string;
// }

