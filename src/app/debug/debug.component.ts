import {Component} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {WebglComponent} from "../webgl/webgl.component";
import {cRing} from "../webgl/cRing";

@Component({
    selector: 'x-debug',
    templateUrl: './debug.component.html',
    styleUrls: ['./debug.component.scss'],
    standalone: false
})

export class DebugComponent {
  app: AppComponent = AppComponent.app;

  appLog(): string {
    return JSON.stringify(this.app.state);
  }

  ringCalcLog(index: number): string {
    // let webglRing = WebglRing.list.find(f => {
    //   return f.ringData.index == index;
    // })
    // if (webglRing)
    //   return JSON.stringify(webglRing.calc);

    let ring = cRing.list.find(f => {
      return f.ringData.index == index;
    })
    if (ring)
      return JSON.stringify(ring.calc, undefined, 4);

    return "";
  }

  ringLog(index: number, key: string = "ringData"): string {
    let ring = cRing.list.find(f => {
      return f.ringData.index == index;
    })
    if (ring) {
      // @ts-ignore
      return JSON.stringify(ring[key], undefined, 4);
    }
    return "";
    // return JSON.stringify(RingData.list[index], undefined, 4);
  }

  webglLog(): string {
    let webgl = WebglComponent.WEBGL;
    if (webgl && webgl.camera) return JSON.stringify({
      alpha: WebglComponent.WEBGL.camera.alpha,
      beta: WebglComponent.WEBGL.camera.beta,
      radius: WebglComponent.WEBGL.camera.radius
    });

    return "";
  }
}

/*
class Test {
  constructor()
  {
    this._foo="bar";
  }

  protected _foo="";
  get foo() { return this._foo; }
  set foo(value) { this._foo = value;}
}

let T = new Test();
console.log(T);

let json ='{"foo": "test"}';
console.log(json);
T = JSON.parse(json);
console.log(T);
T.foo = "123";
console.log(T);

console.log(JSON.stringify(T));
*/
