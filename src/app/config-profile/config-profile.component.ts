import {Component, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {environment} from "../../environments/environment";

@Component({
    selector: 'x-config-profile',
    templateUrl: './config-profile.component.html',
    styleUrls: ['./config-profile.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class ConfigProfileComponent
{
  app: AppComponent = AppComponent.app;
  ringData: RingData[] = RingData.list;
  env = environment;

  setProfile(profileName: string)
  {
    if (this.app.state.configMode == 0)
      this.ringData[0].profileName = profileName;
    else if (this.app.state.configMode == 1)
      this.ringData[1].profileName = profileName;
    else
    {
      this.ringData[0].profileName = profileName;
      this.ringData[1].profileName = profileName;
    }
  }

  isProfileSelected(profileName: string, ringIndex: number | undefined = undefined): boolean
  {
    let result = false;

    let list = [];
    if (ringIndex != undefined && RingData.list.length > ringIndex)
    {
      if (this.app.state.configMode == 0 && ringIndex == 1)
        return false;
      if (this.app.state.configMode == 1 && ringIndex == 0)
        return false;

      list.push(RingData.list[ringIndex]);
    }
    else
    {
      if (this.app.state.configMode == 0)
        list.push(RingData.list[0]);
      else if (this.app.state.configMode == 1)
        list.push(RingData.list[1]);
      else list.push(RingData.list[0], RingData.list[1]);
    }
    for (let i = 0; i < this.app.data.profile.length; i++)
    {
      for (let j = 0; j < list.length; j++)
      {
        if (list[j].profileName == profileName)
          result = true;

        if (result)
          break;
      }

      if (result)
        break;
    }

    return result;
  }

  trackByFn(index:number, item:any) {
    return index;
  }
}
