import {Component, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";

@Component({
    selector: 'x-logger',
    templateUrl: './logger.component.html',
    styleUrls: ['./logger.component.scss'],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})

export class LoggerComponent
{
  static that: LoggerComponent;

  data = [] as iLog[];
  header:string|undefined=undefined;

  constructor()
  {
    if (!LoggerComponent.that)
      LoggerComponent.that = this;
  }

  getHeader():string
  {
    if (this.header)
      return this.header;

    return "Es wurden Anpassungen vorgenommen:";
  }

  log(type: string, message: string, header:string|undefined = undefined)
  {
    if (type.toLowerCase() != "info")
    {
      // console.log(type + ": " + message);
      return;
    }
    if (header != undefined) {
      this.header = header;
      this.data=[{type:type, message:message}];
      AppComponent.app.state.logVisible = true;
      return;
    }

    let found = this.data.find(e =>
    {
      return e.message == message;
    });

    if (!found)
    {
      this.data.push({
        type: type,
        message: message,
      });
      AppComponent.app.state.logVisible = true;
    }
  }
  clear()
  {
    this.data = [] as iLog[];
    this.header = undefined;
    AppComponent.app.state.logVisible = false;
  }
}

export interface iLog
{
  type: string;
  message: string;
}

export function Log(type: string, message: string, header:string|undefined = undefined)
{
  if (LoggerComponent.that)
    LoggerComponent.that.log(type, message, header);
  // console.log(type, message);
}
