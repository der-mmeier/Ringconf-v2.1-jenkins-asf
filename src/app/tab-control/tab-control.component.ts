import {Component, Input, ViewEncapsulation} from '@angular/core';
import {TabPageComponent} from "../tab-page/tab-page.component";

@Component({
  selector: 'x-tab-control',
  templateUrl: './tab-control.component.html',
  styleUrls: ['./tab-control.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class TabControlComponent
{
  @Input() headerOnly = false;
  pages: TabPageComponent[] = [];

  addPage(page: TabPageComponent)
  {
    if (this.pages.length == 0)
      page.active = true;

    this.pages.push(page);
  }

  selectPage(page: TabPageComponent)
  {
    this.pages.forEach((page) =>
    {
      page.active = false;
    })

    page.active = true;
    page.onSelect.emit();
  }
}
