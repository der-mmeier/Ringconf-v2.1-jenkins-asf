import {Component, ElementRef, Input, Output, ViewChild, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {map} from "../app.helper";
import {cRing} from "../webgl/cRing";
import {iFreeStone, iMaterial} from "../app.interfaces";
import {environment} from "../../environments/environment";

@Component({
    selector: 'x-stonexy',
    templateUrl: './stonexy.component.html',
    styleUrls: ['./stonexy.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class StonexyComponent //
{
  @ViewChild('canvas') canvas: ElementRef | undefined;
  @ViewChild('canvasRadial') canvasRadial: ElementRef | undefined;
  @Input() ringId: number = 0;
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  canvasRingHeight: number;
  maxOffset: number;
  ringOffsetPx: number;

  @Output() selectedShapeIndex: number;

  lastSelectedShapeIndex:number; // der zuletzt ausgewählte Stein soll farblich markiert bleiben

  freeStones: iFreeStone[] | undefined = undefined;

  // iconBrillant = document.getElementById('iconBrillant');
  // iconBrillant_selected = document.getElementById('iconBrillant-selected');

  constructor(public elem: ElementRef) {

    this.canvasRingHeight = 0;
    this.maxOffset = 0;
    this.ringOffsetPx = 0;
    this.selectedShapeIndex = -1;
    this.lastSelectedShapeIndex = -1;

    let that = this;
    setInterval(function () {
      if (that.freeStones != that.ringData[that.ringId].stone[cRing.curStoneGroup].freeStones) {
        that.freeStones = that.ringData[that.ringId].stone[cRing.curStoneGroup].freeStones;
        that.draw();
      }
    }, 100);

    window.addEventListener("resize", function () {
      that.draw();
    })

  }

  // ngAfterViewInit() {
  //   let canvas = this.canvas?.nativeElement;
  //   if (canvas) {
  //     let BB = canvas.getBoundingClientRect();
  //     let ringData = RingData.list[this.ringId];
  //     this.canvasRingHeight = BB.width * ringData.ringSize / ringData.ringWidth;
  //     if (this.canvasRingHeight < BB.height * 2)
  //       this.canvasRingHeight = BB.height * 2;
  //     else if (this.canvasRingHeight > BB.height * 4)
  //       this.canvasRingHeight = BB.height * 4;
  //
  //     this.maxOffset = (this.canvasRingHeight - BB.height) / 2;
  //
  //     this.draw();
  //   }
  // }

  onCanvasMouseDown(e: MouseEvent) {
    if (e.target != null && (<HTMLElement>e.target).parentElement != null) {
      e.preventDefault();
      e.stopPropagation();

      let canvas = <HTMLCanvasElement>this.elem.nativeElement.querySelectorAll("canvas.slider-bg")[0];
      let BB = canvas.getBoundingClientRect();
      let x = e.clientX - BB.left;
      let y = e.clientY - BB.top;
      let that = this;

      let isMouseInShape = function (mx: number, my: number, stone: iFreeStone) {
        let dx = mx - map(stone.xDiv, -5000, 5000, 0, BB.width);
        let yCanvas = map(stone.yRad, Math.PI, -Math.PI, -that.canvasRingHeight / 2, that.canvasRingHeight / 2) + BB.height / 2 + that.ringOffsetPx;
        let dy = my - yCanvas;
        let radius = stone.size / 2 * BB.width / RingData.list[that.ringId].ringWidth;
        // let radius = stone.safeRadius * BB.width / that.ringWidth;
        return dx * dx + dy * dy < radius * radius;
      }

      this.selectedShapeIndex = -1;
      this.lastSelectedShapeIndex = -1;

      let stones = this.ringData[this.ringId].stone[cRing.curStoneGroup].freeStones;

      if (stones) {
        for (let i = 0; i < stones.length; i++) {
          if (isMouseInShape(x, y, stones[i])) {
            this.selectedShapeIndex = i;
            this.lastSelectedShapeIndex = i;
            break;
          }
        }
      }

      if (this.selectedShapeIndex == -1) {
        dragginCanvas = true;
      }
      else if (stones){
        // vertausche den aktuell ausgewählten Stein mit dem letzten um den aktuellen Stein als letztes im Steinalgorithmus zu berücksichtigen
        let lastStone = stones[stones.length-1];
        let curStone = stones[this.selectedShapeIndex];

        stones[stones.length-1]=curStone;
        stones[this.selectedShapeIndex] = lastStone;

        this.selectedShapeIndex = stones.length-1;
        this.lastSelectedShapeIndex = this.selectedShapeIndex;
      }


      dragStartX = x;
      dragStartY = y;
      theComponent = this;
      this.draw();

      window.addEventListener("mousemove", mousemove);
      window.addEventListener("mouseup", mouseup);
    } else alert("no parent");
  }

  onCanvasTouchStart(e: TouchEvent) {
    if (e.target != null && (<HTMLElement>e.target).parentElement != null) {
      e.preventDefault();
      e.stopPropagation();
      let canvas = <HTMLCanvasElement>this.elem.nativeElement.querySelectorAll("canvas.slider-bg")[0];
      let BB = canvas.getBoundingClientRect();
      let x = (<unknown>e as TouchEvent).touches[0].clientX - BB.left;
      let y = (<unknown>e as TouchEvent).touches[0].clientY - BB.top;
      let that = this;

      let isMouseInShape = function (mx: number, my: number, stone: iFreeStone) {
        let dx = mx - map(stone.xDiv, -5000, 5000, 0, BB.width);
        let yCanvas = map(stone.yRad, Math.PI, -Math.PI, -that.canvasRingHeight / 2, that.canvasRingHeight / 2) + BB.height / 2 + that.ringOffsetPx;
        let dy = my - yCanvas;
        let radius = stone.size / 2 * BB.width / RingData.list[that.ringId].ringWidth;
        // let radius = stone.safeRadius * BB.width / that.ringWidth;
        return dx * dx + dy * dy < radius * radius;
      }

      this.selectedShapeIndex = -1;
      this.lastSelectedShapeIndex = -1;

      let stones = this.ringData[this.ringId].stone[cRing.curStoneGroup].freeStones;

      if (stones) {
        for (let i = 0; i < stones.length; i++) {
          if (isMouseInShape(x, y, stones[i])) {
            this.selectedShapeIndex = i;
            this.lastSelectedShapeIndex = i;
            break;
          }
        }
      }

      if (this.selectedShapeIndex == -1) {
        dragginCanvas = true;
      }
      else if (stones){
        // vertausche den aktuell ausgewählten Stein mit dem letzten um den aktuellen Stein als letztes im Steinalgorithmus zu berücksichtigen
        let lastStone = stones[stones.length-1];
        let curStone = stones[this.selectedShapeIndex];

        stones[stones.length-1]=curStone;
        stones[this.selectedShapeIndex] = lastStone;

        this.selectedShapeIndex = stones.length-1;
        this.lastSelectedShapeIndex = this.selectedShapeIndex;
      }

      dragStartX = x;
      dragStartY = y;
      theComponent = this;
      this.draw();

      window.addEventListener("touchmove", mousemove);
      window.addEventListener("touchend", mouseup);
    } else alert("no parent");
  }

  commitChanges() {
    this.selectedShapeIndex = -1;
    this.ringData[this.ringId].isDirty = true;
  }

  draw() {

    let canvas = this.canvas?.nativeElement;
    if (!canvas) return;
    let that = this;
    let ring = cRing.list.find(e => {
      return e.ringData.index == that.ringId;
    });
    if (!ring) return;

    let BB = canvas.getBoundingClientRect();
    let ringData = ring.ringData;

    this.canvasRingHeight = BB.width * ringData.ringSize / ringData.ringWidth;
    let ringRadiusInner = ringData.ringSize / Math.PI / 2,
      ringRadiusOuter = ringRadiusInner + ringData.ringHeight,
      ringRadiusFactor = ringRadiusInner / ringRadiusOuter;
    this.canvasRingHeight /= ringRadiusFactor;

      // if (this.canvasRingHeight < BB.height * 2)
    //   this.canvasRingHeight = BB.height * 2;
    // else if (this.canvasRingHeight > BB.height * 4)
    //   this.canvasRingHeight = BB.height * 4;

    this.maxOffset = (this.canvasRingHeight - BB.height) / 2;
    if (this.maxOffset < 0) this.maxOffset = 0;


    let stones = this.ringData[this.ringId].stone[cRing.curStoneGroup].freeStones;

    let sliderCanvasHeight = BB.height;
    let ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, BB.width + 1, BB.height + 1);

      if (1) // zeichne Materialsegmente
      {
        ctx.save();
        ctx.translate(canvas.width / 2, BB.height / 2);
        // ctx.translate(canvas.width / 2, BB.height/2+this.canvasRingHeight/2);
        ctx.scale(1, -1);
        ctx.lineWidth = 1;
        ctx.translate(0.5, 0.5);

        let outlineData = ring.calc.outlineFront;
        let outlineDataMetarialIndex = ring.calc.outlineFrontMetarialIndex;
        ctx.strokeStyle = "#f00";
        ctx.fillStyle = "#f00";
        let height = ringData.ringSize,
          xScale = BB.width / ringData.ringWidth,
          yScale = that.canvasRingHeight / height;

        outlineData.forEach(function (od, odIndex) {

          od.forEach(function (e, index) {
            if (index == 0) {
              ctx.beginPath();
              ctx.moveTo(e.x * xScale, e.y * yScale - that.ringOffsetPx);
            } else
              ctx.lineTo(e.x * xScale, e.y * yScale - that.ringOffsetPx);
          });

          let material = AppComponent.app.data.material.find(function (e: iMaterial) {
            return e.id == ringData.material[outlineDataMetarialIndex[odIndex]];
          })
          if (material)
            ctx.fillStyle = material.colorHtml;
          else
            ctx.fillStyle = "#ff0000";

          ctx.fill();
        });

        ctx.restore();

        ctx.save();
        ctx.translate(canvas.width / 2, BB.height / 2 + this.canvasRingHeight);
        ctx.scale(1, -1);
        ctx.lineWidth = 1;
        ctx.translate(0.5, 0.5);

        // let outlineData = ring.calc.outlineFront;
        ctx.strokeStyle = "#f00";
        ctx.fillStyle = "#f00";
        // let height = ringData.ringSize, ctxScale = that.canvasRingHeight / height;

        outlineData.forEach(function (od, odIndex) {

          od.forEach(function (e, index) {
            if (index == 0) {
              ctx.beginPath();
              ctx.moveTo(e.x * xScale, e.y * yScale - that.ringOffsetPx);
            } else
              ctx.lineTo(e.x * xScale, e.y * yScale - that.ringOffsetPx);
          });

          let material = AppComponent.app.data.material.find(function (e: iMaterial) {
            return e.id == ringData.material[outlineDataMetarialIndex[odIndex]];
          })
          if (material)
            ctx.fillStyle = material.colorHtml;
          else
            ctx.fillStyle = "#ff0000";

          ctx.fill();
        });

        ctx.restore();
      }

      if (stones) // zeichne Steine
      {
        for (let i = 0; i < stones.length; i++) {
          let stone = stones[i];
          let x = map(stone.xDiv, -5000, 5000, 0, BB.width);

          let y = map(stone.yRad, Math.PI, -Math.PI, -this.canvasRingHeight / 2, this.canvasRingHeight / 2) + BB.height / 2 + this.ringOffsetPx;
          let radius = stone.size / 2 * BB.width / ringData.ringWidth
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = (this.selectedShapeIndex == i || this.lastSelectedShapeIndex == i) ? "#f00" : "#fff";
          ctx.fill();
        }
      }

      ctx.beginPath();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 0.2;
      ctx.setLineDash([5, 3]);/*dashes are 5px and spaces are 3px*/
      ctx.lineDashOffset = 0;
      ctx.moveTo(0, BB.height / 2 + this.ringOffsetPx);
      ctx.lineTo(BB.width, BB.height / 2 + this.ringOffsetPx);
      ctx.stroke();
      ctx.beginPath();
      ctx.lineDashOffset = -this.ringOffsetPx;
      ctx.moveTo(BB.width / 2, 0);
      ctx.lineTo(BB.width / 2, BB.height);
      ctx.stroke();

      let pos;
      pos = this.elem.nativeElement.querySelectorAll("#pos180")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx - this.canvasRingHeight / 2) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos135")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx - this.canvasRingHeight / 8 - this.canvasRingHeight / 4) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos90")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx - this.canvasRingHeight / 4) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos45")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx - this.canvasRingHeight / 8) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos0")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos45n")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx + this.canvasRingHeight / 8) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos90n")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx + this.canvasRingHeight / 4) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos135n")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx + this.canvasRingHeight / 8 + this.canvasRingHeight / 4) - 1) + "px";
      pos = this.elem.nativeElement.querySelectorAll("#pos180n")[0];
      if (pos) pos.style.top = ((BB.height / 2 + this.ringOffsetPx + this.canvasRingHeight / 2) - 1) + "px";

      pos = <HTMLDivElement[]>this.elem.nativeElement.querySelectorAll("[id^='pos']");
      pos.forEach(function (e) {
        let top = parseInt(e.style.top);

        if (top < e.offsetHeight / 2 || (top > BB.height - e.offsetHeight / 2))
          e.style.opacity = "0";
        else
          e.style.opacity = "1";
      })
    }

    canvas = this.canvasRadial?.nativeElement;
    if (!canvas) return;

    BB = canvas.getBoundingClientRect();
    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, BB.width + 1, BB.height + 1);

      let x = BB.width / 2, y = BB.height / 2, radius = x - 10;
      if (BB.width > 0 && BB.height > 0) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2, true);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#eee";
        ctx.stroke();

        let range = sliderCanvasHeight * Math.PI * 2 / this.canvasRingHeight;
        let angle = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
        let offset = -this.ringOffsetPx * Math.PI * 2 / this.canvasRingHeight;
        let start = range/2-angle+offset, end = start - range;
        while (end < 0) end += (Math.PI*2)
        ctx.beginPath();
        ctx.arc(x, y, radius, start, end, true);
        ctx.lineWidth = 6;
        // ctx.lineCap = "round";
        ctx.strokeStyle = "#aaa";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(-angle));
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#bbb";
        ctx.stroke();

        if (this.selectedShapeIndex >= 0 && stones) {
          let stoneAngle = stones[this.selectedShapeIndex].yRad + angle;
          ctx.beginPath();
          ctx.arc(x + radius * Math.cos(stoneAngle), y + radius * Math.sin(-stoneAngle), 5, 0, Math.PI * 2, true);
          ctx.lineWidth = 1;
          ctx.fillStyle = "#f00";
          ctx.fill();
        }
      }
    }
  }

  curStoneGroup() {
    return cRing.curStoneGroup;
  }
}

let theComponent = null as StonexyComponent | null;
let dragginCanvas = false;
let dragStartX = 0;
let dragStartY = 0;

function mousemove(e: MouseEvent | TouchEvent) {
  if (!theComponent)
    return;

  e.preventDefault();
  e.stopPropagation();

  let canvas = <HTMLCanvasElement>theComponent.elem.nativeElement.querySelectorAll("canvas.slider-bg")[0];
  let BB = canvas.getBoundingClientRect();
  let x, y;

  if (e.type === "touchmove") {
    x = (<unknown>e as TouchEvent).touches[0].clientX;
    y = (<unknown>e as TouchEvent).touches[0].clientY;
  } else {
    x = (<MouseEvent>e).clientX;
    y = (<MouseEvent>e).clientY;
  }

  x -= BB.left;
  y -= BB.top;

  let stones = theComponent.ringData[theComponent.ringId].stone[cRing.curStoneGroup].freeStones;
  let getStoneSafeRadius = function (stoneSize: number): number {
    let stoneMode_10 = AppComponent.app.data.stoneMode.find(e => {
      return e.mode == 10;
    })

    if (stoneMode_10)
      return (stoneSize + stoneMode_10.safeDistX) / 2;

    return stoneSize / 2;
  }

  if (theComponent.selectedShapeIndex >= 0 && stones && theComponent.selectedShapeIndex < stones.length) // move stone
  {
    let dx = x - dragStartX;
    let dy = y - dragStartY;
    let stone = stones[theComponent.selectedShapeIndex];
    let rStoneDragging = getStoneSafeRadius(stone.size) * BB.width / RingData.list[theComponent.ringId].ringWidth;
    let xStoneDragging = map(stone.xDiv, -5000, 5000, 0, BB.width) + dx;
    let yStoneDragging = map(stone.yRad, Math.PI, -Math.PI, -theComponent.canvasRingHeight / 2, theComponent.canvasRingHeight / 2) + BB.height / 2 + theComponent.ringOffsetPx + dy;
    if (xStoneDragging - rStoneDragging < 0)
      xStoneDragging = rStoneDragging;
    else if (xStoneDragging + rStoneDragging > BB.width)
      xStoneDragging = BB.width - rStoneDragging;
    else // nur im gültigen Bereich den X-Startwert aktualisieren
      dragStartX = x;

    // let stoneMinMax = cRing.list[theComponent.ringId].calc.stoneMinMaxCurSize[0];
    // let min = map(stoneMinMax.min, 0, RingData.list[theComponent.ringId].ringWidth, 0, BB.width);
    // let max = map(stoneMinMax.max, 0, RingData.list[theComponent.ringId].ringWidth, 0, BB.width);
    //
    // // console.log(stoneMinMax, min, max);
    // let isOverlapping = function () {
    //   if (theComponent && stones) {
    //     for (let i = 0; i < stones.length; i++) {
    //       if (i == theComponent.selectedShapeIndex)
    //         continue;
    //       let stone = stones[i];
    //       let xStone = map(stone.xDiv, -5000, 5000, 0, BB.width);
    //       let yStone = map(stone.yRad, Math.PI, -Math.PI, -theComponent.canvasRingHeight / 2, theComponent.canvasRingHeight / 2) + BB.height / 2 + theComponent.ringOffsetPx;
    //       let radius = getStoneSafeRadius(stone.size) * BB.width / RingData.list[theComponent.ringId].ringWidth;
    //       let distance = Math.sqrt(Math.pow(xStoneDragging - xStone, 2) + Math.pow(yStoneDragging - yStone, 2));
    //       if (distance < rStoneDragging + radius)
    //         return true;
    //     }
    //   }
    //   return false;
    // }

    // if (xStoneDragging >= min && xStoneDragging <= max && !isOverlapping())
    {
      dragStartX = x;
      dragStartY = y;
      yStoneDragging = yStoneDragging - BB.height / 2 - theComponent.ringOffsetPx;
      x = map(xStoneDragging, 0, BB.width, -5000, 5000);
      y = map(yStoneDragging, -theComponent.canvasRingHeight / 2, theComponent.canvasRingHeight / 2, Math.PI, -Math.PI);
      let pi2 = Math.PI * 2;
      while (y > Math.PI)
        y -= pi2;
      while (y < -Math.PI)
        y += pi2;
      stones[theComponent.selectedShapeIndex].xDiv = x;
      stones[theComponent.selectedShapeIndex].yRad = y;
    }
  } //
  else if (dragginCanvas)// scroll ring
  {
    theComponent.ringOffsetPx += y - dragStartY;
    if (theComponent.ringOffsetPx < -theComponent.maxOffset)
      theComponent.ringOffsetPx = -theComponent.maxOffset;
    else if (theComponent.ringOffsetPx > theComponent.maxOffset)
      theComponent.ringOffsetPx = theComponent.maxOffset;

    dragStartY = y;
  }

  theComponent.draw();
}

function mouseup() {
  if (theComponent) {
    dragginCanvas = false;
    if (theComponent.selectedShapeIndex != -1)
      theComponent.commitChanges();
    theComponent = null;
  }

  window.removeEventListener("mousemove", mousemove);
  window.removeEventListener("touchmove", mousemove);
  window.removeEventListener("mouseup", mouseup);
  window.removeEventListener("touchend", mouseup);
}
