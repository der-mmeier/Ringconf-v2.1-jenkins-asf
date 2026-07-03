import {Component, ElementRef, HostBinding, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {environment} from "../../environments/environment";

@Component({
    selector: 'x-property-sync-dialog',
    templateUrl: './property-sync-dialog.component.html',
    styleUrls: ['./property-sync-dialog.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class PropertySyncDialogComponent {
  static SYNC_CALLBACK: ((targetIndex: number, value: any) => any) | null;

  @Input() ringId: number = 0;
  @Input() property: string = "";
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  constructor(private elRef: ElementRef) {

  }

  ngAfterContentInit() {
    this.elRef.nativeElement.setAttribute("ringId_s", this.property + "_" + this.ringId);
  }

  close() {
    let e = document.getElementsByTagName("x-property-sync-dialog");
    let list = Array.prototype.slice.call(e);
    list.forEach(function (e) {
      e.classList.remove("visible");
    })
    PropertySyncDialogComponent.SYNC_CALLBACK = null;
  }

  sync() {

    let that = this;
    // @ts-ignore
    let value: any = this.ringData[this.ringId][this.property];

    RingData.list.forEach(e => {
      if (e.index !== that.ringId) {
        if (PropertySyncDialogComponent.SYNC_CALLBACK != null)
          PropertySyncDialogComponent.SYNC_CALLBACK(e.index, value);
        else {
          // @ts-ignore
          e[that.property] = value;
        }
      }
    })

    this.close();
  }
}

export function onRingDataPropertyChange(ringId_source: number, property: string, syncCallback: ((targetIndex: number, value: any) => any) | null = null) {
  let isSingleConfig = true;
  RingData.list.forEach(f => {
    if (f.index != ringId_source) {
      if (f.cartActive) {
        isSingleConfig = false;
      }
    }
  })

  if (isSingleConfig)
    return;

  let e = document.getElementsByTagName("x-property-sync-dialog");
  let list = Array.prototype.slice.call(e);
  let search = property + "_" + ringId_source;

  list.forEach(function (e) {
    if (e.getAttribute("ringId_s") == search)
      e.classList.add("visible");
    else
      e.classList.remove("visible");
  })

  PropertySyncDialogComponent.SYNC_CALLBACK = syncCallback;
}
