import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { AppComponent, dbSaveStdPreset, dbSetAppData } from '../app.component';
import { RingData } from '../app.ringdata';
import { exportObj, WebglComponent } from '../webgl/webgl.component';

@Component({
  selector: 'x-config-admin',
  templateUrl: './config-admin.component.html',
  styleUrls: ['./config-admin.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ConfigAdminComponent {
  app = AppComponent.app;
  ringData = RingData.list;

  setStdPreset(): void {
    dbSaveStdPreset().catch(err => {
      console.log('error in setStdPreset(): ', err);
    });
  }

  toggleWireframe(): void {
    const webgl = WebglComponent.WEBGL;

    if (!webgl) {
      return;
    }

    webgl.scene.forceWireframe = !webgl.scene.forceWireframe;
    webgl.renderFrame();
  }

  dbSetAppData(): void {
    dbSetAppData().then();
  }

  exportObj(): void {
    exportObj();
  }

  downloadCfg(): void {
    const fileName = 'config.json';
    const fileToSave = new Blob([JSON.stringify(AppComponent.app.data)], {
      type: 'application/json'
    });

    this.saveBlob(fileToSave, fileName);
  }

  uploadCfg(): void {
    const input = document.getElementById('selectFiles') as HTMLInputElement | null;
    const file = input?.files?.item(0);

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = event => {
      const content = event.target?.result;

      if (typeof content !== 'string') {
        console.log('error in uploadCfg(): Dateiinhalt konnte nicht gelesen werden.');
        return;
      }

      try {
        JSON.parse(content);
      } catch (err) {
        console.log('error in uploadCfg(): Ungültige JSON-Datei.', err);
        return;
      }

      AppComponent.app.dataSafeJson = content;
      dbSetAppData().then();
    };

    reader.readAsText(file);
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }
}
