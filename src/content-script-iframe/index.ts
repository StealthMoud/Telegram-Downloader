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

