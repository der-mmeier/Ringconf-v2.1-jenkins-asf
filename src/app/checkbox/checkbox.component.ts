import {Component, EventEmitter, HostBinding, Input, Output, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'x-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class CheckboxComponent
{
  @Input() class = "";
  @Input() checked = false;
  @Output() onCheck = new EventEmitter<any>();

  @HostBinding('class.checked') cl = this.checked;
}
