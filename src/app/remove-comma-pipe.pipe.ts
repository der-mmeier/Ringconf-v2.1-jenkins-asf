import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'removeCommaPipe',
    standalone: false
})
export class RemoveCommaPipePipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    if (value !== undefined && value !== null && typeof(value) == "string") {
      return (<string>value).replace(/,/g, "");
    } else {
      return "";
    }
  }
}
