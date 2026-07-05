import {Component, HostBinding, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {closeNavigationPanel, navigation, setNavigationHash} from "../menu/menu.component";
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {environment} from "../../environments/environment";

@Component({
    selector: 'x-config',
    templateUrl: './config.component.html',
    styleUrls: ['./config.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ConfigComponent {
  navigation = navigation;
  env = environment;
  @Input() class:string="";
  @HostBinding('class') get hostClasses() {
    return this.class + (this.isMobilePanelOpen() ? " panel-open" : " panel-closed");
  }

  app:AppComponent = AppComponent.app;
  ringData:RingData[] = RingData.list;

  changeHash(hash: string)
  {
    setNavigationHash(hash, true);
  }

  closePanel()
  {
    closeNavigationPanel();
  }

  isMobilePanelOpen()
  {
    return this.class.indexOf("show-if-mobile") !== -1 && this.navigation.currentHash !== "";
  }
}
