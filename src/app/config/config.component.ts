import {Component, HostBinding, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {navigation, setNavigationHash} from "../menu/menu.component";
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
  @HostBinding('class') cl = this.class;

  app:AppComponent = AppComponent.app;
  ringData:RingData[] = RingData.list;

  changeHash(hash: string)
  {
    setNavigationHash(hash, true);
  }
}
