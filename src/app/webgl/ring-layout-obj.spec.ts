import {parseObjMarkerLayout} from "./ring-layout-obj";

const VALID_OBJ = `
o RCFG_RING0_ORIGIN
v 0 0 0
v 0.1 0 0
o RCFG_RING0_X
v 2 0 0
v 2.1 0 0
o RCFG_RING0_Y
v 0 2 0
v 0.1 2 0
o RCFG_RING0_Z
v 0 0 2
v 0.1 0 2
`;

describe("parseObjMarkerLayout", () => {
  it("parses a complete ring0 marker set", () => {
    const result = parseObjMarkerLayout(VALID_OBJ, 2);
    expect(result.ok).toBeTrue();
    expect(result.layout?.ring0?.position[0]).toBeCloseTo(0.1);
    expect(result.layout?.ring0?.rotationQuaternion.length).toBe(4);
  });

  it("rejects missing markers", () => {
    const result = parseObjMarkerLayout(`
o RCFG_RING0_ORIGIN
v 0 0 0
o RCFG_RING0_X
v 1 0 0
`, 1);
    expect(result.ok).toBeFalse();
    expect(result.errors.join(" ")).toContain("RCFG_RING0_Y");
  });

  it("rejects collinear axes", () => {
    const result = parseObjMarkerLayout(`
o RCFG_RING0_ORIGIN
v 0 0 0
o RCFG_RING0_X
v 1 0 0
o RCFG_RING0_Y
v 2 0 0
o RCFG_RING0_Z
v 0 0 1
`, 1);
    expect(result.ok).toBeFalse();
    expect(result.errors.join(" ")).toContain("kollinear");
  });

  it("rejects wrong handedness", () => {
    const result = parseObjMarkerLayout(`
o RCFG_RING0_ORIGIN
v 0 0 0
o RCFG_RING0_X
v 1 0 0
o RCFG_RING0_Y
v 0 1 0
o RCFG_RING0_Z
v 0 0 -1
`, 1);
    expect(result.ok).toBeFalse();
    expect(result.errors.join(" ")).toContain("Händigkeit");
  });

  it("normalizes quaternion and applies position scale", () => {
    const result = parseObjMarkerLayout(VALID_OBJ, 3);
    const transform = result.layout!.ring0!;
    const q = transform.rotationQuaternion;
    expect(transform.position[0]).toBeCloseTo(0.15);
    expect(Math.hypot(q[0], q[1], q[2], q[3])).toBeCloseTo(1);
  });
});
