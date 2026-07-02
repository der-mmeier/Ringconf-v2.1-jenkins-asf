import {Component, EventEmitter, HostBinding, Input, Output, ViewEncapsulation} from '@angular/core';
import {TabControlComponent} from "../tab-control/tab-control.component";

@Component({
  selector: 'x-tab-page',
  templateUrl: './tab-page.component.html',
  encapsulation: ViewEncapsulation.None
})

export class TabPageComponent
{
  @Input() title: string = "tab-page";
  @Input() class: string = "";
  @Output() onSelect = new EventEmitter<any>();
  // @Input() active: boolean = false;
  // @Input() enabled: boolean = true;

  @HostBinding('class.active') @Input() active = false;
  @HostBinding('class.enabled') @Input() enabled = true;

  constructor(tabControl: TabControlComponent)
  {
    tabControl.addPage(this);
  }
}
