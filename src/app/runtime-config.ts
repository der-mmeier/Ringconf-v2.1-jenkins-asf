import {environment} from "../environments/environment";

export type RingconfRuntimeContext = "public" | "account" | "order-create" | "account-order-create";

export interface RingconfWordPressRuntimeJson {
  schemaVersion: 1;
  instanceId: string;
  restUrl: string;
  restNonce: string;
  assetBaseUrl: string;
  context: RingconfRuntimeContext;
  woocommerce: {
    enabled: boolean;
    productId: number;
    productSku?: string;
  };
  wcAjaxUrl?: string;
  cartUrl?: string;
  checkoutUrl?: string;
  siteUrl?: string;
  initialPresetId?: string;
  pdfUrl?: string;
  cartAddUrl?: string;
}

export interface RingconfResolvedRuntime {
  assetBaseUrl: string;
  apiUrl: string;
  pdfUrl: string;
  context: RingconfRuntimeContext;
  nonce: string;
  initialPresetId?: string;
}

let resolvedRuntime: RingconfResolvedRuntime | null = null;
let runtimeError: string | null = null;

export function applyRuntimeEnvironment(hostElement?: HTMLElement): RingconfResolvedRuntime | null {
  if (!environment.isWooCommerce) {
    resolvedRuntime = createStandaloneRuntime();
    return resolvedRuntime;
  }

  const runtime = readWordPressRuntimeConfig(hostElement);
  if (!runtime) {
    return null;
  }

  resolvedRuntime = {
    assetBaseUrl: trimTrailingSlash(runtime.assetBaseUrl),
    apiUrl: runtime.restUrl,
    pdfUrl: runtime.pdfUrl || runtime.restUrl,
    context: runtime.context,
    nonce: runtime.restNonce,
    initialPresetId: normalizePresetId(runtime.initialPresetId),
  };

  environment.assetFolderLocation = resolvedRuntime.assetBaseUrl;
  environment.pdfEndpoint = resolvedRuntime.pdfUrl;
  return resolvedRuntime;
}

export function resolveRingconfRuntime(): RingconfResolvedRuntime {
  if (resolvedRuntime) {
    return resolvedRuntime;
  }

  if (environment.isWooCommerce) {
    throw new Error(runtimeError || "[ASF Ringconf] Missing valid WordPress runtime configuration.");
  }

  resolvedRuntime = createStandaloneRuntime();
  return resolvedRuntime;
}

export function getRuntimeNonce(): string {
  if (!environment.isWooCommerce) {
    return "";
  }
  return resolvedRuntime?.nonce || "";
}

function readWordPressRuntimeConfig(hostElement?: HTMLElement): RingconfWordPressRuntimeJson | null {
  try {
    const runtimeElement = resolveRuntimeElement(hostElement);
    if (!runtimeElement) {
      throw new Error("Runtime JSON element was not found.");
    }

    const parsed: unknown = JSON.parse(runtimeElement.textContent || "");
    const runtime = validateRuntimeJson(parsed);
    runtimeError = null;
    return runtime;
  } catch (error) {
    runtimeError = error instanceof Error ? error.message : "Unknown runtime configuration error.";
    reportRuntimeError(hostElement, runtimeError);
    return null;
  }
}

function resolveRuntimeElement(hostElement?: HTMLElement): HTMLScriptElement | null {
  const runtimeId = hostElement?.getAttribute("data-asf-ringconf-runtime-id") || "";
  if (!runtimeId) {
    throw new Error("Angular root has no data-asf-ringconf-runtime-id attribute.");
  }

  const element = document.getElementById(runtimeId);
  if (!(element instanceof HTMLScriptElement) || element.type !== "application/json") {
    throw new Error(`Runtime JSON element "${runtimeId}" is missing or has the wrong type.`);
  }
  return element;
}

function validateRuntimeJson(value: unknown): RingconfWordPressRuntimeJson {
  const object = asRecord(value, "runtime");
  const woocommerce = asRecord(object["woocommerce"], "woocommerce");
  const context = asContext(object["context"]);

  if (object["schemaVersion"] !== 1) {
    throw new Error("Runtime schemaVersion must be 1.");
  }

  const runtime: RingconfWordPressRuntimeJson = {
    schemaVersion: 1,
    instanceId: nonEmptyString(object["instanceId"], "instanceId"),
    restUrl: absoluteUrlString(object["restUrl"], "restUrl"),
    restNonce: nonEmptyString(object["restNonce"], "restNonce"),
    assetBaseUrl: absoluteUrlString(object["assetBaseUrl"], "assetBaseUrl"),
    context,
    woocommerce: {
      enabled: booleanValue(woocommerce["enabled"], "woocommerce.enabled"),
      productId: numberValue(woocommerce["productId"], "woocommerce.productId"),
      productSku: optionalString(woocommerce["productSku"]),
    },
    wcAjaxUrl: optionalString(object["wcAjaxUrl"]),
    cartUrl: optionalString(object["cartUrl"]),
    checkoutUrl: optionalString(object["checkoutUrl"]),
    siteUrl: optionalString(object["siteUrl"]),
    initialPresetId: optionalString(object["initialPresetId"]),
    pdfUrl: optionalUrlString(object["pdfUrl"], "pdfUrl"),
    cartAddUrl: optionalUrlString(object["cartAddUrl"], "cartAddUrl"),
  };

  if (!runtime.woocommerce.enabled) {
    throw new Error("WooCommerce runtime is not enabled.");
  }

  return runtime;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Runtime ${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Runtime ${name} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Runtime ${name} must be a boolean.`);
  }
  return value;
}

function numberValue(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Runtime ${name} must be a non-negative number.`);
  }
  return value;
}

function absoluteUrlString(value: unknown, name: string): string {
  const url = nonEmptyString(value, name);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error(`Runtime ${name} must be an absolute HTTP(S) URL.`);
  }
  return url;
}

function optionalUrlString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return absoluteUrlString(value, name);
}

function asContext(value: unknown): RingconfRuntimeContext {
  if (value === "public" || value === "account" || value === "order-create" || value === "account-order-create") {
    return value;
  }
  throw new Error("Runtime context is invalid.");
}

function reportRuntimeError(hostElement: HTMLElement | undefined, message: string): void {
  const fullMessage = `[ASF Ringconf] ${message}`;
  console.error(fullMessage);

  const container = hostElement?.closest(".asf-ringconf-shell") || hostElement?.parentElement;
  if (!container) {
    return;
  }

  const notice = document.createElement("p");
  notice.className = "asf-ringconf-message";
  notice.textContent = "Der ASF Ringkonfigurator konnte die Laufzeitkonfiguration nicht laden.";
  container.appendChild(notice);
}

function createStandaloneRuntime(): RingconfResolvedRuntime {
  return {
    assetBaseUrl: trimTrailingSlash(environment.assetFolderLocation || "."),
    apiUrl: resolveStandaloneApiUrl(),
    pdfUrl: resolveStandalonePdfUrl(),
    context: "public",
    nonce: "",
  };
}

function resolveStandaloneApiUrl(): string {
  let result = window.location.protocol + "//" + window.location.host + window.location.pathname;
  if (!window.location.pathname.endsWith("/")) {
    result += "/";
  }
  return result + (environment.standaloneApiFile || "");
}

function resolveStandalonePdfUrl(): string {
  const configured = environment.pdfEndpoint;
  if (configured && configured.startsWith("http")) {
    return configured;
  }
  if (configured) {
    return window.location.origin + configured;
  }
  return window.location.origin + "/3d-konfigurator/pdf/create.php";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizePresetId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}(?:-\d+)?$/.test(normalized) ? normalized : undefined;
}
