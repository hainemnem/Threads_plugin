(function () {
  const state = {
    overlay: null,
    countNode: null,
    observer: null,
    resizeObserver: null,
    mo: null,
    tickScheduled: false
  };

  const SELECTORS = [
    'main article',
    'article'
  ];

  function ensureOverlay() {
    if (state.overlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'threads-read-counter';
    overlay.innerHTML = `
      <div class="trc-label">Visible posts</div>
      <div class="trc-count">0</div>
    `;

    document.documentElement.appendChild(overlay);
    state.overlay = overlay;
    state.countNode = overlay.querySelector('.trc-count');
  }

  function getFeedArticles() {
    const articles = new Set();
    for (const selector of SELECTORS) {
      document.querySelectorAll(selector).forEach((el) => articles.add(el));
    }
    return [...articles];
  }

  function getVisibleRatio(el) {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);

    if (visibleWidth <= 0 || visibleHeight <= 0) return 0;

    const visibleArea = visibleWidth * visibleHeight;
    const totalArea = Math.max(rect.width * rect.height, 1);
    return visibleArea / totalArea;
  }

  function countVisiblePosts() {
    const articles = getFeedArticles();
    if (!articles.length) return 0;

    const threshold = window.innerHeight < 900 ? 0.55 : 0.5;

    return articles.filter((article) => getVisibleRatio(article) >= threshold).length;
  }

  function updateOverlay() {
    ensureOverlay();
    const visibleCount = countVisiblePosts();
    state.countNode.textContent = String(visibleCount);
    state.overlay.dataset.active = visibleCount > 0 ? 'true' : 'false';
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
    if (state.mo) state.mo.disconnect();
    if (state.resizeObserver) state.resizeObserver.disconnect();

    state.mo = new MutationObserver(scheduleUpdate);
    state.mo.observe(document.body, { childList: true, subtree: true });

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
