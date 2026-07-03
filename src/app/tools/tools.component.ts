import {Component, HostBinding, Input, ViewEncapsulation} from '@angular/core';
import {AppComponent, dbLoadPreset} from "../app.component";
import {WebglComponent} from "../webgl/webgl.component";
import {environment} from "../../environments/environment";

@Component({
    selector: 'x-tools',
    templateUrl: './tools.component.html',
    styleUrls: ['./tools.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class ToolsComponent
{
  app = AppComponent.app;
  env = environment;
  @Input() mode: string = "normal";
  @HostBinding('class') get hostClasses()
  {
    return ['tools', 'mode-' + this.mode];
  }
  onSaveLoad_open()
  {
    AppComponent.app.state.toolsMenu = false;
    AppComponent.app.state.saveLoad = true;
  }
  onLoadDefaults()
  {
    AppComponent.app.state.toolsMenu = false;
    localStorage.removeItem("ringconfId");
    let url = new URL(window.location.href);
    if (url.searchParams.get("id"))
    {
      url.searchParams.delete("id");
      window.location.href = url.href;
    }
    else
    {
      dbLoadPreset("0000-0000").then();
      WebglComponent.WEBGL.camera.alpha = AppComponent.app.data.webglSettings.camera[0];
      WebglComponent.WEBGL.camera.beta = AppComponent.app.data.webglSettings.camera[1];
      WebglComponent.WEBGL.camera.radius = AppComponent.app.data.webglSettings.camera[2];
    }
  }
}
