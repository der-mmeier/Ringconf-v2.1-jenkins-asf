import {TextboxComponent} from "./textbox.component";

describe("TextboxComponent infotext", () => {
  it("stores and emits input values without calculating parent-owned infotext", () => {
    const component = new TextboxComponent();
    const emitted: string[] = [];
    component.onChange.subscribe(value => emitted.push(value));
    component.infotext = "noch 4 Zeichen möglich";

    component._onChange("Anna");

    expect(component.value).toBe("Anna");
    expect(component.infotext).toBe("noch 4 Zeichen möglich");
    expect(emitted).toEqual(["Anna"]);
  });

  it("keeps repeated change-detection-style reads callback-free", () => {
    const component = new TextboxComponent();
    component.infotext = "noch 7 Zeichen möglich";

    expect(component.infotext).toBe("noch 7 Zeichen möglich");
    expect(component.infotext).toBe("noch 7 Zeichen möglich");
    expect(component.getValue()).toBe("");
  });
});
