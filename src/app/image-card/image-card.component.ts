import {Component, Input, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";

@Component({
    selector: 'x-image-card',
    templateUrl: './image-card.component.html',
    styleUrls: ['./image-card.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class ImageCardComponent
{
  app=AppComponent.app;
  @Input() title = "Title";
  @Input() image = ""
}
