import {Component, ElementRef, Input, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {iMaterial, iStoneSize} from "../app.interfaces";
import {cRing} from "../webgl/cRing";
import {getStoneCuts} from "../stone-taxonomy";

@Component({
    selector: 'x-multi-thumb-slider',
    templateUrl: './multi-thumb-slider.component.html',
    styleUrls: ['./multi-thumb-slider.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class MultiThumbSliderComponent {
  @Input() ringId: number = 0;
  @Input() mode: string = "";
  @Input() onThumbChanging: Function | null = null;
  @Input() curStoneGroup: number = 0;

  showValue: boolean = false;
  showHandleIndex: boolean = false;

  app = AppComponent.app;
  ringData = RingData.list;

  materialDivTemp = [] as number[];
  gapDivTemp = [] as number[];
  // webglRing: WebglRing | undefined = undefined;
  ring: cRing | undefined = undefined;

  segmentDiv: iGetSegmentDivResult[] | null = null;
  gapSegments: iGetSegmentDivResult[] | null = null;

  lastComputed = -1;
  private updateIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private elem: ElementRef) {
  }

  ngAfterViewInit() {

    let that = this;

    this.updateIntervalId = setInterval(function () {

      let ring = cRing.list[that.ringId];
      // @ts-ignore
      if (ring && that.lastComputed < ring.calc.lastComputed) {
        that.segmentDiv = that.getSegmentDiv();
        that.gapSegments = that.getGapSegments();


        that.lastComputed = ring.calc.lastComputed;
      }
    }, 500);
  }

  ngOnDestroy() {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  getMaterialDivTrackKey(index: number): string {
    return `material-segment:${this.ringId}:${index}`;
  }

  getMaterialValueTrackKey(index: number): string {
    return `material-value:${this.ringId}:${index}`;
  }

  getGapMaterialDivTrackKey(index: number): string {
    return `gap-material-segment:${this.ringId}:${index}`;
  }

  getStoneSegmentTrackKey(index: number): string {
    return `stone-segment:${this.ringId}:${index}`;
  }

  getStoneGapSegmentTrackKey(index: number): string {
    return `stone-gap-segment:${this.ringId}:${index}`;
  }

  getStonePositionValueTrackKey(index: number): string {
    return `stone-position-value:${this.ringId}:0:${index}`;
  }

  onThumbSelectMouse(e: MouseEvent) {
    if (e.target != null && (<HTMLElement>e.target).parentElement != null) {
      e.stopPropagation();

      let parent = (<HTMLElement>e.target).parentElement;
      if (parent) {
        (<HTMLElement>e.target).remove();
        parent.appendChild(<HTMLElement>e.target);
      }

      MTS.currentComponent = this;
      MTS.currentThumb = <HTMLElement>e.target;
      // @ts-ignore
      MTS.trackWidth = (<HTMLElement>e.target).parentElement.offsetWidth;

      MTS.initialX = (<MouseEvent>e).clientX - (e.target as HTMLElement).offsetLeft;

      MTS.ringData = this.ringData[this.ringId];

      window.addEventListener("mousemove", mousemove);
      window.addEventListener("mouseup", mouseup);
    } else alert("no parent");
  }

  onThumbSelectTouch(e: TouchEvent) {
    if (e.target != null && (<HTMLElement>e.target).parentElement != null) {
      e.stopPropagation();

      let parent = (<HTMLElement>e.target).parentElement;
      if (parent) {
        (<HTMLElement>e.target).remove();
        parent.appendChild(<HTMLElement>e.target);
      }

      MTS.currentComponent = this;
      MTS.currentThumb = <HTMLElement>e.target;
      // @ts-ignore
      MTS.trackWidth = (<HTMLElement>e.target).parentElement.offsetWidth;

      MTS.initialX = (<unknown>e as TouchEvent).touches[0].clientX - (e.target as HTMLElement).offsetLeft;

      MTS.ringData = this.ringData[this.ringId];

      window.addEventListener("touchmove", mousemove);
      window.addEventListener("touchend", mouseup);
    } else alert("no parent");
  }

  getMaterialDiv(): number[] {
    let ringData = this.ringData[this.ringId];
    let divMode = ringData.divPreset.slice(0, 1).toLowerCase();

    if (divMode == "s" || divMode == "h")
      return [10000];

    return ringData.materialDiv;
  }

  trackByFn(index: number, item: any) {
    return index;
  }

  getSegmentDiv(): iGetSegmentDivResult[] {
    let ringData = this.ringData[this.ringId];
    let divMode = ringData.divPreset.slice(0, 1).toLowerCase();

    // if (divMode == "s" || divMode == "h")
    //   return [10000];

    if (ringData.materialDiv.length == 1 || divMode == "s" || divMode == "h")
      return [{
        width: "100%",
        color: this.getMaterialColor(0)
      }];

    let result = [] as iGetSegmentDivResult[];
    let gapWidthPercent = ringData.gapWidth * 100 / ringData.ringWidth,
      gapWidthPercentHalf = gapWidthPercent / 2,
      lastIndex = ringData.materialDiv.length - 1;

    let mDiv = ringData.materialDiv;
    let sum = mDiv.reduce(function (a, b) {
      return a + b;
    })
    //   return (mDiv[index] * 100 / sum) + "%";

    let that = this;
    ringData.materialDiv.forEach(function (e, index) {
      if (index == 0 || index == lastIndex) {
        result.push({
          width: "" + ((mDiv[index] * 100 / sum) - gapWidthPercentHalf) + "%",
          color: that.getMaterialColor(index)
        });
      } else {
        result.push({
          width: "" + ((mDiv[index] * 100 / sum) - gapWidthPercent) + "%",
          color: that.getMaterialColor(index)
        });
      }
      if (index < lastIndex) {
        result.push({
          width: "" + gapWidthPercent + "%",
          color: "#000"
        });
      }
    })

    return result;
  }

  // interval
  getGapSegments(): iGetSegmentDivResult[] {
    let ringData = this.ringData[this.ringId];

    let result = [] as iGetSegmentDivResult[];
    let gapWidthPercent = ringData.gapWidth * 100 / ringData.ringWidth,
      gapWidthPercentHalf = gapWidthPercent / 2,
      lastIndex = ringData.gapDiv.length - 1;

    let mDiv = ringData.gapDiv;
    if (mDiv.length == 0) return result;

    let sum = mDiv.reduce(function (a, b) {
      return a + b;
    })
    //   return (mDiv[index] * 100 / sum) + "%";

    mDiv.forEach(function (e, index) {
      if (index == 0 || index == lastIndex) {
        result.push({
          width: "" + ((mDiv[index] * 100 / sum) - gapWidthPercentHalf) + "%",
          color: "transparent"
        });
      } else {
        result.push({
          width: "" + ((mDiv[index] * 100 / sum) - gapWidthPercent) + "%",
          color: "transparent"
        });
      }
      if (index < lastIndex) {
        result.push({
          width: "" + gapWidthPercent + "%",
          color: "#000"
        });
      }
    })

    return result;
  }

  getMaterialColor(index: number): string {
    let ringData = this.ringData[this.ringId];
    let material = this.app.data.material.find(function (e: iMaterial) {
      return e.id == ringData.material[index];
    })
    if (material)
      return material.colorHtml;

    return "#ff0000";
  }

  getMaterialPercent(index: number): string {
    if (this.getMaterialDiv().length == 1)
      return "100%";

    let mDiv = this.materialDivTemp.length > 0 ? this.materialDivTemp : this.ringData[this.ringId].materialDiv;
    let sum = mDiv.reduce(function (a, b) {
      return a + b;
    })
    return (mDiv[index] * 100 / sum) + "%";
  }

  getGapPercent(index: number): string {
    if (this.ringData[this.ringId].gapDiv.length == 1)
      return "100%";

    let mDiv = this.gapDivTemp.length > 0 ? this.gapDivTemp : this.ringData[this.ringId].gapDiv;
    let sum = mDiv.reduce(function (a, b) {
      return a + b;
    })
    return (mDiv[index] * 100 / sum) + "%";
  }

  getMaterialValue(index: number): string {
    let mDiv = this.materialDivTemp.length > 0 ? this.materialDivTemp : this.ringData[this.ringId].materialDiv;
    return (mDiv[index] * this.ringData[this.ringId].ringWidth / 10000000).toFixed(2);
  }

  getGapValue(index: number): string {
    let mDiv = this.gapDivTemp.length > 0 ? this.gapDivTemp : this.ringData[this.ringId].gapDiv;
    return (mDiv[index] * this.ringData[this.ringId].ringWidth / 10000000).toFixed(2);
  }

  getMaterialThumbPosition(index: number): string {
    let ringData = this.ringData[this.ringId];
    let mDiv = ringData.materialDiv;

    if (index >= 0 && index < mDiv.length) {
      let t = 0;
      for (let i = 0; i <= index; i++)
        t += mDiv[i]
      return (t / 100) + "%";
    }

    return "0%";
  }

  getGapThumbPosition(index: number): string {
    let ringData = this.ringData[this.ringId];
    let mDiv = ringData.gapDiv;

    if (index >= 0 && index < mDiv.length) {
      let t = 0;
      for (let i = 0; i <= index; i++)
        t += mDiv[i]
      return (t / 100) + "%";
    }

    return "0%";
  }

  getMaterialSafeSegmentPercent(index: number): string {
    // let ringData = this.ringData[this.ringId];
    // let materialDiv = ringData.materialDiv;
    // let cur = 0;

    // TODO: MTS getSafeSegments
    return "20%";
  }

  /*
    getStoneMinMaxArray(): iStonePositionSegment[] {
      // if (!this.webglRing)
      // {
      //   let that = this;
      //   this.webglRing = WebglRing.list.find(e =>
      //   {
      //     return e.ringData.index == that.ringId;
      //   })
      // }
      if (!this.ring) {
        let that = this;
        this.ring = cRing.list.find(e => {
          return e.ringData.index == that.ringId;
        })
      }

      let result = [] as iStonePositionSegment[];

      // if (this.webglRing)
      // {
      //   return this.webglRing.calc.stoneMinMaxCurSize;
      // }

      if (this.ring) {
        return this.ring.calc.stoneMinMaxCurSize;
      }

      return [] as iStonePositionSegment[];
    }
  */

  getNoGoPercent(index: number): string[] {
    let ringData = this.ringData[this.ringId];

    let left = 0, right = 0;

    if (ringData.stepMode == 1 || ringData.stepMode == 3)
      left = ringData.stepWidth[0] * 100 / ringData.ringWidth;
    if (ringData.stepMode == 2 || ringData.stepMode == 3)
      right = ringData.stepWidth[1] * 100 / ringData.ringWidth;

    return [left + "%", right + "%"];
  }

  /*
    getPossibleStoneThumbPosition(index: number): string {
      // if (this.webglRing)
      // {
      //   let minMax = this.webglRing.calc.stoneMinMaxCurSize;
      //
      //   if (index >= 0 && index < minMax.length)
      //   {
      //     return (minMax[index].middle * 100 / this.ringData[this.ringId].ringWidth) + "%";
      //   }
      // }
      if (this.ring) {
        let minMax = this.ring.calc.stoneMinMaxCurSize;

        if (index >= 0 && index < minMax.length) {
          return (minMax[index].middle * 100 / this.ringData[this.ringId].ringWidth) + "%";
        }
      }
      return "0%";
    }
  */

  getStoneThumbPosition(): string {
    // if (this.webglRing)
    {
      let ringData = this.ringData[this.ringId];
      let stone = ringData.stone[this.curStoneGroup];

      let sum = stone.positionDiv.reduce(function (a, b) {
        return a + b;
      })

      return (stone.positionDiv[0] / sum * 100) + "%";
    }

    // return "0%";
  }

  getStoneRowSize(): string {
    let that = this;
    let ring = cRing.list.find(e => {
      return e.ringData.index == that.ringId;
    })

    if (!ring) return "0%";

    let rowSize = 0;
    if (ring && ring.stoneCalcData && ring.stoneCalcData.rowSizeXSafe) rowSize = ring.stoneCalcData.rowSizeXSafe;

    rowSize = rowSize * 100 / ring.ringData.ringWidth;
    return rowSize + "%";
  }

  getStonePositionPercent(index:number):string {
    let stoneData = this.ringData[this.ringId].stone[this.curStoneGroup];
    let mDiv = stoneData.positionDiv;
    let sum = mDiv.reduce(function (a, b) {
      return a + b;
    })
    return (mDiv[index] * 100 / sum) + "%";
  }

  getStonePositionValue(index:number) : string {
    let stoneData = this.ringData[this.ringId].stone[this.curStoneGroup];
    return (stoneData.positionDiv[index] * this.ringData[this.ringId].ringWidth / 10000000).toFixed(2);
  }

  updateSegments() {
    if (this.mode == "material") {
      let that = this;
      // let webglRing = WebglRing.list.find(function (e)
      // {
      //   return e.ringData.index == that.ringId;
      // });
      let ring = cRing.list.find(function (e) {
        return e.ringData.index == that.ringId;
      });

      // if (webglRing && MTS.currentThumb)
      // {
      //   let thumbIndex = parseInt(MTS.currentThumb.getAttribute("data-index") || "");
      //   let minMax = webglRing.calc.divMinMax;
      //
      //   let pos = MTS.currentThumbMM;
      //
      //   if (pos < minMax[0].min) pos = minMax[0].min;
      //   else if (pos > minMax[minMax.length - 1].max) pos = minMax[minMax.length - 1].max;
      //   else
      //   {
      //     let limit = minMax[thumbIndex];
      //     if (pos < limit.min) pos = limit.min;
      //     else if (pos > limit.max) pos = limit.max;
      //   }
      //
      //   if (MTS.currentComponent?.onThumbChanging)
      //   {
      //     MTS.currentComponent.onThumbChanging(thumbIndex, pos);
      //   }
      //
      //   MTS.currentThumbMM = pos;
      // }
      // else
      if (ring && MTS.currentThumb) {
        let thumbIndex = parseInt(MTS.currentThumb.getAttribute("data-index") || "");
        let minMax = ring.calc.divMinMax;

        let pos = MTS.currentThumbMM;

        if (pos < minMax[thumbIndex].min) pos = minMax[thumbIndex].min;
        else if (pos > minMax[thumbIndex].max) pos = minMax[thumbIndex].max;
        // if (pos < minMax[0].min) pos = minMax[0].min;
        // else if (pos > minMax[minMax.length - 1].max) pos = minMax[minMax.length - 1].max;
        // else {
        //   console.log("else", thumbIndex, minMax);
        //   let limit = minMax[thumbIndex];
        //   if (pos < limit.min) pos = limit.min;
        //   else if (pos > limit.max) pos = limit.max;
        // }

        MTS.currentThumbMM = pos;

        if (MTS.currentComponent?.onThumbChanging) {
          MTS.currentComponent.onThumbChanging(thumbIndex, pos);
        }

      }

      let width = this.elem.nativeElement.offsetWidth;
      let thumbs = <HTMLDivElement[]>this.elem.nativeElement.querySelectorAll(".thumb");
      let segments = [] as number[];

      thumbs.forEach(e => {
        segments.push(e.offsetLeft);
      })

      segments.sort(function (a, b) {
        return a - b;
      });
      let sum = 0;
      for (let i = 0; i < segments.length; i++) {
        segments[i] = Math.floor(segments[i] / width * 10000) - sum;
        sum += segments[i];
      }

      segments.push(10000 - sum);

      this.materialDivTemp = segments;
      // let materialSegments = this.getMaterialSegments();

      let htmlSegments = <HTMLDivElement[]>this.elem.nativeElement.querySelectorAll(".segment");

      for (let i = 0; i < htmlSegments.length; i++) {
        htmlSegments[i].style.width = this.getMaterialPercent(i);
      }

      // if (materialSegments.length <= htmlSegments.length)
      // {
      //   materialSegments.forEach(function (e, i)
      //   {
      //     htmlSegments[i].style.width = e.percentStr;
      //   })
      // }
    } else if (this.mode == "gap") {
      // Abgleich mit möglichen Positionen
      let that = this;
      // let webglRing = WebglRing.list.find(function (e)
      // {
      //   return e.ringData.index == that.ringId;
      // });
      let ring = cRing.list.find(function (e) {
        return e.ringData.index == that.ringId;
      });

      // if (webglRing && MTS.currentThumb)
      // {
      //   let thumbIndex = parseInt(MTS.currentThumb.getAttribute("data-index") || "");
      //   let minMax = webglRing.gapDiv_calc(webglRing.ringData.gapDiv, thumbIndex);
      //
      //   let pos = MTS.currentThumbMM;
      //   if (pos < minMax[0].min) pos = minMax[0].min;
      //   else if (pos > minMax[minMax.length - 1].max) pos = minMax[minMax.length - 1].max;
      //   else
      //   {
      //     for (let i = 0; i < minMax.length - 1; i++)
      //     {
      //       let s1 = minMax[i];
      //       let s2 = minMax[i + 1];
      //       if (pos > s1.max && pos < s2.min)
      //       {
      //         let a = pos - s1.max;
      //         let b = s2.min - pos;
      //         pos = a < b ? s1.max : s2.min;
      //         break;
      //       }
      //     }
      //   }
      //
      //   if (MTS.currentComponent?.onThumbChanging)
      //   {
      //     MTS.currentComponent.onThumbChanging(thumbIndex, pos);
      //   }
      //
      //   MTS.currentThumbMM = pos;
      // }
      // else
      if (ring && MTS.currentThumb) {
        let thumbIndex = parseInt(MTS.currentThumb.getAttribute("data-index") || "");
        let minMax = ring.gapDiv_calc(ring.ringData.gapDiv, thumbIndex);

        let pos = MTS.currentThumbMM;
        if (pos < minMax[0].min) pos = minMax[0].min;
        else if (pos > minMax[minMax.length - 1].max) pos = minMax[minMax.length - 1].max;
        else {
          for (let i = 0; i < minMax.length - 1; i++) {
            let s1 = minMax[i];
            let s2 = minMax[i + 1];
            if (pos > s1.max && pos < s2.min) {
              let a = pos - s1.max;
              let b = s2.min - pos;
              pos = a < b ? s1.max : s2.min;
              break;
            }
          }
        }

        if (MTS.currentComponent?.onThumbChanging) {
          MTS.currentComponent.onThumbChanging(thumbIndex, pos, ring.ringData.index);
        }

        MTS.currentThumbMM = pos;
      }

      let width = this.elem.nativeElement.offsetWidth;
      let thumbs = <HTMLDivElement[]>this.elem.nativeElement.querySelectorAll(".thumb.gap");
      let segments = [] as number[];

      thumbs.forEach(e => {
        segments.push(e.offsetLeft);
      })

      thumbs = <HTMLDivElement[]>this.elem.nativeElement.querySelectorAll(".thumb.disabled"); // Materialfuge
      thumbs.forEach((e, index) => {
        if (ring && ring.ringData.gapEnabled[index]) segments.push(e.offsetLeft);
      })

      segments.sort(function (a, b) {
        return a - b;
      });
      let sum = 0;
      for (let i = 0; i < segments.length; i++) {
        segments[i] = Math.floor(segments[i] / width * 10000) - sum;
        sum += segments[i];
      }

      segments.push(10000 - sum);

      this.gapDivTemp = segments;

      let htmlSegments = <HTMLDivElement[]>this.elem.nativeElement.querySelectorAll(".valueWrapper .value");

      for (let i = 0; i < htmlSegments.length; i++) htmlSegments[i].style.width = this.getGapPercent(i);

    } else if (this.mode == "stonePosition") {
      // Abgleich mit möglichen Positionen
      let that = this;
      // let webglRing = WebglRing.list.find(function (e)
      // {
      //   return e.ringData.index == that.ringId;
      // });
      let ring = cRing.list.find(function (e) {
        return e.ringData.index == that.ringId;
      });

      // if (webglRing && MTS.currentThumb)
      // {
      //   let minMax = webglRing.calc.stoneMinMaxCurSize;
      //
      //   let pos = MTS.currentThumbMM;
      //   if (minMax.length > 1)
      //   {
      //     if (pos < minMax[0].min) pos = minMax[0].min;
      //     else if (pos > minMax[minMax.length - 1].max) pos = minMax[minMax.length - 1].max;
      //   }
      //
      //   let thumb = <HTMLDivElement>this.elem.nativeElement.querySelector(".thumb.stone.fixed");
      //   let fixedPos = pos;
      //   // let minDiff = [] as number[][];
      //   // minMax.forEach(function (e, index)
      //   // {
      //   //   minDiff.push([Math.abs(fixedPos - e.middle), e.middle, index]);
      //   // })
      //   //
      //   // minDiff.sort(function (a, b)
      //   // {
      //   //   return a[0] - b[0];
      //   // })
      //   //
      //   let getStoneSizeItem = function (): iStoneSize | undefined
      //   {
      //     let stoneType = getStoneCuts(AppComponent.app.data).find(e =>
      //     {
      //       // @ts-ignore
      //       return e.id == webglRing.ringData.stone[that.curStoneGroup].type;
      //     })
      //     if (stoneType)
      //     {
      //       return stoneType.size.find(e =>
      //       {
      //         // @ts-ignore
      //         return e.size == webglRing.ringData.stone[that.curStoneGroup].size;
      //       })
      //     }
      //     return undefined;
      //   }
      //
      //   let stoneSizeHalf = 0;
      //   let stoneSizeItem = getStoneSizeItem();
      //   if (stoneSizeItem && stoneSizeItem.calcSize)
      //     stoneSizeHalf = stoneSizeItem.calcSize / 2;
      //   else
      //   {
      //     stoneSizeHalf = webglRing.ringData.stone[this.curStoneGroup].size / 2;
      //   }
      //
      //   let stoneGroup = webglRing.ringData.stone[webglRing.curStoneGroup];
      //   if (stoneGroup.rows > 1) {
      //     let stoneMode = AppComponent.app.data.stoneMode.find(e => {
      //       return e.mode == stoneGroup.mode;
      //     })
      //     if (stoneMode) {
      //       let rowStoneSize = (stoneSizeHalf*2) * stoneGroup.rows + stoneMode.safeDistX * (stoneGroup.rows+1);
      //       stoneSizeHalf = rowStoneSize / 2;
      //     }
      //   }
      //
      //   // let segment = minMax[minDiff[0][2]];
      //   let segment = minMax.find(e => {
      //     return e.min < fixedPos && e.max > fixedPos;
      //   })
      //
      //   if (segment) {
      //
      //     if (segment.onGap)
      //       fixedPos = segment.middle;
      //     else if (fixedPos < segment.min + stoneSizeHalf)
      //       fixedPos = segment.min + stoneSizeHalf;
      //     else if (fixedPos > segment.max - stoneSizeHalf)
      //       fixedPos = segment.max - stoneSizeHalf;
      //   }
      //
      //   thumb.style.left = (fixedPos * 100 / this.ringData[this.ringId].ringWidth) + "%";
      //
      //   MTS.currentThumbMM = pos;
      // }
      // else
      if (ring && MTS.currentThumb) {
        // let minMax = ring.calc.stoneMinMaxCurSize;

        let pos = MTS.currentThumbMM;
        // if (minMax.length > 0) {
        //   if (pos < minMax[0].min) pos = minMax[0].min;
        //   else if (pos > minMax[minMax.length - 1].max) pos = minMax[minMax.length - 1].max;
        // }

        let thumb = <HTMLDivElement>this.elem.nativeElement.querySelector(".thumb.stone.fixed");
        let fixedPos = pos;
        // let minDiff = [] as number[][];
        // minMax.forEach(function (e, index)
        // {
        //   minDiff.push([Math.abs(fixedPos - e.middle), e.middle, index]);
        // })
        //
        // minDiff.sort(function (a, b)
        // {
        //   return a[0] - b[0];
        // })
        //
        let getStoneSizeItem = function (): iStoneSize | undefined {
          let stoneType = getStoneCuts(AppComponent.app.data).find(e => {
            // @ts-ignore
            return (e.legacyId ?? e.id) == ring.ringData.stone[that.curStoneGroup].type;
          })
          if (stoneType) {
            return stoneType.size.find(e => {
              // @ts-ignore
              return e.size == ring.ringData.stone[that.curStoneGroup].size;
            })
          }
          return undefined;
        }

        let stoneSizeHalf;
        let stoneSizeItem = getStoneSizeItem();
        if (stoneSizeItem && stoneSizeItem.calcSize)
          stoneSizeHalf = stoneSizeItem.calcSize / 2;
        else {
          stoneSizeHalf = ring.ringData.stone[this.curStoneGroup].size / 2;
        }

        let stoneGroup = ring.ringData.stone[cRing.curStoneGroup];
        if (stoneGroup.rows > 1) {
          let stoneMode = AppComponent.app.data.stoneMode.find(e => {
            return e.mode == stoneGroup.mode;
          })
          if (stoneMode) {
            let rowStoneSize = (stoneSizeHalf * 2) * stoneGroup.rows + stoneMode.safeDistX * (stoneGroup.rows + 1);
            // stoneSizeHalf = rowStoneSize / 2;
          }
        }

        // let segment = minMax[minDiff[0][2]];
        // let segment = minMax.find(e => {
        //   return e.min <= fixedPos && e.max >= fixedPos;
        // })
        //
        // if (segment) {
        //
        //   // if (segment.onGap)
        //   //   fixedPos = segment.middle;
        //   // else
        //   if (fixedPos < segment.min)
        //     fixedPos = segment.min;
        //   else if (fixedPos > segment.max)
        //     fixedPos = segment.max;
        //   // else
        //   //   fixedPos = segment.middle;
        //   // if (fixedPos < segment.min + stoneSizeHalf)
        //   //   fixedPos = segment.min + stoneSizeHalf;
        //   // else if (fixedPos > segment.max - stoneSizeHalf)
        //   //   fixedPos = segment.max - stoneSizeHalf;
        //   // else
        //   //   fixedPos = segment.middle;
        // }

        thumb.style.left = (fixedPos * 100 / this.ringData[this.ringId].ringWidth) + "%";

        MTS.currentThumbMM = pos;
      }
    }
  }

  commitChanges() {
    if (this.mode == "material") {
      this.ringData[this.ringId].materialDiv = this.materialDivTemp;
      this.materialDivTemp = [];
    } else if (this.mode == "gap") {
      let width = this.elem.nativeElement.offsetWidth;
      let thumbs = <HTMLDivElement[]>this.elem.nativeElement.querySelectorAll(".thumb.gap");
      let segments = [] as number[];

      thumbs.forEach(e => {
        segments.push(e.offsetLeft);
      })

      segments.sort(function (a, b) {
        return a - b;
      });
      let sum = 0;
      for (let i = 0; i < segments.length; i++) {
        segments[i] = Math.floor(segments[i] / width * 10000) - sum;
        sum += segments[i];
      }

      segments.push(10000 - sum);

      RingData.setGapDivArray(this.ringData[this.ringId], segments);
      this.gapDivTemp = [];
    } else if (this.mode == "stonePosition") {
      let width = this.elem.nativeElement.offsetWidth;
      let thumb = <HTMLDivElement>this.elem.nativeElement.querySelector(".thumb.stone.fixed");
      let thumbNotFixed = <HTMLDivElement>this.elem.nativeElement.querySelector(".thumb.stone.notFixed");
      thumbNotFixed.style.left = thumb.style.left;

      let left = thumb.offsetLeft;
      let div = left * 10000 / width;

      RingData.setStonePositionDiv(this.ringData[this.ringId], this.curStoneGroup, [div, 10000 - div])
    }
  }

  getElem() {
    return this.elem;
  }
}

export interface iMaterialSegment {
  percentStr: string;
  color: string;
  value: number;
}

interface iGetSegmentDivResult {
  width: string;
  color: string;
}

let MTS = {
  currentComponent: null as MultiThumbSliderComponent | null,
  currentThumb: null as HTMLElement | null,
  ringData: null as RingData | null,
  currentThumbMM: 0,
  trackWidth: 0,
  initialX: 0,
}

function mousemove(e: MouseEvent | TouchEvent) {
  if (MTS.currentThumb) {
    let newX;

    if (e.type === "touchmove")
      newX = (<unknown>e as TouchEvent).touches[0].clientX - MTS.initialX;
    else
      newX = (<MouseEvent>e).clientX - MTS.initialX;

    let min = 0, max = MTS.trackWidth;

    if (newX < min) newX = min;
    else if (newX > max) newX = max;

    if (MTS.ringData)
      MTS.currentThumbMM = newX * MTS.ringData.ringWidth / max;
    else
      MTS.currentThumbMM = 0;

    if (MTS.currentComponent) {
      MTS.currentComponent.updateSegments();
      if (MTS.ringData)
        newX = MTS.currentThumbMM * max / MTS.ringData.ringWidth;

      let rowSizeElm = <HTMLDivElement>MTS.currentComponent.getElem().nativeElement.querySelectorAll(".thumb.rowSize")[0];
      if (rowSizeElm)
        rowSizeElm.style.left = "" + newX + "px";
    }

    MTS.currentThumb.style.left = "" + newX + "px";


  }
}

function mouseup(e: MouseEvent | TouchEvent) {
  if (MTS.currentComponent)
    MTS.currentComponent.commitChanges();

  window.removeEventListener("mousemove", mousemove);
  window.removeEventListener("touchmove", mousemove);
  window.removeEventListener("mouseup", mouseup);
  window.removeEventListener("touchend", mouseup);
}
