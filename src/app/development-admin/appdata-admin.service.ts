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
  private readonly endpoint = "./appdata-admin.php";

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
      if (response.ok && response.data === undefined && response.result !== undefined) {
        response.data = response.result;
      }
      response.action = action;
      return response;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.error && typeof error.error === "object") {
        const response = error.error as AppDataAdminResponse<T>;
        response.action = action;
        return response;
      }

      return {
        ok: false,
        action,
        requestId: "",
        error: {
          code: "SERVER_ERROR",
          message: "Die Admin-Anfrage konnte nicht abgeschlossen werden.",
        },
      };
    }
  }
}
