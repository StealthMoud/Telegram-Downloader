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
