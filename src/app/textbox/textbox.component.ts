import {Component, EventEmitter, Input, Output, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';

@Component({
    selector: 'x-textbox',
    templateUrl: './textbox.component.html',
    styleUrls: ['./textbox.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TextboxComponent
{
  @Input() maxlength: number=999;
  @Input() autocomplete: string = "off";
  @Input() spellcheck: string = "false";
  @Input() class: string = "";
  @Input() infotext: string = "";
  @Input() value: string = "";
  @Output() onChange = new EventEmitter<string>();
  @Output() onFocus = new EventEmitter<HTMLInputElement>();
  @Output() onBlur = new EventEmitter<HTMLInputElement>();
  @Output() onCompositionStart = new EventEmitter<HTMLInputElement>();
  @Output() onCompositionEnd = new EventEmitter<string>();

  _onChange(value: string)
  {
    this.value=value;

    this.onChange.emit(value);
  }

  getValue():string {
    return this.value;
  }
}
