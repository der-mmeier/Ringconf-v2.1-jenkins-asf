import {Component, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {iProfile} from "../app.interfaces";
import {onRingDataPropertyChange} from "../property-sync-dialog/property-sync-dialog.component";
import {environment} from "../../environments/environment";

@Component({
    selector: 'x-config-dimension',
    templateUrl: './config-dimension.component.html',
    styleUrls: ['./config-dimension.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class ConfigDimensionComponent
{
  @Input() ringId: number = 0;
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  getOptions_ringWidth(ringId: number): any[]
  {
    let result = [] as number[];

    let rw = this.app.data.ringWidth;
    let profile = this.app.data.profile.find(function (e:iProfile)
    {
      return e.name == RingData.list[ringId].profileName;
    })
    if (profile)
    {
      if (profile.rw)
        rw = profile.rw;
    }

    for (let i = rw.min; i <= rw.max; i += rw.step)
    {
      result.push(i);
    }

    return result;
  }

  setOption(property:string, event:any) {
    // @ts-ignore
    this.ringData[this.ringId][property]=event;
    onRingDataPropertyChange(this.ringId, property);
  }

  getOptions_ringHeight(ringId: number): any[]
  {
    let result = [] as number[];

    let rh = this.app.data.ringHeight;
    let profile = this.app.data.profile.find(function (e:iProfile)
    {
      return e.name == RingData.list[ringId].profileName;
    })
    if (profile)
    {
      if (profile.rh)
        rh = profile.rh;
    }

    for (let i = rh.min; i <= rh.max; i += rh.step)
    {
      result.push(i);
    }

    return result;
  }

  getOptions_ringSize(ringId: number): any[]
  {
    let result = [] as number[];

    let rs = this.app.data.ringSize;
    let profile = this.app.data.profile.find(function (e:iProfile)
    {
      return e.name == RingData.list[ringId].profileName;
    })
    if (profile)
    {
      if (profile.rs)
        rs = profile.rs;
    }

    for (let i = rs.min; i <= rs.max; i += rs.step)
    {
      result.push(i);
    }

    return result;
  }

  onFormat_mm(value: number):string
  {
    return ((value/1000).toFixed(1)) + " mm";
  }

  onFormat_ringSize(value: number):string
  {
    value /= 1000;
    return value.toFixed(1)+ " ("+(value / Math.PI).toFixed(1) + " mm)";
    // return (value / Math.PI).toFixed(1) + " mm (" + value.toFixed(1) + ")";
  }
}
