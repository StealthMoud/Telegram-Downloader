/**
 * Definitive "Audio-Style" Restoration
 * Removes FAB and non-working buttons.
 * Implements "Play & Capture" for Video and Audio.
 */

const PROCESSED_ATTR = 'data-tg-dl-processed';
const DOWNLOAD_EVENT = 'media_download_event';

// --- HELPERS ---

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function getFilenameBase() {
  try {
    const settings = await chrome.storage.local.get(['appSettings']);
    const s = (settings.appSettings || {}) as any;
    const parts: string[] = [];
    if (s.includeKeyword && s.customKeyword) parts.push(s.customKeyword);
    if (s.includeDate) parts.push(new Date().toISOString().split('T')[0]);
    if (s.includeUID) parts.push(Math.random().toString(36).substring(2, 8));
    return parts.join('_');
  } catch {
    return '';
  }
}

function getBestName(container: HTMLElement): string {
  // 1. Files/Documents with <a> and download attribute (Original Logic)
  const downloadLinks = container.querySelectorAll('a[href]');
  for (const link of Array.from(downloadLinks)) {
    const a = link as HTMLAnchorElement;
    if (a.querySelector('img')) continue; // Skip images
    const name = a.getAttribute('download') || a.innerText.trim();
    if (name && name !== 'file' && !name.startsWith('http') && !name.startsWith('blob:')) {
      return name;
    }
  }

  // 2. Class-based Titles (Web A & K)
  const titleSelectors = [
    '.file-title', '.document-title', '.audio-title',
    '.file-name', '.document-name', '.document-title',
    '.Document .title', '.Audio .title', '.Audio .name'
  ];
  for (const sel of titleSelectors) {
    const el = container.querySelector(sel) as HTMLElement;
    if (el && el.innerText.trim()) return el.innerText.trim();
  }

  // 3. Caption/Message Text fallback
  const textSelectors = ['.caption', '.text-content', '.message', '.bubble-content .text', '.message-text'];
  for (const sel of textSelectors) {
    const el = container.querySelector(sel) as HTMLElement;
    if (el && el.innerText.trim()) {
      return el.innerText.trim().split('\n')[0].substring(0, 50).replace(/[<>:"/\\|?*]/g, '_').trim();
    }
  }

  return '';
}
