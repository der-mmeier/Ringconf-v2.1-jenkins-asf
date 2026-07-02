import {Component, HostBinding, Input, ViewEncapsulation} from '@angular/core';
import {navigation} from "../menu/menu.component";
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";

@Component({
  selector: 'x-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ConfigComponent {
  navigation = navigation;
  @Input() class:string="";
  @HostBinding('class') cl = this.class;

  app:AppComponent = AppComponent.app;
  ringData:RingData[] = RingData.list;
}
