import {TestBed} from "@angular/core/testing";
import {provideHttpClient} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import {AppDataAdminService} from "./appdata-admin.service";
import {AdminSessionService} from "./admin-session.service";

describe("AppDataAdminService endpoints", () => {
  let service: AppDataAdminService;
  let adminSession: AdminSessionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AppDataAdminService);
    adminSession = TestBed.inject(AdminSessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it("routes AppData actions to the AppData admin endpoint", async () => {
    const request = service.request("bootstrap");
    const req = http.expectOne(request => request.url.endsWith("/appdata-admin.php"));
    expect(req.request.body.action).toBe("bootstrap");
    req.flush({ok: true, action: "bootstrap", requestId: "appdata-request", result: {}});

    const response = await request;
    expect(response.ok).toBeTrue();
    expect(service.lastDebugInfo?.endpoint.endsWith("/appdata-admin.php")).toBeTrue();
  });

  it("routes calibration actions to the dedicated calibration admin endpoint", async () => {
    adminSession.authenticate({username: "editor", pin: "1234"}, {authenticated: true, username: "editor"});
    const request = service.request("calibrationBootstrap");
    const req = http.expectOne(request => request.url.endsWith("/calibration-admin.php"));
    expect(req.request.body.action).toBe("calibrationBootstrap");
    expect(req.request.body.username).toBe("editor");
    expect(req.request.body.pin).toBe("1234");
    expect(req.request.body.changeReason).toBeUndefined();
    req.flush({ok: true, action: "calibrationBootstrap", requestId: "calibration-request", result: {profile: null}});

    const response = await request;
    expect(response.ok).toBeTrue();
    expect(service.lastDebugInfo?.endpoint.endsWith("/calibration-admin.php")).toBeTrue();
    expect(service.getEndpointForDebug("calibrationBootstrap").endsWith("/calibration-admin.php")).toBeTrue();
  });

  it("does not attach existing credentials to calibrationAuthenticate", async () => {
    adminSession.authenticate({username: "editor", pin: "1234"}, {authenticated: true, username: "editor"});
    const request = service.request("calibrationAuthenticate", {username: "next", pin: "9999"});
    const req = http.expectOne(request => request.url.endsWith("/calibration-admin.php"));
    expect(req.request.body.action).toBe("calibrationAuthenticate");
    expect(req.request.body.username).toBe("next");
    expect(req.request.body.pin).toBe("9999");
    req.flush({ok: true, action: "calibrationAuthenticate", requestId: "auth-request", result: {authenticated: true, username: "next"}});

    const response = await request;
    expect(response.ok).toBeTrue();
  });

  it("blocks calibration actions locally when no admin session exists", async () => {
    const response = await service.request("calibrationBootstrap");

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("AUTHENTICATION_REQUIRED");
    http.expectNone(request => request.url.endsWith("/calibration-admin.php"));
  });

  it("normalizes bare HTTP auth failures for reauthentication handling", async () => {
    adminSession.authenticate({username: "editor", pin: "1234"}, {authenticated: true, username: "editor"});
    const request = service.request("calibrationBootstrap");
    const req = http.expectOne(request => request.url.endsWith("/calibration-admin.php"));
    req.flush("Forbidden", {status: 403, statusText: "Forbidden"});

    const response = await request;
    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("FORBIDDEN");
    expect(adminSession.isAuthenticationFailure(response)).toBeTrue();
  });
});
