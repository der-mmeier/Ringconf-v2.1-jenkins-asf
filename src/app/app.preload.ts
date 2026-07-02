import {AssetsManager, ImageAssetTask, Mesh, Texture} from "@babylonjs/core";
import '@babylonjs/loaders/OBJ'; // WICHTIG: sonst Fehlermeldung beim laden der .obj Dateien
import {WebglComponent} from "./webgl/webgl.component";
import {AppComponent} from "./app.component";
import {environment} from "../environments/environment";

export interface iPreloadPrf
{
  name: string;
  json: string;
}


export interface iPreloadSurface
{
  id: number;
  texture: Texture;
}

export interface iPreloadStone
{
  id: number;
  mesh: Mesh;
}

export let Preload = {
  prf: [] as iPreloadPrf[],
  surface: [] as iPreloadSurface[],
  stone: [] as iPreloadStone[],
  texture: {
    diamond: Texture,
    diamond_top_triangles: Texture,
    diamond_bottom_triangles: Texture,
    diamond_highlight: Texture,
    diamond_sparkle: Texture,
    diamond_fire: Texture,
  },
  image: {
    freeStones:[] as HTMLImageElement[],
  },
  ready: false,

  load(callback: Function)
  {
    let webgl = WebglComponent.WEBGL;
    if (!webgl) return;

    let assetsManager = new AssetsManager(webgl.scene);
    assetsManager.useDefaultLoadingScreen = false;

    let failed = 0;

    AppComponent.app.data.profile.forEach(function (e)
    {
      let T = assetsManager.addTextFileTask(e.name, environment.assetFolderLocation+"/assets/obj/profile/json/" + e.name + ".json");
      T.onSuccess = function (task)
      {
        Preload.prf.push({name: task.name, json: task.text});
      };
      T.onError = function (task, message)
      {
        console.log("failed: ", message);
        failed++;
      }
    })

    AppComponent.app.data.surface.forEach(function (e)
    {
      if (e.material.file)
      {
        let T = assetsManager.addTextureTask(e.id.toString(), environment.assetFolderLocation+"/assets/img3d/" + e.material.file);
        T.onSuccess = function (task)
        {
          task.texture.gammaSpace = false;
          Preload.surface.push({id: parseInt(task.name), texture: task.texture});
        };
        T.onError = function (task, message)
        {
          console.log("failed: ", message);
          failed++;
        }
      }
    })

    AppComponent.app.data.stoneType.forEach(function (e)
    {
      if (e.obj)
      {
        let T = assetsManager.addMeshTask(e.id.toString(), "", environment.assetFolderLocation+"/", "assets/obj/stone/" + e.obj);
        T.onSuccess = function (task)
        {
          let mesh = <Mesh>task.loadedMeshes[0];
          mesh.setEnabled(false);
          // mesh.isVisible = false;
          // @ts-ignore
          // mesh.material = webgl.matStandard;
          mesh.material = webgl.matShader;
          mesh.alwaysSelectAsActiveMesh = true;
          Preload.stone.push({id: parseInt(task.name), mesh: mesh});
        };

        T.onError = function (task, message)
        {
          console.log("failed: ", message);
          failed++;
        }
      }
    })

    // load "Krabbe" - >pin
    let T = assetsManager.addMeshTask("99", "", environment.assetFolderLocation+"/", "assets/obj/stone/krabbe_einzeln.obj");
    T.onSuccess = function (task)
    {
      let mesh = <Mesh>task.loadedMeshes[0];
      mesh.setEnabled(false);
      // @ts-ignore
      mesh.material = webgl.matStandard;
      mesh.alwaysSelectAsActiveMesh = true;
      Preload.stone.push({id: parseInt(task.name), mesh: mesh});
    };

    // load images
    // let I = assetsManager.addImageTask("99", environment.assetFolderLocation+"/assets/imgui/icon-brillant-stoneXY.png");
    // I.onSuccess = function (task:ImageAssetTask) {
    //   Preload.image.freeStones.push(task.image);
    // };
    // I = assetsManager.addImageTask("99", environment.assetFolderLocation+"/assets/imgui/icon-brillant-stoneXY-selected.png");
    // I.onSuccess = function (task:ImageAssetTask) {
    //   task.image.id = "freeStone_selected";
    //   document.append(task.image);
    // };

    T.onError = function (task, message)
    {
      console.log("failed: ", message);
      failed++;
    }

    assetsManager.onFinish = () =>
    {
      if (failed === 0)
      {
        // console.log("Alle Assets geladen");
        Preload.ready = true;
        if (callback) callback();
      }
      else
        console.log("Es konnten nicht alle Assets geladen werden!")
    };

    assetsManager.load();
  },
}
