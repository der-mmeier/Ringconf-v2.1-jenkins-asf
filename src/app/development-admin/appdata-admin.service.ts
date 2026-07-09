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

@Injectable({providedIn: "root"})
export class AppDataAdminService {
  private readonly endpoint = this.resolveEndpoint();

  constructor(private http: HttpClient)
  {
  }

  async request<T>(action: AppDataAdminAction, payload: Record<string, unknown> = {}): Promise<AppDataAdminResponse<T>>
  {
    try {
      const response = await lastValueFrom(this.http.post<AppDataAdminResponse<T>>(this.endpoint, {
        action,
        ...payload,
      }));

      return this.normalizeResponse(action, response);
    } catch (error) {
      return this.normalizeError<T>(action, error);
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
}
