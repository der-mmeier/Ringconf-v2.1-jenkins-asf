import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { AppComponent, dbCheckIdExist, dbLoadPreset } from '../app.component';
import { Log } from '../logger/logger.component';

@Component({
  selector: 'x-local-storage',
  templateUrl: './local-storage.component.html',
  styleUrls: ['./local-storage.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class LocalStorageComponent implements OnInit {
  static that: LocalStorageComponent;

  ringconfId = '';
  isVisible = false;
  isClosed = false;

  @HostBinding('style.display')
  get hostDisplay(): string {
    return this.isClosed ? 'none' : '';
  }

  @HostBinding('style.pointer-events')
  get hostPointerEvents(): string {
    return this.isVisible ? 'auto' : 'none';
  }

  constructor() {
    LocalStorageComponent.that = this;
  }

  ngOnInit(): void {
    if (AppComponent.app.state.urlParams['id'] !== undefined) {
      this.close();
      return;
    }

    this.ringconfId = localStorage.getItem('ringconfId') || '';

    if (this.ringconfId.length < 9) {
      this.close();
      return;
    }

    dbCheckIdExist(this.ringconfId)
      .then((exists: boolean) => {
        if (!exists) {
          this.close();
          return;
        }

        this.isClosed = false;
        this.isVisible = true;
      })
      .catch(err => {
        console.log('error in LocalStorageComponent dbCheckIdExist(): ', err);
        this.close();
      });
  }

  restoreConfiguration(): void {
    const id = this.ringconfId;

    this.close();

    dbLoadPreset(id).catch(err => {
      console.log('error in restoreConfiguration(): ', err);
      Log('error', 'Die gespeicherte Konfiguration konnte nicht geladen werden.');
    });
  }

  close(): void {
    this.isVisible = false;
    this.isClosed = true;
  }
}
