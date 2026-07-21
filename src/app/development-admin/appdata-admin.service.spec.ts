import {TestBed} from "@angular/core/testing";
import {provideHttpClient} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import {AppDataAdminService} from "./appdata-admin.service";

describe("AppDataAdminService endpoints", () => {
  let service: AppDataAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AppDataAdminService);
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
    const request = service.request("calibrationBootstrap");
    const req = http.expectOne(request => request.url.endsWith("/calibration-admin.php"));
    expect(req.request.body.action).toBe("calibrationBootstrap");
    req.flush({ok: true, action: "calibrationBootstrap", requestId: "calibration-request", result: {profile: null}});

    const response = await request;
    expect(response.ok).toBeTrue();
    expect(service.lastDebugInfo?.endpoint.endsWith("/calibration-admin.php")).toBeTrue();
    expect(service.getEndpointForDebug("calibrationBootstrap").endsWith("/calibration-admin.php")).toBeTrue();
  });
});
