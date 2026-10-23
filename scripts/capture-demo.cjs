const { app, BrowserWindow, ipcMain } = require('electron');
const { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');

const root = path.join(__dirname, '..');
const profile = mkdtempSync(path.join(tmpdir(), 'dafeiyu-demo-'));
app.setPath('userData', profile);
app.setName('DaFeiYu-magpie Demo');
const catalog = JSON.parse(readFileSync(path.join(root, 'assets/catalog.json'), 'utf8'));
const now = Date.now();
const snapshot = {
  catalog,
  settings: { size: 460, active: true, paused: false, locked: false, followTasks: true },
  activity: { state: 'thinking', label: 'Magpie 演示请求', available: true, activeCount: 2, observedAt: now, activeAccountIds: ['demo-first'] },
  quota: { ok: true, observedAt: now, accounts: [
    { accountId: 'demo-first', label: '演示账号 A' }, { accountId: 'demo-second', label: '演示账号 B' },
  ], windows: [
    { accountId: 'demo-first', remaining: 72, used: 28, readAt: now },
    { accountId: 'demo-second', remaining: 38, used: 62, readAt: now },
  ] },
};

app.whenReady().then(async () => {
  app.dock?.hide();
  ipcMain.handle('snapshot', () => snapshot);
  const window = new BrowserWindow({ width: 460, height: 371, frame: false, show: false,
    backgroundColor: '#eff5fc', webPreferences: { preload: path.join(root, 'src/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await window.loadFile(path.join(root, 'src/pet.html'));
  await window.webContents.insertCSS('body { background: radial-gradient(ellipse at 50% 55%, #ffffff 0%, #eff5fc 75%); }');
  window.showInactive();
  await new Promise(resolve => setTimeout(resolve, 800));
  window.webContents.send('play', '撸猫');
  await new Promise(resolve => setTimeout(resolve, 4500));
  const report = await window.webContents.executeJavaScript('({ ...window.petDiagnostics, percentages: [...document.querySelectorAll(".account-quota")].map(element => element.textContent) })');
  if (report.errors.length || !report.loaded || report.percentages.join(',') !== '72%,38%') throw new Error('Demo render failed');
  const output = path.join(root, 'docs/images');
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'desktop.png'), (await window.webContents.capturePage()).toPNG());
  console.log('Saved docs/images/desktop.png using synthetic account data.');
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });

app.on('will-quit', () => rmSync(profile, { recursive: true, force: true }));
