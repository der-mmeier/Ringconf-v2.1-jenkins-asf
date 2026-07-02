import {Component, ViewEncapsulation} from '@angular/core';
import {RingData} from "../app.ringdata";
import {AppComponent, addToCart} from "../app.component";
import {environment} from "../../environments/environment";

@Component({
  selector: 'x-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class FooterComponent {
  app = AppComponent.app;
  ringData = RingData.list;
  baseUrl = window.location.host;
  env = environment;
  constructor() {
  }

  addToCart() {
    addToCart();
  }
}
