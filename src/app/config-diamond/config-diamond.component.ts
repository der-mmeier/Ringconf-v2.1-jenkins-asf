import {Component} from '@angular/core';
import {
  AppComponent,
  dbGetEnvironmentPresetList,
  dbSaveEnvironmentPreset,
  dbSetAppData, dbSetCurrentAppData, restoreEnvTexture,
  uploadFile
} from "../app.component";
import {saveAs} from "file-saver";
import {WebglComponent} from "../webgl/webgl.component";
import {environment} from "../../environments/environment";
import { HttpClient } from "@angular/common/http";
import {Matrix} from "@babylonjs/core";
import {iEnvironmentPreset} from "../app.interfaces";
import {lastValueFrom} from "rxjs";

@Component({
  selector: 'x-config-diamond',
  templateUrl: './config-diamond.component.html',
  styleUrls: ['./config-diamond.component.scss']
})
export class ConfigDiamondComponent {

  environmentPresets: iEnvironmentPreset[] = [];
  environmentPresetNames: string[] = [];

  constructor(private httpClient: HttpClient) {
    let that = this;
    dbGetEnvironmentPresetList().then(r => {
      if (r.result) {
        let result = r.result as [];

        that.environmentPresets = [AppComponent.app.data.webglSettings.environmentPreset];
        that.environmentPresetNames = [""];

        result.forEach(e => {
          //@ts-ignore
          that.environmentPresets.push(JSON.parse(e.value));
          //@ts-ignore
          that.environmentPresetNames.push(e.id);
        })
      }
    });
  }

  env = environment;

  refSampler_image = WebglComponent.WEBGL.refSampler_image;

  getRefSampler_image() {
    return AppComponent.app.data.webglSettings.environmentPreset.refSampler_image;
  }

  refSampler_image_change(event:Event) {
    console.log((<HTMLSelectElement>event.target).value);
    AppComponent.app.data.webglSettings.environmentPreset.refSampler_image =(<HTMLSelectElement>event.target).value;
    dbSetCurrentAppData().then(e => {
      window.location.reload();
    });

  }

  refSampler_reflect() {
    return AppComponent.app.data.webglSettings.environmentPreset.refSampler_reflect;
  }

  refSampler_camRad() {
    return AppComponent.app.data.webglSettings.environmentPreset.refSampler_camRad;
  }

  refSampler_factor() {
    return AppComponent.app.data.webglSettings.environmentPreset.refSampler_factor;
  }

  tri1_image = WebglComponent.WEBGL.tri1_image;

  tri1_reflect() {
    return AppComponent.app.data.webglSettings.environmentPreset.tri1_reflect;
  }

  tri1_camRad() {
    return AppComponent.app.data.webglSettings.environmentPreset.tri1_camRad;
  }

  tri1_factor() {
    return AppComponent.app.data.webglSettings.environmentPreset.tri1_factor;
  }

  tri2_image = WebglComponent.WEBGL.tri2_image;

  tri2_reflect() {
    return AppComponent.app.data.webglSettings.environmentPreset.tri2_reflect;
  }

  tri2_camRad() {
    return AppComponent.app.data.webglSettings.environmentPreset.tri2_camRad;
  }

  tri2_factor() {
    return AppComponent.app.data.webglSettings.environmentPreset.tri2_factor;
  }

  high_image = WebglComponent.WEBGL.high_image;

  high_reflect() {
    return AppComponent.app.data.webglSettings.environmentPreset.high_reflect;
  }

  high_camRad() {
    return AppComponent.app.data.webglSettings.environmentPreset.high_camRad;
  }

  high_factor() {
    return AppComponent.app.data.webglSettings.environmentPreset.high_factor;
  }

  sparkle_image = WebglComponent.WEBGL.sparkle_image;

  sparkle_reflect() {
    return AppComponent.app.data.webglSettings.environmentPreset.sparkle_reflect;
  }

  sparkle_camRad() {
    return AppComponent.app.data.webglSettings.environmentPreset.sparkle_camRad;
  }

  sparkle_factor() {
    return AppComponent.app.data.webglSettings.environmentPreset.sparkle_factor;
  }

  fire_image = WebglComponent.WEBGL.fire_image;

  fire_reflect() {
    return AppComponent.app.data.webglSettings.environmentPreset.fire_reflect;
  }

  fire_camRad() {
    return AppComponent.app.data.webglSettings.environmentPreset.fire_camRad;
  }

  fire_factor() {
    return AppComponent.app.data.webglSettings.environmentPreset.fire_factor;
  }


  // diamondEnvMap() {
  //   let result = AppComponent.app.data.diamondSettings.envTexturePath;
  //   if (result == null) return "  --  (nutze globale Umgebungsmap)"
  //   return result;
  // }

  set_refSampler_reflect(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.refSampler_reflect = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_refSampler_camRad(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.refSampler_camRad = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_refSampler_factor(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.refSampler_factor = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_tri1_camRad(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.tri1_camRad = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_tri1_factor(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.tri1_factor = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_tri1_reflect(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.tri1_reflect = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_tri2_camRad(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.tri2_camRad = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_tri2_factor(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.tri2_factor = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_tri2_reflect(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.tri2_reflect = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_high_reflect(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.high_reflect = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_high_camRad(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.high_camRad = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_high_factor(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.high_factor = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_sparkle_reflect(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.sparkle_reflect = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_sparkle_camRad(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.sparkle_camRad = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_sparkle_factor(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.sparkle_factor = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_fire_reflect(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.fire_reflect = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_fire_camRad(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.fire_camRad = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  set_fire_factor(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.fire_factor = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.renderFrame(1);
  }

  //@ts-ignore
  upload_envTexture(event) {
    let files = event.srcElement.files
    if (!files) {
      return
    }

    const formData: FormData = new FormData();
    formData.append("envTexture", files[0], files[0].name);
    uploadFile("/assets/img3d/", "envTexture.env", formData, "envTexture").then();
  }
  restore_envTexture() {
    restoreEnvTexture();
  }

  get_envTexture_yaw() {
    return AppComponent.app.data.webglSettings.environmentPreset.envTexture_yaw;
  }

  set_envTexture_yaw(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.envTexture_yaw = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.envTexture.setReflectionTextureMatrix(Matrix.RotationYawPitchRoll(
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_yaw * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_pitch * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_roll * 2 * Math.PI
    ));
    WebglComponent.WEBGL.renderFrame(1);
  }

  get_envTexture_pitch() {
    return AppComponent.app.data.webglSettings.environmentPreset.envTexture_pitch;
  }

  set_envTexture_pitch(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.envTexture_pitch = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.envTexture.setReflectionTextureMatrix(Matrix.RotationYawPitchRoll(
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_yaw * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_pitch * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_roll * 2 * Math.PI
    ));
    WebglComponent.WEBGL.renderFrame(1);
  }

  get_envTexture_roll() {
    return AppComponent.app.data.webglSettings.environmentPreset.envTexture_roll;
  }

  set_envTexture_roll(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.envTexture_roll = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.envTexture.setReflectionTextureMatrix(Matrix.RotationYawPitchRoll(
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_yaw * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_pitch * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_roll * 2 * Math.PI
    ));
    WebglComponent.WEBGL.renderFrame(1);
  }

  get_scene_exposure() {
    return AppComponent.app.data.webglSettings.environmentPreset.scene_exposure;
  }

  set_scene_exposure(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.scene_exposure = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.scene.imageProcessingConfiguration.exposure = AppComponent.app.data.webglSettings.environmentPreset.scene_exposure;
    WebglComponent.WEBGL.renderFrame(1);
  }

  get_scene_contrast() {
    return AppComponent.app.data.webglSettings.environmentPreset.scene_contrast;
  }

  set_scene_contrast(event: Event) {
    AppComponent.app.data.webglSettings.environmentPreset.scene_contrast = parseFloat((<HTMLInputElement>event.target).value);
    WebglComponent.WEBGL.scene.imageProcessingConfiguration.contrast = AppComponent.app.data.webglSettings.environmentPreset.scene_contrast;
    WebglComponent.WEBGL.renderFrame(1);
  }

  private preset_name: string = "";

  set_preset_name(event: Event) {
    this.preset_name = (<HTMLInputElement>event.target).value;
  }

  can_save_preset() {
    return this.preset_name.length > 5;
  }

  save_preset() {
    dbSaveEnvironmentPreset(this.preset_name, JSON.stringify(AppComponent.app.data.webglSettings.environmentPreset)).then();
  }

  private selected_preset:string="";

  select_preset(event: Event) {
    this.selected_preset = (<HTMLSelectElement>event.target).value;
  }

  update_environment() {
    WebglComponent.WEBGL.envTexture.setReflectionTextureMatrix(Matrix.RotationYawPitchRoll(
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_yaw * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_pitch * 2 * Math.PI,
      AppComponent.app.data.webglSettings.environmentPreset.envTexture_roll * 2 * Math.PI
    ));
    WebglComponent.WEBGL.scene.imageProcessingConfiguration.exposure = AppComponent.app.data.webglSettings.environmentPreset.scene_exposure;
    WebglComponent.WEBGL.scene.imageProcessingConfiguration.contrast = AppComponent.app.data.webglSettings.environmentPreset.scene_contrast;
    WebglComponent.WEBGL.renderFrame(1);
  }

  load_preset() {
    let that = this;
    let index = this.environmentPresetNames.findIndex(e => {
      return e == that.selected_preset;
    })
    if (index > 0) {
      AppComponent.app.data.webglSettings.environmentPreset = JSON.parse(JSON.stringify(this.environmentPresets[index]));
      this.update_environment();
    }
  }

  import_json() {
    //@ts-ignore
    let files = document.getElementById('selectFiles').files;
    if (!files || files.length <= 0) return;

    let fr = new FileReader();
    let that = this;

    fr.onload = function (e) {
      // @ts-ignore
      AppComponent.app.data.webglSettings.environmentPreset = JSON.parse(e.target.result);
      that.update_environment();
    }

    fr.readAsText(files.item(0));
  }

  export_json() {
    let fileName = 'config.json';

    let fileToSave = new Blob([JSON.stringify(AppComponent.app.data.webglSettings.environmentPreset)], {
      type: 'application/json'
    });

    saveAs(fileToSave, fileName);
  }

  upload_appData() {
    dbSetCurrentAppData().then();
  }

  restore_appData() {
    dbSetAppData().then();
  }
}
