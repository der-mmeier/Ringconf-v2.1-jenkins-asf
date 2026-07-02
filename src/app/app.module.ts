import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {HttpClientModule} from "@angular/common/http";

import {AppComponent} from './app.component';
import {MenuComponent} from './menu/menu.component';
import {WebglComponent} from './webgl/webgl.component';
import {ConfigComponent} from './config/config.component';
import {FooterComponent} from './footer/footer.component';
import {DebugComponent} from './debug/debug.component';
import {ToolsComponent} from './tools/tools.component';
import {ConfigProfileComponent} from './config-profile/config-profile.component';
import {ConfigDimensionComponent} from './config-dimension/config-dimension.component';
import {RemoveCommaPipePipe} from './remove-comma-pipe.pipe';
import {DropdownComponent} from './dropdown/dropdown.component';
import {ConfigMaterialComponent} from './config-material/config-material.component';
import {SafeHtmlPipePipe} from './safe-html-pipe.pipe';
import {MultiThumbSliderComponent} from './multi-thumb-slider/multi-thumb-slider.component';
import {ConfigGapComponent} from './config-gap/config-gap.component';
import {TabControlComponent} from './tab-control/tab-control.component';
import {TabPageComponent} from './tab-page/tab-page.component';
import {ImageCardComponent} from './image-card/image-card.component';
import {ConfigStoneComponent} from './config-stone/config-stone.component';
import {ConfigEngravingComponent} from './config-engraving/config-engraving.component';
import {TextboxComponent} from './textbox/textbox.component';
import {CheckboxComponent} from './checkbox/checkbox.component';
import {LoggerComponent} from './logger/logger.component';
import {SaveLoadComponent} from './save-load/save-load.component';
import {ConfigAdminComponent} from './config-admin/config-admin.component';
import {RingDetailsComponent} from './ring-details/ring-details.component';
import {LocalStorageComponent} from './local-storage/local-storage.component';
import { PropertySyncDialogComponent } from './property-sync-dialog/property-sync-dialog.component';
import { StonexyComponent } from './stonexy/stonexy.component';
import { ConfigDiamondComponent } from './config-diamond/config-diamond.component';
import { SliderGapComponent } from './slider-gap/slider-gap.component';
import {MtsHorizontalComponent} from "./mts-horizontal/mts-horizontal.component";

@NgModule({
  declarations: [
    AppComponent,
    MenuComponent,
    WebglComponent,
    ConfigComponent,
    FooterComponent,
    DebugComponent,
    ToolsComponent,
    ConfigProfileComponent,
    ConfigDimensionComponent,
    RemoveCommaPipePipe,
    DropdownComponent,
    ConfigMaterialComponent,
    SafeHtmlPipePipe,
    MultiThumbSliderComponent,
    ConfigGapComponent,
    TabControlComponent,
    TabPageComponent,
    ImageCardComponent,
    ConfigStoneComponent,
    ConfigEngravingComponent,
    TextboxComponent,
    CheckboxComponent,
    LoggerComponent,
    SaveLoadComponent,
    ConfigAdminComponent,
    RingDetailsComponent,
    LocalStorageComponent,
    PropertySyncDialogComponent,
    StonexyComponent,
    ConfigDiamondComponent,
    SliderGapComponent,
    MtsHorizontalComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule
{
}
