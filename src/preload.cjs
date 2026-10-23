const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  getSnapshot: () => ipcRenderer.invoke('snapshot'),
  play: name => ipcRenderer.send('play', name),
  menu: () => ipcRenderer.send('menu'),
  panel: () => ipcRenderer.send('panel'),
  refreshQuota: () => ipcRenderer.invoke('quota-refresh'),
  setting: (key, value) => ipcRenderer.send('setting', key, value),
  drag: phase => ipcRenderer.send('drag', phase),
  interactive: value => ipcRenderer.send('interactive', value),
  openMagpie: () => ipcRenderer.send('open-magpie'),
  on: (channel, callback) => {
    if (!['snapshot', 'activity', 'quota', 'play', 'cursor', 'settings'].includes(channel)) return;
    ipcRenderer.on(channel, (_event, value) => callback(value));
  },
});
