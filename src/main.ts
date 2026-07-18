import { provideZoneChangeDetection } from "@angular/core";
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {AppModule} from './app/app.module';
import {bootstrapDevelopmentAdmin} from "./app/development-admin/admin-entry";

platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], })
  .then(moduleRef => bootstrapDevelopmentAdmin(moduleRef))
  .catch(err => console.error(err));
