import {Injectable} from "@angular/core";

export interface AdminCredentials {
  username: string;
  pin: string;
}

export interface AdminSessionInfo {
  authenticated: boolean;
  username: string;
  permissions: readonly string[];
  authenticatedAt: string;
}

export interface AdminAuthenticationResult {
  authenticated?: boolean;
  username?: string;
  permissions?: readonly string[];
  authenticatedAt?: string;
}

interface AdminRequestResult {
  ok: boolean;
  error?: {
    code?: string;
  };
}

const DEFAULT_CHANGE_REASON = "Kalibrierungsansicht aktualisieren";
const AUTH_ERROR_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "USERNAME_REQUIRED",
  "PIN_REQUIRED",
]);

@Injectable({providedIn: "root"})
export class AdminSessionService {
  private credentialsValue: AdminCredentials | null = null;
  private sessionInfoValue: AdminSessionInfo = {
    authenticated: false,
    username: "",
    permissions: [],
    authenticatedAt: "",
  };
  private changeReasonValue = DEFAULT_CHANGE_REASON;
  private generationValue = 0;

  get authenticated(): boolean {
    return this.credentialsValue !== null && this.sessionInfoValue.authenticated;
  }

  get username(): string {
    return this.sessionInfoValue.username;
  }

  get permissions(): readonly string[] {
    return this.sessionInfoValue.permissions;
  }

  get authenticatedAt(): string {
    return this.sessionInfoValue.authenticatedAt;
  }

  get generation(): number {
    return this.generationValue;
  }

  get changeReason(): string {
    return this.changeReasonValue;
  }

  set changeReason(value: string) {
    const trimmed = value.trim();
    this.changeReasonValue = trimmed || DEFAULT_CHANGE_REASON;
  }

  authenticate(credentials: AdminCredentials, result: AdminAuthenticationResult | null = null): void {
    const username = credentials.username.trim();
    const pin = credentials.pin;
    if (username === "" || pin === "") {
      throw new Error("Admin username and PIN are required.");
    }

    this.credentialsValue = {username, pin};
    this.sessionInfoValue = {
      authenticated: result?.authenticated !== false,
      username: result?.username?.trim() || username,
      permissions: Array.isArray(result?.permissions) ? [...result.permissions] : [],
      authenticatedAt: result?.authenticatedAt || new Date().toISOString(),
    };
    this.generationValue++;
  }

  clearCredentials(): void {
    this.credentialsValue = null;
    this.sessionInfoValue = {
      authenticated: false,
      username: "",
      permissions: [],
      authenticatedAt: "",
    };
    this.generationValue++;
  }

  withCredentials(payload: Record<string, unknown>, options: {includeChangeReason?: boolean} = {}): Record<string, unknown> {
    if (!this.credentialsValue) {
      throw new Error("Admin authentication is required.");
    }

    return {
      ...payload,
      username: this.credentialsValue.username,
      pin: this.credentialsValue.pin,
      ...(options.includeChangeReason === true ? {changeReason: this.changeReasonValue} : {}),
    };
  }

  isAuthenticationFailure(response: AdminRequestResult): boolean {
    if (response.ok) {
      return false;
    }
    const code = response.error?.code;
    return typeof code === "string" && AUTH_ERROR_CODES.has(code);
  }
}
