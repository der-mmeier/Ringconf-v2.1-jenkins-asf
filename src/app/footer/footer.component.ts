import {Component, ViewEncapsulation} from '@angular/core';
import {RingData} from "../app.ringdata";
import {AppComponent, addToCart} from "../app.component";
import {Log} from "../logger/logger.component";
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

  desc_0 = "Standard - 6 - 15 Arbeitstage";
  desc_1 = "Light Express - 7 - 9 Arbeitstage";
  desc_2 = "Express - 4 - 6 Arbeitstage";
  desc_3 = "Super Express - 1 - 4 Arbeitstage";

  constructor() {

    let sm = document.querySelectorAll('[data-sm-id]');
    sm.forEach(e => {
      let sm_id = e.attributes.getNamedItem('data-sm-id');
      let sm_desc = e.attributes.getNamedItem('data-sm-desc');
      if (sm_id && sm_desc) {
        let value = sm_id.value;
        switch (value) {
          case '96953791df1b4d9fb02011224f15b304':
            this.desc_0 = sm_desc.value;
            break;
          case 'f1697234768940e4a24d4e78a28d2e8e':
            this.desc_1 = sm_desc.value;
            break;
          case '41cfdf663e064b40919edf0537ca0152':
            this.desc_2 = sm_desc.value;
            break;
          case '8e9843aa5d7c497f81b170888014051a':
            this.desc_3 = sm_desc.value;
            break;
        }
      }
    })
  }

  csrfToken() {
    return AppComponent.getCookie("__csrf_token-1");
  }

  addToCart() {
    addToCart();
    // dbSavePreset().then(function (data: any)
    // {
    //   let ok = false;
    //   let form = <HTMLFormElement>document.getElementById("rcfgAddToBasket"); // --> index.tpl
    //   if (form)
    //   {
    //     let presetId = <HTMLInputElement>document.getElementById("preset_id");
    //     if (presetId)
    //     {
    //       presetId.value = AppComponent.app.state.preset_id;
    //       let buyBtn = <HTMLButtonElement> document.getElementById("rcfgBuyBtn");
    //       if (buyBtn) {
    //         buyBtn.click();
    //         ok = true;
    //       }
    //     }
    //
    //   }
    //
    //   if (!ok)
    //     Log("error", "Fehler beim hinzufügen zum Warenkorb");
    // })
  }
}
