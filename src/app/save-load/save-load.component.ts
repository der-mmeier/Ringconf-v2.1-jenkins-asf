import {Component, ViewEncapsulation} from '@angular/core';
import {AppComponent, dbLoadPreset, dbSavePreset} from "../app.component";
import {environment} from "../../environments/environment";

@Component({
  selector: 'x-save-load',
  templateUrl: './save-load.component.html',
  styleUrls: ['./save-load.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class SaveLoadComponent
{
  app = AppComponent.app;
  env = environment;
  curPresetId= AppComponent.app.state.preset_id;

  onClose()
  {
    AppComponent.app.state.saveLoad = false;
  }

  onSave() {
    this.onClose();
    dbSavePreset().then().catch(err => {
      console.log("error in onSave(): ", err);
    });
  }

  onLoad(id:string) {
    this.onClose();
    dbLoadPreset(id).then().catch(err => {
      console.log("error in onLoad(): ", err);
    });
  }

  getDBSaveItems() {
    return AppComponent.app.state.dbSaveItems;
  }
}
