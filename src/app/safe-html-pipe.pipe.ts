import { Pipe, PipeTransform } from '@angular/core';
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";

@Pipe({
  name: 'safeHtml'
})
export class SafeHtmlPipePipe implements PipeTransform {

  constructor(private sanitizer:DomSanitizer){}

  transform(html:string):SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

}
