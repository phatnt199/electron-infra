import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

// ---------------------------------------------------------------------
const system = {};

// ---------------------------------------------------------------------
const preference = {};

// ---------------------------------------------------------------------
const ipc = {
  send: <T>(opts: { channel: string; payload: T }) => {
    return ipcRenderer.send(opts.channel, opts.payload);
  },
  invoke: <T>(opts: { channel: string; payload: T }) => {
    return ipcRenderer.invoke(opts.channel, opts.payload);
  },

  on: <T>(opts: {
    channel: string;
    listener: (event: IpcRendererEvent, payload: T) => void;
  }) => {
    return ipcRenderer.on(opts.channel, opts.listener);
  },
  once: <T>(opts: {
    channel: string;
    listener: (event: IpcRendererEvent, payload: T) => void;
  }) => {
    return ipcRenderer.on(opts.channel, opts.listener);
  },

  off: <T>(opts: {
    channel: string;
    listener: (event: IpcRendererEvent, payload: T) => void;
  }) => {
    return ipcRenderer.off(opts.channel, opts.listener);
  },
  offAll: (opts: { channel: string }) => {
    return ipcRenderer.removeAllListeners(opts.channel);
  },
};

// ---------------------------------------------------------------------
contextBridge.exposeInMainWorld('bridgeApi', {
  system,
  preference,
  ipc,
});
