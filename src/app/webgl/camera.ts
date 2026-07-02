import {ArcRotateCamera, Camera, Engine, Scene} from "@babylonjs/core";
import {Vector3} from "@babylonjs/core/Maths/math.vector";
import {AppComponent} from "../app.component";
import {cRing} from "./cRing";

function computeSceneBounds(camera: Camera) {
  let inf = 10000;
  const min = new Vector3(inf, inf, inf);
  const max = new Vector3(-inf, -inf, -inf);


    cRing.list.forEach((r) => {
      r.mesh.forEach((m) => {
        if (m.name.startsWith('shadow')) return;
        m.refreshBoundingInfo();
         // m.showBoundingBox = true;
        const bmin = m.getBoundingInfo().boundingBox.minimumWorld;
        const bmax = m.getBoundingInfo().boundingBox.maximumWorld;

        min.minimizeInPlace(bmin);
        max.maximizeInPlace(bmax);
      });
    })
  // let rings = WebglRing.list;
  //
  //   rings.forEach((r) => {
  //     r.GL.mesh.forEach((m) => {
  //       if (m.name.startsWith('shadow')) return;
  //       m.refreshBoundingInfo();
  //        // m.showBoundingBox = true;
  //       const bmin = m.getBoundingInfo().boundingBox.minimumWorld;
  //       const bmax = m.getBoundingInfo().boundingBox.maximumWorld;
  //
  //       min.minimizeInPlace(bmin);
  //       max.maximizeInPlace(bmax);
  //     });
  //   })

  return [min, max];
}

export function zoomExtends(engine: Engine, canvas:HTMLCanvasElement, scene: Scene, camera: ArcRotateCamera) {

  let [min, max] = computeSceneBounds(camera);
  let W = canvas.clientWidth, H = canvas.clientHeight;
  let aspect = H>W ? H / W : W / H; // BUG RV2-1018

  let cx = Math.max(Math.abs(min.x), Math.abs(max.x));
  let cy = Math.max(Math.abs(min.z), Math.abs(max.z));
  let m = Math.max(cx, cy);
  m /= aspect;

  let minOrthoSize = AppComponent.app.data.webglSettings.cameraMinOrthoSize || 20;

  // deaktiviert, weil Zoom nicht gewünscht
  // if (m < minOrthoSize) m = minOrthoSize;
  // if (m == Infinity) m = minOrthoSize;

  m = minOrthoSize;

  // console.log(m);
  let size = m;
  min.x = -size;
  max.x = size;
  min.y = -size;
  max.y = size;
  min.z = -size;
  max.z = size;

  if (H>W) {
    camera.orthoLeft = min.x;
    camera.orthoRight = max.x;
    camera.orthoTop = max.y * aspect;
    camera.orthoBottom = min.y * aspect;
  }
  else {
    camera.orthoLeft = min.x * aspect;
    camera.orthoRight = max.x * aspect;
    camera.orthoTop = max.y;
    camera.orthoBottom = min.y;
  }
}

export const USE_ORTHO_CAMERA = true;

export function initCamera(engine: Engine, scene: Scene, canvas: HTMLCanvasElement): Camera | null {

  let app = AppComponent.app;

  let camera = new ArcRotateCamera("camera", app.data.webglSettings.camera[0]-Math.PI/2, app.data.webglSettings.camera[1], app.data.webglSettings.camera[2], new Vector3(0, 0, 0), scene);
  camera.attachControl(canvas, true);

  if (USE_ORTHO_CAMERA && !AppComponent.app.state.debug) {
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
    camera.inputs.attached["mousewheel"].detachControl();
    camera.allowUpsideDown = false;
    camera.panningSensibility = 0;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI/2-0.1;
    camera.layerMask = 0xFFFFFFFF;
    camera.angularSensibilityX = 5000;
    camera.angularSensibilityY = 5000;
  } else {
    camera.wheelPrecision = 5;
    camera.panningSensibility = 100;
  }

  return camera;
}
