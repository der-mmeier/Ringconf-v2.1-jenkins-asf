import {Component, EventEmitter, Input, Output, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';

@Component({
    selector: 'x-dropdown',
    templateUrl: './dropdown.component.html',
    styleUrls: ['./dropdown.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DropdownComponent
{
  @Input() title = "Titel";
  @Input() options:any[] = [];
  @Input() value:any=undefined;
  @Output() onSelect = new EventEmitter<any>();
  @Input() onValueFormat:Function|null = null;
  @Input() onValueHidden:Function|null = null;
  @Input() onOptionsCallback:Function|null = null;
  @Input() that:any;
  open=false;

  select(option:any) {
    this.value=option;
    if (this.onSelect)
      this.onSelect.emit(option);
    this.open=false;
  }
  trackByFn(index: number, item: any) {
    return index;
  }
  toggleDropdown() {
    if (!this.open) {
      if (this.onOptionsCallback) {
        this.options = this.onOptionsCallback();
      }
    }
    this.open = !this.open;
  }
}
