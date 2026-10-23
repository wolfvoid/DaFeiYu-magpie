import { AnimationDirector } from './animation.mjs';
import { accountPercentages } from './quota-display.mjs';

const api = window.pet;
const videos = [...document.querySelectorAll('video')];
const lights = document.querySelector('#request-lights');
const stage = document.querySelector('#stage');
const hitCanvas = document.createElement('canvas');
hitCanvas.width = 256;
hitCanvas.height = 144;
const hitContext = hitCanvas.getContext('2d', { willReadFrequently: true });
let visible = 0;
let generation = 0;
let director;
let settings;
let activity;
let quota;
let pointerStart;
let dragging = false;
let animationTimer;
let lastInteractive;
let failureCount = 0;
window.petDiagnostics = { loaded: false, errors: [], played: [], transparent: false };

function describe() {
  renderQuota();
  const requests = activity.available && Number.isInteger(activity.activeCount) ? Math.max(0, activity.activeCount) : 0;
  const description = activity.available ? requests ? `Magpie：${requests} 个进行中的请求（含排队）` : activity.label : 'Magpie 未连接，状态未知';
  lights.title = description;
  lights.setAttribute('aria-label', description);
  lights.classList.toggle('unavailable', !activity.available);
  if (lights.dataset.count !== String(requests)) {
    lights.replaceChildren();
    for (let index = 0; index < Math.max(1, requests); index++) {
      const bulb = document.querySelector('#bulb-template').content.firstElementChild.cloneNode(true);
      bulb.classList.toggle('lit', requests > 0);
      lights.append(bulb);
    }
    lights.dataset.count = String(requests);
  }
  const label = settings.paused ? '继续动画' : '暂停动画';
  const button = document.querySelector('#pause');
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(settings.paused));
  document.querySelector('#pause-icon').toggleAttribute('hidden', settings.paused);
  document.querySelector('#play-icon').toggleAttribute('hidden', !settings.paused);
}

function renderQuota() {
  const container = document.querySelector('#account-quotas');
  const scrollOffset = container.scrollLeft;
  container.replaceChildren();
  for (const account of accountPercentages(quota, activity)) {
    const badge = document.createElement('span');
    badge.className = 'account-quota';
    badge.classList.toggle('active', account.active);
    badge.classList.toggle('unavailable', !account.available);
    badge.textContent = account.text;
    badge.title = `${account.label} · ${account.active ? '正在使用' : '当前未确认有请求使用'} · ${account.available ? '剩余 ' + account.text + '（取最低额度窗口）' : '额度待刷新'}`;
    badge.setAttribute('aria-label', badge.title);
    container.append(badge);
  }
  container.scrollLeft = scrollOffset;
}

async function play(name) {
  if (!name) return;
  const request = ++generation;
  clearTimeout(animationTimer);
  const previous = videos[visible];
  const nextIndex = 1 - visible;
  const next = videos[nextIndex];
  next.pause();
  next.onended = null;
  next.src = new URL(`../assets/webm/${encodeURIComponent(name)}.webm`, import.meta.url).href;
  let timeout;
  try {
    await new Promise((resolve, reject) => {
      next.onloadeddata = resolve;
      next.onerror = () => reject(new Error(`无法播放：${name}`));
      timeout = setTimeout(() => reject(new Error(`动画加载超时：${name}`)), 10000);
      next.load();
    });
    clearTimeout(timeout);
    if (request !== generation) return;
    await next.play();
    if (request !== generation) { next.pause(); return; }
    next.style.opacity = '1';
    previous.style.opacity = '0';
    previous.pause();
    visible = nextIndex;
    if (settings.paused) next.pause();
    next.onended = () => { if (request === generation && !dragging) play(director.next()); };
    failureCount = 0;
    window.petDiagnostics.loaded = true;
    window.petDiagnostics.played.push(name);
    window.petDiagnostics.played = window.petDiagnostics.played.slice(-20);
    window.petDiagnostics.video = { width: next.videoWidth, height: next.videoHeight, duration: next.duration };
  } catch (error) {
    clearTimeout(timeout);
    if (request !== generation) return;
    window.petDiagnostics.errors.push(error.message);
    document.querySelector('#next-action').title = '动画暂不可用，点击换一个动作';
    if (++failureCount < 3) animationTimer = setTimeout(() => play(director.select(director.catalog.idle[0])), 1000);
  }
}

function applySettings(value) {
  const wasPaused = settings?.paused;
  settings = value;
  director.paused = value.paused;
  director.active = value.active;
  director.activity = value.followTasks ? activity : { state: 'idle' };
  if (value.paused) videos[visible].pause();
  else if (wasPaused) {
    if (videos[visible].ended) play(director.next());
    else videos[visible].play().catch(() => {});
  }
  describe();
}

api.on('activity', value => {
  activity = value;
  if (!director) return;
  if (settings.followTasks) play(director.update(value));
  describe();
});
api.on('settings', value => { if (director) applySettings(value); });
api.on('quota', value => { quota = value; renderQuota(); });
api.on('play', name => {
  if (!director) return;
  if (settings.paused) api.setting('paused', false);
  play(director.select(name, true));
});
api.on('cursor', point => {
  if (!director) return;
  let interactive = dragging;
  if (!interactive) {
    interactive = [...document.querySelectorAll('.interactive')].some(element => {
      const bounds = element.getBoundingClientRect();
      return point.x >= bounds.left && point.x < bounds.right && point.y >= bounds.top && point.y < bounds.bottom;
    });
  }
  const bounds = stage.getBoundingClientRect();
  if (!interactive && point.x >= bounds.left && point.x < bounds.right && point.y >= bounds.top && point.y < bounds.bottom && videos[visible].readyState >= 2) {
    try {
      hitContext.clearRect(0, 0, 256, 144);
      hitContext.drawImage(videos[visible], 0, 0, 256, 144);
      const pixel = hitContext.getImageData(Math.floor((point.x - bounds.left) / bounds.width * 256), Math.floor((point.y - bounds.top) / bounds.height * 144), 1, 1).data;
      interactive = pixel[3] > 20;
    } catch { interactive = true; }
  }
  if (interactive !== lastInteractive) { api.interactive(interactive); lastInteractive = interactive; }
});

stage.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  pointerStart = { x: event.screenX, y: event.screenY };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', event => {
  if (!pointerStart || settings.locked || dragging) return;
  if (Math.hypot(event.screenX - pointerStart.x, event.screenY - pointerStart.y) > 5) {
    dragging = true;
    api.drag('start');
    play(director.select('被鼠标拖拽悬空反馈', true));
  }
});
stage.addEventListener('pointerup', () => {
  if (!pointerStart) return;
  if (dragging) { api.drag('end'); dragging = false; play(director.next()); }
  else {
    const options = director.catalog.clicks.filter(name => name !== director.current);
    play(director.select(options[Math.floor(Math.random() * options.length)], true));
  }
  pointerStart = null;
});
stage.addEventListener('lostpointercapture', () => {
  if (dragging) { api.drag('end'); dragging = false; }
  pointerStart = null;
});
document.addEventListener('contextmenu', event => { event.preventDefault(); api.menu(); });
document.querySelector('#next-action').onclick = () => play(director.select(director.program(), true, true));
document.querySelector('#pause').onclick = () => api.setting('paused', !settings.paused);
document.querySelector('#menu').onclick = () => api.menu();
document.querySelector('#account-quotas').addEventListener('wheel', event => {
  const container = event.currentTarget;
  if (container.scrollWidth > container.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    container.scrollLeft += event.deltaY;
    event.preventDefault();
  }
}, { passive: false });

const initial = await api.getSnapshot();
settings = initial.settings;
activity = initial.activity;
quota = initial.quota;
director = new AnimationDirector(initial.catalog);
applySettings(settings);
await play(director.next());
setInterval(() => {
renderQuota();
if (videos[visible].readyState >= 2) {
  hitContext.clearRect(0, 0, 256, 144);
  hitContext.drawImage(videos[visible], 0, 0, 256, 144);
  const pixels = hitContext.getImageData(0, 0, 256, 144).data;
  let clear = 0;
  let opaque = 0;
  for (let index = 3; index < pixels.length; index += 4) { if (pixels[index] < 16) clear++; if (pixels[index] > 200) opaque++; }
  window.petDiagnostics.transparent = clear > 5000 && opaque > 100;
  window.petDiagnostics.alpha = { clear, opaque };
}
}, 2000);
