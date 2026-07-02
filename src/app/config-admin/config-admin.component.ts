import {Component, ViewEncapsulation} from '@angular/core';
import {AppComponent, dbSaveStdPreset, dbSetAppData} from "../app.component";
import {RingData} from "../app.ringdata";
import {exportObj, WebglComponent} from "../webgl/webgl.component";
import { saveAs } from 'file-saver';

@Component({
  selector: 'x-config-admin',
  templateUrl: './config-admin.component.html',
  styleUrls: ['./config-admin.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class ConfigAdminComponent {
  app = AppComponent.app;
  ringData = RingData.list;

  setStdPreset() {
    dbSaveStdPreset().then(r => {
    }).catch(err => {
      console.log("error in setStdPreset(): ", err);
    });
    ;
  }

  toggleWireframe() {
    let webgl = WebglComponent.WEBGL;
    if (webgl) {
      webgl.scene.forceWireframe = !webgl.scene.forceWireframe;
      webgl.renderFrame();
    }
  }

  dbSetAppData() {
    dbSetAppData().then();
  }

  exportObj() {
    exportObj();
  }

  downloadCfg() {
    // let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppComponent.app.data));
    // let dlAnchorElem = document.getElementById('downloadAnchorElem');
    // if (dlAnchorElem) {
    //   dlAnchorElem.setAttribute("href", dataStr);
    //   dlAnchorElem.setAttribute("download", "config.json");
    //   dlAnchorElem.click();
    // }

    let fileName = 'config.json';

    let fileToSave = new Blob([JSON.stringify(AppComponent.app.data)], {
      type: 'application/json'
    });

    saveAs(fileToSave, fileName);
  }

  uploadCfg() {
    // @ts-ignore
    let files = document.getElementById('selectFiles').files;
    if (!files || files.length <= 0) return;

    let fr = new FileReader();

    fr.onload = function (e) {
      // @ts-ignore
      let result = JSON.parse(e.target.result);

      // @ts-ignore
      AppComponent.app.dataSafeJson = <string> e.target.result;
      dbSetAppData().then(e => {
      //  location.reload();
      })
    }

    fr.readAsText(files.item(0));
  }
}
