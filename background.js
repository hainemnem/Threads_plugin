const DEFAULT_LIMIT = 0;
const GREEN = '#2e7d32';
const RED = '#b3261e';
const tabCounts = new Map();

async function updateBadge(tabId, count) {
  const result = await chrome.storage.local.get({ postLimit: DEFAULT_LIMIT });
  const limit = Number(result.postLimit) || DEFAULT_LIMIT;
  const reached = limit > 0 && count >= limit;

  await chrome.action.setBadgeText({
    tabId,
    text: count > 999 ? '999+' : String(count)
  });
  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: reached ? RED : GREEN
  });
  chrome.tabs.sendMessage(tabId, {
    type: 'threads-limit-state',
    reached,
    limit
  }).catch(() => {});

  await chrome.action.setTitle({
    tabId,
    title: limit > 0
      ? `Threads posts read: ${count}/${limit}`
      : `Threads posts read: ${count}`
  });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'threads-read-count' || !sender.tab?.id) return;
  const count = Math.max(0, Number(message.count) || 0);
  tabCounts.set(sender.tab.id, count);
  updateBadge(sender.tab.id, count).catch(() => {});
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.postLimit) return;

  chrome.tabs.query({
    url: [
      'https://www.threads.com/*',
      'https://www.threads.net/*',
      'https://threads.com/*',
      'https://threads.net/*'
    ]
  }).then((tabs) => {
    for (const tab of tabs) {
      const count = tabCounts.get(tab.id) || 0;
      updateBadge(tab.id, count).catch(() => {});
      chrome.tabs.sendMessage(tab.id, {
        type: 'threads-limit-changed',
        limit: Number(changes.postLimit.newValue) || DEFAULT_LIMIT
      }).catch(() => {});
    }
  }).catch(() => {});
});




