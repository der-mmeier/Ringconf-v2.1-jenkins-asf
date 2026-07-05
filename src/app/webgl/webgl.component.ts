import {Component, ElementRef, ChangeDetectionStrategy} from '@angular/core';
import {IsFullscreen, ToggleFullscreen} from "../../main";
import {AppComponent, dbLoadPreset} from "../app.component";
import {
  ArcRotateCamera,
  AssetsManager,
  Color3,
  Color4,
  CreateScreenshotUsingRenderTargetAsync,
  CubeTexture,
  Effect,
  Engine,
  HardwareScalingOptimization,
  Matrix,
  MergeMeshesOptimization, PassPostProcess,
  PBRMaterial,
  Scene,
  SceneOptimizer,
  SceneOptimizerOptions,
  ShaderMaterial,
  StandardMaterial,
  Texture,
  Vector3
} from "@babylonjs/core";
import {iMaterial, iWebGLSettings} from "../app.interfaces";
import {OBJExport} from "@babylonjs/serializers";
import {Preload} from "../app.preload";
import {RingData} from "../app.ringdata";
import {environment} from "../../environments/environment";
import {initCamera, USE_ORTHO_CAMERA, zoomExtends} from "./camera";
import {cRing} from "./cRing";

@Component({
    selector: 'x-webgl',
    templateUrl: './webgl.component.html',
    styleUrls: ['./webgl.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class WebglComponent {
  static WEBGL: any = null;
  app = AppComponent.app;
  env = environment;
  canvas: HTMLCanvasElement | any;
  textureCanvas: HTMLCanvasElement | any; // wird benötigt, um die Fehlermeldung des multiplen getImage2d() Aufrufs zu unterdrücken
  alphaCanvas: HTMLCanvasElement | any; // die alpha-Map hat eine andere Auflösung als die normale Textur
  engine: Engine | any;
  scene: Scene | any;
  camera: ArcRotateCamera | any;
  cameraIntroAnimate = true;
  cameraScreenshot: ArcRotateCamera | any;
  cameraChanged: boolean = false;
  forceFrames: number = 0; // erzwingt das Rendern von n Frames; Dieser Zähler wird aktiv heruntergezählt.
  envTexture: CubeTexture | any;

  maxTextureSize: number = 2048;
  maxTextureSize_doubled: number = 4096;
  maxAlphaTextureSize: number = 2048;
  maxAlphaTextureSize_doubled: number = 4096;

  textureUV: Texture | null = null;
  matStandard: PBRMaterial | any;
  matUV: PBRMaterial | any;
  matShadow: StandardMaterial | any;
  matWireframe: StandardMaterial | any;

  // @ts-ignore
  matShader: ShaderMaterial;

  renderLoopEnabled: boolean = false;
  renderIntervalId: number = 0;

  renderCount = 0;

  // sceneExposure: number = 0;
  // sceneContrast: number = 0;
  // environmentYaw: number = 0;
  // environmentPitch: number = 0;
  // cameraAlpha: number = 0;
  // cameraBeta: number = 0;

  refSampler_image="diamondMap_0.jpg";
  tri1_image="diamond_tri_1.jpeg";
  tri2_image="diamond_tri_2.jpeg";
  high_image="diamondHighlight.png";
  sparkle_image="diamondSparkle.jpg";
  fire_image = "diamondFire.jpg"

  static busyCounter = 0; // spinner overlay
  isBusy(): boolean {
    return WebglComponent.busyCounter > 0;
  }

  constructor(private elem: ElementRef) {
    if (WebglComponent.WEBGL) throw("WebglComponent already exist");
    WebglComponent.WEBGL = this;
    (window as any).__oneRingconfWebgl = this;

    let that = this;
    let intervalId = setInterval(function () {

      if (AppComponent.app.state.ready) {
        clearInterval(intervalId);
        that.InitAfterAppReady();
      }
    }, 100)
  }

  getBuildString() {
    let result = "Build " + this.app.state.build + " · AppData " + this.app.state.appDataVersionLabel;
    if (this.app.state.debug)
      result += " DEBUG";
    return result;
  }

  // ngAfterViewInit() {
  InitAfterAppReady() {
    let that = this;
    this.canvas = this.elem.nativeElement.querySelector('#webgl');

    this.canvas.addEventListener('wheel', function (evt: Event) {
      evt.preventDefault();
    });

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    }, true);

    this.engine.enableOfflineSupport = false;
    this.engine.doNotHandleContextLost = true;
    this.engine.disableUniformBuffers = true;

    let webglSettings: iWebGLSettings = AppComponent.app.data.webglSettings;

    this.maxTextureSize_doubled = this.engine.getCaps().maxTextureSize;
    this.maxTextureSize = this.maxTextureSize_doubled / 2;

    let ts = AppComponent.app.state.mobile ? AppComponent.app.data.webglSettings.maxTextureSize / 2 : AppComponent.app.data.webglSettings.maxTextureSize;
    if (ts < this.maxTextureSize_doubled) {
      this.maxTextureSize_doubled = ts;
      this.maxTextureSize = ts / 2;
    }

    this.maxAlphaTextureSize_doubled = this.engine.getCaps().maxTextureSize;
    this.maxAlphaTextureSize = this.maxAlphaTextureSize_doubled / 2;

    ts = AppComponent.app.state.mobile  ? AppComponent.app.data.webglSettings.maxAlphaTextureSize / 2 : AppComponent.app.data.webglSettings.maxAlphaTextureSize;
    if (ts < this.maxAlphaTextureSize_doubled) {
      this.maxAlphaTextureSize_doubled = ts;
      this.maxAlphaTextureSize = ts / 2;
    }

    this.textureCanvas = document.createElement("canvas");
    this.textureCanvas.width = this.maxTextureSize_doubled;
    this.textureCanvas.height = this.maxTextureSize_doubled;
    this.textureCanvas.getContext("2d", {willReadFrequently: true})

    this.alphaCanvas = document.createElement("canvas");
    this.alphaCanvas.width = this.maxAlphaTextureSize_doubled;
    this.alphaCanvas.height = this.maxAlphaTextureSize_doubled;
    this.alphaCanvas.getContext("2d", {willReadFrequently: true})

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.9764705882352941, 0.9764705882352941, 0.9764705882352941, 1.0);
    this.scene.imageProcessingConfiguration.exposure = AppComponent.app.data.webglSettings.environmentPreset.scene_exposure;
    this.scene.imageProcessingConfiguration.contrast = AppComponent.app.data.webglSettings.environmentPreset.scene_contrast;
    // this.scene.imageProcessingConfiguration.exposure = AppComponent.app.data.webglSettings.sceneExposure;
    // this.scene.imageProcessingConfiguration.contrast = AppComponent.app.data.webglSettings.sceneContrast;

    this.camera = initCamera(this.engine, this.scene, this.canvas);

    let onResize = function () {
      if (USE_ORTHO_CAMERA) {
        zoomExtends(that.engine, that.canvas, that.scene, that.camera);
        // that.camera.radius = 30;
        // For the orthographic camera mode we need to set the left, right, bottom and
        // top boundaries. Usually you'll want to maintain the aspect ratio of the
        // renderer canvas.
        // let rect = that.engine.getRenderingCanvasClientRect();
        // let aspect = rect.height / rect.width;
        // In that example we'll set the distance based on the camera's radius.
        // that.camera.orthoLeft = -that.camera.radius;
        // that.camera.orthoRight = that.camera.radius;
        // that.camera.orthoBottom = -that.camera.radius * aspect;
        // that.camera.orthoTop = that.camera.radius * aspect;
      }
    }

    onResize();

    window.addEventListener("resize", function () {
      that.resize();
      // that.engine.resize();
      // //    onResize();
      // that.cameraChanged = true;
      // that.renderFrame();
    });

    this.cameraScreenshot = new ArcRotateCamera("cameraScreenshot", webglSettings.camera[0], webglSettings.camera[1], webglSettings.camera[2], new Vector3(0, 10, 0), this.scene);
    // @ts-ignore
    this.cameraScreenshot.layerMask = 0x20000000;

    this.envTexture = CubeTexture.CreateFromPrefilteredData(this.env.assetFolderLocation + "/assets/img3d/envTextureKeyShot.env", this.scene);
    // this.envTexture = CubeTexture.CreateFromPrefilteredData(this.env.assetFolderLocation + "/assets/img3d/envTexture.env", this.scene);
    this.envTexture.gammaSpace = false;
    this.envTexture.setReflectionTextureMatrix(Matrix.RotationYawPitchRoll(
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_yaw * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_pitch * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_roll * 2 * Math.PI));
    // this.envTexture.setReflectionTextureMatrix(Matrix.RotationYawPitchRoll(
    //   AppComponent.app.data.webglSettings.envRotationRad_yaw,
    //   AppComponent.app.data.webglSettings.envRotationRad_pitch,
    //   0.0));

    this.matWireframe = new StandardMaterial("wireframe", this.scene);
    this.matWireframe.diffuseColor = new Color3(1, 0, 0);
    this.matWireframe.wireframe = true;

    this.matStandard = new PBRMaterial("standard", this.scene);
    this.matStandard.albedoColor = new Color3(0, 0, 1);
    this.matStandard.metallic = 1;
    this.matStandard.roughness = 0;
    this.matStandard.reflectionTexture = this.envTexture;

    this.matUV = new PBRMaterial("standard", this.scene);
    if (0) {
      this.textureUV = new Texture("/assets/img3d/UVMap2.png", this.scene);
      // this.textureUV = new Texture(APPDATA.urlRoot + "/assets/img3d/3DLABbg_UV_Map_Checker_01_4096x4096.jpg", this.scene);
      // this.textureUV = new Texture(APPDATA.urlRoot + "/assets/img3d/tex_uvref_4096.jpg", this.scene);
      // this.textureUV = new Texture(APPDATA.urlRoot + "/assets/img3d/tex_uvref_2048.jpg", this.scene);
      this.matUV.albedoTexture = this.textureUV;
      this.matUV.albedoTexture.gammaSpace = false;
      (<Texture>this.matUV.albedoTexture).uScale = 0.5;
      (<Texture>this.matUV.albedoTexture).vScale = 4.0;
      // this.matUV.metallic = 1;
      // this.matUV.roughness = 0;
      // this.matUV.backFaceCulling = false;
      // this.matUV.reflectionTexture = this.envTexture;
      // this.matUV.wireframe = true;
    }
    this.matShadow = new StandardMaterial("shadow", this.scene);
    this.matShadow.diffuseColor = new Color3(0, 0, 0);
    this.matShadow.opacityTexture = new Texture(this.env.assetFolderLocation + "/assets/img3d/tex_shadow.png", this.scene);
    // this.matShadow.opacityTexture.gammaSpace = false;

    if (0) // matShader
    {
      Effect.ShadersStore["customVertexShader"] = `
              precision highp float;

              attribute vec3 position;
              attribute vec3 normal;

              #include<instancesDeclaration>

              uniform mat4 viewProjection;

              varying vec4 vPosition;
              varying vec3 vNormal;
              varying vec3 cameraPosition;

              out vec3 reflectedVector;

              void main(void) {
                  #include<instancesVertex>
                  vec4 p = vec4( position, 1.0 );
                  vPosition = p;
                  vNormal = normal;
                  //vec3 viewVector = normalize(cameraPosition);
                  vec3 viewVector = normalize(position - cameraPosition);
                  reflectedVector = reflect(viewVector, vNormal);
                  gl_Position = viewProjection * finalWorld * p;
              }
              `;

      Effect.ShadersStore["customFragmentShader"] = `
              precision highp float;
              uniform mat4 worldView;
              in vec3 reflectedVector;
              varying vec4 vPosition;
              varying vec4 vPosition2;
              varying vec3 vNormal;
              varying vec3 cameraPosition;
              uniform samplerCube cubeMap;
              uniform sampler2D textureSampler;
              uniform sampler2D refSampler;
              uniform sampler2D refSamplerFire;
              uniform sampler2D refSamplerSparkle;
              uniform sampler2D refSamplerTri1;
              uniform sampler2D refSamplerTri2;
              uniform sampler2D refSamplerHighlight;
              uniform float alpha;
              uniform float cameraRadius;

              float random (vec2 st) {
                  return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
              }
              void main(void) {
                  vec3 e = normalize( vec3( worldView * vPosition) );
                  vec3 n = normalize( worldView * vec4(vNormal, 0.0) ).xyz;
                  vec3 r = reflectedVector;
                  //vec3 r = reflect( e, n*0.3);
                  float m = 2. * sqrt(
                      pow( r.x, 2. ) +
                      pow( r.y, 2. ) +
                      pow( r.z + 1., 2. )
                  );

                 // m = 1.0;

                  vec2 vN = (reflect( e, n * 1.811).xy / m + .1) * (cameraRadius * 1.394);
                  vec3 base = texture2D( refSampler, vN).rgb * 1.0;
                  vec3 result = base;

                  // vN = (reflect( e, n*0.5).xy / m + .1) * (cameraRadius * 0.5);
                  // vec3 fire = texture2D( refSamplerFire, vN).rgb * 0.5;
                  // result = result + fire;

                  vec3 highlight = texture2D( refSamplerHighlight, vN).rgb * 1.0;
                  result = result + highlight;

                  vN = (reflect( e, n*0.5).xy / m + .1) * (cameraRadius * 1.0);
                  vec3 sparkle = texture2D( refSamplerSparkle, vN).rgb * 1.0;
                  result = result + sparkle;

                  // vN = (reflect( e, n*0.5).xy / m + .1) * (cameraRadius * 2.5);
                  // vec3 tri1 = texture2D( refSamplerTri1, vN).rgb * 1.0;
                  // result = result + tri1;

                  // vN = (reflect( e, n*0.1).xy / m + .1) * (cameraRadius * 7.0);
                  // tri1 = texture2D( refSamplerTri1, vN).rgb * 0.5;
                  // result = result + tri1;
                  //
                  // vN = (reflect( e, n*0.9).xy / m + .1) * ((cameraRadius) * 2.5);
                  // vec3 tri2 = texture2D( refSamplerTri2, vN).rgb * 0.4;
                  // result = result + tri2;

                  gl_FragColor = vec4( result, alpha );
              }`;

      this.matShader = new ShaderMaterial("shader", this.scene, "custom",
        {
          attributes: ["position", "normal", "camera"],
          uniforms: ["world", "worldView", "viewProjection", "view", "projection", "camera"],
          defines: ["#define INSTANCES"]
        });
    }
    else {
      Effect.ShadersStore["customVertexShader"] = `
              precision highp float;

              attribute vec3 position;
              attribute vec3 normal;
              attribute vec2 uv;

              #include<instancesDeclaration>

             uniform mat4 worldViewProjection;
             uniform mat4 viewProjection;

              varying vec4 vPosition;
              varying vec3 vNormal;
              varying vec3 cameraPosition;
              varying vec3 worldPosition;

              varying vec2 vUV;

              out vec3 reflectedVector;

              void main(void) {
                #include<instancesVertex>
                vec4 p = vec4( position, 1.0 );
                vPosition = p;// * finalWorld;
                gl_Position = viewProjection * finalWorld * p;
               vNormal = normalize(vec3(world * vec4(normal, 0.0)));
               vUV = uv;
              }
              `;

      Effect.ShadersStore["customFragmentShader"] = `
              precision highp float;
              uniform mat4 worldView;
              in vec3 reflectedVector;
              varying vec4 vPosition;
              varying vec4 vPosition2;
              varying vec3 vNormal;
              varying vec3 cameraPosition;
              varying vec2 vUV;
              uniform samplerCube cubeMap;
              uniform sampler2D textureSampler;
              uniform sampler2D refSampler;
              uniform sampler2D refSamplerFire;
              uniform sampler2D refSamplerSparkle;
              uniform sampler2D refSamplerTri1;
              uniform sampler2D refSamplerTri2;
              uniform sampler2D refSamplerHighlight;
              uniform float alpha;
              uniform float cameraRadius;

              uniform float reflect_refSampler;
              uniform float camRad_refSampler;
              uniform float factor_refSampler;

              uniform float reflect_tri1;
              uniform float camRad_tri1;
              uniform float factor_tri1;

              uniform float reflect_tri2;
              uniform float camRad_tri2;
              uniform float factor_tri2;

              uniform float reflect_high;
              uniform float camRad_high;
              uniform float factor_high;

              uniform float reflect_sparkle;
              uniform float camRad_sparkle;
              uniform float factor_sparkle;

              uniform float reflect_fire;
              uniform float camRad_fire;
              uniform float factor_fire;

              float random (vec2 st) {
                  return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
              }
              void main(void) {
                  vec3 e = normalize( vec3( worldView * vPosition) );
                  vec3 n = normalize( worldView * vec4(vNormal, 0.0) ).xyz;
                  vec3 r = reflectedVector;
                  //vec3 r = reflect( e, n*0.3);
                  float m = 2. * sqrt(
                      pow( r.x, 2. ) +
                      pow( r.y, 2. ) +
                      pow( r.z + 1., 2. )
                  );

              //    m = 1.0;

                  vec2 vN;
                  vec3 result;
                  vec3 n2 = (n * reflect_refSampler);

                  vN = (reflect( e, n2).xy / m + .1) * (cameraRadius * camRad_refSampler);
                  result = texture2D( refSampler, vN).rgb * factor_refSampler;

                  n2 = (n * reflect_tri1);
                  vN = (reflect( e, n2).xy / m + .1) * (cameraRadius * camRad_tri1);
                  result += texture2D( refSamplerTri1, vN).rgb * factor_tri1;

                  n2 = (n * reflect_tri2);
                  vN = (reflect( e, n2).xy / m + .1) * ((cameraRadius) * camRad_tri2);
                  result += texture2D( refSamplerTri2, vN).rgb * factor_tri2;

                  n2 = (n * reflect_high);
                  vN = (reflect( e, n2).xy / m + .1) * ((cameraRadius) * camRad_high);
                  result += texture2D( refSamplerHighlight, vN).rgb * factor_high;

                  n2 = (n * reflect_sparkle);
                  vN = (reflect( e, n2).xy / m + .1) * ((cameraRadius) * camRad_sparkle);
                  result += texture2D( refSamplerSparkle, vN).rgb * factor_sparkle;

                  n2 = (n * reflect_fire);
                  vN = (reflect( e, n2).xy / m + .1) * ((cameraRadius) * camRad_fire);
                  result += texture2D( refSamplerFire, vN).rgb * factor_fire;

                  gl_FragColor = vec4( result, alpha );
              }`;

      this.matShader = new ShaderMaterial("shader", this.scene, "custom",
        {
          attributes: ["position", "normal", "camera", "uv"],
          uniforms: ["world", "worldView", "worldViewProjection", "viewProjection", "view", "projection", "camera"],
          defines: ["#define INSTANCES"]
        });

      let preset = AppComponent.app.data.webglSettings.environmentPreset;
      that.matShader.setFloat("reflect_refSampler", preset.refSampler_reflect);
      that.matShader.setFloat("camRad_refSampler", preset.refSampler_camRad);
      that.matShader.setFloat("factor_refSampler", preset.refSampler_factor);

      that.matShader.setFloat("reflect_tri1", preset.tri1_reflect);
      that.matShader.setFloat("camRad_tri1", preset.tri1_camRad);
      that.matShader.setFloat("factor_tri1", preset.tri1_factor);

      that.matShader.setFloat("reflect_tri2", preset.tri2_reflect);
      that.matShader.setFloat("camRad_tri2", preset.tri2_camRad);
      that.matShader.setFloat("factor_tri2", preset.tri2_factor);

      that.matShader.setFloat("reflect_high", preset.high_reflect);
      that.matShader.setFloat("camRad_high", preset.high_camRad);
      that.matShader.setFloat("factor_high", preset.high_factor);

      that.matShader.setFloat("reflect_sparkle", preset.sparkle_reflect);
      that.matShader.setFloat("camRad_sparkle", preset.sparkle_camRad);
      that.matShader.setFloat("factor_sparkle", preset.sparkle_factor);

      that.matShader.setFloat("reflect_fire", preset.fire_reflect);
      that.matShader.setFloat("camRad_fire", preset.fire_camRad);
      that.matShader.setFloat("factor_fire", preset.fire_factor);
    }

    this.matShader.backFaceCulling = false;
    this.matShader.setVector3("cameraPosition", Vector3.Zero());
    // this.matShader.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
    // this.matShader.needDepthPrePass = true;
    this.matShader.setFloat("alpha", 1.0);
    this.matShader.setFloat("cameraRadius", this.camera.radius);

    this.matShader.setTexture("cubeMap", this.envTexture);

    let assetsManager = new AssetsManager(this.scene);
    assetsManager.useDefaultLoadingScreen = false;
    let T = assetsManager.addTextureTask("", this.env.assetFolderLocation + '/assets/img3d/'+webglSettings.environmentPreset.refSampler_image);
    T.onSuccess = function (task) {
      that.matShader.setTexture("refSampler", task.texture);
    };
    T.onError = function (task, message) {
      console.log("failed refSampler: ", message);
    }
    T = assetsManager.addTextureTask("", this.env.assetFolderLocation + '/assets/img3d/'+this.tri1_image);
    T.onSuccess = function (task) {
      that.matShader.setTexture("refSamplerTri1", task.texture);
    };
    T.onError = function (task, message) {
      console.log("failed refSamplerTri1: ", message);
    }
    T = assetsManager.addTextureTask("", this.env.assetFolderLocation + '/assets/img3d/'+this.tri2_image);
    T.onSuccess = function (task) {
      that.matShader.setTexture("refSamplerTri2", task.texture);
    };
    T.onError = function (task, message) {
      console.log("failed refSamplerTri2: ", message);
    }
    T = assetsManager.addTextureTask("", this.env.assetFolderLocation + '/assets/img3d/'+this.high_image);
    T.onSuccess = function (task) {
      that.matShader.setTexture("refSamplerHighlight", task.texture);
    };
    T.onError = function (task, message) {
      console.log("failed refSamplerHighlight: ", message);
    }
    T = assetsManager.addTextureTask("", this.env.assetFolderLocation + '/assets/img3d/'+this.sparkle_image);
    T.onSuccess = function (task) {
      that.matShader.setTexture("refSamplerSparkle", task.texture);
    };
    T.onError = function (task, message) {
      console.log("failed refSamplerSparkle: ", message);
    }
    T = assetsManager.addTextureTask("", this.env.assetFolderLocation + '/assets/img3d/'+this.fire_image);
    T.onSuccess = function (task) {
      that.matShader.setTexture("refSamplerFire", task.texture);
    };
    T.onError = function (task, message) {
      console.log("failed refSamplerFire: ", message);
    }
    assetsManager.load();

    if (1) {
      if (AppComponent.app.state.mobile) {
        this.engine.setHardwareScalingLevel(0.2);
      } else
      {
        new PassPostProcess("scale_pass", 4.0, this.camera, Texture.BILINEAR_SAMPLINGMODE);
        new PassPostProcess("scale_pass", 2.0, this.camera, Texture.BILINEAR_SAMPLINGMODE);
        new PassPostProcess("scale_pass", 1.0, this.camera, Texture.BILINEAR_SAMPLINGMODE);
      }
    }
    // else {
    //   // if (!IS_MOBILE)
    //   this.engine.setHardwareScalingLevel(0.5);
    //
    //   let pipeline = new DefaultRenderingPipeline("defaultPipeline", false, this.scene, [this.camera]);
    //   let caps = this.engine.getCaps();
    //
    //   pipeline.samples = caps.maxMSAASamples;
    //   pipeline.fxaaEnabled = true;
    //   if (pipeline.fxaaEnabled) {
    //     pipeline.fxaa.samples = 4;
    //   }
    //
    //   pipeline.imageProcessingEnabled = true;
    // }

    function onCameraChange() {
      that.cameraChanged = true;
    }

    this.camera.onProjectionMatrixChangedObservable.add(onCameraChange);
    this.camera.onViewMatrixChangedObservable.add(onCameraChange);
    this.camera.onMeshTargetChangedObservable.add(onCameraChange);

    // interface iCameraCookie {
    //   alpha: number;
    //   beta: number;
    //   radius: number;
    //   position: number[];
    //   target: number[];
    // }

    // let cookie = AppComponent.getCookie("camera");
    // @ts-ignore
    // if (0 && urlParams["freecam"] !== undefined && urlParams["freecam"] !== "0" && cookie.length > 0) {
    //   let camera: iCameraCookie = <iCameraCookie>JSON.parse(cookie);
    //
    //   this.camera.alpha = camera.alpha;
    //   this.camera.beta = camera.beta;
    //   this.camera.radius = camera.radius;
    //   this.camera.position.x = camera.position[0];
    //   this.camera.position.y = camera.position[1];
    //   this.camera.position.z = camera.position[2];
    //   this.camera.target.x = camera.target[0];
    //   this.camera.target.y = camera.target[1];
    //   this.camera.target.z = camera.target[2];
    // }

    this.canvas.addEventListener("pointerdown", function () {
      that.cameraIntroAnimate = false;
    });
    // this.canvas.addEventListener("pointerup", function () {
    //   let camera: iCameraCookie = {
    //     alpha: WebglComponent.WEBGL.camera.alpha,
    //     beta: WebglComponent.WEBGL.camera.beta,
    //     radius: WebglComponent.WEBGL.camera.radius,
    //     position: [WebglComponent.WEBGL.camera.position.x, WebglComponent.WEBGL.camera.position.y, WebglComponent.WEBGL.camera.position.z],
    //     target: [WebglComponent.WEBGL.camera.target.x, WebglComponent.WEBGL.camera.target.y, WebglComponent.WEBGL.camera.target.z],
    //   }
    //
    //   AppComponent.setCookie("camera", JSON.stringify(camera));
    // });

    Preload.load(function () {
      that.enableRenderLoop(false); // nur rendern, wenn notwendig

      if (0) {
        let options = new SceneOptimizerOptions(30, 500);
        let priority = 0;
        options.optimizations.push(new MergeMeshesOptimization(priority++));
        options.optimizations.push(new HardwareScalingOptimization(priority++, 1));
        let optimizer = SceneOptimizer.OptimizeAsync(that.scene, options);
        optimizer.start();
      }
      // if (typeof onReadyCallback === "function")
      //   onReadyCallback(this);

      // that.testScene_1();
      // that.show_axis(10);

      RingData.list.forEach(function (e: RingData) {
        // if (AppComponent.app.state.test25)
        new cRing(e);
        // else
        //   new WebglRing(e);
        // new Ring3D(e);
      })

      // LocalStorageComponent.that.show();
      // dbLoadPreset(AppComponent.app.state.preset_id).then(r => {});
      dbLoadPreset("0000-0000").then(r => {
        window.setTimeout(function () {
          that.resizeViewport();
        }, 0);
        window.setTimeout(function () {
          that.resizeViewport();
        }, 250);
      });
    })
  }

  toggleFullscreen() {
    ToggleFullscreen();
  }

  isFullscreen() {
    return IsFullscreen();
  }

  resize() {
    this.resizeViewport();
  }

  resizeViewport() {
    this.engine?.resize();
    if (this.engine && this.canvas && this.scene && this.camera) {
      zoomExtends(this.engine, this.canvas, this.scene, this.camera);
    }
    this.cameraChanged = true;
    this.renderFrame(2);
  }

  renderFrame(forceFrames: number = 0) {

    if (!this.camera || !this.camera.target) {
      if (this.forceFrames < forceFrames)
        this.forceFrames = forceFrames;
      return;
    }

    let t = [] as boolean[];
    RingData.list.forEach(function (e) {
      if (e.cartActive) t.push(true);
      else t.push(false);
    })

    // if (AppComponent.app.state.test25) //
    {
      if (t[0] && !t[1]) //
      {
        // look at 0
        // let ring = Ring3D.list.find(function (e) {
        let ring = cRing.list.find(function (e) {
          return e.ringData.index == 0;
        })
        if (ring && ring.cameraData && ring.cameraData.target) {
          this.camera.target.x = ring.cameraData.target.x;
          this.camera.target.y = ring.cameraData.target.y;
          this.camera.target.z = ring.cameraData.target.z;
        }
      } //
      else if (!t[0] && t[1]) //
      {
        // look at 1
        // let ring = Ring3D.list.find(function (e) {
        let ring = cRing.list.find(function (e) {
          return e.ringData.index == 1;
        })
        if (ring && ring.cameraData && ring.cameraData.target) {
          this.camera.target.x = ring.cameraData.target.x;
          this.camera.target.y = ring.cameraData.target.y;
          this.camera.target.z = ring.cameraData.target.z;
        }
      } else if (t[0] && t[1]) //
      {
        // beide
        let ring_0 = cRing.list.find(function (e) {
          return e.ringData.index == 0;
        })
        let ring_1 = cRing.list.find(function (e) {
          return e.ringData.index == 1;
        })

        let x = 0;

        if (ring_0 && ring_1 && ring_0.cameraData && ring_0.cameraData.target && ring_1.cameraData && ring_1.cameraData.target) {
          x = (ring_0.cameraData.target.x + ring_1.cameraData.target.x) / 2;
          this.camera.target.x = x;
          this.camera.target.y = 10;
          this.camera.target.z = 0;
        }
      }
    } //
    // else //
    // {
    //   if (t[0] && !t[1]) {
    //     // look at 0
    //     // let ring = Ring3D.list.find(function (e) {
    //     let ring = WebglRing.list.find(function (e) {
    //       return e.ringData.index == 0;
    //     })
    //     // if (ring) {
    //     //   this.camera.target.x = ring.cameraData.target.x;
    //     //   this.camera.target.y = ring.cameraData.target.y;
    //     //   this.camera.target.z = ring.cameraData.target.z;
    //     // }
    //     if (ring) {
    //       this.camera.target.x = ring.GL.cameraData.target.x;
    //       this.camera.target.y = ring.GL.cameraData.target.y;
    //       this.camera.target.z = ring.GL.cameraData.target.z;
    //     }
    //   } else if (!t[0] && t[1]) {
    //     // look at 1
    //     // let ring = Ring3D.list.find(function (e) {
    //     let ring = WebglRing.list.find(function (e) {
    //       return e.ringData.index == 1;
    //     })
    //     // if (ring) {
    //     //   this.camera.target.x = ring.cameraData.target.x;
    //     //   this.camera.target.y = ring.cameraData.target.y;
    //     //   this.camera.target.z = ring.cameraData.target.z;
    //     // }
    //     if (ring) {
    //       this.camera.target.x = ring.GL.cameraData.target.x;
    //       this.camera.target.y = ring.GL.cameraData.target.y;
    //       this.camera.target.z = ring.GL.cameraData.target.z;
    //     }
    //   } else if (t[0] && t[1]) {
    //     // beide
    //     // let ring_0 = Ring3D.list.find(function (e) {
    //     let ring_0 = WebglRing.list.find(function (e) {
    //       return e.ringData.index == 0;
    //     })
    //     // let ring_1 = Ring3D.list.find(function (e) {
    //     let ring_1 = WebglRing.list.find(function (e) {
    //       return e.ringData.index == 1;
    //     })
    //
    //     let x = 0;
    //
    //     if (ring_0 && ring_1) {
    //       // x = (ring_0.cameraData.target.x + ring_1.cameraData.target.x) / 2;
    //       x = (ring_0.GL.cameraData.target.x + ring_1.GL.cameraData.target.x) / 2;
    //     }
    //
    //     this.camera.target.x = x;
    //     this.camera.target.y = 10;
    //     this.camera.target.z = 0;
    //   }
    // }

    this.cameraChanged = true;

    // zoomExtends(this.engine, this.canvas, this.scene, this.camera);
    if (this.forceFrames < forceFrames)
      this.forceFrames = forceFrames;

    // draw helper overlay
    if (0) {
      const canvas = document.getElementById("helperOverlay") as unknown as HTMLCanvasElement;

      if (canvas) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height);
          ctx.scale(1, -1);
          ctx.lineWidth = 1;
          ctx.translate(0.5, 0.5);

          let ring = cRing.list[0];

          if (ring) {
            let stoneData = ring.stoneCalcData,
              ringData = ring.ringData,
              height = ringData.ringSize,
              ctxScale = canvas.height / height,
              stoneSizeHalf = ringData.stone[0].size / 2 * ctxScale;

            // (1) zeichne das Segment und ermittle den kleinsten Abstand zwischen linker und rechter Segmentbegrenzung
            let outlineData = ring.calc.outlineFront;
            ctx.strokeStyle = "#fff";
            ctx.fillStyle = "#fff";
            outlineData.forEach(function (od, odIndex) {

              od.forEach(function (e, index) {
                if (index == 0) {
                  ctx.beginPath();
                  ctx.moveTo(e.x * ctxScale, e.y * ctxScale);
                } else
                  ctx.lineTo(e.x * ctxScale, e.y * ctxScale);
              });

              let material = AppComponent.app.data.material.find(function (e: iMaterial) {
                return e.id == ringData.material[odIndex];
              })
              if (material)
                ctx.fillStyle = material.colorHtml;
              else
                ctx.fillStyle = "#ff0000";

              ctx.fill();
            });

            ctx.strokeStyle = "#f00";
            ctx.fillStyle = "#f00";

            let y: number;

            if (stoneData && stoneData.coordinates) {
              stoneData.coordinates.forEach(e => {
                y = e.y;
                if (y < 0) y += ringData.ringSize;
                ctx.beginPath();
                ctx.ellipse(e.x * ctxScale, y * ctxScale, stoneSizeHalf, stoneSizeHalf, 0, 0, Math.PI * 2);
                ctx.fill();
              })
            }
          }

          ctx.restore();
        }
      }
    }
  }

  enableRenderLoop(state: boolean) {
    this.renderLoopEnabled = state;

    if (!state) {
      this.engine.stopRenderLoop();
      let targetFps: number = AppComponent.app.data.webglSettings.maxFps;
      if (targetFps < 10) targetFps = 10;
      if (targetFps > 60) targetFps = 60;
      let m1 = null, m2 = null, renderCount = 0, that = this;

      window.setTimeout(function () {
        that.cameraChanged = true;
        let lastTime: number = new Date().getTime(), curTime: number;

        let intervalHandler = function () {
          m1 = that.camera.alpha + that.camera.beta + that.camera.position.x + that.camera.position.y + that.camera.position.z;
          let ready = AppComponent.app.state.ready;

          if (ready && (that.cameraChanged || that.forceFrames > 0)) {

            zoomExtends(that.engine, that.canvas, that.scene, that.camera);

            that.matShader.setFloat("cameraRadius", that.camera.radius);
            that.matShader.setVector3("cameraPosition", that.camera.position);

            let preset = AppComponent.app.data.webglSettings.environmentPreset;
            that.matShader.setFloat("reflect_refSampler", preset.refSampler_reflect);
            that.matShader.setFloat("camRad_refSampler", preset.refSampler_camRad);
            that.matShader.setFloat("factor_refSampler", preset.refSampler_factor);

            that.matShader.setFloat("reflect_tri1", preset.tri1_reflect);
            that.matShader.setFloat("camRad_tri1", preset.tri1_camRad);
            that.matShader.setFloat("factor_tri1", preset.tri1_factor);

            that.matShader.setFloat("reflect_tri2", preset.tri2_reflect);
            that.matShader.setFloat("camRad_tri2", preset.tri2_camRad);
            that.matShader.setFloat("factor_tri2", preset.tri2_factor);

            that.matShader.setFloat("reflect_high", preset.high_reflect);
            that.matShader.setFloat("camRad_high", preset.high_camRad);
            that.matShader.setFloat("factor_high", preset.high_factor);

            that.matShader.setFloat("reflect_sparkle", preset.sparkle_reflect);
            that.matShader.setFloat("camRad_sparkle", preset.sparkle_camRad);
            that.matShader.setFloat("factor_sparkle", preset.sparkle_factor);

            that.matShader.setFloat("reflect_fire", preset.fire_reflect);
            that.matShader.setFloat("camRad_fire", preset.fire_camRad);
            that.matShader.setFloat("factor_fire", preset.fire_factor);

            that.scene.render();
            curTime = new Date().getTime();

            if (that.forceFrames > 0)
              that.forceFrames--;

            that.renderCount++;
            renderCount++;
            WebglComponent.busyCounter = 0;
          } else
            curTime = new Date().getTime();

          lastTime = curTime;

          if (1 && that.cameraIntroAnimate) {
            let t = 0.05;
            let targetAlpha = AppComponent.app.data.webglSettings.camera[0];
            that.camera.alpha = (1 - t) * that.camera.alpha + t * targetAlpha;

            let max = Math.max(Math.abs(that.camera.alpha), Math.abs(targetAlpha));
            let min = Math.min(Math.abs(that.camera.alpha), Math.abs(targetAlpha));

            if (max - min <= 0.001) {
              that.camera.alpha = targetAlpha;
              that.cameraIntroAnimate = false;
            }
          }

          that.camera.update();
          m2 = that.camera.alpha + that.camera.beta + that.camera.position.x + that.camera.position.y + that.camera.position.z;
          if (m1 == m2 && renderCount > 100) that.cameraChanged = false;
        };

        that.renderIntervalId = window.setInterval(intervalHandler, 1000 / targetFps);
      }, 100);
    } else {
      if (this.renderIntervalId) {
        clearInterval(this.renderIntervalId);
        this.renderIntervalId = 0;
      }
      let that = this;
      let renderLoop = function () {
        that.matShader.setFloat("cameraRadius", that.camera.radius);
        that.matShader.setVector3("cameraPosition", that.camera.position);

        let preset = AppComponent.app.data.webglSettings.environmentPreset;
        that.matShader.setFloat("reflect_refSampler", preset.refSampler_reflect);
        that.matShader.setFloat("camRad_refSampler", preset.refSampler_camRad);
        that.matShader.setFloat("factor_refSampler", preset.refSampler_factor);

        that.matShader.setFloat("reflect_tri1", preset.tri1_reflect);
        that.matShader.setFloat("camRad_tri1", preset.tri1_camRad);
        that.matShader.setFloat("factor_tri1", preset.tri1_factor);

        that.matShader.setFloat("reflect_tri2", preset.tri2_reflect);
        that.matShader.setFloat("camRad_tri2", preset.tri2_camRad);
        that.matShader.setFloat("factor_tri2", preset.tri2_factor);

        that.matShader.setFloat("reflect_high", preset.high_reflect);
        that.matShader.setFloat("camRad_high", preset.high_camRad);
        that.matShader.setFloat("factor_high", preset.high_factor);

        that.matShader.setFloat("reflect_sparkle", preset.sparkle_reflect);
        that.matShader.setFloat("camRad_sparkle", preset.sparkle_camRad);
        that.matShader.setFloat("factor_sparkle", preset.sparkle_factor);

        that.matShader.setFloat("reflect_fire", preset.fire_reflect);
        that.matShader.setFloat("camRad_fire", preset.fire_camRad);
        that.matShader.setFloat("factor_fire", preset.fire_factor);

        that.scene.render();
      };
      this.engine.runRenderLoop(renderLoop);
    }
  }

  /*
    show_axis(size: number): Mesh[] | null {
      if (!this.scene) return null;
      let axisX = CreateLines("axisX", {
        points: [
          new Vector3(-size, 0, 0), new Vector3(size, 0, 0), new Vector3(size * 0.95, 0.05 * size, 0),
          new Vector3(size, 0, 0), new Vector3(size * 0.95, -0.05 * size, 0)
        ],
        useVertexAlpha: false
      }, this.scene);

      axisX.color = new Color3(1, 0, 0);
      let axisY = CreateLines("axisY", {
        points: [
          new Vector3(0, -size, 0), new Vector3(0, size, 0), new Vector3(-0.05 * size, size * 0.95, 0),
          new Vector3(0, size, 0), new Vector3(0.05 * size, size * 0.95, 0)
        ],
        useVertexAlpha: false
      }, this.scene);
      axisY.color = new Color3(0, 1, 0);
      let axisZ = CreateLines("axisZ", {
        points: [
          new Vector3(0, 0, -size), new Vector3(0, 0, size), new Vector3(0, -0.05 * size, size * 0.95),
          new Vector3(0, 0, size), new Vector3(0, 0.05 * size, size * 0.95)
        ],
        useVertexAlpha: false
      }, this.scene);
      axisZ.color = new Color3(0, 0, 1);

      return [axisX, axisY, axisZ];
    }

    show_normals(mesh: Mesh, size: number, color: Color3, pivot: any) {
      let normals = mesh.getVerticesData(VertexBuffer.NormalKind);
      if (!normals) return;
      let positions = mesh.getVerticesData(VertexBuffer.PositionKind);
      color = color || Color3.White();
      size = size || 1;
      let lines = [], i, v1, v2;
      for (i = 0; i < normals.length; i += 3) {
        v1 = Vector3.FromArray(<FloatArray>positions, i);
        v2 = v1.add(Vector3.FromArray(normals, i).scaleInPlace(size));
        lines.push([v1.add(mesh.position), v2.add(mesh.position)]);
      }
      let normalLines = MeshBuilder.CreateLineSystem("normalLines", {lines}, this.scene);
      normalLines.color = color;
      normalLines.parent = pivot;
      return normalLines;
    }
  */

  isAdmin() {
    return AppComponent.app.state.admin;
  }
}

export async function createScreenshot(size: number): Promise<string> {
  let webgl = WebglComponent.WEBGL;
  if (!webgl) return "";

  let renderLoopState = webgl.renderLoopEnabled;

  if (!renderLoopState)
    webgl.enableRenderLoop(true);

  if (1) {
    let t = [] as boolean[];
    RingData.list.forEach(function (e) {
      if (e.cartActive) t.push(true);
      else t.push(false);
    })
    if (t[0] && !t[1]) {
      // look at 0
      let ring = cRing.list.find(function (e) {
        return e.ringData.index == 0;
      })
      if (ring) {
        webgl.cameraScreenshot.setTarget(new Vector3(
          ring.cameraData.target.x,
          ring.cameraData.target.y,
          ring.cameraData.target.z
        ));
      }
    } else if (!t[0] && t[1]) {
      // look at 1
      let ring = cRing.list.find(function (e) {
        return e.ringData.index == 1;
      })
      if (ring) {
        webgl.cameraScreenshot.setTarget(new Vector3(
          ring.cameraData.target.x,
          ring.cameraData.target.y,
          ring.cameraData.target.z
        ));
      }
    } else if (t[0] && t[1]) {
      // beide
      let ring_0 = cRing.list.find(function (e) {
        return e.ringData.index == 0;
      })
      let ring_1 = cRing.list.find(function (e) {
        return e.ringData.index == 1;
      })

      let x = 0;

      if (ring_0 && ring_1) {
        x = (ring_0.cameraData.target.x + ring_1.cameraData.target.x) / 2;
      }

      webgl.cameraScreenshot.setTarget(new Vector3(x, 10, 0));
    }
    // if (t[0] && !t[1]) {
    //   // look at 0
    //   let ring = WebglRing.list.find(function (e) {
    //     return e.ringData.index == 0;
    //   })
    //   if (ring) {
    //     webgl.cameraScreenshot.setTarget(new Vector3(
    //       ring.GL.cameraData.target.x,
    //       ring.GL.cameraData.target.y,
    //       ring.GL.cameraData.target.z
    //     ));
    //   }
    // } else if (!t[0] && t[1]) {
    //   // look at 1
    //   let ring = WebglRing.list.find(function (e) {
    //     return e.ringData.index == 1;
    //   })
    //   if (ring) {
    //     webgl.cameraScreenshot.setTarget(new Vector3(
    //       ring.GL.cameraData.target.x,
    //       ring.GL.cameraData.target.y,
    //       ring.GL.cameraData.target.z
    //     ));
    //   }
    // } else if (t[0] && t[1]) {
    //   // beide
    //   let ring_0 = WebglRing.list.find(function (e) {
    //     return e.ringData.index == 0;
    //   })
    //   let ring_1 = WebglRing.list.find(function (e) {
    //     return e.ringData.index == 1;
    //   })
    //
    //   let x = 0;
    //
    //   if (ring_0 && ring_1) {
    //     x = (ring_0.GL.cameraData.target.x + ring_1.GL.cameraData.target.x) / 2;
    //   }
    //
    //   webgl.cameraScreenshot.setTarget(new Vector3(x, 10, 0));
    // }
  }

  webgl.cameraScreenshot.alpha = AppComponent.app.data.webglSettings.camera[0];
  webgl.cameraScreenshot.beta = AppComponent.app.data.webglSettings.camera[1];
  webgl.cameraScreenshot.radius = 50;//AppComponent.app.data.webglSettings.camera[2];

  let layerMask = cRing.list[0].mesh.length ? cRing.list[0].mesh[0].layerMask : cRing.list[1].mesh[0].layerMask;

  let setLayerMask = function (mask: number) {
    cRing.list.forEach(r => {
      r.mesh.forEach(m => {
        if (m)
          m.layerMask = mask;
      })
    })
  }
  // let layerMask = WebglRing.list[0].GL.mesh[0].layerMask;
  //
  // let setLayerMask = function (mask: number) {
  //   WebglRing.list.forEach(r => {
  //     r.GL.mesh.forEach(m => {
  //       if (m)
  //         m.layerMask = mask;
  //     })
  //   })
  // }

  setLayerMask(0x20000000);

  let imgData = "";
  await CreateScreenshotUsingRenderTargetAsync(webgl.engine, webgl.cameraScreenshot, {
    width: size,
    height: size
  }).then(function (data) {
    imgData = data;
    if (!renderLoopState) {
      // @ts-ignore
      webgl.enableRenderLoop(false);
    }
  });

  setLayerMask(layerMask);

  return imgData;
}

async function createRingScreenshot(ringIndex: number, width: number, height: number): Promise<string> {
  let webgl = WebglComponent.WEBGL;
  if (!webgl) return "";
  if (ringIndex < 0 || ringIndex > 1) return "";
  if (RingData.list.length < 2 || !RingData.list[ringIndex].cartActive) return "";

  let ring = cRing.list.find(e => {
    return e.ringData.index == ringIndex;
  })

  if (!ring || !ring.mesh || !ring.mesh.length) return "";
  // @ts-ignore
  let camData = ring.cameraData;
  // @ts-ignore
  let layerMask = ring.mesh[0].layerMask;

  let setLayerMask = function (mask: number) {
    // @ts-ignore
    ring.mesh.forEach(function (e) {
      if (e)
        e.layerMask = mask;
    })
  }
  // let ring = WebglRing.list.find(e => {
  //   return e.ringData.index == ringIndex;
  // })
  //
  // if (!ring || !ring.GL.mesh || !ring.GL.mesh.length) return "";
  // // @ts-ignore
  // let camData = ring.GL.cameraData;
  // // @ts-ignore
  // let layerMask = ring.GL.mesh[0].layerMask;
  //
  // let setLayerMask = function (mask: number) {
  //   // @ts-ignore
  //   ring.GL.mesh.forEach(function (e) {
  //     if (e)
  //       e.layerMask = mask;
  //   })
  // }

  setLayerMask(0x20000000);

  webgl.cameraScreenshot.setPosition(new Vector3(camData.position.x, camData.position.y, camData.position.z));
  webgl.cameraScreenshot.setTarget(new Vector3(camData.target.x, camData.target.y, camData.target.z));
  webgl.cameraScreenshot.radius = (ring.ringData.ringSize / 1.5) / 1000;

  let renderLoopState = webgl.renderLoopEnabled;

  if (!renderLoopState)
    webgl.enableRenderLoop(true);

  let imgData = "";
  await CreateScreenshotUsingRenderTargetAsync(webgl.engine, webgl.cameraScreenshot, {
    width: width,
    height: height
  }).then(function (data: string) {
    imgData = data;
    if (!renderLoopState) {
      // @ts-ignore
      webgl.enableRenderLoop(false);
    }
  });

  setLayerMask(layerMask);

  return imgData;
}

export function collectRingScreenshots(width: number, height: number, callback: Function) {
  let data = [] as string[];

  createRingScreenshot(0, width, height).then(function (imgData) {
    data.push(imgData);
    createRingScreenshot(1, width, height).then(function (imgData) {
      data.push(imgData);

      if (callback) callback(data);
    })
  })
}

function download(text: string, name: string, type: string) {
  let a = document.createElement("a");
  let file = new Blob([text], {type: type});
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
}

export function exportObj() {
  let webgl = WebglComponent.WEBGL;
  if (webgl) {
    // @ts-ignore
    download(OBJExport.OBJ(webgl.scene.meshes, true, "scene", false), "scene.obj", "text/plain");
  }
}
