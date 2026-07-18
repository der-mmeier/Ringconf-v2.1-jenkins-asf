import {Component, ElementRef, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {onRingDataPropertyChange} from "../property-sync-dialog/property-sync-dialog.component";
import {environment} from "../../environments/environment";
import {cRing, eRingFlags} from "../webgl/cRing";
import {WebglComponent} from "../webgl/webgl.component";
import {
  ExteriorEngravingType,
  ExteriorEngravingPlacement,
  iEngravingOffer
} from "../app.interfaces";
import {
  exteriorTypeToOfferId,
  formatCoordinates,
  getEngravingOfferPrice,
  hasActiveStoneGroups,
  isEngravingOfferVisible,
  parseCoordinateInput
} from "../exterior-engraving";

@Component({
    selector: 'x-config-engraving',
    templateUrl: './config-engraving.component.html',
    styleUrls: ['./config-engraving.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class ConfigEngravingComponent
{
  @Input() ringId: number = 0;
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;
  exteriorTypes = [
    {
      id: "text" as ExteriorEngravingType,
      title: "Textgravur außen",
      description: "Ein kurzer Text auf der sichtbaren Außenfläche.",
      image: "assets/engravings/exterior/cards/text.svg"
    },
    {
      id: "coordinates" as ExteriorEngravingType,
      title: "Koordinaten außen",
      description: "Breiten- und Längengrad, optional mit Schiffssteuerrad.",
      image: "assets/engravings/exterior/cards/coordinates.svg"
    },
    {
      id: "waveform" as ExteriorEngravingType,
      title: "Stimmwelle außen",
      description: "Eine Beispielvorschau für Ihre spätere Sprachaufnahme.",
      image: "assets/engravings/exterior/cards/waveform.svg"
    },
    {
      id: "fingerprint" as ExteriorEngravingType,
      title: "Fingerabdruck außen",
      description: "Eine Beispielvorschau für Ihren später eingereichten Fingerabdruck.",
      image: "assets/engravings/exterior/cards/fingerprint.svg"
    },
  ];
  exteriorConflictMessage = "";
  exteriorTextDraft: Record<number, string> = {};

  constructor(private elem: ElementRef)
  {
  }

  onEngravingInfoFormat(value: string): string
  {
    let length = AppComponent.app.data.engraving.maxLength - value.length;
    if (length < 0) length = 0;
    return "noch " + length + " Zeichen möglich";
  }

  applyEngravingText()
  {
    let input = <HTMLInputElement>this.elem.nativeElement.querySelector('#engravingText input');

    if (input)
    {
      this.ringData[this.ringId].engraving = input.value;
      onRingDataPropertyChange(this.ringId, "engraving");
    }
  }

  addSymbol(unicode: string)
  {
    let input = <HTMLInputElement>this.elem.nativeElement.querySelector('#engravingText input');

    if (input)
    {
      let caretPos = (input.selectionStart || input.selectionStart == 0) ? input.selectionStart : 0;
      let text = input.value;
      if (text.length >= AppComponent.app.data.engraving.maxLength) return;

      text = text.slice(0, caretPos) + unicode + text.slice(caretPos);
      input.value = text;
      if (input.setSelectionRange)
      {
        input.focus();
        input.setSelectionRange(caretPos + 1, caretPos + 1);
      }
    }
  }

  setFont(value:number)
  {
    //this.ringData[this.ringId].engravingFont=value;
    this.ringData.forEach(f=> {
      f.engravingFont = value;
    })
  }

  isInnerEngravingVisible(): boolean {
    return isEngravingOfferVisible(this.app.data, "inner-text");
  }

  isAnyExteriorVisible(): boolean {
    return this.exteriorTypes.some(type => this.isExteriorTypeVisible(type.id));
  }

  hasAnyVisibleEngraving(): boolean {
    return this.isInnerEngravingVisible() || this.isAnyExteriorVisible();
  }

  isExteriorTypeVisible(type: ExteriorEngravingType): boolean {
    const offerId = exteriorTypeToOfferId(type);
    return offerId ? isEngravingOfferVisible(this.app.data, offerId) : false;
  }

  getExteriorPrice(type: ExteriorEngravingType): string {
    const offerId = exteriorTypeToOfferId(type);
    if (!offerId) return "";
    const price = getEngravingOfferPrice(this.app.data, offerId);
    return price === null ? "" : `+ ${price.toFixed(2).replace(".", ",")} €`;
  }

  hasStoneConflict(ringId = this.ringId): boolean {
    return hasActiveStoneGroups(this.ringData[ringId]?.stone);
  }

  getExteriorDisabledReason(type: ExteriorEngravingType): string {
    if (!this.isExteriorTypeVisible(type)) return "";
    if (this.hasStoneConflict()) return "Außengravuren sind nur bei Ringen ohne Steinbesatz möglich.";
    return "";
  }

  selectExteriorType(type: ExteriorEngravingType) {
    this.exteriorConflictMessage = "";
    if (!this.isExteriorTypeVisible(type)) return;
    if (!this.confirmRemoveStonesForExterior(this.ringId)) return;

    RingData.setExteriorEngravingType(this.ringData[this.ringId], type);
    if (type === "text") {
      this.exteriorTextDraft[this.ringId] = this.ringData[this.ringId].exteriorEngraving.text ?? "";
    }
    this.applyPlacementToPair();
    this.invalidateEngravingTexture(this.ringId);
  }

  clearExteriorEngraving() {
    RingData.setExteriorEngravingType(this.ringData[this.ringId], "none");
    this.invalidateEngravingTexture(this.ringId);
  }

  getExteriorPlacement(): ExteriorEngravingPlacement {
    return this.ringData[this.ringId].exteriorEngraving.placement;
  }

  setExteriorPlacement(placement: ExteriorEngravingPlacement) {
    const config = this.ringData[this.ringId].exteriorEngraving;
    if (!this.isPlacementAvailable(placement)) return;
    if (placement !== "single-ring" && !this.confirmBothRingsStoneFree()) return;

    RingData.setExteriorEngravingPlacement(this.ringData[this.ringId], placement);
    this.applyPlacementToPair();
    this.invalidateEngravingTexture(0);
    this.invalidateEngravingTexture(1);
  }

  isPlacementAvailable(placement: ExteriorEngravingPlacement): boolean {
    const hasPair = this.ringData[0]?.cartActive && this.ringData[1]?.cartActive;
    const type = this.ringData[this.ringId].exteriorEngraving.type;
    if (placement === "single-ring") return true;
    if (!hasPair) return false;
    if (placement === "split-pair") return type === "waveform" || type === "fingerprint";
    return true;
  }

  setExteriorTextDraft(event: Event) {
    this.exteriorTextDraft[this.ringId] = (event.target as HTMLInputElement).value;
  }

  getExteriorTextDraft(): string {
    if (this.exteriorTextDraft[this.ringId] === undefined) {
      this.exteriorTextDraft[this.ringId] = this.ringData[this.ringId].exteriorEngraving.text ?? "";
    }
    return this.exteriorTextDraft[this.ringId];
  }

  applyExteriorText(value = this.getExteriorTextDraft()) {
    if (!this.confirmRemoveStonesForExterior(this.ringId)) return;
    RingData.setExteriorEngravingText(this.ringData[this.ringId], value);
    this.exteriorTextDraft[this.ringId] = this.ringData[this.ringId].exteriorEngraving.text ?? "";
    this.applyPlacementToPair();
    this.invalidateEngravingTexture(this.ringId);
  }

  setExteriorFont(value: number) {
    RingData.setExteriorEngravingFont(this.ringData[this.ringId], value);
    this.applyPlacementToPair();
    this.invalidateEngravingTexture(this.ringId);
  }

  setCoordinateLatitude(event: Event) {
    this.setCoordinates((event.target as HTMLInputElement).value, this.ringData[this.ringId].exteriorEngraving.longitudeInput ?? "");
  }

  setCoordinateLongitude(event: Event) {
    this.setCoordinates(this.ringData[this.ringId].exteriorEngraving.latitudeInput ?? "", (event.target as HTMLInputElement).value);
  }

  setCoordinateShipWheel(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.setCoordinates(
      this.ringData[this.ringId].exteriorEngraving.latitudeInput ?? "",
      this.ringData[this.ringId].exteriorEngraving.longitudeInput ?? "",
      checked
    );
  }

  setCoordinates(latitudeInput: string, longitudeInput: string, showShipWheel = this.ringData[this.ringId].exteriorEngraving.showShipWheel !== false) {
    if (!this.confirmRemoveStonesForExterior(this.ringId)) return;
    RingData.setExteriorCoordinates(this.ringData[this.ringId], latitudeInput, longitudeInput, showShipWheel);
    this.applyPlacementToPair();
    this.invalidateEngravingTexture(this.ringId);
  }

  getCoordinatePreview(): string {
    return formatCoordinates(this.ringData[this.ringId].exteriorEngraving) || "Bitte gültige Koordinaten eingeben.";
  }

  getCoordinateError(): string {
    const config = this.ringData[this.ringId].exteriorEngraving;
    if (config.type !== "coordinates") return "";
    if (config.latitudeInput && parseCoordinateInput(config.latitudeInput, -90, 90) === null)
      return "Breitengrad muss zwischen -90 und 90 liegen.";
    if (config.longitudeInput && parseCoordinateInput(config.longitudeInput, -180, 180) === null)
      return "Längengrad muss zwischen -180 und 180 liegen.";
    return "";
  }

  focusExteriorEngraving() {
    const webgl = WebglComponent.WEBGL;
    if (!webgl?.camera) return;
    webgl.camera.alpha = AppComponent.app.data.webglSettings.camera[0] - Math.PI / 2;
    webgl.camera.beta = Math.max(0.35, AppComponent.app.data.webglSettings.camera[1] * 0.85);
    webgl.renderFrame(AppComponent.app.data.webglSettings.forceFrames ?? 15);
  }

  getExteriorMaxLength(): number {
    return this.app.data.engraving?.exterior?.maxTextLength ?? this.app.data.engraving.maxLength;
  }

  getExteriorRemainingChars(): number {
    return Math.max(0, this.getExteriorMaxLength() - this.getExteriorTextDraft().length);
  }

  private confirmRemoveStonesForExterior(ringId: number): boolean {
    if (!this.hasStoneConflict(ringId)) return true;
    const ok = window.confirm("Außengravuren sind nur bei Ringen ohne Steinbesatz möglich. Steinbesatz entfernen und Außengravur wählen?");
    if (!ok) {
      this.exteriorConflictMessage = "Außengravur wurde nicht aktiviert. Entfernen Sie zuerst den Steinbesatz oder bestätigen Sie die Entfernung bewusst.";
      return false;
    }

    this.ringData[ringId].stone.forEach((_, index) => RingData.clearStonegroup(this.ringData[ringId], index));
    return true;
  }

  private confirmBothRingsStoneFree(): boolean {
    if (!this.hasStoneConflict(0) && !this.hasStoneConflict(1)) return true;
    const ok = window.confirm("Paarmotive sind nur möglich, wenn beide Ringe steinfrei sind. Steinbesatz auf beiden Ringen entfernen und Paarmotiv wählen?");
    if (!ok) {
      this.exteriorConflictMessage = "Paarmodus wurde nicht aktiviert, weil mindestens ein Ring Steinbesatz hat.";
      return false;
    }
    [0, 1].forEach(ringId => this.ringData[ringId].stone.forEach((_, index) => RingData.clearStonegroup(this.ringData[ringId], index)));
    return true;
  }

  private applyPlacementToPair() {
    const current = this.ringData[this.ringId].exteriorEngraving;
    if (current.placement === "single-ring" || !(this.ringData[0]?.cartActive && this.ringData[1]?.cartActive)) return;
    const targetId = this.ringId === 0 ? 1 : 0;
    this.ringData[targetId].exteriorEngraving = {...current};
    this.invalidateEngravingTexture(targetId);
  }

  private invalidateEngravingTexture(ringId: number) {
    const ring = cRing.list.find(item => item.ringData.index === ringId);
    if (ring) {
      ring.flags |= eRingFlags.InvalidateMaterialOnly;
    }
    this.ringData[ringId].isDirty = true;
  }
}
