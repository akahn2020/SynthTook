const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('synthtookFS', {
  readSession:      ()             => ipcRenderer.invoke('session:read'),
  writeSession:     (data)         => ipcRenderer.invoke('session:write', data),
  clearSession:     ()             => ipcRenderer.invoke('session:clear'),
  listSlots:        ()             => ipcRenderer.invoke('slots:list'),
  writeSlot:        (index, slot)  => ipcRenderer.invoke('slots:write', index, slot),
  clearSlot:        (index)        => ipcRenderer.invoke('slots:clear', index),
  openSaveLocation: ()             => ipcRenderer.invoke('shell:openUserData'),
});
