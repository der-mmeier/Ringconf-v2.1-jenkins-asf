import {iProfile, iStoneDistances, iStoneMode} from "./app.interfaces";
import {AppComponent} from "./app.component";

export function getProfile(name: string): iProfile | undefined {
  return AppComponent.app.data.profile.find(e => {
    return e.name.toLowerCase() == name.toLowerCase();
  })
}

export function getStoneDistances(stoneMode: iStoneMode, profileName: string): iStoneDistances | undefined {
  return stoneMode.stoneDistances?.find(e => {
    if (e.profile)
      return (e.profile.indexOf(profileName) != -1);
    return e;
  })
}

export function getRowWidth(stoneSize: number, numRows: number, stoneDistances: iStoneDistances): number {
  let stoneToBevel_x = stoneDistances.stoneToBevel_x;
  if (stoneToBevel_x > 0 && stoneToBevel_x < 2.0) {
    stoneToBevel_x = stoneSize * stoneToBevel_x;
  }

  return stoneSize * numRows + stoneDistances.stoneToStone_x * (numRows - 1) + stoneToBevel_x * 2;
}

export function getStoneMode(mode: number): iStoneMode | undefined {
  let modes = AppComponent.app.data.stoneMode, result = undefined;
  for (let i = 0; i < modes.length; i++) {
    if (modes[i].mode === mode) {
      result = modes[i];
    } else {
      let items = modes[i].items;
      if (items) {
        for (let j = 0; j < items.length; j++) {
          if (items[j].mode === mode) {
            result = items[j];
            break;
          }
        }
      }
    }

    if (result)
      break;
  }

  return result;
}
