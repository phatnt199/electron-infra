import { TStatusFromClass, ValueOrPromise } from '@minimaltech/node-infra';
import {
  BindingTag,
  Constructor,
  DynamicValueProviderClass,
} from '@minimaltech/node-infra/@lb/core';
import { JsonSchema } from '@minimaltech/node-infra/@lb/rest';
import { BrowserWindow, TBrowserWindowOptions } from '../base/models';
import { ExposeVerbs } from './constants';

// ------------------------------------------------------------------------------
export interface IExposeMetadata {
  verb: TStatusFromClass<typeof ExposeVerbs>;
  payload?: { schema: JsonSchema };
}

// ----------------------------------------------------------------------
export interface IWindowManager {
  getContainer(): Map<string, { window: BrowserWindow; options: TBrowserWindowOptions }>;

  open(opts: TBrowserWindowOptions): Promise<BrowserWindow>;
  close(opts: { identifier?: string; name?: string }): void;
  getWindows(opts: { identifier?: string; name?: string }): Array<BrowserWindow>;
}

// ----------------------------------------------------------------------
export interface IElectronApplication {
  getApplicationInstance(): Electron.App;
  getWindowManager(): IWindowManager;

  // ------------------------------------------------------------------------------
  preConfigure(): ValueOrPromise<void>;
  postConfigure(): ValueOrPromise<void>;
  buildRoutes(): ValueOrPromise<void>;
  bindContext(): ValueOrPromise<void>;

  // ------------------------------------------------------------------------------
  onWillFinishLaunching(): void;
  onReady(
    event: Electron.Event,
    launchInfo: Record<string, any> | Electron.NotificationResponse,
  ): void;
  onSecondApplicationInstance(
    event: Electron.Event,
    args: string[],
    dir: string,
    additionalData: any,
  ): void;
  onBrowserWindowCreated(event: Electron.Event, window: BrowserWindow): void;
  onAllWindowsClosed(): void;
  onWillQuit(event: Electron.Event): void;
  onBeforeQuit(event: Electron.Event): void;
  onQuit(event: Electron.Event, exitCode: number): void;

  // ------------------------------------------------------------------------------
  injectable<T>(
    scope: string,
    value: DynamicValueProviderClass<T> | Constructor<T>,
    tags?: Array<BindingTag>,
  ): void;
  datasource<T>(value: DynamicValueProviderClass<T> | Constructor<T>): void;
  repository<T>(value: DynamicValueProviderClass<T> | Constructor<T>): void;

  // ------------------------------------------------------------------------------
  start(): ValueOrPromise<void>;
}
