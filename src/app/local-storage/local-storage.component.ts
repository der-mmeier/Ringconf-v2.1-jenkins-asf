import {Component, HostBinding, ViewEncapsulation} from '@angular/core';
import {RingData} from "../app.ringdata";
import {AppComponent, dbCheckIdExist, dbLoadPreset} from "../app.component";
import {Log} from "../logger/logger.component";
import {bootstrapApplication} from "@angular/platform-browser";

@Component({
    selector: 'x-local-storage',
    templateUrl: './local-storage.component.html',
    styleUrls: ['./local-storage.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})

export class LocalStorageComponent
{
  static that: LocalStorageComponent;
  ringconf = [] as RingData[];
  ringconfId = "";
  isVisible = false;

  constructor()
  {
    LocalStorageComponent.that = this;
  }

  ngAfterViewInit() {
    // @ts-ignore
    if (AppComponent.app.state.urlParams["id"] !== undefined) {
      this.close();
      return;
    }

    this.ringconfId = localStorage.getItem("ringconfId") || "";
    let that = this;

    // console.log(this.ringconfId);

    dbCheckIdExist(this.ringconfId).then(function (result: boolean)
    {
      if (!result)
      {
        that.close();
      }
      else
        that.isVisible = true;
    });
  }

  restoreConfiguration()
  {
    this.close();
    dbLoadPreset(this.ringconfId).then().catch(err =>
    {
      console.log("error in restoreConfiguration(): ", err);
    });
  }

  close()
  {
    let e = document.getElementsByTagName("x-local-storage");
    if (e)
    {
      for (let i = 0, len = e.length; i != len; ++i)
      {
        if (e[0].parentNode)
          e[0].parentNode.removeChild(e[0]);
      }
    }
  }
}
