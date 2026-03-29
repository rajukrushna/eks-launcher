import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },

  env: {
    list:   ()              => ipcRenderer.invoke('env:list'),
    get:    (id: number)    => ipcRenderer.invoke('env:get', id),
    create: (data: any)     => ipcRenderer.invoke('env:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('env:update', id, data),
    delete: (id: number)    => ipcRenderer.invoke('env:delete', id),
  },

  cmd: {
    run: (env: any) => ipcRenderer.invoke('cmd:run', env),
    onLog: (cb: (data: any) => void) => {
      const h = (_: any, d: any) => cb(d)
      ipcRenderer.on('cmd:log', h)
      return () => ipcRenderer.removeListener('cmd:log', h)
    },
  },

  okta: {
    readProfiles: () => ipcRenderer.invoke('okta:read-profiles'),
  },

  pf: {
    list:    ()              => ipcRenderer.invoke('pf:list'),
    create:  (data: any)     => ipcRenderer.invoke('pf:create', data),
    update:  (id: number, data: any) => ipcRenderer.invoke('pf:update', id, data),
    delete:  (id: number)    => ipcRenderer.invoke('pf:delete', id),
    start:   (pf: any)       => ipcRenderer.invoke('pf:start', pf),
    stop:    (id: number)    => ipcRenderer.invoke('pf:stop', id),
    stopAll: ()              => ipcRenderer.invoke('pf:stopAll'),
    onLog: (cb: (data: any) => void) => {
      const h = (_: any, d: any) => cb(d)
      ipcRenderer.on('pf:log', h)
      return () => ipcRenderer.removeListener('pf:log', h)
    },
    onStatusChange: (cb: (data: any) => void) => {
      const h = (_: any, d: any) => cb(d)
      ipcRenderer.on('pf:status', h)
      return () => ipcRenderer.removeListener('pf:status', h)
    },
  },
})
