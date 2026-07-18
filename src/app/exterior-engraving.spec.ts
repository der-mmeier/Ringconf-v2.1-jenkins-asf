import {iAppData, iEngravingOffer} from "./app.interfaces";
import {
  getEngravingOffer,
  getEngravingOfferPrice,
  isEngravingOfferVisible,
  normalizeEngravingAppData
} from "./exterior-engraving";

function appDataWithEngraving(engraving: unknown): iAppData {
  return {engraving} as unknown as iAppData;
}

describe("engraving AppData normalization", () => {
  it("keeps legacy engraving snapshots without exterior offers usable", () => {
    const data = normalizeEngravingAppData(appDataWithEngraving({
      maxLength: 30,
      symbols: [],
      color: "#333333",
      alpha: 0.6,
    }));

    expect(isEngravingOfferVisible(data, "inner-text")).toBeTrue();
    expect(isEngravingOfferVisible(data, "exterior-text")).toBeTrue();
    expect(data.engraving.exterior?.offers?.length).toBe(5);
  });

  it("normalizes string prices and preserves unknown exterior fields", () => {
    const data = normalizeEngravingAppData(appDataWithEngraving({
      maxLength: "28",
      symbols: [],
      color: "#111111",
      exterior: {
        customContractField: "preserved",
        offers: [
          {id: "inner-text", enabled: "true", price: "12,50"},
          {id: "exterior-text", enabled: "1", price: "49.5"},
        ],
      },
    }));

    expect(data.engraving.maxLength).toBe(28);
    expect((data.engraving.exterior as unknown as Record<string, unknown>)["customContractField"]).toBe("preserved");
    expect(getEngravingOfferPrice(data, "inner-text")).toBe(12.5);
    expect(getEngravingOfferPrice(data, "exterior-text")).toBe(49.5);
  });

  it("hides only the option with price zero", () => {
    const data = normalizeEngravingAppData(appDataWithEngraving({
      offers: [
        {id: "inner-text", price: 0},
        {id: "exterior-text", price: 49},
      ],
    }));

    expect(isEngravingOfferVisible(data, "inner-text")).toBeFalse();
    expect(isEngravingOfferVisible(data, "exterior-text")).toBeTrue();
  });

  it("supports only inner engraving without hiding it because exterior is unavailable", () => {
    const exteriorIds: iEngravingOffer["id"][] = [
      "exterior-text",
      "exterior-coordinates",
      "exterior-waveform",
      "exterior-fingerprint",
    ];
    const data = normalizeEngravingAppData(appDataWithEngraving({
      exterior: {
        offers: [
          {id: "inner-text", enabled: true, price: 29},
          ...exteriorIds.map(id => ({id, enabled: false, price: 49})),
        ],
      },
    }));

    expect(isEngravingOfferVisible(data, "inner-text")).toBeTrue();
    exteriorIds.forEach(id => expect(isEngravingOfferVisible(data, id)).toBeFalse());
  });

  it("supports only exterior engraving without requiring inner engraving", () => {
    const data = normalizeEngravingAppData(appDataWithEngraving({
      exterior: {
        offers: [
          {id: "inner-text", enabled: false, price: 29},
          {id: "exterior-text", enabled: true, price: 49},
          {id: "exterior-coordinates", enabled: false, price: 59},
          {id: "exterior-waveform", enabled: false, price: 69},
          {id: "exterior-fingerprint", enabled: false, price: 69},
        ],
      },
    }));

    expect(isEngravingOfferVisible(data, "inner-text")).toBeFalse();
    expect(isEngravingOfferVisible(data, "exterior-text")).toBeTrue();
  });

  it("treats null prices as unavailable without leaking old normalized offers", () => {
    const enabled = normalizeEngravingAppData(appDataWithEngraving({}));
    expect(isEngravingOfferVisible(enabled, "inner-text")).toBeTrue();

    const disabled = normalizeEngravingAppData(appDataWithEngraving({
      exterior: {
        offers: [
          {id: "inner-text", enabled: false, price: null},
          {id: "exterior-text", enabled: false, price: null},
          {id: "exterior-coordinates", enabled: false, price: null},
          {id: "exterior-waveform", enabled: false, price: null},
          {id: "exterior-fingerprint", enabled: false, price: null},
        ],
      },
    }));

    expect(disabled.engraving.exterior?.offers?.every(offer => !isEngravingOfferVisible(disabled, offer.id))).toBeTrue();
  });

  it("accepts legacy offer ids from partially migrated AppData", () => {
    const data = normalizeEngravingAppData(appDataWithEngraving({
      exterior: {
        offers: [
          {id: "interior-text", price: "31"},
          {id: "outer-text", price: "51"},
        ],
      },
    }));

    expect(getEngravingOffer(data, "inner-text")?.price).toBe(31);
    expect(getEngravingOffer(data, "exterior-text")?.price).toBe(51);
  });
});
