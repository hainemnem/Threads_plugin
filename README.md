# Threads Read Counter

A lightweight Chrome extension that shows how many Threads posts are visible in the feed.

## Install locally

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder

## How it counts

- It looks for `article` elements in the Threads feed
- It counts only posts that are visibly inside the viewport
- The threshold adapts a little based on browser height so the number changes naturally with window size
