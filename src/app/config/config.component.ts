import {Component, HostBinding, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {closeNavigationPanel, navigation, setNavigationHash} from "../menu/menu.component";
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {environment} from "../../environments/environment";
import {ConfiguratorLayoutMode, isConfiguratorDrawerMode} from "../layout/configurator-layout.models";

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
  @Input() layoutMode: ConfiguratorLayoutMode = "desktop-compact";
  @HostBinding('class') get hostClasses() {
    return this.class + " layout-" + this.layoutMode + (this.isPanelOpen() ? " panel-open" : " panel-closed");
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

  isPanelDismissible()
  {
    return isConfiguratorDrawerMode(this.layoutMode);
  }

  isPanelOpen()
  {
    return !isConfiguratorDrawerMode(this.layoutMode) || this.navigation.currentHash !== "";
  }
}
