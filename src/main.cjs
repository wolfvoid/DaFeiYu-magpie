const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen, shell } = require('electron');
const { readFileSync, writeFileSync, mkdirSync, renameSync } = require('node:fs');
const path = require('node:path');
const { clampPetPosition } = require('./position.cjs');

app.setName('蓝色大肥鱼');
app.setPath('userData', path.join(app.getPath('appData'), 'BlueDaFeiYu-Codex'));
const catalog = JSON.parse(readFileSync(path.join(__dirname, '../assets/catalog.json'), 'utf8'));
const defaults = { size: 460, active: true, paused: false, locked: false, followTasks: true, x: null, y: null };
let settings = { ...defaults };
let petWindow;
let panelWindow;
let tray;
let reader;
let quota = { ok: false, windows: [], error: '正在连接 Magpie…', observedAt: null };
let activity = { state: 'unknown', label: '正在读取任务状态', available: false, activeCount: 0 };
let quotaQuery;
let lastQuotaAttempt = 0;
let dragState;
let momentum;
let lastInteractive = false;
const timers = [];
const smoke = process.argv.includes('--smoke-test');
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const send = (channel, payload) => {
  for (const window of [petWindow, panelWindow]) if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
};
const snapshot = () => ({ catalog, settings, activity, quota });

function saveSettings() {
  mkdirSync(app.getPath('userData'), { recursive: true });
  const temporary = settingsPath() + '.tmp';
  writeFileSync(temporary, JSON.stringify(settings, null, 2));
  renameSync(temporary, settingsPath());
}

function windowSize() {
  return { width: settings.size, height: Math.round(settings.size * 9 / 16) + 112 };
}

function clampPosition(position, display) {
  const dimensions = windowSize();
  display ??= screen.getDisplayNearestPoint({ x: Math.round(position.x + dimensions.width / 2), y: Math.round(position.y + dimensions.height / 2) });
  return clampPetPosition(position, display.workArea, dimensions);
}

function recenter() {
  momentum = null;
  dragState = null;
  const area = screen.getPrimaryDisplay().workArea;
  const dimensions = windowSize();
  petWindow.setPosition(Math.round(area.x + (area.width - dimensions.width) / 2), Math.round(area.y + (area.height - dimensions.height) / 2));
  persistPosition();
  showPet();
}

function persistPosition() {
  if (!petWindow || petWindow.isDestroyed()) return;
  [settings.x, settings.y] = petWindow.getPosition();
  saveSettings();
}

function guardWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
}

function showPet() {
  petWindow.showInactive();
  send('settings', settings);
  updateTray();
}

function showPanel() {
  if (panelWindow && !panelWindow.isDestroyed()) { panelWindow.show(); panelWindow.focus(); return; }
  panelWindow = new BrowserWindow({ width: 460, height: 680, minWidth: 400, minHeight: 540,
    title: '蓝色大肥鱼 · 陪伴面板', backgroundColor: '#f5f8ff', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  guardWindow(panelWindow);
  panelWindow.loadFile(path.join(__dirname, 'panel.html'));
  panelWindow.once('ready-to-show', () => panelWindow.show());
  panelWindow.on('closed', () => { panelWindow = null; });
}

function play(name) {
  if (!catalog.names.includes(name)) return;
  showPet();
  petWindow.webContents.send('play', name);
}

function changeSetting(key, value) {
  if (['active', 'paused', 'locked', 'followTasks'].includes(key) && typeof value === 'boolean') settings[key] = value;
  else if (key === 'size' && [360, 460, 560].includes(value)) settings.size = value;
  else return;
  momentum = null;
  dragState = null;
  const position = clampPosition({ x: petWindow.getBounds().x, y: petWindow.getBounds().y });
  petWindow.setBounds({ ...position, ...windowSize() });
  saveSettings();
  send('settings', settings);
  updateTray();
}

function menuItems() {
  return [
    { label: '蓝色大肥鱼 · Magpie 伴侣', enabled: false },
    { label: activity.label, enabled: false },
    { type: 'separator' },
    { label: '✨ 放烟花', click: () => play('放烟花') },
    { label: '🪄 凭空生花', click: () => play('凭空生花') },
    { label: '🐋 蓝鲸现世', click: () => play('蓝鲸现世') },
    { label: '点播全部动作', submenu: catalog.categories.map(category => ({ label: category.id,
      submenu: category.actions.map(name => ({ label: name, click: () => play(name) })) })) },
    { type: 'separator' },
    { label: '额度与设置…', click: showPanel },
    { label: '打开 Magpie', click: openMagpie },
    { label: '跟随 Magpie 请求', type: 'checkbox', checked: settings.followTasks, click: item => changeSetting('followTasks', item.checked) },
    { label: '随机玩耍', type: 'checkbox', checked: settings.active, click: item => changeSetting('active', item.checked) },
    { label: '暂停动画', type: 'checkbox', checked: settings.paused, click: item => changeSetting('paused', item.checked) },
    { label: '锁定位置', type: 'checkbox', checked: settings.locked, click: item => changeSetting('locked', item.checked) },
    { label: '回到屏幕内', click: recenter },
    { label: '大小', submenu: [[360, '小'], [460, '中'], [560, '大']].map(([size, label]) => ({ label, type: 'radio',
      checked: settings.size === size, click: () => changeSetting('size', size) })) },
    { label: petWindow?.isVisible() ? '隐藏桌宠' : '显示桌宠', click: () => {
      if (petWindow.isVisible()) { petWindow.hide(); petWindow.webContents.send('settings', { ...settings, paused: true }); }
      else showPet();
      updateTray();
    } },
    { type: 'separator' },
    { label: '退出蓝色大肥鱼', click: () => app.quit() },
  ];
}

function updateTray() { tray?.setContextMenu(Menu.buildFromTemplate(menuItems())); }

async function openMagpie() {
  const { existsSync } = require('node:fs');
  const target = ['/Applications/magpie.app', path.join(app.getPath('home'), 'Applications/magpie.app')].find(existsSync);
  if (target) await shell.openPath(target);
}

async function refreshQuota(force = false) {
  if (quotaQuery) return quotaQuery;
  if (!force && Date.now() - lastQuotaAttempt < 30000) return quota;
  lastQuotaAttempt = Date.now();
  const { readQuota } = await import('./magpie.mjs');
  quotaQuery = readQuota().then(result => {
    quota = result;
    send('quota', quota);
    return quota;
  }).finally(() => { quotaQuery = null; });
  return quotaQuery;
}

function moveTick() {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
  const cursor = screen.getCursorScreenPoint();
  if (dragState) {
    const now = Date.now();
    const elapsed = Math.max(1, now - dragState.lastTime);
    dragState.velocity = { x: (cursor.x - dragState.last.x) * 1000 / elapsed, y: (cursor.y - dragState.last.y) * 1000 / elapsed };
    if (cursor.x !== dragState.last.x || cursor.y !== dragState.last.y) dragState.lastMoved = now;
    dragState.last = cursor;
    dragState.lastTime = now;
    const position = clampPosition({ x: cursor.x - dragState.offset.x, y: cursor.y - dragState.offset.y }, screen.getDisplayNearestPoint(cursor));
    petWindow.setPosition(position.x, position.y);
  } else if (momentum) {
    momentum.velocityY += 1400 * 0.016;
    momentum.x += momentum.velocityX * 0.016;
    momentum.y += momentum.velocityY * 0.016;
    const position = clampPosition(momentum, momentum.display);
    if (position.x !== Math.round(momentum.x)) momentum.velocityX *= -0.65;
    if (position.y !== Math.round(momentum.y)) {
      momentum.velocityY *= -0.55;
      momentum.velocityX *= 0.82;
    }
    momentum.x = position.x;
    momentum.y = position.y;
    petWindow.setPosition(position.x, position.y);
    if (Date.now() - momentum.started > 4500 || (Math.abs(momentum.velocityY) < 24 && Math.abs(momentum.velocityX) < 15)) {
      momentum = null;
      persistPosition();
    }
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (petWindow) showPet(); });
  app.whenReady().then(async () => {
    if (process.platform === 'darwin') app.dock?.hide();
    try {
      const saved = JSON.parse(readFileSync(settingsPath(), 'utf8'));
      for (const key of ['active', 'paused', 'locked', 'followTasks']) if (typeof saved[key] === 'boolean') settings[key] = saved[key];
      if ([360, 460, 560].includes(saved.size)) settings.size = saved.size;
      if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) { settings.x = saved.x; settings.y = saved.y; }
    } catch {}
    if (!smoke) saveSettings();
    const area = screen.getPrimaryDisplay().workArea;
    const position = clampPosition({ x: settings.x ?? area.x + area.width - settings.size - 20, y: settings.y ?? area.y + area.height - windowSize().height - 12 });
    petWindow = new BrowserWindow({ ...windowSize(), ...position, title: '蓝色大肥鱼', frame: false, transparent: true,
      resizable: false, hasShadow: false, alwaysOnTop: true, skipTaskbar: true, acceptFirstMouse: true,
      show: false, backgroundColor: '#00000000',
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: true } });
    guardWindow(petWindow);
    petWindow.setAlwaysOnTop(true, 'floating');
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    petWindow.setIgnoreMouseEvents(true, { forward: true });
    petWindow.loadFile(path.join(__dirname, 'pet.html'));
    petWindow.once('ready-to-show', showPet);
    petWindow.on('closed', () => app.quit());
    tray = new Tray(nativeImage.createEmpty());
    tray.setTitle('🐋');
    tray.setToolTip('蓝色大肥鱼 · Magpie 伴侣');
    updateTray();
    const trusted = event => [petWindow, panelWindow].some(window => window && !window.isDestroyed() && event.sender === window.webContents);
    ipcMain.handle('snapshot', event => trusted(event) ? snapshot() : null);
    ipcMain.handle('quota-refresh', event => trusted(event) ? refreshQuota() : null);
    ipcMain.on('panel', event => { if (trusted(event)) showPanel(); });
    ipcMain.on('menu', event => { if (trusted(event)) Menu.buildFromTemplate(menuItems()).popup({ window: petWindow }); });
    ipcMain.on('play', (event, name) => { if (trusted(event)) play(name); });
    ipcMain.on('setting', (event, key, value) => { if (trusted(event)) changeSetting(key, value); });
    ipcMain.on('open-magpie', event => { if (trusted(event)) openMagpie(); });
    ipcMain.on('interactive', (event, value) => {
      if (event.sender !== petWindow.webContents || typeof value !== 'boolean' || dragState || value === lastInteractive) return;
      lastInteractive = value;
      petWindow.setIgnoreMouseEvents(!value, { forward: true });
    });
    ipcMain.on('drag', (event, phase) => {
      if (event.sender !== petWindow.webContents || settings.locked) return;
      if (phase === 'start') {
        const cursor = screen.getCursorScreenPoint();
        const bounds = petWindow.getBounds();
        momentum = null;
        dragState = { offset: { x: cursor.x - bounds.x, y: cursor.y - bounds.y }, last: cursor, lastTime: Date.now(), lastMoved: Date.now(), velocity: { x: 0, y: 0 } };
        petWindow.setIgnoreMouseEvents(false);
      } else if (phase === 'end' && dragState) {
        const velocity = dragState.velocity;
        const bounds = petWindow.getBounds();
        if (Date.now() - dragState.lastMoved < 120 && Math.hypot(velocity.x, velocity.y) > 200) {
          momentum = { x: bounds.x, y: bounds.y, velocityX: Math.max(-2000, Math.min(2000, velocity.x)), velocityY: Math.max(-2000, Math.min(2000, velocity.y)),
            started: Date.now(), display: screen.getDisplayNearestPoint(screen.getCursorScreenPoint()) };
        }
        dragState = null;
        petWindow.setIgnoreMouseEvents(!lastInteractive, { forward: true });
        persistPosition();
      }
    });
    const { ActivityReader } = await import('./magpie.mjs');
    reader = new ActivityReader();
    let activityPending = false;
    const updateActivity = async () => {
      if (activityPending) return;
      activityPending = true;
      try { activity = await reader.read(); send('activity', activity); updateTray(); }
      finally { activityPending = false; }
    };
    updateActivity();
    timers.push(setInterval(updateActivity, 2000));
    timers.push(setInterval(() => refreshQuota(), 30000));
    timers.push(setInterval(moveTick, 16));
    timers.push(setInterval(() => {
      if (!petWindow.isVisible()) return;
      const cursor = screen.getCursorScreenPoint();
      const bounds = petWindow.getBounds();
      petWindow.webContents.send('cursor', { x: cursor.x - bounds.x, y: cursor.y - bounds.y });
    }, 100));
    refreshQuota(true);
    screen.on('display-removed', recenter);
    if (smoke) {
      setTimeout(() => play('放烟花'), 3500);
      setTimeout(() => play('凭空生花'), 15000);
      setTimeout(showPanel, 23000);
      setTimeout(async () => {
        activityPending = true;
        const originalPaused = settings.paused;
        changeSetting('paused', false);
        const controls = await petWindow.webContents.executeJavaScript(`(async () => {
          const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
          const currentVideo = () => [...document.querySelectorAll('video')].find(video => video.style.opacity === '1');
          await delay(100);
          const before = window.petDiagnostics.played.at(-1);
          document.querySelector('#next-action').click();
          await delay(800);
          const switched = window.petDiagnostics.played.at(-1) !== before;
          document.querySelector('#pause').click();
          await delay(100);
          const frozenAt = currentVideo().currentTime;
          await delay(250);
          const paused = currentVideo().paused && currentVideo().currentTime === frozenAt;
          const pauseIcon = document.querySelector('#pause').getAttribute('aria-pressed') === 'true' && !document.querySelector('#play-icon').hasAttribute('hidden');
          document.querySelector('#next-action').click();
          await delay(800);
          const switchedWhilePaused = currentVideo().paused;
          document.querySelector('#pause').click();
          await delay(100);
          const resumedAt = currentVideo().currentTime;
          await delay(250);
          return { switched, paused, pauseIcon, switchedWhilePaused, resumed: !currentVideo().paused && currentVideo().currentTime > resumedAt,
            buttons: [...document.querySelectorAll('nav button')].map(button => button.id), noTopBubble: !document.querySelector('#bubble') };
        })()`);
        const bulbs = [];
        for (const count of [0, 1, 3, 7]) {
          petWindow.webContents.send('activity', { ...activity, available: true, activeCount: count });
          await new Promise(resolve => setTimeout(resolve, 100));
          bulbs.push({ requests: count, lit: await petWindow.webContents.executeJavaScript('document.querySelectorAll(".bulb.lit").length') });
        }
        const accountBadges = [];
        for (const count of [0, 1, quota.accounts?.length || 0]) {
          petWindow.webContents.send('activity', { ...activity, available: true, observedAt: Date.now(), activeCount: count,
            activeAccountIds: (quota.accounts || []).slice(0, count).map(account => account.accountId) });
          await new Promise(resolve => setTimeout(resolve, 100));
          accountBadges.push({ expectedActive: count, badges: await petWindow.webContents.executeJavaScript(
            '[...document.querySelectorAll(".account-quota")].map(badge => ({ text: badge.textContent, active: badge.classList.contains("active"), color: getComputedStyle(badge).color }))') });
          if (count === 1) {
            mkdirSync(path.join(app.getAppPath(), 'qa'), { recursive: true });
            writeFileSync(path.join(app.getAppPath(), 'qa/account-colors.png'), (await petWindow.webContents.capturePage()).toPNG());
          }
        }
        const accountLayout = await petWindow.webContents.executeJavaScript(`(() => {
          const row = document.querySelector('#account-quotas');
          const sample = row.firstElementChild;
          if (!sample) return { available: false };
          while (row.children.length < 12) row.append(sample.cloneNode(true));
          const boxes = [...row.children].map(badge => badge.getBoundingClientRect());
          const aboveButtons = row.getBoundingClientRect().bottom < document.querySelector('nav').getBoundingClientRect().top;
          row.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));
          return { available: true, sameRow: boxes.every(box => box.top === boxes[0].top), aboveButtons,
            scrollable: row.scrollWidth > row.clientWidth, wheelScrolls: row.scrollLeft > 0, count: boxes.length };
        })()`);
        petWindow.webContents.send('quota', quota);
        petWindow.webContents.send('activity', activity);
        changeSetting('paused', originalPaused);
        const report = await petWindow.webContents.executeJavaScript('window.petDiagnostics');
        const originalBounds = petWindow.getBounds();
        const workArea = screen.getPrimaryDisplay().workArea;
        const requested = clampPosition({ x: workArea.x + workArea.width, y: originalBounds.y }, screen.getPrimaryDisplay());
        petWindow.setPosition(requested.x, requested.y);
        await new Promise(resolve => setTimeout(resolve, 300));
        const edge = { requested, actual: petWindow.getBounds(), workArea };
        petWindow.setBounds(originalBounds);
        const ui = await petWindow.webContents.executeJavaScript('({ filter: getComputedStyle(document.querySelector("video")).filter, status: document.querySelector("#request-lights").getAttribute("aria-label") })');
        mkdirSync(path.join(app.getAppPath(), 'qa'), { recursive: true });
        writeFileSync(path.join(app.getAppPath(), 'qa/smoke.json'), JSON.stringify({ report, activity, quota, edge, ui, controls, bulbs, accountBadges, accountLayout }, null, 2));
        const image = await petWindow.webContents.capturePage();
        writeFileSync(path.join(app.getAppPath(), 'qa/pet.png'), image.toPNG());
        if (panelWindow) {
          await panelWindow.webContents.executeJavaScript('window.scrollTo(0, 0)');
          await new Promise(resolve => setTimeout(resolve, 100));
          writeFileSync(path.join(app.getAppPath(), 'qa/panel.png'), (await panelWindow.webContents.capturePage()).toPNG());
        }
        app.quit();
      }, 27000);
    }
  }).catch(error => { console.error(error); app.quit(); });
}

app.on('window-all-closed', () => {});
app.on('before-quit', () => { for (const timer of timers) clearInterval(timer); });
