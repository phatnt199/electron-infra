import { BaseService, ResultCodes, getError } from '@minimaltech/node-infra';
import { IWindowManager } from '../../common';
import { BrowserWindow, TBrowserWindowOptions } from '../models';

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
    const { name } = opts;

    if (opts.identifier && this.container.has(opts.identifier)) {
      throw getError({
        statusCode: ResultCodes.RS_4.BadRequest,
        message: `[open] Identifier: ${opts.identifier} | Invalid window identifier | Existed in container`,
      });
    }

    const window = new BrowserWindow(opts);
    const identifier = window.getIdentifier();
    this.container.set(identifier, { window, options: opts });

    this.logger.info(
      '[open] Identifier: %s | Name: %s | Window CREATED',
      identifier,
      name,
    );

    window.on('closed', () => {
      if (!this.container.has(identifier)) {
        return;
      }

      this.container.delete(identifier);
    });

    window.on('ready-to-show', () => {
      window.show();
    });

    window.on('close', () => {
      this.container.delete(identifier);
    });

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
