import {Component, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";
import {RingData} from "../app.ringdata";
import {environment} from "../../environments/environment";

@Component({
  selector: 'x-ring-details',
  templateUrl: './ring-details.component.html',
  styleUrls: ['./ring-details.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class RingDetailsComponent
{
  app = AppComponent.app;
  ringData = RingData.list;
  detailMode = 0;
  env = environment;

  getPrice(index: number)
  {
    return this.ringData[index].price;
  }
}
