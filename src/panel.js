const api = window.pet;
let catalog;
let lastQuota;

function renderActivity(activity) {
  document.querySelector('#activity').textContent = activity.label + (activity.activeCount > 1 ? ` · ${activity.activeCount} 个请求` : '');
  document.querySelector('#scope').textContent = activity.available ? '本机 Magpie' : '状态未知';
}

function renderQuota(quota) {
  lastQuota = quota;
  const container = document.querySelector('#quota');
  container.replaceChildren();
  if (!quota.ok) {
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = quota.error || '额度暂不可用';
    container.append(error);
  }
  for (const window of quota.windows || []) {
    const expired = (window.resetsAt && window.resetsAt * 1000 <= Date.now()) || !window.readAt || Date.now() - window.readAt > 600000;
    const row = document.createElement('div');
    row.className = 'quota-row';
    const label = document.createElement('div');
    label.className = 'quota-label';
    const name = document.createElement('span');
    name.textContent = window.label;
    const remaining = document.createElement('strong');
    remaining.textContent = expired ? '待刷新' : `${Math.round(window.remaining)}%`;
    label.append(name, remaining);
    const meter = document.createElement('div');
    meter.className = 'meter';
    const fill = document.createElement('span');
    fill.style.width = `${expired ? 0 : window.remaining}%`;
    if (window.remaining < 20) fill.style.background = '#db9f78';
    meter.append(fill);
    const reset = document.createElement('div');
    reset.className = 'reset';
    reset.textContent = window.resetsAt ? `重置：${new Date(window.resetsAt * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}（北京时间）` : '重置时间暂不可用';
    reset.textContent += window.readAt ? ` · 数据 ${new Date(window.readAt).toLocaleTimeString('zh-CN')}` : ' · 数据时间未知';
    row.append(label, meter, reset);
    container.append(row);
  }
  const stale = quota.observedAt && Date.now() - quota.observedAt > 240000;
  document.querySelector('#quota-time').textContent = quota.observedAt ?
    `${quota.ok ? 'Magpie 缓存额度 · 剩余比例' : '查询未成功'} · ${new Date(quota.observedAt).toLocaleTimeString('zh-CN')}${stale ? ' · 请刷新' : ''}。每 30 秒同步；过期请在 Magpie 刷新。` : '正在读取 Magpie 额度…';
  document.querySelector('#usage').textContent = quota.usage ? `Magpie 今日：${quota.usage.calls} 次请求 · ${quota.usage.errors} 次错误（按 Magpie 统计口径）` : '';
}

function renderSettings(settings) {
  for (const input of document.querySelectorAll('[data-setting]')) input.checked = settings[input.dataset.setting];
  document.querySelector('#size').value = settings.size;
}

function filterActions() {
  const query = document.querySelector('#search').value.trim().toLowerCase();
  const container = document.querySelector('#actions');
  container.replaceChildren();
  for (const name of catalog.names.filter(name => name.toLowerCase().includes(query))) {
    const button = document.createElement('button');
    button.textContent = name;
    button.onclick = () => api.play(name);
    container.append(button);
  }
}

document.querySelector('#refresh').onclick = async () => {
  const button = document.querySelector('#refresh');
  button.disabled = true;
  button.textContent = '查询中…';
  try { renderQuota(await api.refreshQuota()); }
  finally { button.disabled = false; button.textContent = '刷新'; }
};
document.querySelector('#open-magpie').onclick = () => api.openMagpie();
document.querySelector('#search').oninput = filterActions;
document.querySelector('#size').onchange = event => api.setting('size', Number(event.target.value));
for (const input of document.querySelectorAll('[data-setting]')) input.onchange = () => api.setting(input.dataset.setting, input.checked);
for (const button of document.querySelectorAll('[data-play]')) button.onclick = () => api.play(button.dataset.play);
api.on('activity', renderActivity);
api.on('quota', renderQuota);
api.on('settings', renderSettings);
api.getSnapshot().then(snapshot => {
  catalog = snapshot.catalog;
  renderActivity(snapshot.activity);
  renderQuota(snapshot.quota);
  renderSettings(snapshot.settings);
  filterActions();
});
setInterval(() => { if (lastQuota) renderQuota(lastQuota); }, 30000);
