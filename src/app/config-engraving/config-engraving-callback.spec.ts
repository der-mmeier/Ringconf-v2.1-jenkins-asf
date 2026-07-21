import {ElementRef} from "@angular/core";
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {ConfigEngravingComponent, formatRemainingChars} from "./config-engraving.component";

describe("ConfigEngravingComponent engraving infotext", () => {
  beforeEach(() => {
    (AppComponent as unknown as {app: unknown}).app = {
      data: {
        engraving: {
          maxLength: 10,
          exterior: {
            maxTextLength: 12,
          },
        },
      },
    };
    (RingData as unknown as {list: unknown[]}).list = [
      {engraving: "", exteriorEngraving: {text: ""}, isDirty: false},
      {engraving: "", exteriorEngraving: {text: ""}, isDirty: false},
    ];
  });

  it("formats remaining characters without a component callback", () => {
    expect(formatRemainingChars(6)).toBe("noch 6 Zeichen möglich");
    expect(formatRemainingChars(-2)).toBe("noch 0 Zeichen möglich");
  });

  it("returns a ready-to-render infotext string for female and male inner engraving", () => {
    const female = createComponent(0);
    const male = createComponent(1);

    female.setInnerEngravingDraft("Anna");
    male.setInnerEngravingDraft("Max");

    expect(female.getInnerEngravingInfoText()).toBe("noch 6 Zeichen möglich");
    expect(male.getInnerEngravingInfoText()).toBe("noch 7 Zeichen möglich");
  });

  it("handles empty and maximum-length inner engraving text", () => {
    const component = createComponent(0);

    component.setInnerEngravingDraft("");
    expect(component.getInnerEngravingInfoText()).toBe("noch 10 Zeichen möglich");

    component.setInnerEngravingDraft("1234567890");
    expect(component.getInnerEngravingInfoText()).toBe("noch 0 Zeichen möglich");

    component.setInnerEngravingDraft("12345678901");
    expect(component.getInnerEngravingDraft()).toBe("1234567890");
    expect(component.getInnerEngravingInfoText()).toBe("noch 0 Zeichen möglich");
  });

  it("survives repeated change-detection-style reads without a callback exception", () => {
    const component = createComponent(0);
    component.setInnerEngravingDraft("abc");

    expect(component.getInnerEngravingInfoText()).toBe("noch 7 Zeichen möglich");
    expect(component.getInnerEngravingInfoText()).toBe("noch 7 Zeichen möglich");
    expect(component.getInnerEngravingInfoText()).toBe("noch 7 Zeichen möglich");
  });

  it("keeps exterior engraving remaining-character calculation independent of inner textbox state", () => {
    const component = createComponent(0);
    component.exteriorTextDraft[0] = "Aussen";

    expect(component.getExteriorRemainingChars()).toBe(6);
  });
});

function createComponent(ringId: number): ConfigEngravingComponent {
  const component = new ConfigEngravingComponent(new ElementRef(document.createElement("div")));
  component.ringId = ringId;
  return component;
}
