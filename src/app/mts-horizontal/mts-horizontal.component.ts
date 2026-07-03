import {Component, ElementRef, ViewChild, AfterViewInit, OnInit, Input, Output, EventEmitter, ViewEncapsulation, IterableDiffer} from '@angular/core';
// import {NgFor, NgIf} from '@angular/common';
import {environment} from "../../environments/environment";
import {cRing} from "../webgl/cRing";
import {iMaterial} from "../app.interfaces";
import {AppComponent} from "../app.component";

@Component({
    selector: 'x-mts-horizontal',
    // imports: [NgFor, NgIf],
    templateUrl: './mts-horizontal.component.html',
    styleUrls: ['./mts-horizontal.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class MtsHorizontalComponent implements AfterViewInit, OnInit {


  @Input() ringId: number = 0;
  @Input() mode: string = "";
  _valueGap: number[] = [];
  _valueGapEnabledArray: number[] = [0, 0, 0, 0, 0, 0, 0];
  @Output() onValueGapChanged = new EventEmitter<number[]>();
  _valueGapObserved = false;
  _gapNoEvents: boolean = false;
  _gapDisabled = false;

  _valueFreeGap: number[] = [];
  @Output() onValueFreeGapChanged = new EventEmitter<number[]>();
  _valueFreeGapObserved = false;

  _colors: string[] = [];
  _maxValue: number = 10.0

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("bgCanvas") bgCanvas!: ElementRef;

  env = environment;

  lastComputed = -1;

  constructor() {

  }

  ngOnInit() {
    this._gapNoEvents = !this.onValueGapChanged.observed;
    this._gapDisabled = !this.onValueGapChanged.observed;

    this._valueGapObserved = this.onValueGapChanged.observed;
    this._valueFreeGapObserved = this.onValueFreeGapChanged.observed;
  }

  ngAfterViewInit() {

    let that = this;

    setInterval(function () {
      let ring = cRing.list[that.ringId];
      if (!ring || !ring.ringData) return;
      let sum = checksum(ring.ringData.materialDiv) + checksum(ring.ringData.gapDiv) + checksumStr(that.getMaterialColor()) + checksum(ring.ringData.gapEnabled);
      if (sum != that.lastComputed) {
        that._valueGap = ring.ringData.materialDiv.slice();
        that._valueFreeGap = ring.ringData.gapDiv.slice();
        that._maxValue = ring.ringData.ringWidth / 1000;
        that._colors = that.getMaterialColor();
        that._valueGapEnabledArray = ring.ringData.gapEnabled.slice();

        if (that.bgCanvas.nativeElement.width != that.wrapper.nativeElement.offsetWidth) {
          that.updateCanvas2(that._valueGap);
        }

        that.lastComputed = sum;
      }
    }, 500);

    this.updateCanvas2(this._valueGap);
  }

  is_valueGapObserved() {
    return this.onValueGapChanged.observed;
  }

  is_valueFreeGapObserved() {
    return this.onValueFreeGapChanged.observed;
  }

  /*
  gibt ein Array mit den Farbwerten zurück
   */
  getMaterialColor(): string[] {
    let ringData = cRing.list[this.ringId].ringData;
    let count = ringData.divPreset.split(':').length - 1;

    let result = [];
    for (let i = 0; i < count; i++) {
      let material = AppComponent.app.data.material.find(function (e: iMaterial) {
        return e.id == ringData.material[i];
      })
      if (material)
        result.push(material.colorHtml);
    }
    return result;
  }

  getValueGapArray() {
    if (this._valueGap != undefined && this._valueGap.length > 0) {
      let sum = this._valueGap.reduce((a, b) => a + b)
      this._valueGap.forEach((e, i) => {
        this._valueGap[i] = e * 10000 / sum;
      })

      if (this.bgCanvas && MTSHC.component == null) this.updateCanvas2(this._valueGap);
      return this._valueGap.slice(0, this._valueGap.length - 1);
    }
    return [];
  }

  // getGapEnabledAtIndex(i:number):boolean {
  //   let ringData = cRing.list[this.ringId].ringData;
  //   if (i >= 0 && i < ringData.gapEnabled.length)
  //     return ringData.gapEnabled[i] == 1 ? true : false;
  //   return true;
  // }

  getValueFreeGapArray() {
    if (this._valueFreeGap != undefined && this._valueFreeGap.length > 0 && this.onValueFreeGapChanged.observed) {
      let sum = this._valueFreeGap.reduce((a, b) => a + b)
      this._valueFreeGap.forEach((e, i) => {
        this._valueFreeGap[i] = e * 10000 / sum;
      })
      return this._valueFreeGap.slice(0, this._valueFreeGap.length - 1);
    }
    return [];
  }

  isValueFreeGapObserved(): boolean {
    return this.onValueFreeGapChanged.observed;
  }

  updateCanvas2(gap: number[]) {
    const canvasEl: HTMLCanvasElement = this.bgCanvas.nativeElement;
    canvasEl.width = this.wrapper.nativeElement.offsetWidth;

    let cx = canvasEl.getContext("2d");

    if (cx) {
      let position = 0;
      let that = this;

      cx.font = "10px Montserrat";
      cx.textAlign = "center";
      cx.textBaseline = "middle";

      let text: string = "";
      let tm: TextMetrics;

      gap.forEach((e, i) => {
        let w = e * canvasEl.width / 10000;
        if (cx) {
          cx.fillStyle = that._colors[i];
          // cx.globalAlpha=0.5;
          cx.fillRect(position, 0, w, canvasEl.height);

          // cx.globalAlpha=1.0;
          cx.fillStyle = '#000'
          cx.strokeStyle = cx.fillStyle;

          if (this.onValueGapChanged.observed) {
            // id
            text = (i + 1).toString();
            tm = cx.measureText(text);
            cx.fillText(text, position + w / 2, canvasEl.height / 4);

            // value
            text = (e * that._maxValue / 10000).toFixed(2) + " mm";
            tm = cx.measureText(text);
            if (tm.width > w-5)
              text = (e * that._maxValue / 10000).toFixed(2);
            cx.fillText(text, position + w / 2, canvasEl.height / 4 * 3);
          } else {
            // value
            text = (e * that._maxValue / 10000).toFixed(2) + " mm";
            tm = cx.measureText(text);
            if (tm.width > w-5)
              text = (e * that._maxValue / 10000).toFixed(2);
            cx.fillText(text, position + w / 2, canvasEl.height / 2);
          }
        }
        position += w;
      })

      cx.restore()
    }
  }

  getPercentGapAtIndex(index: number) {
    let value = 0.0;
    while (index >= 0) value += this._valueGap[index--];
    return value * 100 / 10000;
  }

  getPercentFreeGapAtIndex(index: number) {
    let value = 0.0;
    while (index >= 0) value += this._valueFreeGap[index--];
    return value * 100 / 10000;
  }

  getValueFreeGap(index: number) {
    return (this.getPercentFreeGapAtIndex(index) * this._maxValue / 100).toFixed(2);
  }

  onThumbSelectMouse(e: MouseEvent) {
    if (e.target != null && (<HTMLElement>e.target).parentElement != null) {
      e.stopPropagation();

      // füge das aktuelle Element an das Ende an, um es optisch in den Vordergrund zu bringen
      MTSHC.sliderHandleWrapperElement = <HTMLElement | undefined>(<HTMLElement>e.target).parentElement;
      if (MTSHC.sliderHandleWrapperElement) {
        MTSHC.sliderHandleWrapperElement.remove();
        this.wrapper.nativeElement.appendChild(MTSHC.sliderHandleWrapperElement);
      }

      MTSHC.component = this;
      MTSHC.sliderValueElement = <HTMLElement | undefined>MTSHC.sliderHandleWrapperElement?.getElementsByClassName("slider-value")[0];
      MTSHC.sliderIndexElement = <HTMLElement | undefined>MTSHC.sliderHandleWrapperElement?.getElementsByClassName("slider-index")[0];

      // @ts-ignore
      MTSHC.trackWidth = this.wrapper.nativeElement.offsetWidth;

      MTSHC.initialX = (<MouseEvent>e).clientX - MTSHC.sliderHandleWrapperElement!.offsetLeft;

      window.addEventListener("mousemove", mousemove);
      window.addEventListener("mouseup", mouseup);
    } else alert("no parent");
  }
  onThumbSelectTouch(e: TouchEvent) {
    if (e.target != null && (<HTMLElement>e.target).parentElement != null) {
      e.stopPropagation();

      // füge das aktuelle Element an das Ende an, um es optisch in den Vordergrund zu bringen
      MTSHC.sliderHandleWrapperElement = <HTMLElement | undefined>(<HTMLElement>e.target).parentElement;
      if (MTSHC.sliderHandleWrapperElement) {
        MTSHC.sliderHandleWrapperElement.remove();
        this.wrapper.nativeElement.appendChild(MTSHC.sliderHandleWrapperElement);
      }

      MTSHC.component = this;
      MTSHC.sliderValueElement = <HTMLElement | undefined>MTSHC.sliderHandleWrapperElement?.getElementsByClassName("slider-value")[0];
      MTSHC.sliderIndexElement = <HTMLElement | undefined>MTSHC.sliderHandleWrapperElement?.getElementsByClassName("slider-index")[0];

      // @ts-ignore
      MTSHC.trackWidth = this.wrapper.nativeElement.offsetWidth;

      // MTSHC.initialX = (<MouseEvent>e).clientX - MTSHC.sliderHandleWrapperElement!.offsetLeft;
      MTSHC.initialX = (<unknown>e as TouchEvent).touches[0].clientX - MTSHC.sliderHandleWrapperElement!.offsetLeft;

      window.addEventListener("touchmove", mousemove);
      window.addEventListener("touchend", mouseup);
    } else alert("no parent");
  }

}

let MTSHC = {
  component: null as MtsHorizontalComponent | null,
  sliderHandleWrapperElement: undefined as HTMLElement | undefined,
  sliderIndexElement: undefined as HTMLElement | undefined,
  trackWidth: 0,
  initialX: 0,

  sliderValueElement: undefined as HTMLElement | undefined,
}

function extractValues(elements: HTMLElement[]) {
  let values = [] as number[];
  for (let item of elements) {
    values.push(item.offsetLeft);
  }
  values = values.sort((a, b) => {
    return a - b;
  });
  values.forEach((e, i) => {
    values[i] = Math.floor(10000 * e / MTSHC.trackWidth);
  })
  values.push(10000);
  let valRelative = [] as number[];
  values.forEach((e, i) => {
    if (i > 0) valRelative.push(values[i] - values[i - 1]);
    else valRelative.push(values[i]);
  })

  return valRelative;
}

function mousemove(e: MouseEvent | TouchEvent) {

  if (MTSHC.component && MTSHC.sliderIndexElement) {
    let newX;

    if (e.type === "touchmove")
      newX = (<unknown>e as TouchEvent).touches[0].clientX - MTSHC.initialX;
    else
      newX = (<MouseEvent>e).clientX - MTSHC.initialX;

    let min = 0, max = MTSHC.trackWidth;

    // >> Die Slider sollen nur bis zum nächsten Slider bewegt werden können und nicht darüber hinaus.
    if (MTSHC.component.mode == "material") {
      let T = <HTMLDivElement[]>MTSHC.component.wrapper.nativeElement.querySelectorAll(".slider-handle-wrapper.gap");
      let tArray = [] as HTMLDivElement[];
      T.forEach(e => {
        tArray.push(e);
      })

      tArray.sort(function(a, b) {
        return a.offsetLeft - b.offsetLeft;
      });

      let currentIndex = parseInt(MTSHC.sliderHandleWrapperElement?.getAttribute("data-index") || "");

      let a, b;
      let ring = cRing.list[MTSHC.component.ringId];
      let ringWidth = ring.ringData.ringWidth;
      let profile = AppComponent.app.data.profile.find(e => {
        return e.name == ring.ringData.profileName;
      })
      // @ts-ignore
      let sideDistance = (profile.sideGapDistance + ring.ringData.gapWidth/2) * MTSHC.trackWidth / ringWidth;
      // @ts-ignore
      let gapDistance = (profile.gapGapDistance + ring.ringData.gapWidth) * MTSHC.trackWidth / ringWidth;

      if (tArray.length == 1) {
        a = sideDistance;
        b = MTSHC.trackWidth - sideDistance;
      }
      else {
        if (currentIndex == 0) {
          a = sideDistance;
          b = tArray[1].offsetLeft -gapDistance;
        } else if (currentIndex == T.length - 1) {
          a = tArray[currentIndex - 1].offsetLeft + gapDistance;
          b = MTSHC.trackWidth - sideDistance;
        } else {
          a = tArray[currentIndex - 1].offsetLeft + gapDistance;
          b = tArray[currentIndex + 1].offsetLeft - gapDistance;
        }
      }

      if (newX < a) newX = a;
      else if (newX > b) newX = b;
    }
    // <<


    if (newX < min) newX = min;
    else if (newX > max) newX = max;

    let valuePercent = newX * 100 / max;

    (<HTMLElement>MTSHC.sliderIndexElement.parentElement).style.left = valuePercent.toFixed(2) + "%";

    if (MTSHC.sliderValueElement)
      MTSHC.sliderValueElement.innerText = (valuePercent * MTSHC.component._maxValue / 100.0).toFixed(2);

    // update UI
    if (MTSHC.sliderHandleWrapperElement) {
      if (MTSHC.sliderHandleWrapperElement.classList.contains("gap")) {
        MTSHC.component.updateCanvas2(extractValues(MTSHC.component.wrapper.nativeElement.getElementsByClassName("gap")));
      }
    }
  }
}

function mouseup() {

  if (MTSHC.component && MTSHC.sliderHandleWrapperElement) {

    if (MTSHC.sliderHandleWrapperElement.classList.contains("gap")) {
      MTSHC.component._valueGap = extractValues(MTSHC.component.wrapper.nativeElement.getElementsByClassName("gap"));
      MTSHC.component.onValueGapChanged.emit(MTSHC.component._valueGap);
    }

    if (MTSHC.sliderHandleWrapperElement.classList.contains("freeGap")) {
      MTSHC.component._valueFreeGap = extractValues(MTSHC.component.wrapper.nativeElement.getElementsByClassName("freeGap"));
      MTSHC.component.onValueFreeGapChanged.emit(MTSHC.component._valueFreeGap);
    }
  }

  MTSHC.component = null;
  MTSHC.sliderHandleWrapperElement = undefined;
  MTSHC.sliderValueElement = undefined;
  MTSHC.sliderIndexElement = undefined;

  window.removeEventListener("mousemove", mousemove);
  window.removeEventListener("touchmove", mousemove);
  window.removeEventListener("mouseup", mouseup);
  window.removeEventListener("touchend", mouseup);
}

function checksum(array: number[]): number {
  let c: number = 0;
  for (let i = 0; i < array.length; i++) {
    c += array[i];
    c = c << 3 | c >> (32 - 3); // rotate a little
  }
  return c;
}

function checksumStr(array: string[]): number {
  let c: number = 0;
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < array[i].length; j++) {
      c += array[i].charCodeAt(j);
      c = c << 3 | c >> (32 - 3); // rotate a little
    }
  }
  return c;
}
