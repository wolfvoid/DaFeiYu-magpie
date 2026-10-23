export function accountPercentages(quota, activity, now = Date.now()) {
  const activeIds = new Set(activity?.available && now - activity.observedAt < 10000 ? activity.activeAccountIds || [] : []);
  return (quota?.accounts || []).map(account => {
    const windows = (quota.windows || []).filter(window => window.accountId === account.accountId);
    const valid = quota.ok && windows.length > 0 && windows.every(window =>
      Number.isFinite(window.remaining) && window.readAt && now - window.readAt < 600000 &&
      (!window.resetsAt || window.resetsAt * 1000 > now));
    return { ...account, active: activeIds.has(account.accountId),
      text: valid ? `${Math.round(Math.min(...windows.map(window => window.remaining)))}%` : '—%',
      available: Boolean(valid) };
  });
}
