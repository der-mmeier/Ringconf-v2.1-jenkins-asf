import {CommonModule} from "@angular/common";
import {Component, EventEmitter, Input, Output} from "@angular/core";

let nextControlId = 0;

@Component({
  selector: "x-calibration-number-control",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./calibration-number-control.component.html",
  styleUrls: ["./calibration-number-control.component.scss"],
})
export class CalibrationNumberControlComponent {
  @Input({required: true}) label = "";
  @Input() help = "";
  @Input() unit = "";
  @Input() value = 0;
  @Input() min = -100;
  @Input() max = 100;
  @Input() step = 1;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<number>();

  readonly inputId = `calibration-number-control-${++nextControlId}`;

  update(value: unknown): void {
    const next = Number(value);
    if (!Number.isFinite(next)) {
      return;
    }
    this.valueChange.emit(next);
  }
}
