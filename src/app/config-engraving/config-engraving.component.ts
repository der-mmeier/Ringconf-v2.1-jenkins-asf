import {Component, ElementRef, Input, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {onRingDataPropertyChange} from "../property-sync-dialog/property-sync-dialog.component";
import {environment} from "../../environments/environment";

@Component({
    selector: 'x-config-engraving',
    templateUrl: './config-engraving.component.html',
    styleUrls: ['./config-engraving.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})

export class ConfigEngravingComponent
{
  @Input() ringId: number = 0;
  app = AppComponent.app;
  ringData = RingData.list;
  env = environment;

  constructor(private elem: ElementRef)
  {
  }

  onEngravingInfoFormat(value: string): string
  {
    let length = AppComponent.app.data.engraving.maxLength - value.length;
    if (length < 0) length = 0;
    return "noch " + length + " Zeichen möglich";
  }

  applyEngravingText()
  {
    let input = <HTMLInputElement>this.elem.nativeElement.querySelector('#engravingText input');

    if (input)
    {
      this.ringData[this.ringId].engraving = input.value;
      onRingDataPropertyChange(this.ringId, "engraving");
    }
  }

  addSymbol(unicode: string)
  {
    let input = <HTMLInputElement>this.elem.nativeElement.querySelector('#engravingText input');

    if (input)
    {
      let caretPos = (input.selectionStart || input.selectionStart == 0) ? input.selectionStart : 0;
      let text = input.value;
      if (text.length >= AppComponent.app.data.engraving.maxLength) return;

      text = text.slice(0, caretPos) + unicode + text.slice(caretPos);
      input.value = text;
      if (input.setSelectionRange)
      {
        input.focus();
        input.setSelectionRange(caretPos + 1, caretPos + 1);
      }
    }
  }

  setFont(value:number)
  {
    //this.ringData[this.ringId].engravingFont=value;
    this.ringData.forEach(f=> {
      f.engravingFont = value;
    })
  }
}
