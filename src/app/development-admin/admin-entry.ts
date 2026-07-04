import {ApplicationRef, createComponent, NgModuleRef} from "@angular/core";
import {DevelopmentAdminComponent} from "./development-admin.component";

export function bootstrapDevelopmentAdmin(moduleRef: NgModuleRef<unknown>): void
{
  const host = document.createElement("x-development-admin-host");
  document.body.appendChild(host);

  const componentRef = createComponent(DevelopmentAdminComponent, {
    environmentInjector: moduleRef.injector,
    hostElement: host,
  });

  const appRef = moduleRef.injector.get(ApplicationRef);
  componentRef.setInput("app", appRef.components[0]?.instance ?? null);
  appRef.attachView(componentRef.hostView);
  componentRef.changeDetectorRef.detectChanges();
}
