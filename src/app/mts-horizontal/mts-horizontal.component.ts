import {AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, ViewEncapsulation} from '@angular/core';
import {environment} from "../../environments/environment";
import {cRing} from "../webgl/cRing";
import {iMaterial} from "../app.interfaces";
import {AppComponent} from "../app.component";

type MtsThumbKind = "gap" | "freeGap" | "naturalGap";

interface MtsThumbViewModel {
  id: string;
  index: number;
  value: number;
  label: string;
  kind: MtsThumbKind;
  leftPercent: number;
  disabled?: boolean;
}

@Component({
  selector: 'x-mts-horizontal',
  templateUrl: './mts-horizontal.component.html',
  styleUrls: ['./mts-horizontal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
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
  _maxValue: number = 10.0;

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("bgCanvas") bgCanvas!: ElementRef;

  env = environment;
  lastComputed = -1;
  activeThumbId = "";
  private activeThumbKind: MtsThumbKind | null = null;
  private activeThumbIndex = -1;
  private activeLeftPercent = 0;

  constructor(private changeDetector: ChangeDetectorRef) {
  }

  ngOnInit() {
    this._gapNoEvents = !this.onValueGapChanged.observed;
    this._gapDisabled = !this.onValueGapChanged.observed;
    this._valueGapObserved = this.onValueGapChanged.observed;
    this._valueFreeGapObserved = this.onValueFreeGapChanged.observed;
  }

  ngAfterViewInit() {
    const that = this;

    setInterval(function () {
      const ring = cRing.list[that.ringId];
      if (!ring || !ring.ringData) return;
      const sum = checksum(ring.ringData.materialDiv) + checksum(ring.ringData.gapDiv) + checksumStr(that.getMaterialColor()) + checksum(ring.ringData.gapEnabled);
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

  getMaterialColor(): string[] {
    const ringData = cRing.list[this.ringId].ringData;
    const count = ringData.divPreset.split(':').length - 1;

    const result = [];
    for (let i = 0; i < count; i++) {
      const material = AppComponent.app.data.material.find(function (e: iMaterial) {
        return e.id == ringData.material[i];
      });
      if (material) {
        result.push(material.colorHtml);
      }
    }
    return result;
  }

  getValueGapArray() {
    if (this._valueGap != undefined && this._valueGap.length > 0) {
      this._valueGap = this.normalizeRelativeArray(this._valueGap);

      if (this.bgCanvas && MTSHC.component == null) this.updateCanvas2(this._valueGap);
      return this._valueGap.slice(0, this._valueGap.length - 1);
    }
    return [];
  }

  getValueFreeGapArray() {
    if (this._valueFreeGap != undefined && this._valueFreeGap.length > 0 && this.onValueFreeGapChanged.observed) {
      this._valueFreeGap = this.normalizeRelativeArray(this._valueFreeGap);
      return this._valueFreeGap.slice(0, this._valueFreeGap.length - 1);
    }
    return [];
  }

  isValueFreeGapObserved(): boolean {
    return this.onValueFreeGapChanged.observed;
  }

  getGapThumbs(): MtsThumbViewModel[] {
    this.getValueGapArray();
    return this._valueGap.slice(0, Math.max(0, this._valueGap.length - 1)).map((value, index) => ({
      id: `gap-${index}`,
      index,
      value,
      label: "",
      kind: "gap",
      leftPercent: this.getThumbPercent("gap", index),
      disabled: this._gapDisabled,
    }));
  }

  getNaturalGapThumbs(): MtsThumbViewModel[] {
    return this.getGapThumbs().map(thumb => ({
      ...thumb,
      id: `naturalGap-${thumb.index}`,
      kind: "naturalGap",
      label: String(thumb.index + 1),
      disabled: this._valueGapEnabledArray[thumb.index] != 1,
    }));
  }

  getFreeGapThumbs(): MtsThumbViewModel[] {
    this.getValueFreeGapArray();
    return this._valueFreeGap.slice(0, Math.max(0, this._valueFreeGap.length - 1)).map((value, index) => ({
      id: `freeGap-${index}`,
      index,
      value,
      label: String(index + 1),
      kind: "freeGap",
      leftPercent: this.getThumbPercent("freeGap", index),
    }));
  }

  updateCanvas2(gap: number[]) {
    const canvasEl: HTMLCanvasElement = this.bgCanvas.nativeElement;
    canvasEl.width = this.wrapper.nativeElement.offsetWidth;

    const cx = canvasEl.getContext("2d");

    if (cx) {
      let position = 0;
      const that = this;

      cx.font = "10px Montserrat";
      cx.textAlign = "center";
      cx.textBaseline = "middle";

      let text: string = "";
      let tm: TextMetrics;

      gap.forEach((e, i) => {
        const w = e * canvasEl.width / 10000;
        if (cx) {
          cx.fillStyle = that._colors[i];
          cx.fillRect(position, 0, w, canvasEl.height);
          cx.fillStyle = '#000';
          cx.strokeStyle = cx.fillStyle;

          if (this.onValueGapChanged.observed) {
            text = (i + 1).toString();
            tm = cx.measureText(text);
            cx.fillText(text, position + w / 2, canvasEl.height / 4);

            text = (e * that._maxValue / 10000).toFixed(2) + " mm";
            tm = cx.measureText(text);
            if (tm.width > w - 5) {
              text = (e * that._maxValue / 10000).toFixed(2);
            }
            cx.fillText(text, position + w / 2, canvasEl.height / 4 * 3);
          } else {
            text = (e * that._maxValue / 10000).toFixed(2) + " mm";
            tm = cx.measureText(text);
            if (tm.width > w - 5) {
              text = (e * that._maxValue / 10000).toFixed(2);
            }
            cx.fillText(text, position + w / 2, canvasEl.height / 2);
          }
        }
        position += w;
      });
    }
  }

  getPercentGapAtIndex(index: number) {
    return this.getThumbPercent("gap", index);
  }

  getPercentFreeGapAtIndex(index: number) {
    return this.getThumbPercent("freeGap", index);
  }

  getValueFreeGap(index: number) {
    return (this.getPercentFreeGapAtIndex(index) * this._maxValue / 100).toFixed(2);
  }

  onThumbSelectMouse(e: MouseEvent, thumb: MtsThumbViewModel) {
    if (this.startDrag(e, thumb, e.clientX)) {
      window.addEventListener("mousemove", mousemove);
      window.addEventListener("mouseup", mouseup);
      window.addEventListener("blur", mouseup);
    }
  }

  onThumbSelectTouch(e: TouchEvent, thumb: MtsThumbViewModel) {
    if (this.startDrag(e, thumb, e.touches[0].clientX)) {
      window.addEventListener("touchmove", mousemove);
      window.addEventListener("touchend", mouseup);
      window.addEventListener("touchcancel", mouseup);
      window.addEventListener("blur", mouseup);
    }
  }

  getGapDragBoundsPx(index: number): { min: number; max: number } {
    const positions = this.getAbsolutePercents(this._valueGap).map(percent => percent * MTSHC.trackWidth / 100);
    let min = 0;
    let max = MTSHC.trackWidth;

    if (this.mode !== "material") {
      return {min, max};
    }

    const ring = cRing.list[this.ringId];
    const profile = AppComponent.app.data.profile.find(e => {
      return e.name == ring?.ringData.profileName;
    });
    const ringWidth = ring?.ringData.ringWidth || 0;
    if (!ring || !profile || ringWidth <= 0) {
      return {min, max};
    }

    const sideDistance = (profile.sideGapDistance + ring.ringData.gapWidth / 2) * MTSHC.trackWidth / ringWidth;
    const gapDistance = (profile.gapGapDistance + ring.ringData.gapWidth) * MTSHC.trackWidth / ringWidth;
    const lastIndex = positions.length - 1;

    if (positions.length === 1) {
      min = sideDistance;
      max = MTSHC.trackWidth - sideDistance;
    } else if (index === 0) {
      min = sideDistance;
      max = positions[1] - gapDistance;
    } else if (index === lastIndex) {
      min = positions[index - 1] + gapDistance;
      max = MTSHC.trackWidth - sideDistance;
    } else {
      min = positions[index - 1] + gapDistance;
      max = positions[index + 1] - gapDistance;
    }

    return {min, max};
  }

  updateActiveDragPercent(leftPercent: number): void {
    this.activeLeftPercent = Math.max(0, Math.min(100, leftPercent));

    if (MTSHC.sliderHandleWrapperElement) {
      MTSHC.sliderHandleWrapperElement.style.left = this.activeLeftPercent.toFixed(2) + "%";
    }
    if (MTSHC.sliderValueElement && this.activeThumbKind === "freeGap") {
      MTSHC.sliderValueElement.innerText = (this.activeLeftPercent * this._maxValue / 100.0).toFixed(2);
    }
    if (this.activeThumbKind === "gap") {
      this.updateCanvas2(this.buildRelativeArrayFromDrag("gap"));
    }
  }

  applyActiveDrag(): void {
    if (!this.activeThumbKind || this.activeThumbIndex < 0) {
      return;
    }

    if (this.activeThumbKind === "gap") {
      this._valueGap = this.buildRelativeArrayFromDrag("gap");
      this.onValueGapChanged.emit(this._valueGap);
      this.updateCanvas2(this._valueGap);
    }

    if (this.activeThumbKind === "freeGap") {
      this._valueFreeGap = this.buildRelativeArrayFromDrag("freeGap");
      this.onValueFreeGapChanged.emit(this._valueFreeGap);
      const ring = cRing.list[this.ringId];
      if (ring?.ringData?.gapDiv) {
        this._valueFreeGap = ring.ringData.gapDiv.slice();
      }
    }

    this.lastComputed = -1;
  }

  clearActiveDrag(): void {
    this.activeThumbId = "";
    this.activeThumbKind = null;
    this.activeThumbIndex = -1;
    this.activeLeftPercent = 0;
    this.changeDetector.detectChanges();
  }

  private startDrag(e: MouseEvent | TouchEvent, thumb: MtsThumbViewModel, clientX: number): boolean {
    if (thumb.disabled || thumb.kind === "naturalGap") {
      return false;
    }

    e.stopPropagation();
    e.preventDefault();

    MTSHC.component = this;
    MTSHC.activeThumb = thumb;
    MTSHC.sliderHandleWrapperElement = e.currentTarget as HTMLElement;
    MTSHC.sliderValueElement = <HTMLElement | undefined>MTSHC.sliderHandleWrapperElement?.getElementsByClassName("slider-value")[0];
    MTSHC.trackWidth = this.wrapper.nativeElement.offsetWidth;
    MTSHC.initialX = clientX - (thumb.leftPercent * MTSHC.trackWidth / 100);

    this.activeThumbId = thumb.id;
    this.activeThumbKind = thumb.kind;
    this.activeThumbIndex = thumb.index;
    this.activeLeftPercent = thumb.leftPercent;
    this.changeDetector.detectChanges();
    return true;
  }

  private getThumbPercent(kind: "gap" | "freeGap", index: number): number {
    if (this.activeThumbKind === kind && this.activeThumbIndex === index) {
      return this.activeLeftPercent;
    }

    const values = kind === "gap" ? this._valueGap : this._valueFreeGap;
    const percents = this.getAbsolutePercents(values);
    return percents[index] ?? 0;
  }

  private getAbsolutePercents(values: number[]): number[] {
    const normalized = this.normalizeRelativeArray(values);
    let position = 0;
    const result: number[] = [];
    for (let index = 0; index < normalized.length - 1; index++) {
      position += normalized[index];
      result.push(position * 100 / 10000);
    }
    return result;
  }

  private normalizeRelativeArray(values: number[]): number[] {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }
    const sum = values.reduce((a, b) => a + Number(b || 0), 0);
    if (!Number.isFinite(sum) || sum <= 0) {
      return [];
    }
    return values.map(value => value * 10000 / sum);
  }

  private buildRelativeArrayFromDrag(kind: "gap" | "freeGap"): number[] {
    const source = kind === "gap" ? this._valueGap : this._valueFreeGap;
    const positions = this.getAbsolutePercents(source);
    if (this.activeThumbIndex >= 0 && this.activeThumbIndex < positions.length) {
      positions[this.activeThumbIndex] = this.activeLeftPercent;
    }
    return this.buildRelativeArrayFromPercents(positions);
  }

  private buildRelativeArrayFromPercents(positions: number[]): number[] {
    const sorted = positions
      .filter(position => Number.isFinite(position))
      .map(position => Math.max(0, Math.min(100, position)))
      .sort((a, b) => a - b);

    if (!sorted.length) {
      return [];
    }

    const values: number[] = [];
    let last = 0;
    sorted.forEach(position => {
      const current = Math.round(position * 100);
      values.push(Math.max(0, current - last));
      last = current;
    });
    values.push(Math.max(0, 10000 - last));
    return values;
  }
}

let MTSHC = {
  component: null as MtsHorizontalComponent | null,
  activeThumb: undefined as MtsThumbViewModel | undefined,
  sliderHandleWrapperElement: undefined as HTMLElement | undefined,
  trackWidth: 0,
  initialX: 0,
  sliderValueElement: undefined as HTMLElement | undefined,
};

function mousemove(e: MouseEvent | TouchEvent) {
  if (MTSHC.component && MTSHC.activeThumb) {
    if (e.cancelable) {
      e.preventDefault();
    }
    let newX: number;

    if (e.type === "touchmove") {
      newX = (<unknown>e as TouchEvent).touches[0].clientX - MTSHC.initialX;
    } else {
      newX = (<MouseEvent>e).clientX - MTSHC.initialX;
    }

    let min = 0;
    let max = MTSHC.trackWidth;

    if (MTSHC.activeThumb.kind === "gap" && MTSHC.component.mode == "material") {
      const bounds = MTSHC.component.getGapDragBoundsPx(MTSHC.activeThumb.index);
      min = bounds.min;
      max = bounds.max;
    }

    if (newX < min) newX = min;
    else if (newX > max) newX = max;

    const valuePercent = MTSHC.trackWidth > 0 ? newX * 100 / MTSHC.trackWidth : 0;
    MTSHC.component.updateActiveDragPercent(valuePercent);
  }
}

function mouseup() {
  if (MTSHC.component) {
    MTSHC.component.applyActiveDrag();
  }

  MTSHC.component?.clearActiveDrag();
  MTSHC.component = null;
  MTSHC.activeThumb = undefined;
  MTSHC.sliderHandleWrapperElement = undefined;
  MTSHC.sliderValueElement = undefined;

  window.removeEventListener("mousemove", mousemove);
  window.removeEventListener("touchmove", mousemove);
  window.removeEventListener("mouseup", mouseup);
  window.removeEventListener("touchend", mouseup);
  window.removeEventListener("touchcancel", mouseup);
  window.removeEventListener("blur", mouseup);
}

function checksum(array: number[]): number {
  let c: number = 0;
  for (let i = 0; i < array.length; i++) {
    c += array[i];
    c = c << 3 | c >> (32 - 3);
  }
  return c;
}

function checksumStr(array: string[]): number {
  let c: number = 0;
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < array[i].length; j++) {
      c += array[i].charCodeAt(j);
      c = c << 3 | c >> (32 - 3);
    }
  }
  return c;
}
