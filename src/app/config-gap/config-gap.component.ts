import {ChangeDetectionStrategy, Component, Input, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {iGapMode, iProfile, iSurface} from "../app.interfaces";
import {onRingDataPropertyChange} from "../property-sync-dialog/property-sync-dialog.component";
import {environment} from "../../environments/environment";
import {cRing} from "../webgl/cRing";
import {ConfigStoneComponent} from "../config-stone/config-stone.component";
import {getStoneMode} from "../app.definitions";
import {createDefaultPearlingSizes, hasPearlingDefinitions, isValidPearlingSizeId, normalizePearlingAllowedSizes} from "../pearling-size";

type JsonRecord = Record<string, unknown>;

interface PearlingSizeOption {
  id: number;
  name: string;
  img: string;
  diameter: number;
  rowClearance: number;
  channelEdgeClearance: number;
  channelWidth: number;
  spacingMode: string;
}

interface PearlingFeatureRule {
  enabled?: boolean;
  allowedSizes?: Array<number | string>;
  allowedGapModes?: Array<number | string>;
  allowedSides?: string[];
}

@Component({
  selector: 'x-config-gap',
  templateUrl: './config-gap.component.html',
  styleUrls: ['./config-gap.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: false
})
export class ConfigGapComponent {
  @Input() ringId: number = 0;

  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  private readonly fallbackPearlingSizes = createDefaultPearlingSizes() as unknown as PearlingSizeOption[];

  isDisabled_gapMode(value: number): boolean {
    if (this.ringData[this.ringId].waveCount > 1 && value === 2) {
      return true;
    }
    return value === 0 && RingData.getForceGap(this.ringData[this.ringId]);
  }

  setValue_gapMode(value: number) {
    this.ringData[this.ringId].gapMode = value;
    if (value === 0) {
      this.ringData[this.ringId].gapPearlingEnabled = false;
    }
    this.enforcePearlingAvailability();
    onRingDataPropertyChange(this.ringId, "gapMode");
    this.requestRenderFrame();
  }

  isVisible_gapSettings(): boolean {
    return this.ringData[this.ringId].gapMode !== 0;
  }

  getOptions_gapWidth() {
    const gapModeId = this.ringData[this.ringId].gapMode;
    const gapMode = this.app.data.gapMode.find(function (e: iGapMode) {
      return e.id === gapModeId;
    });
    return gapMode ? gapMode.width : [];
  }

  setOption_gapWidth(value: number) {
    this.ringData[this.ringId].gapWidth = value;
    this.enforcePearlingAvailability();
    onRingDataPropertyChange(this.ringId, "gapWidth");
  }

  onValueFormat_gapWidth(value: number) {
    return (value / 1000).toFixed(1) + " mm";
  }

  onValueHidden_gapWidth(that: ConfigStoneComponent, value: number) {
    const ringData = that.ringData[that.ringId];
    const stoneGroup = ringData.stone[cRing.curStoneGroup];
    const stoneMode = getStoneMode(stoneGroup.mode);
    let maxGapWidth = 10000;
    const ring = cRing.list.find(e => e.ringData.index === that.ringId);

    if (ring) {
      maxGapWidth = ring.calc.gwMax;
    }

    if (stoneMode?.maxGapWidth !== undefined && stoneMode.maxGapWidth > 0 && stoneMode.maxGapWidth < maxGapWidth) {
      maxGapWidth = stoneMode.maxGapWidth;
    }

    return value > maxGapWidth;
  }

  getOptions_gapSurface() {
    const gapModeId = this.ringData[this.ringId].gapMode;
    const gapMode = this.app.data.gapMode.find(function (e: iGapMode) {
      return e.id === gapModeId;
    });
    return gapMode ? gapMode.surface : [];
  }

  setOption_gapSurface(value: number) {
    this.ringData[this.ringId].gapSurface = value;
    onRingDataPropertyChange(this.ringId, "gapSurface");
  }

  onValueFormat_gapSurface(value: number) {
    const surface = AppComponent.app.data.surface.find(function (e: iSurface) {
      return e.id === value;
    });
    if (surface) {
      return "<span style='background: url(" + environment.assetFolderLocation + "/assets/imgui/" + surface.img + ") center center no-repeat; background-size: contain; width: 20px; height: 20px; display: inline-block; vertical-align: middle;'></span> " + surface.name;
    }
    return value;
  }

  isHidden_gapElement(index: number) {
    const divMode = this.ringData[this.ringId].divPreset.slice(0, 1).toLowerCase();
    const numDiv = this.ringData[this.ringId].materialDiv.length;

    if (divMode === "s" || divMode === "h" || numDiv < 2) {
      return true;
    }
    return index >= numDiv - 1;
  }

  onToggleGapEnabled(index: number) {
    const gapEnabledAr = this.ringData[this.ringId].gapEnabled;
    RingData.setGapEnabled(this.ringData[this.ringId], index, gapEnabledAr[index] === 0);
    const ring = cRing.list.find(e => e.ringData.index === this.ringId);
    ring?.normalizeFreeGaps();
    this.requestRenderFrame();
  }

  getGapPositionString(index: number) {
    const ringData = this.ringData[this.ringId];
    const result = [];
    let pos = 0;
    const gapDiv = ringData.gapDiv;

    for (let i = 0; i < gapDiv.length - 1; i++) {
      pos += gapDiv[i];
      result.push((pos * ringData.ringWidth / 10000000).toFixed(2) + ' mm');
    }

    return index >= 0 && index < result.length ? result[index] : "";
  }

  onDeleteGap(index: number) {
    let gapDiv = this.ringData[this.ringId].gapDiv.slice();

    if (index < 0 || index > gapDiv.length - 1) {
      return;
    }

    if (gapDiv.length === 2) {
      gapDiv = [];
    } else if (gapDiv.length > 2) {
      const value = gapDiv[index];
      gapDiv.splice(index, 1);
      gapDiv[index] += value;
    }

    const ring = cRing.list.find(e => e.ringData.index === this.ringId);
    if (ring) {
      ring.setFreeGapDiv(gapDiv);
    } else {
      RingData.setGapDivArray(this.ringData[this.ringId], gapDiv);
    }
  }

  canAddGaps(): boolean {
    const ring = cRing.list.find(e => e.ringData.index === this.ringId);
    return ring ? ring.calc.gapDivMinMax.length > 0 : false;
  }

  onAddGap() {
    const ring = cRing.list.find(e => e.ringData.index === this.ringId);
    if (ring) {
      ring.gapDiv_plus();
      ring.normalizeFreeGaps();
    }
  }

  canSteps(): boolean {
    const profileName = this.ringData[this.ringId].profileName;
    const profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name === profileName;
    });
    return !!profile?.sw;
  }

  setValue_stepMode(value: number) {
    this.ringData[this.ringId].stepMode = value;
    if (value === 0) {
      this.ringData[this.ringId].stepPearlingEnabled = false;
    }
    this.enforcePearlingAvailability();
    onRingDataPropertyChange(this.ringId, "stepMode");
    this.requestRenderFrame();
  }

  getOptions_stepWidth(): number[] {
    const profileName = this.ringData[this.ringId].profileName;
    const profile = AppComponent.app.data.profile.find(function (e: iProfile) {
      return e.name === profileName;
    });

    if (!profile?.sw) {
      return [];
    }

    let maxStepWidth = (this.ringData[this.ringId].ringWidth - 1.0) / 2 - profile.gapGapDistance;
    if (maxStepWidth > profile.sw.max) {
      maxStepWidth = profile.sw.max;
    }

    const result = [];
    for (let i = profile.sw.min; i <= profile.sw.max && i <= maxStepWidth; i += profile.sw.step) {
      result.push(i);
    }
    return result;
  }

  onValueFormat_stepWidth(value: number) {
    return (value / 1000).toFixed(1) + " mm";
  }

  onSelect_stepWidth(index: number, value: number) {
    RingData.setStepWidth(this.ringData[this.ringId], index, value);

    const targetId = this.ringId === 0 ? 1 : 0;
    if (index === 0) {
      const stepMode = RingData.list[targetId].stepMode;
      if (stepMode === 1 || stepMode === 3) {
        const data = this.ringData[this.ringId].stepWidth;
        onRingDataPropertyChange(this.ringId, "stepWidth_left", function (id) {
          RingData.setStepWidth(RingData.list[id], 0, data[0]);
        });
      }
    } else if (index === 1) {
      const stepMode = RingData.list[targetId].stepMode;
      if (stepMode === 2 || stepMode === 3) {
        const data = this.ringData[this.ringId].stepWidth;
        onRingDataPropertyChange(this.ringId, "stepWidth_right", function (id) {
          RingData.setStepWidth(RingData.list[id], 1, data[1]);
        });
      }
    }
    this.requestRenderFrame();
    this.enforcePearlingAvailability();
  }

  getPearlingSizes(): PearlingSizeOption[] {
    const data = this.app?.data as unknown as JsonRecord | null;
    if (!hasPearlingDefinitions(data)) {
      return [];
    }

    const raw = Array.isArray(data?.["pearlingSize"])
      ? data?.["pearlingSize"] as unknown[]
      : (Array.isArray(data?.["milgrainSize"]) ? data?.["milgrainSize"] as unknown[] : []);

    const items = raw
      .filter(entry => entry && typeof entry === "object" && !Array.isArray(entry))
      .map(entry => this.normalizePearlingSize(entry as JsonRecord))
      .filter((entry): entry is PearlingSizeOption => entry !== null)
      .filter(entry => isValidPearlingSizeId(entry.id));

    return items.length > 0 ? items : this.fallbackPearlingSizes;
  }

  getGapPearlingEnabled(): boolean {
    const ringData = this.ringData[this.ringId] as unknown as JsonRecord;
    return ringData["gapPearlingEnabled"] === true || ringData["_gapPearlingEnabled"] === true;
  }

  setGapPearlingEnabled(value: boolean): void {
    if (value && this.isDisabled_gapPearling()) {
      return;
    }
    if (value) {
      const allowed = this.getAllowedPearlingSizeIds("gapPearling");
      if (!allowed.includes(this.getGapPearlingSize())) {
        this.ringData[this.ringId].gapPearlingSize = allowed[0] ?? 500;
      }
    }
    this.ringData[this.ringId].gapPearlingEnabled = value;
    onRingDataPropertyChange(this.ringId, "gapPearlingEnabled");
    this.requestRenderFrame();
  }

  getGapPearlingSize(): number {
    const ringData = this.ringData[this.ringId] as unknown as JsonRecord;
    return this.resolvePearlingSize(Number(ringData["gapPearlingSize"] ?? ringData["_gapPearlingSize"] ?? 500));
  }

  setGapPearlingSize(value: number): void {
    if (this.isDisabled_pearlingSize(value, "gapPearling")) {
      return;
    }
    this.ringData[this.ringId].gapPearlingSize = value;
    onRingDataPropertyChange(this.ringId, "gapPearlingSize");
    this.requestRenderFrame();
  }

  getStepPearlingEnabled(): boolean {
    const ringData = this.ringData[this.ringId] as unknown as JsonRecord;
    return ringData["stepPearlingEnabled"] === true || ringData["_stepPearlingEnabled"] === true;
  }

  setStepPearlingEnabled(value: boolean): void {
    if (value && this.isDisabled_stepPearling()) {
      return;
    }
    if (value) {
      const allowed = this.getAllowedPearlingSizeIds("stepPearling");
      if (!allowed.includes(this.getStepPearlingSize())) {
        this.ringData[this.ringId].stepPearlingSize = allowed[0] ?? 500;
      }
    }
    this.ringData[this.ringId].stepPearlingEnabled = value;
    onRingDataPropertyChange(this.ringId, "stepPearlingEnabled");
    this.requestRenderFrame();
  }

  getStepPearlingSize(): number {
    const ringData = this.ringData[this.ringId] as unknown as JsonRecord;
    return this.resolvePearlingSize(Number(ringData["stepPearlingSize"] ?? ringData["_stepPearlingSize"] ?? 500));
  }

  setStepPearlingSize(value: number): void {
    if (this.isDisabled_pearlingSize(value, "stepPearling")) {
      return;
    }
    this.ringData[this.ringId].stepPearlingSize = value;
    onRingDataPropertyChange(this.ringId, "stepPearlingSize");
    this.requestRenderFrame();
  }

  isDisabled_gapPearling(): boolean {
    if (!this.isVisible_gapSettings()) {
      return true;
    }
    const rule = this.getFeatureRule("gapPearling");
    if (!rule || rule.enabled === false) {
      return true;
    }
    const allowedGapModes = this.normalizeNumberList(rule?.allowedGapModes);
    if (allowedGapModes.length > 0 && !allowedGapModes.includes(this.ringData[this.ringId].gapMode)) {
      return true;
    }
    return this.getAllowedPearlingSizeIds("gapPearling").length === 0;
  }

  isDisabled_stepPearling(): boolean {
    if (this.ringData[this.ringId].stepMode === 0) {
      return true;
    }
    const rule = this.getFeatureRule("stepPearling");
    return !rule || rule.enabled === false || this.getAllowedPearlingSizeIds("stepPearling").length === 0;
  }

  isDisabled_pearlingSize(value: number, ruleKey: "gapPearling" | "stepPearling"): boolean {
    const allowed = this.getAllowedPearlingSizeIds(ruleKey);
    return allowed.length > 0 && !allowed.includes(value);
  }

  formatPearlingSize(size: PearlingSizeOption): string {
    const label = size.name || this.formatMicrometer(size.diameter || size.id);
    return label + " (" + size.id + ")";
  }

  getGapPearlingDisabledReason(): string {
    if (!this.isVisible_gapSettings()) {
      return "Perlierung benoetigt eine aktive Fuge.";
    }
    return this.getPearlingChannelDisabledReason("gapPearling");
  }

  getStepPearlingDisabledReason(): string {
    if (this.ringData[this.ringId].stepMode === 0) {
      return "Perlierung benoetigt eine aktive Stufe.";
    }
    return this.getPearlingChannelDisabledReason("stepPearling");
  }

  trackByFn(index: number, _item: unknown) {
    return index;
  }

  onValueFreeGapArrayChanged(value: number[]) {
    const ring = cRing.list.find(e => e.ringData.index === this.ringId);
    if (ring) {
      ring.setFreeGapDiv(value);
      this.requestRenderFrame();
      return;
    }
    RingData.setGapDivArray(this.ringData[this.ringId], value);
    this.requestRenderFrame();
  }

  private normalizePearlingSize(entry: JsonRecord): PearlingSizeOption | null {
    const id = Number(entry["id"]);
    const diameter = Number(entry["diameter"] ?? entry["id"]);
    if (!Number.isFinite(id) || !Number.isFinite(diameter)) {
      return null;
    }

    return {
      id,
      name: String(entry["name"] ?? this.formatMicrometer(diameter)),
      img: String(entry["img"] ?? "icon-milgrain-size-0-5.svg"),
      diameter,
      rowClearance: Number(entry["rowClearance"] ?? entry["spacing"] ?? Math.max(50, diameter * 0.1)),
      channelEdgeClearance: Number(entry["channelEdgeClearance"] ?? entry["border"] ?? entry["borderLeft"] ?? 100),
      channelWidth: Number(entry["channelWidth"] ?? diameter + 200),
      spacingMode: String(entry["spacingMode"] ?? "auto-fit"),
    };
  }

  private getFeatureRule(key: "gapPearling" | "stepPearling"): PearlingFeatureRule | null {
    const data = this.app?.data as unknown as JsonRecord | null;
    const featureRules = data?.["featureRules"];
    if (!featureRules || typeof featureRules !== "object" || Array.isArray(featureRules)) {
      return null;
    }
    const raw = (featureRules as JsonRecord)[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    return raw as PearlingFeatureRule;
  }

  private getAllowedPearlingSizeIds(ruleKey: "gapPearling" | "stepPearling"): number[] {
    const rule = this.getFeatureRule(ruleKey);
    if (!rule || rule.enabled === false) {
      return [];
    }

    const validSizeIds = this.getPearlingSizes()
      .filter(size => this.isPearlingSizeAllowedForChannel(size, ruleKey))
      .map(entry => entry.id);
    const explicit = normalizePearlingAllowedSizes(rule?.allowedSizes).filter(id => validSizeIds.includes(id));
    return explicit.length > 0 ? explicit : validSizeIds;
  }

  private isPearlingSizeAllowedForChannel(size: PearlingSizeOption, ruleKey: "gapPearling" | "stepPearling"): boolean {
    return this.getPearlingChannelWidth(ruleKey) >= this.getRequiredPearlingChannelWidth(size);
  }

  private getPearlingChannelDisabledReason(ruleKey: "gapPearling" | "stepPearling"): string {
    const available = this.getPearlingChannelWidth(ruleKey);
    const requiredValues = this.getPearlingSizes().map(size => this.getRequiredPearlingChannelWidth(size));
    const smallestRequired = Math.min(...requiredValues);
    if (!Number.isFinite(smallestRequired) || available >= smallestRequired) {
      return "";
    }
    return "Kanal zu schmal: mindestens " + this.formatMicrometer(smallestRequired) + " erforderlich.";
  }

  private getPearlingChannelWidth(ruleKey: "gapPearling" | "stepPearling"): number {
    const data = this.ringData[this.ringId];
    if (ruleKey === "gapPearling") {
      return Number(data.gapWidth);
    }

    const activeWidths: number[] = [];
    if (data.stepMode === 1 || data.stepMode === 3) {
      activeWidths.push(Number(data.stepWidth[0]));
    }
    if (data.stepMode === 2 || data.stepMode === 3) {
      activeWidths.push(Number(data.stepWidth[1]));
    }
    const finite = activeWidths.filter(value => Number.isFinite(value) && value > 0);
    return finite.length ? Math.min(...finite) : 0;
  }

  private getRequiredPearlingChannelWidth(size: PearlingSizeOption): number {
    const diameter = Number(size.diameter || size.id);
    const edgeClearance = Number(size.channelEdgeClearance || 0);
    const configured = Number(size.channelWidth);
    const calculated = diameter + 2 * edgeClearance;
    return Math.max(
      Number.isFinite(configured) && configured > 0 ? configured : 0,
      Number.isFinite(calculated) && calculated > 0 ? calculated : diameter,
    );
  }

  private normalizeNumberList(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(entry => Number(entry))
      .filter(entry => Number.isFinite(entry));
  }

  private formatMicrometer(value: unknown): string {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return String(value ?? "");
    }
    return (numberValue / 1000).toFixed(1).replace(".", ",") + " mm";
  }

  private resolvePearlingSize(value: number): number {
    const sizes = this.getPearlingSizes();
    const fallback = sizes.find(size => size.id === 500)?.id ?? sizes[0]?.id ?? 500;
    return sizes.some(size => size.id === value) ? value : fallback;
  }

  private requestRenderFrame(): void {
    const webgl = (window as unknown as {__oneRingconfWebgl?: {renderFrame?: (frames?: number) => void}}).__oneRingconfWebgl;
    if (webgl?.renderFrame) {
      webgl.renderFrame(15);
    }
  }

  private enforcePearlingAvailability(): void {
    const data = this.ringData[this.ringId];
    if (data.gapPearlingEnabled) {
      const allowed = this.getAllowedPearlingSizeIds("gapPearling");
      if (allowed.length === 0) {
        data.gapPearlingEnabled = false;
        onRingDataPropertyChange(this.ringId, "gapPearlingEnabled");
      } else if (!allowed.includes(this.getGapPearlingSize())) {
        data.gapPearlingSize = allowed[0];
        onRingDataPropertyChange(this.ringId, "gapPearlingSize");
      }
    }
    if (data.stepPearlingEnabled) {
      const allowed = this.getAllowedPearlingSizeIds("stepPearling");
      if (allowed.length === 0) {
        data.stepPearlingEnabled = false;
        onRingDataPropertyChange(this.ringId, "stepPearlingEnabled");
      } else if (!allowed.includes(this.getStepPearlingSize())) {
        data.stepPearlingSize = allowed[0];
        onRingDataPropertyChange(this.ringId, "stepPearlingSize");
      }
    }
  }
}
