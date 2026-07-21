chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'threads-read-count' || !sender.tab?.id) return;

  const count = Math.max(0, Number(message.count) || 0);
  chrome.action.setBadgeText({
    tabId: sender.tab.id,
    text: count > 999 ? '999+' : String(count)
  });
  chrome.action.setBadgeBackgroundColor({
    tabId: sender.tab.id,
    color: '#b3261e'
  });
  chrome.action.setTitle({
    tabId: sender.tab.id,
    title: `Threads posts read: ${count}`
  });
});
