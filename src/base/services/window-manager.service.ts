import { BaseService, ResultCodes, getError } from '@minimaltech/node-infra';
import { IWindowManager } from '../../common';
import { BrowserWindow, TBrowserWindowOptions } from '../models';
import { Menu } from 'electron';
import { debounceTime, fromEvent } from 'rxjs';

export class WindowManager extends BaseService implements IWindowManager {
  private static instance: WindowManager | null;
  private container: Map<
    string,
    {
      window: BrowserWindow;
      options: TBrowserWindowOptions;
    }
  >;

  private constructor() {
    super({ scope: WindowManager.name });
    this.container = new Map();
  }

  // -----------------------------------------------------------------------------------
  static getInstance() {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }

    return WindowManager.instance;
  }

  // -----------------------------------------------------------------------------------
  getContainer() {
    return this.container;
  }

  // -----------------------------------------------------------------------------------
  open(opts: TBrowserWindowOptions) {
    const {
      name,
      useDevTool = false,
      onClose,
      onClosed,
      onReadyToShow,
      onShow,
      onMove,
      onResize,
    } = opts;

    if (opts.identifier && this.container.has(opts.identifier)) {
      throw getError({
        statusCode: ResultCodes.RS_4.BadRequest,
        message: `[open] Identifier: ${opts.identifier} | Invalid window identifier | Existed in container`,
      });
    }

    const window = new BrowserWindow(opts);
    const identifier = window.getIdentifier();
    this.container.set(identifier, { window, options: opts });

    if (opts.menuFactory) {
      Menu.setApplicationMenu(opts.menuFactory.getMenu(window));
    }

    this.logger.info(
      '[open] Identifier: %s | Name: %s | Window CREATED',
      identifier,
      name,
    );

    // --------------------------------------------------
    const subscriptionResize = fromEvent(window, 'resize')
      .pipe(debounceTime(1000))
      .subscribe(() => {
        onResize?.(window);
      });
    const subscriptionMove = fromEvent(window, 'move')
      .pipe(debounceTime(1000))
      .subscribe(() => {
        onMove?.(window);
      });

    // --------------------------------------------------
    window.on('ready-to-show', () => {
      onReadyToShow?.(window);

      window.webContents.on('did-finish-load', () => {
        this.logger.info(
          '[open] Identifier: %s | Name: %s | Window READY',
          identifier,
          name,
        );

        window.webContents.send('windowId', identifier);
      });

      window.show();
    });

    window.on('show', () => {
      onShow?.(window);
    });

    // --------------------------------------------------
    window.on('closed', () => {
      onClosed?.(window);

      if (!this.container.has(identifier)) {
        return;
      }

      subscriptionResize.unsubscribe();
      subscriptionMove.unsubscribe();
      this.container.delete(identifier);
    });

    window.on('close', () => {
      onClose?.(window);

      this.container.delete(identifier);
    });

    if (useDevTool) {
      window.webContents.toggleDevTools();
    }

    return window;
  }

  // -----------------------------------------------------------------------------------
  close(opts: { identifier?: string; name?: string }) {
    const { identifier, name } = opts;

    if (!identifier && !name) {
      return;
    }

    for (const [k, v] of this.container) {
      const windowName = v.window.getName();
      if (k !== identifier && name !== windowName) {
        continue;
      }

      v.window.close();
    }
  }

  // -----------------------------------------------------------------------------------
  getWindows(opts: { identifier?: string; name?: string }) {
    const { identifier, name } = opts;
    const rs: Array<BrowserWindow> = [];

    if (!identifier && !name) {
      for (const el of this.container.values()) {
        rs.push(el.window);
      }

      return rs;
    }

    if (identifier && this.container.has(identifier)) {
      const el = this.container.get(identifier)!;
      if (el?.window) {
        rs.push(el.window);
      }
    }

    if (name) {
      for (const [_, v] of this.container) {
        const windowName = v.window.getName();
        if (name !== windowName) {
          continue;
        }

        rs.push(v.window);
      }
    }

    return rs;
  }
}
