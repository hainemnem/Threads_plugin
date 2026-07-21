(function () {
  const state = {
    overlay: null,
    countNode: null,
    mutationObserver: null,
    resizeObserver: null,
    tickScheduled: false,
    readPosts: new WeakSet(),
    readCount: 0
  };

  const POST_SELECTORS = [
    'main article',
    'main [role="article"]',
    'article',
    '[role="article"]'
  ];

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
      document.querySelectorAll(selector).forEach((el) => posts.add(el));
    }

    document.querySelectorAll('main a[href*="/post/"]').forEach((link) => {
      const post = link.closest('[role="article"], article');
      if (post) posts.add(post);
    });

    return [...posts].filter((post) => {
      const rect = post.getBoundingClientRect();
      return rect.width > 180 && rect.height > 80 && post.closest('main');
    });
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

  function markReadPosts() {
    const threshold = window.innerHeight < 900 ? 0.48 : 0.5;

    for (const post of getFeedPosts()) {
      if (!state.readPosts.has(post) && getVisibleRatio(post) >= threshold) {
        state.readPosts.add(post);
        state.readCount += 1;
      }
    }
  }

  function updateOverlay() {
    ensureOverlay();
    markReadPosts();
    state.countNode.textContent = String(state.readCount);
    state.overlay.dataset.active = state.readCount > 0 ? 'true' : 'false';

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
      updateOverlay();
    });
  }

  function attachObservers() {
    if (state.mutationObserver) state.mutationObserver.disconnect();
    if (state.resizeObserver) state.resizeObserver.disconnect();

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
  }

  function init() {
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
