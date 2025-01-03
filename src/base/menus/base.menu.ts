import { Menu } from 'electron';
import { BaseService } from '@minimaltech/node-infra';

// --------------------------------------------------------------------------------
export abstract class AbstractMenuFactory extends BaseService {
  abstract getMenu(window: Electron.BrowserWindow): Menu;
}
