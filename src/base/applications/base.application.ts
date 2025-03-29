import {
  ApplicationLogger,
  LoggerFactory,
  ResultCodes,
  ValueOrPromise,
  getError,
} from '@minimaltech/node-infra';
import {
  Application,
  Binding,
  BindingTag,
  Constructor,
  DynamicValueProviderClass,
  MetadataInspector,
} from '@minimaltech/node-infra/@loopback/core';
import {
  IpcMainEvent,
  IpcMainInvokeEvent,
  app as crossProcessApplication,
  ipcMain,
} from 'electron';
import fs from 'fs';
import path from 'path';
import { ExposeVerbs } from '../..';
import { BindingKeys } from '../../common/keys';
import {
  IElectronApplication,
  IExposeMetadata,
  IWindowManager,
} from '../../common/types';
import { WindowManager } from '../services';

// --------------------------------------------------------------------------------
export abstract class AbstractElectronApplication
  extends Application
  implements IElectronApplication
{
  protected logger: ApplicationLogger;

  application: Electron.App;
  windowManager: IWindowManager;
  // routes: Map<string | symbol, Function>;

  // ------------------------------------------------------------------------------
  constructor(opts: {
    scope: string;

    windowManager?: IWindowManager;
    application?: Electron.App;
  }) {
    super();
    this.logger = LoggerFactory.getLogger([opts.scope]);

    // this.routes = new Map<string | symbol, Function>();
    this.windowManager = opts.windowManager ?? WindowManager.getInstance();
    this.application = opts.application ?? crossProcessApplication;
  }

  // ------------------------------------------------------------------------------
  // Events Binding
  // ------------------------------------------------------------------------------
  abstract onBeforeMigrate(): ValueOrPromise<void>;
  abstract onAfterMigrate(): ValueOrPromise<void>;

  abstract onWillFinishLaunching(): void;

  abstract onReady(): void;
  // event: Electron.Event,
  // launchInfo: Record<string, any> | Electron.NotificationResponse,

  abstract onSecondApplicationInstance(
    event: Electron.Event,
    args: string[],
    dir: string,
    additionalData: any,
  ): void;
  abstract onBrowserWindowCreated(
    event: Electron.Event,
    window: Electron.BrowserWindow,
  ): void;

  abstract onAllWindowsClosed(): void;
  abstract onWillQuit(event: Electron.Event): void;
  abstract onBeforeQuit(event: Electron.Event): void;
  abstract onQuit(event: Electron.Event, exitCode: number): void;

  abstract getProjectRoot(): string;
  abstract bindContext(): ValueOrPromise<void>;

  // ------------------------------------------------------------------------------
  getApplicationInstance(): Electron.App {
    return this.application;
  }

  getWindowManager(): IWindowManager {
    return this.windowManager;
  }

  getPreloadPath(opts?: { fileName?: string }): string {
    const { fileName = 'preload.js' } = opts ?? { fileName: 'preload.js' };

    const projectRoot = this.getProjectRoot();
    const preloadPath = path.join(projectRoot, fileName);
    this.logger.debug('[getPreloadPath] preloadPath: %s', preloadPath);

    if (!fs.existsSync(preloadPath)) {
      throw getError({
        statusCode: ResultCodes.RS_4.NotFound,
        message: `[getPreloadPath] Path: ${preloadPath} | preloadPath NOT FOUND`,
      });
    }

    return preloadPath;
  }

  // ------------------------------------------------------------------------------
  // Context Binding
  // ------------------------------------------------------------------------------
  preConfigure(): ValueOrPromise<void> {
    const isFirstInstance = this.application.requestSingleInstanceLock();
    if (!isFirstInstance) {
      this.logger.warn(
        '[preConfigure] Quiting application | Application instance was locked by another process | Please check whether or not another application was opening!',
      );
      this.application.quit();
    }

    this.bindContext();
    this.bindEvents();
  }

  // ------------------------------------------------------------------------------
  postConfigure(): ValueOrPromise<void> {
    this.buildRoutes();
  }

  // ------------------------------------------------------------------------------
  getMethodExecutor(opts: { binding: Readonly<Binding<any>>; methodName: string }) {
    const { binding, methodName } = opts;
    const ctor = binding.valueConstructor;
    const ctorPrototype = ctor?.prototype;
    const className = ctorPrototype?.name ?? '';

    return (...args: any[]) => {
      if (args?.length > 1) {
        this.logger.warn(
          '[%s] executor use only FIRST arg | Please check again caller args!',
          methodName,
        );
      }

      const controller = binding.getValue(this);
      if (!controller?.[methodName]) {
        throw getError({
          message: `[getMethodExecutor] Class: ${className} | Method: ${methodName} | Method is not available!`,
        });
      }

      return Reflect.apply(controller[methodName], controller, args);
    };
  }

  // ------------------------------------------------------------------------------
  buildRoute(opts: { binding: Readonly<Binding<any>>; methodName: string }) {
    const { binding, methodName } = opts;

    const ctor = binding.valueConstructor;
    const ctorPrototype = ctor?.prototype;

    if (!ctorPrototype) {
      throw getError({
        message: `[buildRoute] Binding: ${binding.key} | Class: ${ctor?.name} | method: ${methodName} | Skip build route | Invalid ctor prototype`,
      });
    }

    const exposeMetadata = MetadataInspector.getMethodMetadata(
      BindingKeys.EXPOSE_METHOD_KEY,
      ctorPrototype,
      methodName,
    );

    if (!exposeMetadata) {
      this.logger.warn(
        '[buildRoute] Class: %s | Method: %s | Skip method initialize!',
        ctor.name,
        methodName,
      );
      return;
    }

    const { verb } = exposeMetadata as IExposeMetadata;

    let ipcAction: 'on' | 'handle' | null = null;
    const executor = this.getMethodExecutor(opts);

    const ipcChannel = `${ctor.name}.${methodName}`;
    switch (verb) {
      case ExposeVerbs.SUBSCRIBER: {
        ipcAction = 'on';
        ipcMain.on(ipcChannel, (_event: IpcMainEvent, ...args: any[]) => {
          executor(...args);
        });
        break;
      }
      case ExposeVerbs.HANDLER: {
        ipcAction = 'handle';
        ipcMain.handle(ipcChannel, (_event: IpcMainInvokeEvent, ...args: any[]) => {
          return Promise.resolve(executor(...args));
        });
        break;
      }
      default: {
        break;
      }
    }

    this.logger.info(
      '[buildRoute][%s] Binding route | Class: %s | Method: %s | ipcMethod: %s',
      ipcAction,
      ctor.name,
      methodName,
      ipcChannel,
    );

    /* this.routes.set(`${ctor.name}_${methodName}`, () => {
      executor!(method ?? methodName, (_event, ...args: any[]) => {});
    }); */
  }

  // ------------------------------------------------------------------------------
  buildRoutes() {
    const controllers = this.findByTag('controllers');
    for (const binding of controllers) {
      const prototype = binding.valueConstructor?.prototype;
      if (!prototype) {
        continue;
      }

      const methodDescriptors = Object.getOwnPropertyDescriptors(prototype);
      for (const methodName in methodDescriptors) {
        if (methodName === 'constructor') {
          continue;
        }

        this.buildRoute({ binding, methodName });
        /* this.routes.set(methodName, (...args: any[]) => {
          const controller = binding.getValue(this);
          Reflect.apply(controller[methodName], controller, args);
        }); */
      }
    }
  }

  // ------------------------------------------------------------------------------
  injectable<T>(
    scope: string,
    value: DynamicValueProviderClass<T> | Constructor<T>,
    tags?: BindingTag[],
  ) {
    this.bind(`${scope}.${value.name}`)
      .toInjectable(value)
      .tag(...(tags ?? []), scope);
  }

  // ------------------------------------------------------------------------------
  datasource<T>(value: DynamicValueProviderClass<T> | Constructor<T>) {
    this.injectable('datasources', value);
  }

  // ------------------------------------------------------------------------------
  repository<T>(value: DynamicValueProviderClass<T> | Constructor<T>) {
    this.injectable('repositories', value);
  }

  // ------------------------------------------------------------------------------
  bindEvents() {
    if (!this.application) {
      throw getError({
        message: '[binding] Invalid application instance to bind',
      });
    }

    this.on('before-migrate', () => {
      Promise.resolve(this.onBeforeMigrate()).then(() => {
        this.emit('after-migrate');
      });
    });

    this.on('after-migrate', () => {
      Promise.resolve(this.onAfterMigrate()).then(() => {
        this.onReady();
      });
    });

    this.application.on('will-finish-launching', () => this.onWillFinishLaunching());
    this.application.on('ready', (_event, _launchInfo) => () => {
      this.emit('before-migrate');
      // this.onReady(event, launchInfo)
    });
    this.application.on('second-instance', (event, args, dir, additionalData) =>
      this.onSecondApplicationInstance(event, args, dir, additionalData),
    );
    this.application.on('browser-window-created', (event, window) =>
      this.onBrowserWindowCreated(event, window),
    );
    this.application.on('window-all-closed', () => this.onAllWindowsClosed());
    this.application.on('will-quit', event => this.onWillQuit(event));
    this.application.on('before-quit', event => this.onBeforeQuit(event));
    this.application.on('quit', (event, exitCode) => this.onQuit(event, exitCode));
  }

  // ------------------------------------------------------------------------------
  override async start() {
    super.start();
    await this.preConfigure();
    await this.postConfigure();
  }
}

// --------------------------------------------------------------------------------
export abstract class BaseElectronApplication extends AbstractElectronApplication {
  override onBeforeMigrate(): ValueOrPromise<void> {
    return;
  }

  override onAfterMigrate(): ValueOrPromise<void> {
    return;
  }

  override onWillFinishLaunching(): void {
    this.logger.debug('[onWillFinishLaunching] Application finishing launching');
  }

  override onSecondApplicationInstance(
    event: Electron.Event,
    args: string[],
    _dir: string,
    _additionalData: any,
  ): void {
    this.logger.debug(
      '[onSecondApplicationInstance] New Application was requested to create | Args: %j',
      event,
      args,
    );
  }

  override onBrowserWindowCreated(
    event: Electron.Event,
    window: Electron.BrowserWindow,
  ): void {
    this.logger.debug(
      '[onBrowserWindowCreated] New BrowserWindow CREATED | Window: %j',
      event,
      window,
    );
  }

  override onAllWindowsClosed(): void {
    this.logger.debug(
      '[onAllWindowsClosed] All BrowserWindows was CLOSED | Quiting application!',
    );

    if (process.platform === 'darwin') {
      return;
    }

    crossProcessApplication.quit();
  }

  override onWillQuit(event: Electron.Event): void {
    this.logger.debug('[onWillQuit] Application WILL_QUIT', event);
  }

  override onBeforeQuit(event: Electron.Event): void {
    this.logger.debug('[onBeforeQuit] Application BEFORE_QUIT', event);
  }

  override onQuit(event: Electron.Event, exitCode: number): void {
    this.logger.debug('[onQuit] Application QUIT | exitCode: %s', event, exitCode);
  }
}
