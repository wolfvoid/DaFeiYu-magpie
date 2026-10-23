import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';

const identitySalt = randomBytes(32);
const accountKey = (provider, user) => createHmac('sha256', identitySalt).update(JSON.stringify([provider, user])).digest('hex');

export function resolvePort() {
  try {
    const settings = JSON.parse(readFileSync(join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'magpie/settings.json'), 'utf8'));
    if (Number.isInteger(settings.port) && settings.port > 0 && settings.port <= 65535) return settings.port;
  } catch {}
  return 3425;
}

export async function readLocal(route, { port = resolvePort(), fetcher = fetch, timeoutMs = 5000, maxBytes = 2000000 } = {}) {
  const response = await fetcher(`http://127.0.0.1:${port}${route}`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'BlueDaFeiYu/0.2.0' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) throw new Error('Response too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const unknown = () => ({ state: 'unknown', label: 'Magpie 未连接或状态暂不可读', available: false, activeCount: 0, observedAt: Date.now() });
const count = value => Number.isInteger(value) && value >= 0;

export function chooseActivity(data, now = Date.now()) {
  if (data?.object !== 'concurrency' || !['requests', 'waiting', 'tools'].every(key => count(data[key]))) return unknown();
  let state = 'idle';
  let label = 'Magpie 当前没有进行中的请求';
  if (data.requests > data.waiting) { state = 'thinking'; label = 'Magpie 正在处理模型请求'; }
  else if (data.waiting > 0) { state = 'waiting'; label = 'Magpie 请求排队中'; }
  else if (data.tools > 0) { state = 'working'; label = 'Magpie 正在等待客户端工具结果'; }
  return { state, label, available: true, activeCount: data.requests, waitingCount: data.waiting,
    toolCount: data.tools, observedAt: now, scope: '本机 Magpie 网关' };
}

export class ActivityReader {
  constructor(options = {}) { this.options = options; this.traceSequence = 0; this.routes = new Map(); }
  async read() {
    try {
      const concurrency = await readLocal('/v1/magpie/concurrency', this.options);
      const activity = chooseActivity(concurrency);
      const activeRoutes = (Array.isArray(concurrency.active) ? concurrency.active : [])
        .filter(request => request.phase === 'upstream' && Number.isSafeInteger(request.route)).map(request => request.route);
      if (!activity.available || !activeRoutes.length) return { ...activity, activeAccountIds: [] };
      try {
        const trace = await readLocal(`/v1/magpie/trace?after=${this.traceSequence}`, { ...this.options, maxBytes: 8000000 });
        if (trace.object !== 'trace' || !Array.isArray(trace.routes) || !Array.isArray(trace.ids) || !Number.isSafeInteger(trace.seq)) throw new Error('Incompatible trace');
        if (trace.seq < this.traceSequence) this.routes.clear();
        this.traceSequence = trace.seq;
        for (const route of trace.routes) this.routes.set(route.id, activeAccountsForRoute(route));
        const retained = new Set(trace.ids);
        for (const id of this.routes.keys()) if (!retained.has(id)) this.routes.delete(id);
        return { ...activity, activeAccountIds: [...new Set(activeRoutes.flatMap(id => this.routes.get(id) || []))] };
      } catch {
        this.traceSequence = 0;
        this.routes.clear();
        return { ...activity, activeAccountIds: [], accountStatusAvailable: false };
      }
    }
    catch { return unknown(); }
  }
}

export function activeAccountsForRoute(route) {
  if (route.done !== false || !Array.isArray(route.tries)) return [];
  const candidates = [...(route.order || []), ...(route.left || [])];
  return route.tries.filter(attempt => attempt.done === false).flatMap(attempt => {
    const account = candidates.find(candidate => candidate.id === attempt.id);
    return account && typeof account.provider === 'string' && typeof account.who === 'string' && account.who
      ? [accountKey(account.provider, account.who)] : [];
  });
}

export function normalizeCards(data, now = Date.now()) {
  const windows = [];
  const accounts = [];
  for (const [index, card] of (Array.isArray(data?.data) ? data.data : []).entries()) {
    const accountId = accountKey(card.provider || '', card.user || `unknown-${index}`);
    accounts.push({ accountId, label: `${card.name || '订阅'} · ${card.plan || '账户'} #${index + 1}` });
    for (const window of Array.isArray(card.windows) ? card.windows : []) {
      if (typeof window.used !== 'number' || !Number.isFinite(window.used)) continue;
      const used = Math.max(0, Math.min(100, window.used));
      const readAt = Date.parse(card.readAt);
      const reset = Date.parse(window.resetsAt);
      windows.push({ accountId, label: `${card.name || '订阅'} · ${card.plan || '账户'} #${index + 1} · ${window.name || '额度'}`,
        used, remaining: 100 - used, resetsAt: Number.isFinite(reset) ? reset / 1000 : null,
        readAt: Number.isFinite(readAt) ? readAt : null,
        stale: !Number.isFinite(readAt) || now - readAt > 600000 });
    }
  }
  return { ok: windows.length > 0, windows, accounts, observedAt: now,
    error: windows.length ? null : 'Magpie 尚无可显示的额度；请在 Magpie 中检查订阅' };
}

export async function readQuota(options = {}) {
  try {
    const cards = await readLocal('/v1/magpie/quotas/cards', options);
    const quota = normalizeCards(cards);
    try {
      const usage = await readLocal('/v1/magpie/usage?period=today', options);
      if (count(usage.calls) && count(usage.errors)) quota.usage = { calls: usage.calls, errors: usage.errors };
    } catch {}
    return quota;
  } catch {
    return { ok: false, windows: [], observedAt: Date.now(), error: '无法读取 Magpie 额度，请确认本机 Magpie 已启动' };
  }
}
