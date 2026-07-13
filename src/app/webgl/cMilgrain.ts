import {Color3, Matrix, Mesh, MeshBuilder, PBRMaterial, TransformNode} from "@babylonjs/core";
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {hasPearlingDefinitions, normalizePearlingSpacingMode, PearlingSpacingMode} from "../pearling-size";
import {CVertex} from "./threeD";
import {WebglComponent} from "./webgl.component";

type JsonRecord = Record<string, unknown>;

interface PearlingSizeDefinition {
  id: number;
  diameter: number;
  rowClearance: number;
  minRowClearance?: number;
  maxRowClearance?: number;
  channelEdgeClearance: number;
  channelWidth: number;
  spacingMode: PearlingSpacingMode;
  pitch?: number;
  beadCount?: number;
}

interface PearlingRule {
  enabled?: boolean;
  allowedSizes?: Array<number | string>;
  allowedGapModes?: Array<number | string>;
  minDistanceToStone?: number;
  minDistanceToOtherGap?: number;
}

interface PearlingChannelRequest {
  type: "gap" | "step";
  side?: "left" | "right";
  xCenter: number;
  sizeId: number;
  channelWidth: number;
}

interface PearlingChannelContext {
  type: "gap" | "step";
  side?: "left" | "right";
  xCenter: number;
  channelWidth: number;
  channelDepth: number;
  surfaceZ: number;
  floorZ: number;
  beadDiameter: number;
  beadRadius: number;
  channelEdgeClearance: number;
  rowClearance: number;
  minRowClearance?: number;
  maxRowClearance?: number;
  spacingMode: PearlingSpacingMode;
  pitch?: number;
  requestedBeadCount?: number;
  actualGap?: number;
  availableLength?: number;
  circumference?: number;
  requiredChannelWidth: number;
  visibleCenterZ: number;
  rowRadius: number;
  sizeId: number;
  beadCount: number;
  disabledReason?: string;
}

interface PearlingSpacingPlan {
  beadCount: number;
  startArc: number;
  pitch: number;
  actualGap: number;
  availableLength: number;
  circumference: number;
  requestedBeadCount?: number;
  disabledReason?: string;
}

interface PearlingRingHost {
  ringData: RingData;
  pivot: TransformNode;
  profile: {
    frontVertices: CVertex[];
    stonePaths?: PearlingStonePath[];
  };
}

export interface MilgrainRenderStats {
  active: boolean;
  modeId: number;
  sizeId: number;
  rowCount: number;
  beadCount: number;
}

interface PearlingStonePath {
  positions?: CVertex[];
}

interface PearlingStoneExclusion {
  angle: number;
  halfAngle: number;
}

const FALLBACK_SIZES: PearlingSizeDefinition[] = [
  {id: 500, diameter: 500, rowClearance: 100, minRowClearance: 50, maxRowClearance: 120, channelEdgeClearance: 100, channelWidth: 700, spacingMode: "stretch-gap", pitch: 600},
  {id: 1000, diameter: 1000, rowClearance: 100, minRowClearance: 80, maxRowClearance: 150, channelEdgeClearance: 100, channelWidth: 1200, spacingMode: "stretch-gap", pitch: 1100},
];

export class cMilgrain {
  private readonly meshes: Mesh[] = [];
  private material: PBRMaterial | null = null;
  private debugLoggedKey = "";

  stats: MilgrainRenderStats = {
    active: false,
    modeId: 0,
    sizeId: 500,
    rowCount: 0,
    beadCount: 0,
  };

  constructor(private readonly ring: PearlingRingHost) {
  }

  update(): void {
    this.dispose();

    try {
      const contexts = this.collectChannelContexts();
      this.stats = {
        active: false,
        modeId: contexts.length ? 1 : 0,
        sizeId: contexts[0]?.sizeId ?? 500,
        rowCount: contexts.length,
        beadCount: 0,
      };

      const webgl = WebglComponent.WEBGL;
      if (!webgl || contexts.length === 0) {
        return;
      }

      const material = this.createMaterial();
      const innerRadius = this.ring.ringData.ringSize / Math.PI / 2;
      const ringRotation = AppComponent.app.data.webglSettings.ringRotationX * Math.PI / 180;
      let beadCountTotal = 0;

      contexts.forEach((context, rowIndex) => {
        if (context.disabledReason) {
          return;
        }

        const diameter = context.beadDiameter;
        const beadRadius = context.beadRadius;
        const rowRadius = context.rowRadius;
        const circumference = rowRadius * Math.PI * 2;
        const spacingPlan = this.createSpacingPlan(context, circumference);
        context.beadCount = spacingPlan.beadCount;
        context.pitch = spacingPlan.pitch;
        context.actualGap = spacingPlan.actualGap;
        context.availableLength = spacingPlan.availableLength;
        context.circumference = spacingPlan.circumference;
        context.requestedBeadCount = spacingPlan.requestedBeadCount;

        if (spacingPlan.disabledReason) {
          context.disabledReason = spacingPlan.disabledReason;
          return;
        }

        const beadCount = spacingPlan.beadCount;
        const stoneExclusions = this.shouldApplyStoneExclusions(context)
          ? this.getStoneExclusions(rowRadius, beadRadius, context.type)
          : [];

        if (beadCount < 1) {
          return;
        }

        const mesh = MeshBuilder.CreateSphere(
          `pearling_r${this.ring.ringData.index}_${context.type}_${context.side ?? "center"}_${rowIndex}_s${context.sizeId}`,
          {
            diameter: diameter / 1000,
            segments: diameter >= 1000 ? 16 : 12,
            slice: 0.5,
          },
          webgl.scene,
        );

        mesh.parent = this.ring.pivot;
        mesh.material = material;
        mesh.setEnabled(true);
        mesh.alwaysSelectAsActiveMesh = true;

        const matrices = new Float32Array(beadCount * 16);
        let activeBeadCount = 0;

        for (let beadIndex = 0; beadIndex < beadCount; beadIndex++) {
          const arc = spacingPlan.startArc + beadIndex * spacingPlan.pitch;
          const theta = arc / rowRadius + ringRotation;
          const point = new CVertex(context.xCenter, 0, context.visibleCenterZ - innerRadius);
          point.rotateX(theta);
          if (this.isInsideStoneExclusion(this.angleFromPoint(point), stoneExclusions)) {
            continue;
          }

          const rotation = Matrix.RotationX(theta - Math.PI / 2);
          const translation = Matrix.Translation(point.x / 1000, point.y / 1000, point.z / 1000);
          const matrix = rotation.multiply(translation);
          matrix.copyToArray(matrices, activeBeadCount * 16);
          activeBeadCount++;
        }

        if (activeBeadCount < 1) {
          mesh.dispose();
          return;
        }

        mesh.thinInstanceSetBuffer("matrix", matrices.subarray(0, activeBeadCount * 16), 16);
        this.meshes.push(mesh);
        beadCountTotal += activeBeadCount;
      });

      this.stats = {
        active: beadCountTotal > 0,
        modeId: contexts.length ? 1 : 0,
        sizeId: contexts[0]?.sizeId ?? 500,
        rowCount: this.meshes.length,
        beadCount: beadCountTotal,
      };
      this.debug(contexts);
    } catch (error) {
      console.warn("[Pearling] Rendering failed", error);
      this.dispose();
    }
  }

  dispose(): void {
    while (this.meshes.length) {
      const mesh = this.meshes.pop();
      if (!mesh) {
        continue;
      }

      try {
        WebglComponent.WEBGL?.scene.removeMesh(mesh);
        mesh.material = null;
        mesh.dispose();
      } catch (error) {
        console.warn("[Pearling] Dispose failed", error);
      }
    }

    if (this.material) {
      try {
        this.material.dispose();
      } catch (error) {
        console.warn("[Pearling] Material dispose failed", error);
      }
      this.material = null;
    }

    this.stats = {
      active: false,
      modeId: this.stats.modeId,
      sizeId: this.stats.sizeId,
      rowCount: 0,
      beadCount: 0,
    };
  }

  private collectChannelContexts(): PearlingChannelContext[] {
    const requests: PearlingChannelRequest[] = [];
    const data = this.ring.ringData;
    if (!hasPearlingDefinitions(AppComponent.app.data)) {
      this.debugPearlingUnavailable("AppData has no pearling definitions");
      return [];
    }

    if (data.gapPearlingEnabled && data.gapMode > 0 && this.isRuleEnabled("gapPearling")) {
      const allowedGapModes = this.normalizeNumberList(this.getRule("gapPearling")?.allowedGapModes);
      if (allowedGapModes.length === 0 || allowedGapModes.includes(data.gapMode)) {
        const sizeId = this.resolveSizeId(data.gapPearlingSize, "gapPearling");
        this.getNaturalGapXPositions().forEach(xCenter => requests.push({type: "gap", xCenter, sizeId, channelWidth: data.gapWidth}));
        this.getFreeGapXPositions().forEach(xCenter => requests.push({type: "gap", xCenter, sizeId, channelWidth: data.gapWidth}));
      }
    }

    if (data.stepPearlingEnabled && data.stepMode > 0 && this.isRuleEnabled("stepPearling")) {
      const sizeId = this.resolveSizeId(data.stepPearlingSize, "stepPearling");
      if (data.stepMode === 1 || data.stepMode === 3) {
        const channelWidth = data.stepWidth[0];
        requests.push({type: "step", side: "left", xCenter: -data.ringWidth / 2 + channelWidth / 2, sizeId, channelWidth});
      }
      if (data.stepMode === 2 || data.stepMode === 3) {
        const channelWidth = data.stepWidth[1];
        requests.push({type: "step", side: "right", xCenter: data.ringWidth / 2 - channelWidth / 2, sizeId, channelWidth});
      }
    }

    const minDistance = this.positiveNumber(this.getRule("gapPearling")?.minDistanceToOtherGap, 0);
    return requests
      .filter((request, index) => {
        return requests.findIndex(other => other.type === request.type && Math.abs(other.xCenter - request.xCenter) < Math.max(1, minDistance)) === index;
      })
      .map(request => this.createChannelContext(request))
      .filter((context): context is PearlingChannelContext => context !== null);
  }

  private getNaturalGapXPositions(): number[] {
    const data = this.ring.ringData;
    const divMode = data.divPreset.slice(0, 1).toLowerCase();
    if (divMode === "s" || divMode === "h" || data.materialDiv.length < 2) {
      return [];
    }

    const result: number[] = [];
    let pos = 0;
    for (let index = 0; index < data.materialDiv.length - 1; index++) {
      pos += data.materialDiv[index];
      if (data.gapEnabled[index]) {
        result.push(pos * data.ringWidth / 10000 - data.ringWidth / 2);
      }
    }
    return result;
  }

  private getFreeGapXPositions(): number[] {
    const data = this.ring.ringData;
    const result: number[] = [];
    let pos = 0;
    for (let index = 0; index < data.gapDiv.length - 1; index++) {
      pos += data.gapDiv[index];
      result.push(pos * data.ringWidth / 10000 - data.ringWidth / 2);
    }
    return result;
  }

  private getSize(sizeId: number): PearlingSizeDefinition | null {
    return this.getSizes().find(size => size.id === sizeId) ?? this.getSizes().find(size => size.id === 500) ?? this.getSizes()[0] ?? null;
  }

  private getSizes(): PearlingSizeDefinition[] {
    const appData = AppComponent.app.data as unknown as JsonRecord;
    if (!hasPearlingDefinitions(appData)) {
      return [];
    }

    const raw = Array.isArray(appData["pearlingSize"])
      ? appData["pearlingSize"] as unknown[]
      : (Array.isArray(appData["milgrainSize"]) ? appData["milgrainSize"] as unknown[] : []);
    const result = raw
      .filter(item => item && typeof item === "object" && !Array.isArray(item))
      .map(item => this.normalizeSize(item as JsonRecord))
      .filter((item): item is PearlingSizeDefinition => item !== null)
      .filter(item => item.id === 500 || item.id === 1000);

    return result.length > 0 ? result : FALLBACK_SIZES;
  }

  private normalizeSize(record: JsonRecord): PearlingSizeDefinition | null {
    const id = Number(record["id"]);
    const diameter = Number(record["diameter"] ?? record["id"]);
    if (!Number.isFinite(id) || !Number.isFinite(diameter) || diameter <= 0) {
      return null;
    }

    return {
      id,
      diameter,
      rowClearance: this.nonNegativeNumber(record["rowClearance"] ?? record["spacing"], Math.max(50, diameter * 0.1)),
      minRowClearance: this.optionalNonNegativeNumber(record["minRowClearance"]),
      maxRowClearance: this.optionalNonNegativeNumber(record["maxRowClearance"]),
      channelEdgeClearance: this.nonNegativeNumber(record["channelEdgeClearance"] ?? record["border"] ?? record["borderLeft"], 100),
      channelWidth: this.positiveNumber(record["channelWidth"], diameter + 200),
      spacingMode: normalizePearlingSpacingMode(record["spacingMode"]),
      pitch: this.optionalPositiveNumber(record["pitch"]),
      beadCount: this.optionalPositiveInteger(record["beadCount"]),
    };
  }

  private resolveSizeId(value: number, ruleKey: "gapPearling" | "stepPearling"): number {
    const sizes = this.getSizes();
    const allowed = this.normalizeNumberList(this.getRule(ruleKey)?.allowedSizes);
    const validIds = sizes.map(size => size.id).filter(id => allowed.length === 0 || allowed.includes(id));
    return validIds.includes(value) ? value : validIds[0] ?? 500;
  }

  private getRequiredChannelWidth(size: PearlingSizeDefinition): number {
    const diameter = this.positiveNumber(size.diameter, size.id);
    const edgeClearance = this.nonNegativeNumber(size.channelEdgeClearance, 0);
    const configured = this.positiveNumber(size.channelWidth, 0);
    return Math.max(configured, diameter + 2 * edgeClearance);
  }

  private getRule(key: "gapPearling" | "stepPearling"): PearlingRule | null {
    const featureRules = (AppComponent.app.data as unknown as JsonRecord)["featureRules"];
    if (!featureRules || typeof featureRules !== "object" || Array.isArray(featureRules)) {
      return null;
    }
    const rule = (featureRules as JsonRecord)[key];
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      return null;
    }
    return rule as PearlingRule;
  }

  private isRuleEnabled(key: "gapPearling" | "stepPearling"): boolean {
    const rule = this.getRule(key);
    return !!rule && rule.enabled !== false;
  }

  private createChannelContext(request: PearlingChannelRequest): PearlingChannelContext | null {
    const profile = this.ring.profile.frontVertices;
    if (profile.length < 2) {
      return null;
    }

    const size = this.getSize(request.sizeId);
    if (!size) {
      return null;
    }

    const data = this.ring.ringData;
    const beadDiameter = this.positiveNumber(size.diameter, size.id);
    const beadRadius = beadDiameter / 2;
    const rowClearance = this.nonNegativeNumber(size.rowClearance, Math.max(50, beadDiameter * 0.1));
    const minRowClearance = this.optionalNonNegativeNumber(size.minRowClearance);
    const maxRowClearance = this.optionalNonNegativeNumber(size.maxRowClearance);
    const channelEdgeClearance = this.nonNegativeNumber(size.channelEdgeClearance, 100);
    const requiredChannelWidth = this.getRequiredChannelWidth(size);
    const channelWidth = this.positiveNumber(request.channelWidth, 0);
    const channelDepth = request.type === "gap"
      ? this.resolveGapDepth(channelWidth)
      : this.resolveStepDepth();
    const floor = this.resolveChannelFloor(request, channelDepth, profile);
    const rowRadius = Math.max(1, data.ringSize / Math.PI / 2 - floor.floorZ);

    let disabledReason: string | undefined;
    if (channelWidth < requiredChannelWidth) {
      disabledReason = "channelWidth < requiredChannelWidth";
    } else if (!Number.isFinite(channelDepth) || channelDepth <= 0) {
      disabledReason = "channelDepth invalid";
    } else if (channelDepth < beadRadius) {
      disabledReason = "channelDepth < beadRadius";
    } else if (!Number.isFinite(floor.floorZ) || !Number.isFinite(floor.surfaceZ)) {
      disabledReason = "channel floor invalid";
    } else if (rowRadius <= 1) {
      disabledReason = "rowRadius invalid";
    }

    return {
      type: request.type,
      side: request.side,
      xCenter: request.xCenter,
      channelWidth,
      channelDepth,
      surfaceZ: floor.surfaceZ,
      floorZ: floor.floorZ,
      beadDiameter,
      beadRadius,
      channelEdgeClearance,
      rowClearance,
      minRowClearance,
      maxRowClearance,
      spacingMode: size.spacingMode,
      pitch: size.pitch,
      requestedBeadCount: size.beadCount,
      requiredChannelWidth,
      visibleCenterZ: floor.floorZ,
      rowRadius,
      sizeId: size.id,
      beadCount: 0,
      disabledReason,
    };
  }

  private resolveChannelFloor(
    request: PearlingChannelRequest,
    channelDepth: number,
    profile: CVertex[],
  ): {surfaceZ: number; floorZ: number} {
    const interpolated = this.interpolateProfile(request.xCenter, profile);
    if (request.type === "step") {
      return {
        surfaceZ: interpolated.z - channelDepth,
        floorZ: interpolated.z,
      };
    }

    return {
      surfaceZ: interpolated.z,
      floorZ: interpolated.z + channelDepth,
    };
  }

  private resolveGapDepth(channelWidth: number): number {
    const data = this.ring.ringData;
    let rawDepth = Number(data.gapDepth);
    if (!Number.isFinite(rawDepth) || rawDepth <= 0) {
      const gapMode = AppComponent.app.data.gapMode.find(item => item.id === data.gapMode);
      rawDepth = Number(gapMode?.depth);
    }

    if (!Number.isFinite(rawDepth) || rawDepth <= 0) {
      return 0;
    }

    return rawDepth <= 1.0 ? channelWidth * rawDepth : rawDepth;
  }

  private resolveStepDepth(): number {
    const data = this.ring.ringData;
    const direct = Number(data.stepDepth);
    if (Number.isFinite(direct) && direct > 0) {
      return direct;
    }

    const profile = AppComponent.app.data.profile.find(item => item.name === data.profileName);
    const profileDepth = Number(profile?.sd);
    if (Number.isFinite(profileDepth) && profileDepth > 0) {
      return profileDepth;
    }

    const configured = AppComponent.app.data.stepDepthOptions?.find(value => Number(value) > 0);
    return Number(configured) || 300;
  }

  private shouldApplyStoneExclusions(context: PearlingChannelContext): boolean {
    return context.type === "gap";
  }

  private createSpacingPlan(context: PearlingChannelContext, circumference: number): PearlingSpacingPlan {
    const diameter = context.beadDiameter;
    const requestedGap = this.nonNegativeNumber(context.rowClearance, Math.max(50, diameter * 0.1));
    const minGap = this.nonNegativeNumber(context.minRowClearance, Math.max(0, requestedGap));
    const maxGap = this.nonNegativeNumber(context.maxRowClearance, Math.max(minGap, requestedGap));
    const availableLength = Math.max(0, circumference - context.channelEdgeClearance * 2);
    const base = {
      availableLength,
      circumference,
      requestedBeadCount: context.requestedBeadCount,
    };

    if (availableLength < diameter) {
      return {...base, beadCount: 0, startArc: 0, pitch: diameter + requestedGap, actualGap: requestedGap, disabledReason: "availableLength < beadDiameter"};
    }

    switch (context.spacingMode) {
      case "fixed-gap":
        return this.createFixedGapSpacingPlan(context, availableLength, circumference, requestedGap);
      case "stretch-gap":
        return this.createStretchGapSpacingPlan(context, availableLength, circumference, requestedGap, minGap, maxGap);
      case "exact-pitch":
        return this.createExactPitchSpacingPlan(context, availableLength, circumference, requestedGap);
      case "max-count":
        return this.createMaxCountSpacingPlan(context, availableLength, circumference, minGap);
      case "fixed-count":
        return this.createFixedCountSpacingPlan(context, availableLength, circumference, minGap);
      case "auto-fit":
      default:
        return this.createAutoFitSpacingPlan(context, availableLength, circumference, requestedGap);
    }
  }

  private createAutoFitSpacingPlan(
    context: PearlingChannelContext,
    availableLength: number,
    circumference: number,
    gap: number,
  ): PearlingSpacingPlan {
    const pitch = context.beadDiameter + gap;
    const beadCount = this.clampBeadCount(Math.floor((availableLength + gap) / pitch));
    if (beadCount < 1) {
      return {beadCount: 0, startArc: 0, pitch, actualGap: gap, availableLength, circumference, disabledReason: "beadCount < 1"};
    }

    const usedLength = beadCount * context.beadDiameter + Math.max(0, beadCount - 1) * gap;
    const leftover = Math.max(0, availableLength - usedLength);
    return {
      beadCount,
      startArc: context.channelEdgeClearance + leftover / 2 + context.beadRadius,
      pitch,
      actualGap: gap,
      availableLength,
      circumference,
    };
  }

  private createFixedGapSpacingPlan(
    context: PearlingChannelContext,
    availableLength: number,
    circumference: number,
    gap: number,
  ): PearlingSpacingPlan {
    const pitch = context.beadDiameter + gap;
    const beadCount = this.clampBeadCount(Math.floor((availableLength + gap) / pitch));
    if (beadCount < 1) {
      return {beadCount: 0, startArc: 0, pitch, actualGap: gap, availableLength, circumference, disabledReason: "beadCount < 1"};
    }

    return {
      beadCount,
      startArc: context.channelEdgeClearance + context.beadRadius,
      pitch,
      actualGap: gap,
      availableLength,
      circumference,
    };
  }

  private createStretchGapSpacingPlan(
    context: PearlingChannelContext,
    availableLength: number,
    circumference: number,
    requestedGap: number,
    minGap: number,
    maxGap: number,
  ): PearlingSpacingPlan {
    const desiredPitch = context.beadDiameter + requestedGap;
    const requestedBeadCount = this.clampBeadCount(Math.max(1, Math.round(availableLength / desiredPitch)));

    for (let beadCount = requestedBeadCount; beadCount >= 1; beadCount--) {
      const actualGap = (availableLength - beadCount * context.beadDiameter) / beadCount;
      if (actualGap >= minGap && actualGap <= maxGap) {
        return {
          beadCount,
          startArc: context.channelEdgeClearance + actualGap / 2 + context.beadRadius,
          pitch: context.beadDiameter + actualGap,
          actualGap,
          availableLength,
          circumference,
          requestedBeadCount,
        };
      }
    }

    for (let beadCount = requestedBeadCount + 1; beadCount <= 720; beadCount++) {
      const actualGap = (availableLength - beadCount * context.beadDiameter) / beadCount;
      if (actualGap < minGap) {
        break;
      }
      if (actualGap <= maxGap) {
        return {
          beadCount,
          startArc: context.channelEdgeClearance + actualGap / 2 + context.beadRadius,
          pitch: context.beadDiameter + actualGap,
          actualGap,
          availableLength,
          circumference,
          requestedBeadCount,
        };
      }
    }

    const fallback = this.createAutoFitSpacingPlan(context, availableLength, circumference, requestedGap);
    return {...fallback, requestedBeadCount, disabledReason: fallback.disabledReason};
  }

  private createExactPitchSpacingPlan(
    context: PearlingChannelContext,
    availableLength: number,
    circumference: number,
    fallbackGap: number,
  ): PearlingSpacingPlan {
    const pitch = this.positiveNumber(context.pitch, context.beadDiameter + fallbackGap);
    const actualGap = pitch - context.beadDiameter;
    if (actualGap < 0) {
      return {beadCount: 0, startArc: 0, pitch, actualGap, availableLength, circumference, disabledReason: "pitch < beadDiameter"};
    }

    const beadCount = this.clampBeadCount(Math.floor((availableLength + actualGap) / pitch));
    if (beadCount < 1) {
      return {beadCount: 0, startArc: 0, pitch, actualGap, availableLength, circumference, disabledReason: "beadCount < 1"};
    }

    const usedLength = beadCount * context.beadDiameter + Math.max(0, beadCount - 1) * actualGap;
    const leftover = Math.max(0, availableLength - usedLength);
    return {
      beadCount,
      startArc: context.channelEdgeClearance + leftover / 2 + context.beadRadius,
      pitch,
      actualGap,
      availableLength,
      circumference,
    };
  }

  private createMaxCountSpacingPlan(
    context: PearlingChannelContext,
    availableLength: number,
    circumference: number,
    minGap: number,
  ): PearlingSpacingPlan {
    const beadCount = this.clampBeadCount(Math.floor(availableLength / (context.beadDiameter + minGap)));
    if (beadCount < 1) {
      return {beadCount: 0, startArc: 0, pitch: context.beadDiameter + minGap, actualGap: minGap, availableLength, circumference, disabledReason: "beadCount < 1"};
    }

    const actualGap = Math.max(minGap, (availableLength - beadCount * context.beadDiameter) / beadCount);
    return {
      beadCount,
      startArc: context.channelEdgeClearance + actualGap / 2 + context.beadRadius,
      pitch: context.beadDiameter + actualGap,
      actualGap,
      availableLength,
      circumference,
    };
  }

  private createFixedCountSpacingPlan(
    context: PearlingChannelContext,
    availableLength: number,
    circumference: number,
    minGap: number,
  ): PearlingSpacingPlan {
    const requestedBeadCount = this.clampBeadCount(context.requestedBeadCount ?? 0);
    if (requestedBeadCount < 1) {
      return {...this.createAutoFitSpacingPlan(context, availableLength, circumference, context.rowClearance), requestedBeadCount, disabledReason: "fixed-count beadCount invalid"};
    }

    let beadCount = requestedBeadCount;
    while (beadCount > 0 && (availableLength - beadCount * context.beadDiameter) / beadCount < minGap) {
      beadCount--;
    }

    if (beadCount < 1) {
      return {beadCount: 0, startArc: 0, pitch: context.beadDiameter + minGap, actualGap: minGap, availableLength, circumference, requestedBeadCount, disabledReason: "fixed-count too tight"};
    }

    const actualGap = (availableLength - beadCount * context.beadDiameter) / beadCount;
    return {
      beadCount,
      startArc: context.channelEdgeClearance + actualGap / 2 + context.beadRadius,
      pitch: context.beadDiameter + actualGap,
      actualGap,
      availableLength,
      circumference,
      requestedBeadCount,
    };
  }

  private clampBeadCount(value: number): number {
    return Math.max(0, Math.min(720, Math.floor(value)));
  }

  private interpolateProfile(x: number, vertices: CVertex[]): CVertex {
    let indexA = 0;
    for (let index = 0; index < vertices.length; index++) {
      if (vertices[index].x > x) {
        break;
      }
      indexA = index;
    }

    const indexB = indexA >= vertices.length - 1 ? indexA : indexA + 1;
    if (indexA === indexB) {
      return new CVertex(x, 0, vertices[indexA].z);
    }

    const a = vertices[indexA];
    const b = vertices[indexB];
    const range = b.x - a.x;
    const amount = range === 0 ? 0 : (x - a.x) / range;
    const result = new CVertex();
    a.lerpToRef(b, amount, result);
    return result;
  }

  private createMaterial(): PBRMaterial | null {
    const scene = WebglComponent.WEBGL?.scene;
    if (!scene) {
      return null;
    }

    const material = new PBRMaterial(`pearling_material_r${this.ring.ringData.index}`, scene);
    const materialId = this.ring.ringData.material[0] ?? 0;
    const materialData = AppComponent.app.data.material.find(item => item.id === materialId);

    material.albedoColor = this.parseColor(materialData?.color3d ?? materialData?.colorHtml);
    material.metallic = 0.9;
    material.roughness = 0.24;
    material.metallicF0Factor = 0.0;
    material.backFaceCulling = true;
    material.reflectionTexture = WebglComponent.WEBGL?.envTexture ?? null;
    this.material = material;
    return material;
  }

  private parseColor(value: string | undefined): Color3 {
    if (!value) {
      return new Color3(1.0, 0.72, 0.32);
    }

    try {
      return Color3.FromHexString(value);
    } catch {
      return new Color3(1.0, 0.72, 0.32);
    }
  }

  private debug(contexts: PearlingChannelContext[]): void {
    if (!this.isDebugEnabled()) {
      return;
    }

    const key = [
      this.ring.ringData.index,
      this.stats.rowCount,
      this.stats.beadCount,
      contexts.map(context => `${context.type}:${context.side ?? ""}:${context.xCenter}:${context.sizeId}:${context.spacingMode}:${context.pitch ?? ""}:${context.actualGap ?? ""}:${context.disabledReason ?? ""}:${context.beadCount}`).join("|"),
    ].join(":");

    if (key === this.debugLoggedKey) {
      return;
    }

    this.debugLoggedKey = key;
    contexts.forEach(context => {
      console.info("[PearlingChannel]", {
        type: context.type,
        side: context.side,
        xCenter: context.xCenter,
        channelWidth: context.channelWidth,
        channelDepth: context.channelDepth,
        surfaceZ: context.surfaceZ,
        floorZ: context.floorZ,
        beadDiameter: context.beadDiameter,
        diameter: context.beadDiameter,
        beadRadius: context.beadRadius,
        sizeId: context.sizeId,
        spacingMode: context.spacingMode,
        channelEdgeClearance: context.channelEdgeClearance,
        rowClearance: context.rowClearance,
        minRowClearance: context.minRowClearance,
        maxRowClearance: context.maxRowClearance,
        pitch: context.pitch,
        requestedBeadCount: context.requestedBeadCount,
        actualBeadCount: context.beadCount,
        actualGap: context.actualGap,
        availableLength: context.availableLength,
        circumference: context.circumference,
        requiredChannelWidth: context.requiredChannelWidth,
        visibleCenterZ: context.visibleCenterZ,
        rowRadius: context.rowRadius,
        beadCount: context.beadCount,
        disabledReason: context.disabledReason,
        stoneExclusionsApplied: this.shouldApplyStoneExclusions(context),
        fullRing: !this.shouldApplyStoneExclusions(context),
      });
    });
  }

  private debugPearlingUnavailable(disabledReason: string): void {
    if (!this.isDebugEnabled()) {
      return;
    }

    const key = `${this.ring.ringData.index}:unavailable:${disabledReason}`;
    if (key === this.debugLoggedKey) {
      return;
    }

    this.debugLoggedKey = key;
    console.info("[PearlingChannel]", {
      ringId: this.ring.ringData.index,
      pearlingAvailable: false,
      disabledReason,
    });
  }

  private getStoneExclusions(rowRadius: number, beadRadius: number, type: "gap" | "step"): PearlingStoneExclusion[] {
    if (type !== "gap") {
      return [];
    }

    const rowRadiusMm = Math.max(0.001, rowRadius / 1000);
    const beadRadiusMm = Math.max(0.001, beadRadius / 1000);
    const paths = this.ring.profile.stonePaths ?? [];
    const rule = this.getRule(type === "gap" ? "gapPearling" : "stepPearling");
    const configuredStoneDistance = this.nonNegativeNumber(rule?.minDistanceToStone, beadRadius);
    const exclusions: PearlingStoneExclusion[] = [];

    paths.forEach((path, pathIndex) => {
      const stoneSizeMm = this.getStoneSizeMm(pathIndex);
      const halfArcMm = stoneSizeMm / 2 + beadRadiusMm + configuredStoneDistance / 1000;
      const halfAngle = Math.min(Math.PI / 2, Math.max(0.02, halfArcMm / rowRadiusMm));

      (path.positions ?? []).forEach(position => {
        exclusions.push({
          angle: this.angleFromPoint(position),
          halfAngle,
        });
      });
    });

    return exclusions;
  }

  private getStoneSizeMm(pathIndex: number): number {
    const stone = this.ring.ringData.stone[pathIndex];
    const size = Number(stone?.size);
    return Number.isFinite(size) && size > 0 ? size / 1000 : 1.5;
  }

  private isInsideStoneExclusion(angle: number, exclusions: PearlingStoneExclusion[]): boolean {
    return exclusions.some(exclusion => this.angularDistance(angle, exclusion.angle) <= exclusion.halfAngle);
  }

  private angleFromPoint(point: CVertex): number {
    return this.normalizeAngle(Math.atan2(point.y, point.z));
  }

  private angularDistance(a: number, b: number): number {
    const diff = Math.abs(this.normalizeAngle(a) - this.normalizeAngle(b));
    return diff > Math.PI ? Math.PI * 2 - diff : diff;
  }

  private normalizeAngle(angle: number): number {
    const full = Math.PI * 2;
    const normalized = angle % full;
    return normalized < 0 ? normalized + full : normalized;
  }

  private isDebugEnabled(): boolean {
    try {
      return Boolean(
        AppComponent.app.state.debug
        || window.location.search.includes("debugPearling=1")
        || window.localStorage.getItem("ringconfPearlingDebug") === "1",
      );
    } catch {
      return false;
    }
  }

  private normalizeNumberList(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(entry => Number(entry)).filter(entry => Number.isFinite(entry));
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const next = Number(value);
    return Number.isFinite(next) && next > 0 ? next : fallback;
  }

  private nonNegativeNumber(value: unknown, fallback: number): number {
    const next = Number(value);
    return Number.isFinite(next) && next >= 0 ? next : fallback;
  }

  private optionalPositiveNumber(value: unknown): number | undefined {
    const next = Number(value);
    return Number.isFinite(next) && next > 0 ? next : undefined;
  }

  private optionalNonNegativeNumber(value: unknown): number | undefined {
    const next = Number(value);
    return Number.isFinite(next) && next >= 0 ? next : undefined;
  }

  private optionalPositiveInteger(value: unknown): number | undefined {
    const next = Math.floor(Number(value));
    return Number.isFinite(next) && next > 0 ? next : undefined;
  }
}
