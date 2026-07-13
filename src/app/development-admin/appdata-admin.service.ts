import {Injectable} from "@angular/core";
import {HttpClient, HttpErrorResponse} from "@angular/common/http";
import {lastValueFrom} from "rxjs";

export type AppDataAdminAction =
  "bootstrap"
  | "listBuilds"
  | "registerBuild"
  | "listVersions"
  | "getVersion"
  | "importCurrentBaseline"
  | "saveVersion"
  | "setCompatibility"
  | "approveVersion"
  | "retireVersion"
  | "listTargets"
  | "assignTarget"
  | "rollbackTarget";

export interface AppDataAdminResponse<T = unknown> {
  ok: boolean;
  action: AppDataAdminAction;
  requestId: string;
  data?: T;
  result?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AppDataAdminDebugInfo {
  action: AppDataAdminAction;
  endpoint: string;
  status: "pending" | "ok" | "error";
  requestId: string;
  payloadSummary: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  versionId?: number;
  baseVersionId?: number;
}

@Injectable({providedIn: "root"})
export class AppDataAdminService {
  private readonly endpoint = this.resolveEndpoint();
  lastDebugInfo: AppDataAdminDebugInfo | null = null;

  constructor(private http: HttpClient)
  {
  }

  async request<T>(action: AppDataAdminAction, payload: Record<string, unknown> = {}): Promise<AppDataAdminResponse<T>>
  {
    const payloadSummary = this.summarizePayload(payload);
    this.lastDebugInfo = {
      action,
      endpoint: this.endpoint,
      status: "pending",
      requestId: "",
      payloadSummary,
      versionId: this.numberOrUndefined(payload["versionId"]),
      baseVersionId: this.numberOrUndefined(payload["baseVersionId"]),
    };
    if (this.debugEnabled()) {
      console.info("[AppDataAdmin] request", action, this.endpoint, payloadSummary);
    }

    try {
      const response = await lastValueFrom(this.http.post<AppDataAdminResponse<T>>(this.endpoint, {
        action,
        ...payload,
      }));

      const normalized = this.normalizeResponse(action, response);
      this.lastDebugInfo = {
        ...this.lastDebugInfo,
        status: normalized.ok ? "ok" : "error",
        requestId: normalized.requestId,
        errorCode: normalized.error?.code,
        errorMessage: normalized.error?.message,
      };
      if (this.debugEnabled()) {
        console.info("[AppDataAdmin] response", action, normalized);
      }
      return normalized;
    } catch (error) {
      const normalized = this.normalizeError<T>(action, error);
      this.lastDebugInfo = {
        ...this.lastDebugInfo,
        status: "error",
        requestId: normalized.requestId,
        errorCode: normalized.error?.code,
        errorMessage: normalized.error?.message,
      };
      if (this.debugEnabled()) {
        console.error("[AppDataAdmin] error", action, normalized);
      }
      return normalized;
    }
  }

  getEndpointForDebug(): string
  {
    return this.endpoint;
  }

  private resolveEndpoint(): string
  {
    const globalEndpoint = (window as unknown as {__ONE_RINGCONF_APPDATA_ADMIN_ENDPOINT?: unknown}).__ONE_RINGCONF_APPDATA_ADMIN_ENDPOINT;
    if (typeof globalEndpoint === "string" && globalEndpoint.trim() !== "") {
      return globalEndpoint.trim();
    }

    try {
      return new URL("appdata-admin.php", document.baseURI || window.location.href).toString();
    } catch {
      return "./appdata-admin.php";
    }
  }

  private normalizeResponse<T>(action: AppDataAdminAction, response: AppDataAdminResponse<T>): AppDataAdminResponse<T>
  {
    return {
      ...response,
      action,
      data: response.data !== undefined ? response.data : response.result,
    };
  }

  private normalizeError<T>(action: AppDataAdminAction, error: unknown): AppDataAdminResponse<T>
  {
    if (error instanceof HttpErrorResponse) {
      const parsed = this.parseErrorBody<T>(error.error);
      if (parsed) {
        return this.normalizeResponse(action, parsed);
      }

      return {
        ok: false,
        action,
        requestId: "",
        error: {
          code: this.statusToCode(error.status),
          message: this.statusToMessage(error),
          details: {
            status: error.status,
            statusText: error.statusText,
            url: error.url || this.endpoint,
            endpoint: this.endpoint,
            body: typeof error.error === "string" ? error.error.slice(0, 1000) : error.error,
          },
        },
      };
    }

    return {
      ok: false,
      action,
      requestId: "",
      error: {
        code: "SERVER_ERROR",
        message: "Die Admin-Anfrage konnte nicht abgeschlossen werden.",
        details: error instanceof Error ? error.message : error,
      },
    };
  }

  private parseErrorBody<T>(body: unknown): AppDataAdminResponse<T> | null
  {
    if (body && typeof body === "object" && "ok" in body) {
      return body as AppDataAdminResponse<T>;
    }

    if (typeof body !== "string" || body.trim() === "") {
      return null;
    }

    try {
      const decoded = JSON.parse(body) as unknown;
      if (decoded && typeof decoded === "object" && "ok" in decoded) {
        return decoded as AppDataAdminResponse<T>;
      }
    } catch {
      return null;
    }

    return null;
  }

  private statusToCode(status: number): string
  {
    if (status === 0) {
      return "NETWORK_ERROR";
    }
    if (status === 404) {
      return "ENDPOINT_NOT_FOUND";
    }
    if (status === 405) {
      return "METHOD_NOT_ALLOWED";
    }
    if (status === 413) {
      return "REQUEST_TOO_LARGE";
    }
    if (status === 429) {
      return "RATE_LIMITED";
    }
    if (status >= 500) {
      return "SERVER_ERROR";
    }
    return "REQUEST_FAILED";
  }

  private statusToMessage(error: HttpErrorResponse): string
  {
    if (error.status === 0) {
      return "Der Admin-Endpunkt konnte nicht erreicht werden. Prüfe Netzwerk, CORS oder die URL.";
    }

    if (error.status === 404) {
      return `Der Admin-Endpunkt wurde nicht gefunden: ${error.url || this.endpoint}`;
    }

    return `Die Admin-Anfrage ist fehlgeschlagen. HTTP ${error.status} ${error.statusText || ""}`.trim();
  }

  private debugEnabled(): boolean
  {
    try {
      return new URL(window.location.href).searchParams.get("debugAdmin") === "1" || window.localStorage.getItem("ringconfAdminDebug") === "1";
    } catch {
      return false;
    }
  }

  private summarizePayload(payload: Record<string, unknown>): Record<string, unknown>
  {
    const summary: Record<string, unknown> = {};
    ["username", "changeReason", "baseVersionId", "baseVersionLabel", "versionId", "targetKey", "status", "note"].forEach(key => {
      if (payload[key] !== undefined) {
        summary[key] = key === "pin" ? "***" : payload[key];
      }
    });
    if (payload["pin"] !== undefined) {
      summary["pin"] = "***";
    }
    const appData = payload["appData"];
    if (appData && typeof appData === "object" && !Array.isArray(appData)) {
      const data = appData as Record<string, unknown>;
      summary["appData"] = {
        profileLength: Array.isArray(data["profile"]) ? data["profile"].length : null,
        pearlingSize: this.collectionSummary(data["pearlingSize"]),
        featureRules: !!data["featureRules"],
      };
    }
    if (payload["build"] && typeof payload["build"] === "object") {
      const build = payload["build"] as Record<string, unknown>;
      summary["build"] = {
        build_key: build["build_key"],
        version_label: build["version_label"],
      };
    }
    return summary;
  }

  private collectionSummary(value: unknown): Record<string, unknown>
  {
    return {
      type: Array.isArray(value) ? "array" : value === undefined ? "missing" : typeof value,
      length: Array.isArray(value) ? value.length : null,
    };
  }

  private numberOrUndefined(value: unknown): number | undefined
  {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
  }
}
