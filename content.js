(function () {
  const state = {
    overlay: null,
    countNode: null,
    mutationObserver: null,
    resizeObserver: null,
    intersectionObserver: null,
    tickScheduled: false,
    readKeys: new Set(),
    fallbackReadPosts: new WeakSet(),
    readCount: 0,
    postLimit: 0,
    readDate: '',
    hydrated: false
  };

  // Threads currently uses data-pressable-container for feed cards.
  const POST_SELECTORS = [
    'div[data-pressable-container="true"]',
    'article[role="article"]',
    'main article',
    'main [role="article"]',
    'article'
  ];

  function getDateKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  async function loadDailyState() {
    const today = getDateKey();
    const saved = await chrome.storage.local.get({
      readDate: today,
      readKeys: [],
      readCount: 0
    });

    state.readDate = saved.readDate === today ? today : today;
    state.readKeys = new Set(saved.readDate === today ? saved.readKeys : []);
    state.readCount = saved.readDate === today ? Number(saved.readCount) || 0 : 0;
    state.hydrated = true;

    await chrome.storage.local.set({
      readDate: today,
      readKeys: Array.from(state.readKeys),
      readCount: state.readCount
    });
  }

  function resetIfNewDay() {
    const today = getDateKey();
    if (state.readDate === today) return;

    state.readDate = today;
    state.readKeys = new Set();
    state.fallbackReadPosts = new WeakSet();
    state.readCount = 0;
    void chrome.storage.local.set({ readDate: today, readKeys: [], readCount: 0 });
  }

  function persistDailyState() {
    void chrome.storage.local.set({
      readDate: state.readDate,
      readKeys: Array.from(state.readKeys),
      readCount: state.readCount
    });
  }
  function ensureOverlay() {
    if (state.overlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'threads-read-counter';
    overlay.innerHTML = `
      <div class="trc-label">Posts read</div>
      <div class="trc-count">0</div>
    `;

    document.documentElement.appendChild(overlay);
    state.overlay = overlay;
    state.countNode = overlay.querySelector('.trc-count');
  }

  function getFeedPosts() {
    const posts = new Set();

    for (const selector of POST_SELECTORS) {
      document.querySelectorAll(selector).forEach((post) => posts.add(post));
    }

    return [...posts].filter((post) => {
      if (post.closest('#threads-read-counter')) return false;

      const rect = post.getBoundingClientRect();
      const textLength = (post.textContent || '').trim().length;
      return rect.width > 180 && rect.height > 80 && textLength > 20;
    });
  }

  function getPostKey(post) {
    const link = post.querySelector('a[href*="/post/"]');
    if (link?.href) return `url:${link.href.split('?')[0]}`;

    const id = post.getAttribute('data-interactive-id') ||
      post.getAttribute('data-id') ||
      post.id;
    if (id) return `id:${id}`;

    // Virtualized feeds may reuse one DOM node for a different post.
    const text = (post.textContent || '').replace(/\\s+/g, ' ').trim();
    return text ? `text:${text.slice(0, 240)}` : null;
  }

  function isCompleteVisible(el) {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const tolerance = 2;

    return rect.top >= -tolerance &&
      rect.bottom <= viewportHeight + tolerance &&
      rect.left >= -tolerance &&
      rect.right <= viewportWidth + tolerance;
  }

  function getVisibleRatio(el) {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);

    if (visibleWidth <= 0 || visibleHeight <= 0) return 0;

    return (visibleWidth * visibleHeight) / Math.max(rect.width * rect.height, 1);
  }

  function markReadPost(post) {
    const key = getPostKey(post);
    const alreadyRead = key ? state.readKeys.has(key) : state.fallbackReadPosts.has(post);
    if (alreadyRead) return;

    if (key) state.readKeys.add(key);
    else state.fallbackReadPosts.add(post);

    state.readCount += 1;
    persistDailyState();
  }

  function scanVisiblePosts() {
    for (const post of getFeedPosts()) {
      if (isCompleteVisible(post)) markReadPost(post);
    }
  }

  function syncTheme() {
    if (!state.overlay) return;

    const pageRoot = document.documentElement;
    const body = document.body;
    const rootStyle = getComputedStyle(pageRoot);
    const bodyStyle = body ? getComputedStyle(body) : null;
    const bodyColor = bodyStyle?.backgroundColor;
    const pageColor = bodyColor && bodyColor !== 'rgba(0, 0, 0, 0)' && bodyColor !== 'transparent'
      ? bodyColor
      : rootStyle.backgroundColor;
    const rgb = pageColor.match(/\d+/g)?.map(Number) || [];
    const isLightPage = rgb.length >= 3 && (rgb[0] + rgb[1] + rgb[2]) > 420;

    state.overlay.dataset.theme = isLightPage ? 'light' : 'dark';
  }
  function applyLimitState() {
    if (!state.overlay) return;

    const reached = state.postLimit > 0 && state.readCount >= state.postLimit;
    state.overlay.dataset.limitReached = reached ? 'true' : 'false';
    state.countNode.style.color = reached ? '#ff3b30' : '';
    const label = state.overlay.querySelector('.trc-label');
    if (label) label.style.color = reached ? '#ff3b30' : '';
  }
  function updateCounter() {
    if (!state.hydrated) return;
    resetIfNewDay();
    ensureOverlay();
    syncTheme();
    scanVisiblePosts();

    state.countNode.textContent = String(state.readCount);
    state.overlay.dataset.active = state.readCount > 0 ? 'true' : 'false';
    applyLimitState();

    chrome.runtime.sendMessage({
      type: 'threads-read-count',
      count: state.readCount
    }).catch(() => {});
  }

  function scheduleUpdate() {
    if (state.tickScheduled) return;
    state.tickScheduled = true;

    requestAnimationFrame(() => {
      state.tickScheduled = false;
      updateCounter();
    });
  }

  function attachObservers() {
    state.mutationObserver?.disconnect();
    state.resizeObserver?.disconnect();
    state.intersectionObserver?.disconnect();

    state.mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => {
        const target = record.target;
        return target.nodeType !== Node.ELEMENT_NODE ||
          !target.closest('#threads-read-counter');
      })) {
        scheduleUpdate();
      }
    });
    state.mutationObserver.observe(document.body, { childList: true, subtree: true });

    state.resizeObserver = new ResizeObserver(scheduleUpdate);
    state.resizeObserver.observe(document.documentElement);

    state.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) scheduleUpdate();
      },
      { threshold: [0, 0.5, 1] }
    );

    getFeedPosts().forEach((post) => state.intersectionObserver.observe(post));
  }

  chrome.storage.local.get({ postLimit: 0 }).then(({ postLimit }) => {
    state.postLimit = Number(postLimit) || 0;
    applyLimitState();
  }).catch(() => {});

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'threads-limit-state') {
      state.postLimit = Number(message.limit) || state.postLimit;
      applyLimitState();
      return;
    }

    if (message?.type !== 'threads-limit-changed') return;
    state.postLimit = Number(message.limit) || 0;
    updateCounter();
  });
  async function init() {
    await loadDailyState();
    ensureOverlay();
    attachObservers();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    scheduleUpdate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

















