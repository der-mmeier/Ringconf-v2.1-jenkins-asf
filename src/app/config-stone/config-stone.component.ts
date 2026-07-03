import {Component, Input, OnInit, ViewChild, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {
  iFreeStone,
  iStoneCount, iStoneDistribution,
  iStoneMode, iStonePosition,
  iStoneQuality,
  iStoneSize,
  iStoneType
} from "../app.interfaces";
import {environment} from "../../environments/environment";
import {cRing} from "../webgl/cRing";
import {map} from "../app.helper";
import {DropdownComponent} from "../dropdown/dropdown.component";
import {StonexyComponent} from "../stonexy/stonexy.component";
import {stoneCalc_addFreeStone} from "../webgl/stoneCalc";

@Component({
    selector: 'x-config-stone',
    templateUrl: './config-stone.component.html',
    styleUrls: ['./config-stone.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class ConfigStoneComponent implements OnInit {
  @Input() ringId: number = 0;
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  items = [] as iStoneMode[];
  curStoneMode: iStoneMode | null = null;

  stoneCount = [] as number[];
  stoneRows = [] as number[];

  @ViewChild('stonexy') stonexy: StonexyComponent | undefined = undefined;
  @ViewChild('stoneSize_mode11') stoneSize_mode11: DropdownComponent | undefined = undefined;

  constructor() {
    this.closeStoneMode();
  }

  ngOnInit() {
    let that = this;

    // => stoneCount
    this.stoneCount = [] as number[];

    AppComponent.app.data.stoneCount.forEach(function (e: iStoneCount) {
      that.stoneCount.push(e.id);
    })
    for (let i = 1; i <= 100; i++) {
      this.stoneCount.push(i);
    }
    // <= stoneCount

    // => stoneRows
    this.stoneRows = [] as number[];
    let maxRows = AppComponent.app.data.stoneRowsMax;

    for (let i = 1; i <= maxRows; i++)
      this.stoneRows.push(i);
    // <= stoneRows

  }

  curStoneGroup() {
    return cRing.curStoneGroup;
  }

  // => Mode ===========================================================================================================
  isActive_stoneMode(item: iStoneMode) {
    let result = null;

    if (item.mode == this.ringData[this.ringId].stone[cRing.curStoneGroup].mode) {
      result = item;
    }

    if (!result && item.items) {
      let items = item.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].mode == this.ringData[this.ringId].stone[cRing.curStoneGroup].mode) {
          result = items[i];
          break;
        }
      }
    }

    this.curStoneMode = result;
    return this.curStoneMode ? true : false;
  }

  isDisabled_stoneMode(item: iStoneMode) {
    if (item.mode == 0)
      return false;

    let ringData = this.ringData[this.ringId];

    let ring = cRing.list.find(e => {
      return e.ringData.index == ringData.index;
    })

    // if (ring && ring.calc.stoneMinMaxCurSize.length == 0)
    //   return true;

    let itemModes = [] as number[];
    if (item.mode)
      itemModes.push(item.mode);
    else if (item.items) {
      item.items.forEach(e => {
        if (e.mode)
          itemModes.push(e.mode)
      })
    }

    let profile = AppComponent.app.data.profile.find(e => {
      return e.name == ringData.profileName;
    })

    let result = false;

    if (profile) {
      let intersection = profile.stoneModes.filter(x => itemModes.includes(x));
      result = !intersection.length;
    }

    // if (ring && ring.calc.stoneMinMaxCurSize.length == 0 && item.mode != 31 && result) {
    //   result = false;
    // }

    if (item.minRingWidth && item.minRingWidth > ringData.ringWidth)
      result = true;

    return result;
  }

  selectStoneMode(item: iStoneMode) {
    if (item.items) {
      this.items = item.items;
    } else if (item.mode != undefined) {

      if (item.defaultStoneSize != undefined && item.defaultStoneSize > 0)
        this.ringData[this.ringId].stone[cRing.curStoneGroup].size = item.defaultStoneSize;

      RingData.setStoneMode(this.ringData[this.ringId], cRing.curStoneGroup, item);
      this.closeStoneMode();
    }
  }

  closeStoneMode() {
    this.items = this.app.data.stoneMode;
  }

  // <= Mode

  // => Type ===========================================================================================================
  getValue_stoneType() {
    let ringData = this.ringData[this.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];
    let result = this.app.data.stoneType.find(function (e: iStoneType) {
      return e.id == stoneGroup.type;
    })
    return result;
  }

  onValueFormat_stoneType(value: iStoneType) {
    if (value)
      return "<img class='icon' src='" + environment.assetFolderLocation + "/assets/imgui/" + value.img + "'></img>" + value.name;
    return null;
  }

  onValueHidden_stoneType(that: ConfigStoneComponent, value: iStoneType) {
    let ringData = that.ringData[that.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];

    return (value.allowedStoneMode.indexOf(stoneGroup.mode) == -1 ||
      value.size[0].minRingWidth >= ringData.ringWidth ||
      value.size[0].minRingHeight >= ringData.ringHeight);
  }

  onSelect_stoneType(value: iStoneType) {
    RingData.setStoneType(this.ringData[this.ringId], cRing.curStoneGroup, value);
  }

  // <= Type

  // => Size ===========================================================================================================
  getOptions_stoneSize() {
    let ringData = this.ringData[this.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];
    let stoneType = this.app.data.stoneType.find(function (e: iStoneType) {
      return e.id == stoneGroup.type;
    })

    if (stoneType) {
      return stoneType.size;
    }

    return [];
  }

  getValue_stoneSize() {
    let ringData = this.ringData[this.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];
    let stoneType = this.app.data.stoneType.find(function (e: iStoneType) {
      return e.id == stoneGroup.type;
    })

    if (!stoneType) return null;

    return stoneType.size.find(function (e) {
      return e.size == stoneGroup.size;
    })
  }

  onValueFormat_stoneSize(sizeItem: iStoneSize) {
    if (sizeItem)
      return (sizeItem.size / 1000).toFixed(1) + "mm / " + sizeItem.carat + "ct";
    return null;
  }

  onValueHidden_stoneSize(that: ConfigStoneComponent, sizeItem: iStoneSize) {
    let ringData = that.ringData[that.ringId];
    let minSize = 0;
    let maxSize = 9999;
    let ring = cRing.list.find(e => {
      return e.ringData.index == ringData.index;
    })
    if (ring) {
      let stoneCalcData = ring.stoneCalcData;
      if (stoneCalcData) {
        minSize = stoneCalcData.minSize;
        maxSize = stoneCalcData.maxSize;
      }
    }
    return !(ringData.ringWidth >= sizeItem.minRingWidth
      && ringData.ringHeight >= sizeItem.minRingHeight
      && minSize <= sizeItem.size
      && maxSize >= sizeItem.size
    );

    return false;
  }

  onSelect_stoneSize(value: iStoneSize) {
    RingData.setStoneSize(this.ringData[this.ringId], cRing.curStoneGroup, value);
  }

  // <= Size

  // => Quality ========================================================================================================
  setValue_stoneQuality(item: iStoneQuality) {
    RingData.setStoneQuality(this.ringData[this.ringId], cRing.curStoneGroup, item);
  }

  // <=

  // => Distribution ===================================================================================================
  isVisible_distribution() {
    let stoneGroup = this.ringData[this.ringId].stone[cRing.curStoneGroup];
    let notAllowedModes = [20, 31, 42,43,44, 45];
    return notAllowedModes.indexOf(stoneGroup.mode) == -1;
  }

  getValue_stoneDistribution() {
    let stoneGroup = this.ringData[this.ringId].stone[cRing.curStoneGroup];
    return this.app.data.stoneDistribution.find(function (e: iStoneDistribution) {
      return e.id == stoneGroup.distribution;
    })
  }

  onValueFormat_stoneDistribution(item: iStoneDistribution) {
    return item.name;
  }

  onSelect_stoneDistribution(item: iStoneDistribution) {
    RingData.setStoneDistribution(this.ringData[this.ringId], cRing.curStoneGroup, item);
  }

  // <= Distribution

  // => Count ==========================================================================================================
  isVisible_count() {
    let stoneMode = this.ringData[this.ringId].stone[cRing.curStoneGroup].mode;
    if (stoneMode == 35) return false;
    return true;
  }

  getTitle_stoneCount(): string {

    let result = this.hasRows() ? 'Anzahl pro Reihe' : 'Anzahl';

    let stoneGroup = this.ringData[this.ringId].stone[cRing.curStoneGroup];
    if (stoneGroup.count < 0)
      result += " (" + stoneGroup.countReal / stoneGroup.rows + ")";

    return result;
  }

  getValue_stoneCount() {
    return this.ringData[this.ringId].stone[cRing.curStoneGroup].count;
  }

  onValueFormat_stoneCount(item: number) {
    if (item < 0) {
      let result = AppComponent.app.data.stoneCount.find(e => {
        return e.id == item;
      })

      if (result)
        return result.name;
    }

    return item;
  }

  onValueHidden_stoneCount(that: ConfigStoneComponent, value: number) {
    let ringData = that.ringData[that.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];

    let test = [31];
    if (value < 0 && test.indexOf(stoneGroup.mode) != -1) return true;

    // Verschnitt und Kanal seitlich nur "Voll" zulassen
    test = [42, 43, 44, 45];
    if (test.indexOf(stoneGroup.mode) != -1 && value < 0 && value > -100) return true;

    test = [20, 40, 41, 42, 43, 44, 45];
    if (value < 0 && that.isVisible_distribution() || test.indexOf(stoneGroup.mode) != -1 && stoneGroup.distribution < 33) return false;

    let ring = cRing.list.find(e => {
      return e.ringData.index == that.ringId;
    })

    if (ring) {
      let stoneCalcData = ring.stoneCalcData;
      let maxCount = stoneCalcData ? stoneCalcData.maxCount : 100;
      return value > maxCount;
    }

    return false;
  }

  onSelect_stoneCount(item: number) {
    RingData.setStoneCount(this.ringData[this.ringId], cRing.curStoneGroup, item);
  }

  // <= Count

  // => Rows ===========================================================================================================
  getValue_stoneRows() {
    return this.ringData[this.ringId].stone[cRing.curStoneGroup].rows;
  }

  onValueHidden_stoneRows(that: ConfigStoneComponent, value: number) {
    let ringData = that.ringData[that.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];

    let ring = cRing.list.find(e => {
      return e.ringData.index == ringData.index;
    })

    if (ring && ring.stoneCalcData) return value > ring.stoneCalcData.maxRows;

    return false;
  }

  onSelect_stoneRows(item: number) {
    RingData.setStoneRows(this.ringData[this.ringId], cRing.curStoneGroup, item);
  }

  hasRows(): boolean {
    let stoneGroup = this.ringData[this.ringId].stone[cRing.curStoneGroup];
    return stoneGroup.mode === 20;
  }

  // <= Rows

  // => Position =======================================================================================================
  isVisible_stonePosition() {
    let stoneMode = this.ringData[this.ringId].stone[cRing.curStoneGroup].mode;
    return stoneMode < 40 && stoneMode != 31 && stoneMode != 35 && stoneMode != 36;
  }

  setValue_stonePosition(item: iStonePosition) {
    let ringData = this.ringData[this.ringId];
    let odmSegments = ringData.stone[cRing.curStoneGroup].odm;

    let value = this.ringData[this.ringId].ringWidth / 2;

    if (item.id != 0 && odmSegments) {
      if (item.id == -1) value += (odmSegments[0].minXSafe != undefined) ? odmSegments[0].minXSafe : odmSegments[0].minX;
      else { // @ts-ignore
        value += (odmSegments[odmSegments.length - 1].maxXSafe != undefined) ? odmSegments[odmSegments.length - 1].maxXSafe : odmSegments[odmSegments.length - 1].maxX;
      }
    }

    RingData.setStonePositionValue(this.ringData[this.ringId], cRing.curStoneGroup, value);
  }

  // <= Position

  // => Free Stones ====================================================================================================
  onClick_addFreeStone() {
    if (this.stoneSize_mode11) {
      let that = this;
      let ring = cRing.list.find(e => {
        return e.ringData.index == that.ringId;
      })
      if (ring) {
        stoneCalc_addFreeStone(ring, this.stoneSize_mode11.value.size);
        ring.ringData.isDirty = true;
      }
    }
  }

  getValue_freeStoneX(xDiv: any) {
    let ringData = this.ringData[this.ringId];
    let x = map(xDiv, -5000, 5000, -ringData.ringWidth / 2, ringData.ringWidth / 2);
    return (x / 1000).toFixed(1);// + "mm";
  }

  getValue_freeStoneY(yRad: any) {
    let grad = map(yRad, Math.PI, -Math.PI, 180, -180);
    return (grad).toFixed(1) + "°";
  }

  getValue_freeStoneSize(size: number) {
    let ringData = this.ringData[this.ringId];
    let stoneGroup = ringData.stone[cRing.curStoneGroup];
    let stoneType = this.app.data.stoneType.find(function (e: iStoneType) {
      return e.id == stoneGroup.type;
    })

    if (!stoneType) return "???";

    let stoneSizeItem = stoneType.size.find(function (e) {
      return e.size == size;//stoneGroup.size;
    })
    if (stoneSizeItem)
      return stoneSizeItem.carat + "ct./"+(size / 1000).toFixed(1) + "mm";

    return "???";
  }

  delete_freeStone(i: number) {
    let ringData = this.ringData[this.ringId];
    let freeStones = ringData.stone[cRing.curStoneGroup].freeStones;
    if (freeStones) {
      let newFreeStones = [] as iFreeStone[];
      freeStones.forEach(function (e, index) {
        if (index != i)
          newFreeStones.push(e);
      })
      ringData.stone[cRing.curStoneGroup].freeStones = newFreeStones;
      this.ringData[this.ringId].isDirty = true;
    }

  }

  // <= Free Stones

  trackByFn(index: number, item: any) {
    return index;
  }
}
