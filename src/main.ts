import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {AppModule} from './app/app.module';
import {WebglComponent} from "./app/webgl/webgl.component";

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

export function IsFullscreen(): boolean
{
  // @ts-ignore
  return (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) != undefined;
}

export function ToggleFullscreen()
{
  // @ts-ignore
  let state = IsFullscreen();

  if (state)
  {
    if (document.exitFullscreen)
    {
      document.exitFullscreen().then(function ()
      {
      }).catch(err => {
        console.log("error in ExitFullscreen(): ", err);
      });
    }
    // @ts-ignore
    else if (document.webkitExitFullscreen)
    {
      // @ts-ignore
      document.webkitExitFullscreen();
    }
    // @ts-ignore
    else if (document.mozCancelFullScreen)
    {
      // @ts-ignore
      document.mozCancelFullScreen();
    }
    // @ts-ignore
    else if (document.msExitFullscreen)
    {
      // @ts-ignore
      document.msExitFullscreen();
    }
  }
  else
  {
    let webglWrapper = document.getElementById("webglWrapper");

    if (webglWrapper)
    {
      webglWrapper.requestFullscreen().then(function ()
      {
      }).catch(err => {
        console.log("error in ToggleFullscren(): ", err);
      });
    }
  }

  WebglComponent.WEBGL?.resize();
}
