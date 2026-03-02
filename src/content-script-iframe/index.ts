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

let version: 'a' | 'k' | 'unknown' = 'unknown';
function detectVersion() {
  const url = window.location.href;
  if (url.includes('web.telegram.org/a')) version = 'a';
  else if (url.includes('web.telegram.org/k')) version = 'k';
}

// --- CORE EXTRACTION ENGINE ---

/**
 * Surgical Click: Dispatches precise MouseEvents like the original code
 */
function surgicalClick(el: HTMLElement) {
  if (!el) return;
  const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
  events.forEach(name => {
    const ev = new MouseEvent(name, { bubbles: true, cancelable: true, view: window });
    el.dispatchEvent(ev);
  });
}

async function handleMediaDownload(targetEl: HTMLElement, mid: string, btn: HTMLElement) {
  btn.classList.add('loading');
  const originalText = btn.innerText;
  btn.innerText = 'WAITING...';

  // 1. Trigger Media Viewer Surgically
  console.log('[TG-DL] Surgically opening viewer for:', mid);
  surgicalClick(targetEl);

  let capturedUrl = null;
  let type: 'video' | 'image' = 'image';

  // 2. Original Polling Logic (Version Specific)
  if (version === 'a') {
    // Web A: Poll for Slide--active
    for (let i = 0; i < 15; i++) {
      await sleep(200);
      const activeSlide = document.querySelector('.MediaViewerSlide--active');
      if (activeSlide) {
        const video = activeSlide.querySelector('video') as HTMLVideoElement;
        const img = activeSlide.querySelector('img.full-media') as HTMLImageElement;
        if (video?.src && video.src.length > 20) {
          capturedUrl = video.src;
          type = 'video';
          break;
        } else if (img?.src && img.src.length > 20) {
          capturedUrl = img.src;
          type = 'image';
          break;
        }
      }
    }
  } else {
    // Web K: Poll for media-viewer-whole
    for (let i = 0; i < 15; i++) {
      await sleep(200);
      const viewer = document.querySelector('.media-viewer-whole');
      if (viewer) {
        const video = viewer.querySelector('video') as HTMLVideoElement;
        const img = viewer.querySelector('img.media-photo') as HTMLImageElement;
        if (video?.src && video.src.length > 20) {
          capturedUrl = video.src;
          type = 'video';
          break;
        } else if (img?.src && img.src.length > 20) {
          capturedUrl = img.src;
          type = 'image';
          break;
        }
      }
    }

    // Web K Fallback: Trigger Quality Menu if still no URL
    if (!capturedUrl && version === 'k') {
      const viewer = document.querySelector('.media-viewer-whole');
      const buttons = viewer?.querySelectorAll('.media-viewer-buttons .btn-icon');
      if (buttons && buttons.length >= 3) {
        surgicalClick(buttons[2] as HTMLElement); // 3rd is Quality
        await sleep(500);
        const firstMenuItem = document.querySelector('.quality-download-options-button-menu .btn-menu-item') as HTMLElement;
        if (firstMenuItem) {
          surgicalClick(firstMenuItem);
          await sleep(1000);
          const video = viewer?.querySelector('video') as HTMLVideoElement;
          if (video?.src) capturedUrl = video.src;
        }
      }
    }
  }

  // 3. Dispatch to Engine
  if (capturedUrl) {
    const prefix = await getFilenameBase();
    const bestName = getBestName(targetEl.closest('.message-list-item, .bubble-content-wrapper') as HTMLElement || targetEl);
    const finalTitle = bestName || `telegram_media_${mid}`;

    chrome.runtime.sendMessage({
      type: 'download_status',
      id: mid,
      status: 'starting',
      title: finalTitle
    });

    const event = new CustomEvent(DOWNLOAD_EVENT, {
      detail: {
        video_src: { video_url: capturedUrl, video_id: mid, page: 'content', download_id: mid },
        type: 'single',
        title: finalTitle,
        customTitle: prefix
      }
    });

    // Listen for progress
    const progressId = `${mid}_download_progress`;
    const progressHandler = (ev: any) => {
      const prog = ev.detail.progress || 0;
      const status = ev.detail.status || (prog >= 100 ? 'finished' : 'downloading');

      chrome.runtime.sendMessage({
        type: 'download_status',
        id: mid,
        status: status,
        progress: prog
      });
      if (prog >= 100 || status === 'cancelled') document.removeEventListener(progressId, progressHandler);
    };
    document.addEventListener(progressId, progressHandler);

    document.dispatchEvent(event);
  } else {
    alert('Capture failed. Please try clicking the media manually while waitng.');
  }

  // 4. Surgical Auto-Close Viewer
  setTimeout(() => {
    if (version === 'a') {
      const actions = document.querySelector('.MediaViewerActions');
      const closeBtns = actions?.querySelectorAll('.Button.smaller.round');
      if (closeBtns && closeBtns.length > 0) {
        surgicalClick(closeBtns[closeBtns.length - 1] as HTMLElement);
      }
    } else {
      const viewer = document.querySelector('.media-viewer-whole');
      const buttons = viewer?.querySelectorAll('.media-viewer-buttons .btn-icon');
      if (buttons && buttons.length >= 5) {
        surgicalClick(buttons[4] as HTMLElement); // 5th is usually Close
      }
    }
    btn.classList.remove('loading');
    btn.innerText = originalText;
  }, 1200);
}
async function handleAudioDownload(container: HTMLElement, mid: string, btn: HTMLElement) {
  btn.classList.add('loading');
  btn.innerText = 'WAITING...';

  const playBtn = container.querySelector('.audio-play-icon, .Audio .play-button, [class*="play-button"]') as HTMLElement;
  if (!playBtn) {
    btn.classList.remove('loading');
    btn.innerText = 'DOWNLOAD AUDIO';
    return;
  }

  playBtn.click();
  await sleep(1500);

  const audioTags = document.querySelectorAll('audio');
  let audioUrl = null;
  for (const a of audioTags) {
