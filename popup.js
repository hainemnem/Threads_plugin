const form = document.querySelector('#limit-form');
const input = document.querySelector('#post-limit');

let previousLimit = 0;

chrome.storage.local.get({ postLimit: 0 }).then(({ postLimit }) => {
  previousLimit = Number(postLimit) || 0;
  input.value = previousLimit > 0 ? String(previousLimit) : '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const value = input.value.trim();
  let nextLimit = 0;

  if (value !== '') {
    nextLimit = Number(value);
    if (!Number.isInteger(nextLimit) || nextLimit < 1) return;
  }

  if (nextLimit > 0) {
    await chrome.storage.local.set({ postLimit: nextLimit });
  } else {
    await chrome.storage.local.remove('postLimit');
  }

  previousLimit = nextLimit;
});
