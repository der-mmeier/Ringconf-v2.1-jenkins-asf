import {Component, EventEmitter, Input, Output, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'x-textbox',
  templateUrl: './textbox.component.html',
  styleUrls: ['./textbox.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TextboxComponent
{
  @Input() maxlength: number=999;
  @Input() autocomplete: string = "off";
  @Input() spellcheck: string = "false";
  @Input() class: string = "";
  @Input() infotext: string = "";
  @Input() value: string = "";
  @Output() onChange = new EventEmitter<any>();
  @Input() onInfotextFormat: Function | null = null;

  _onChange(value: any)
  {
    this.value=value;
    if (this.onInfotextFormat)
      this.infotext = this.onInfotextFormat(value);

    this.onChange.emit(value);
  }

  getValue():string {
    return this.value;
  }
}
