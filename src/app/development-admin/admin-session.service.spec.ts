import {AdminSessionService} from "./admin-session.service";

describe("AdminSessionService", () => {
  let service: AdminSessionService;

  beforeEach(() => {
    service = new AdminSessionService();
  });

  it("keeps admin credentials only in memory and appends them to calibration payloads", () => {
    service.authenticate({username: " editor ", pin: "1234"}, {
      authenticated: true,
      username: "editor",
      permissions: ["appdata.edit"],
      authenticatedAt: "2026-07-22T00:00:00Z",
    });
    service.changeReason = " Ansichten aktualisieren ";

    const payload = service.withCredentials({viewId: 7}, {includeChangeReason: true});

    expect(service.authenticated).toBeTrue();
    expect(service.username).toBe("editor");
    expect(payload).toEqual({
      viewId: 7,
      username: "editor",
      pin: "1234",
      changeReason: "Ansichten aktualisieren",
    });
  });

  it("clears credentials without persisting PIN state", () => {
    service.authenticate({username: "editor", pin: "1234"}, {authenticated: true, username: "editor"});
    service.clearCredentials();

    expect(service.authenticated).toBeFalse();
    expect(service.username).toBe("");
    expect(() => service.withCredentials({})).toThrowError("Admin authentication is required.");
  });

  it("classifies auth failures without suppressing other errors", () => {
    expect(service.isAuthenticationFailure({ok: false, error: {code: "INVALID_CREDENTIALS"}})).toBeTrue();
    expect(service.isAuthenticationFailure({ok: false, error: {code: "FORBIDDEN"}})).toBeTrue();
    expect(service.isAuthenticationFailure({ok: false, error: {code: "SERVER_ERROR"}})).toBeFalse();
    expect(service.isAuthenticationFailure({ok: true})).toBeFalse();
  });
});
