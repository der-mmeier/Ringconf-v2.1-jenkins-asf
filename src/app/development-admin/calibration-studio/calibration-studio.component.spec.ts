import {CALIBRATION_FIELD_DEFINITIONS, getCalibrationFieldDefinition} from "./calibration-field-definitions";
import {easing, normalizeQuaternion} from "./calibration-studio.component";
import {CalibrationStudioComponent} from "./calibration-studio.component";
import {AdminSessionService} from "../admin-session.service";

describe("Calibration Studio 2.0", () => {
  it("has help metadata for every exportable field", () => {
    const exportable = CALIBRATION_FIELD_DEFINITIONS.filter(field => field.exportable);
    expect(exportable.length).toBeGreaterThan(0);
    for (const field of exportable) {
      expect(field.key).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(field.help.length).toBeGreaterThan(20);
      expect(getCalibrationFieldDefinition(field.key)).toBe(field);
    }
  });

  it("keeps ringRotationX out of presentation field metadata", () => {
    expect(CALIBRATION_FIELD_DEFINITIONS.some(field => field.key === "ringRotationX")).toBeFalse();
    expect(CALIBRATION_FIELD_DEFINITIONS.some(field => field.legacyShopwareKey === "ringRotationX")).toBeFalse();
  });

  it("normalizes quaternions deterministically", () => {
    expect(normalizeQuaternion([0, 0, 0, 2])).toEqual([0, 0, 0, 1]);
    expect(normalizeQuaternion([0, 0, 0, 0])).toEqual([0, 0, 0, 1]);
  });

  it("uses deterministic easing functions", () => {
    expect(easing(0, "linear")).toBe(0);
    expect(easing(1, "linear")).toBe(1);
    expect(easing(0.5, "ease-in")).toBeCloseTo(0.25, 6);
    expect(easing(0.5, "ease-out")).toBeCloseTo(0.75, 6);
    expect(easing(0.5, "ease-in-out")).toBeCloseTo(0.5, 6);
    expect(easing(1, "legacy-exponential")).toBeGreaterThan(0.99);
  });

  it("opens the login dialog instead of bootstrapping before authentication", () => {
    const adminApi = fakeAdminApi();
    const component = new CalibrationStudioComponent(adminApi, new AdminSessionService());

    component.toggle();

    expect(component.open).toBeFalse();
    expect(component.loginOpen).toBeTrue();
    expect(adminApi.request).not.toHaveBeenCalled();
  });

  it("authenticates first and then bootstraps exactly once", async () => {
    const adminApi = fakeAdminApi();
    adminApi.request.and.callFake(async (action: string) => {
      if (action === "calibrationAuthenticate") {
        return {ok: true, action, requestId: "auth", data: {authenticated: true, username: "editor"}};
      }
      return {ok: true, action, requestId: "bootstrap", data: {profile: emptyProfile()}};
    });
    const component = new CalibrationStudioComponent(adminApi, new AdminSessionService());
    component.toggle();
    component.loginUsername = "editor";
    component.loginPin = "1234";

    await component.authenticateFromDialog();
    await Promise.resolve();

    expect(component.loginOpen).toBeFalse();
    expect(component.open).toBeTrue();
    expect(adminApi.request.calls.allArgs().map((args: unknown[]) => args[0])).toEqual(["calibrationAuthenticate", "calibrationBootstrap"]);
  });

  it("reopens login on auth failure without retry loops", async () => {
    const session = new AdminSessionService();
    session.authenticate({username: "editor", pin: "old"}, {authenticated: true, username: "editor"});
    const adminApi = fakeAdminApi();
    adminApi.request.and.resolveTo({
      ok: false,
      action: "calibrationBootstrap",
      requestId: "expired",
      error: {code: "INVALID_CREDENTIALS", message: "Login erforderlich."},
    });
    const component = new CalibrationStudioComponent(adminApi, session);

    component.toggle();
    await Promise.resolve();

    expect(component.open).toBeTrue();
    expect(component.loginOpen).toBeTrue();
    expect(session.authenticated).toBeFalse();
    expect(adminApi.request.calls.allArgs().map((args: unknown[]) => args[0])).toEqual(["calibrationBootstrap"]);
  });
});

function fakeAdminApi(): any {
  return {
    request: jasmine.createSpy("request"),
    lastDebugInfo: null,
    getEndpointForDebug: jasmine.createSpy("getEndpointForDebug").and.returnValue("/calibration-admin.php"),
  };
}

function emptyProfile(): any {
  return {
    id: 1,
    schemaVersion: 1,
    profileKey: "test",
    name: "Test",
    status: "active",
    revision: 1,
    isActive: true,
    compositions: [],
  };
}
