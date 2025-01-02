import { ResultCodes, getUID } from '@minimaltech/node-infra';
import { getError } from '@minimaltech/node-infra';
import {
  BrowserWindowConstructorOptions,
  BrowserWindow as ElectronBrowserWindow,
} from 'electron';

export type TBrowserWindowOptions = BrowserWindowConstructorOptions & {
  identifier?: string;
  name: string;
  url: string;
};

export class BrowserWindow extends ElectronBrowserWindow {
  private identifier: string;
  private name: string;
  private url: string;

  constructor(opts: TBrowserWindowOptions) {
    const { identifier, name, url, ...rest } = opts;
    super(rest);

    this.identifier = identifier ?? `${name}_${getUID()}`;
    this.name = name;
    this.url = url;

    this.loadUI();
  }

  getIdentifier() {
    return this.identifier;
  }

  getName() {
    return this.name;
  }

  loadUI(opts?: { url?: string }) {
    const url = opts?.url ?? this.url;
    if (!url) {
      throw getError({
        statusCode: ResultCodes.RS_5.InternalServerError,
        message: `[load] Identifier: ${this.identifier} | Name: ${this.name} | Invalid url to load!`,
      });
    }

    this.loadURL(url);
  }
}
