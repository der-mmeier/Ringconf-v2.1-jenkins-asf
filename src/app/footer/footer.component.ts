import {Component, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {RingData} from "../app.ringdata";
import {AppComponent, addToCart, dbLoadPreset} from "../app.component";
import {environment} from "../../environments/environment";
import {WebglComponent} from "../webgl/webgl.component";

@Component({
    selector: 'x-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
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

  openSaveLoad() {
    this.app.state.toolsMenu = false;
    this.app.state.saveLoad = true;
  }

  openDetails() {
    this.app.state.toolsMenu = false;
    this.app.state.ringDetails = true;
  }

  createPdf() {
    this.app.state.toolsMenu = false;
    this.app.createPdf();
  }

  resetConfiguration() {
    this.app.state.toolsMenu = false;
    localStorage.removeItem("ringconfId");
    let url = new URL(window.location.href);
    if (url.searchParams.get("id")) {
      url.searchParams.delete("id");
      window.location.href = url.href;
    } else {
      dbLoadPreset("0000-0000").then();
      if (WebglComponent.WEBGL?.camera) {
        WebglComponent.WEBGL.camera.alpha = this.app.data.webglSettings.camera[0];
        WebglComponent.WEBGL.camera.beta = this.app.data.webglSettings.camera[1];
        WebglComponent.WEBGL.camera.radius = this.app.data.webglSettings.camera[2];
      }
    }
  }

  hasJewelerCartContext(): boolean {
    const jeweler = (this.app.data as any)?.jeweler;
    const licenseKey = jeweler?.["license-key"] || jeweler?.licenseKey;
    const serverTopDomain = jeweler?.["server-top-domain"] || jeweler?.serverTopDomain;

    // TODO: enable cart/pricing by server-side license and Origin allowlist; license-key is a public tenant id, not a secret.
    return !!(licenseKey && serverTopDomain);
  }

  getRingDisplayName(index: number): string {
    if (index === 0)
      return "Ring 1";
    if (index === 1)
      return "Ring 2";

    return this.ringData[index]?.name || "";
  }
}
