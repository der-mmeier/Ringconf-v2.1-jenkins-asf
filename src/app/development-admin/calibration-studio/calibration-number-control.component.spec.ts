import {ComponentFixture, TestBed} from "@angular/core/testing";
import {CalibrationNumberControlComponent} from "./calibration-number-control.component";

describe("CalibrationNumberControlComponent", () => {
  let fixture: ComponentFixture<CalibrationNumberControlComponent>;
  let component: CalibrationNumberControlComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalibrationNumberControlComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalibrationNumberControlComponent);
    component = fixture.componentInstance;
    component.label = "Position X";
    component.help = "Hilfetext fuer Position X.";
    component.unit = "mm";
    component.value = 12;
    component.min = -50;
    component.max = 50;
    component.step = 0.5;
    fixture.detectChanges();
  });

  it("renders a vertical number and slider control", () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector(".control-header label")?.textContent?.trim()).toBe("Position X");
    expect(host.querySelector(".unit")?.textContent?.trim()).toBe("mm");
    expect(host.querySelector("button.help")?.getAttribute("title")).toBe("Hilfetext fuer Position X.");
    expect(host.querySelectorAll("input[type='number']").length).toBe(1);
    expect(host.querySelectorAll("input[type='range']").length).toBe(1);
  });

  it("emits finite numeric values from both controls", () => {
    const emitted: number[] = [];
    component.valueChange.subscribe(value => emitted.push(value));

    component.update("14.5");
    component.update("not-a-number");
    component.update(15);

    expect(emitted).toEqual([14.5, 15]);
  });
});
