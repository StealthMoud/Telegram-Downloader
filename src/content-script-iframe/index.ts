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
    if (a.src) { audioUrl = a.src; break; }
  }

  if (audioUrl) {
    playBtn.click(); // Stop
    const prefix = await getFilenameBase();
    const bestName = getBestName(container);
    const title = bestName || `audio_${mid}`;

    // Notify Side Panel: Starting
    chrome.runtime.sendMessage({
      type: 'download_status',
      id: mid,
      status: 'downloading',
      progress: 0,
      title: title
    });

    const event = new CustomEvent(DOWNLOAD_EVENT, {
      detail: {
        video_src: { video_url: audioUrl, video_id: mid, page: 'content', download_id: mid },
        type: 'single',
        fileType: 'audio',
        title: title,
        customTitle: prefix
      }
    });

    // Listen for progress from main.js
    const progressId = `${mid}_download_progress`;
    const handler = (ev: any) => {
      const prog = ev.detail.progress || 0;
      const status = ev.detail.status || (prog >= 100 ? 'finished' : 'downloading');

      chrome.runtime.sendMessage({
        type: 'download_status',
        id: mid,
        status: status,
        progress: prog
      });
      if (prog >= 100 || status === 'cancelled') document.removeEventListener(progressId, handler);
    };
    document.addEventListener(progressId, handler);

    document.dispatchEvent(event);
  } else {
    alert('Could not capture audio stream.');
  }

  btn.classList.remove('loading');
  btn.innerText = 'DOWNLOAD AUDIO';
}

async function handleDocumentDownload(container: HTMLElement, mid: string, btn: HTMLElement) {
  btn.classList.add('loading');
  const originalText = btn.innerText;
  btn.innerText = 'WAITING...';

  const prefix = await getFilenameBase();
  const bestName = getBestName(container);
  const title = bestName || `document_${mid}`;

  let capturedUrl: string | null = null;

  // Strategy 1: Intercept blob URL creation by hooking URL.createObjectURL
  const originalCreateObjectURL = URL.createObjectURL;
  let interceptedBlobUrl: string | null = null;
  URL.createObjectURL = function (obj: Blob | MediaSource) {
    const url = originalCreateObjectURL.call(URL, obj);
    interceptedBlobUrl = url;
    return url;
  };

  // Strategy 2: Look for download button in the document container and click it
  // Web K: .document with .document-download or clickable area
  // Web A: .Document with download button
  const downloadBtn = container.querySelector(
    '.document-download, .download-button, .btn-icon.tgico-download, .document-download-button'
  ) as HTMLElement;

  if (downloadBtn) {
    surgicalClick(downloadBtn);
  } else {
    // Click the document container itself to trigger Telegram's download
    const clickTarget = container.querySelector(
      '.document-thumb, .document-ico, .document-name, .file-title, .document-title'
    ) as HTMLElement;
    if (clickTarget) {
      surgicalClick(clickTarget);
    } else {
      surgicalClick(container);
    }
  }

  // Wait for blob URL interception or Telegram to process
  await sleep(2000);

  // Restore original function
  URL.createObjectURL = originalCreateObjectURL;

  if (interceptedBlobUrl) {
    capturedUrl = interceptedBlobUrl;
  }

  // Strategy 3: If no blob URL was intercepted, try to extract stream/progressive URL
  // by looking at the page's active network requests or document links
  if (!capturedUrl) {
    // Look for any anchor elements with download attributes that might have been created
    const allAnchors = document.querySelectorAll('a[download]');
    for (const anchor of Array.from(allAnchors)) {
      const a = anchor as HTMLAnchorElement;
      if (a.href && (a.href.startsWith('blob:') || a.href.includes('stream/') || a.href.includes('progressive/'))) {
        capturedUrl = a.href;
        break;
      }
    }
  }

  // Strategy 4: For Web K, try to find the stream URL from the document's data attributes
  if (!capturedUrl && version === 'k') {
    // In Web K, documents are loaded through stream URLs similar to videos
    // Try clicking the main document area and then looking for the download
    const docEl = container.closest('.document, .document-container') as HTMLElement;
    if (docEl) {
      // Look for preloader that indicates a download is in progress
      for (let i = 0; i < 10; i++) {
        await sleep(500);
        // Check if a blob URL was intercepted during this time
        if (interceptedBlobUrl) {
          capturedUrl = interceptedBlobUrl;
          break;
        }
        // Check for newly created download links
        const newAnchors = document.querySelectorAll('a[download]');
        for (const anchor of Array.from(newAnchors)) {
          const a = anchor as HTMLAnchorElement;
          if (a.href && a.href.startsWith('blob:')) {
            capturedUrl = a.href;
            break;
          }
        }
        if (capturedUrl) break;
      }
    }
  }

  // Strategy 5: For Web A, similar approach
  if (!capturedUrl && version === 'a') {
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      if (interceptedBlobUrl) {
        capturedUrl = interceptedBlobUrl;
        break;
      }
      const newAnchors = document.querySelectorAll('a[download]');
      for (const anchor of Array.from(newAnchors)) {
        const a = anchor as HTMLAnchorElement;
        if (a.href && a.href.startsWith('blob:')) {
          capturedUrl = a.href;
          break;
        }
      }
      if (capturedUrl) break;
    }
  }

  // Dispatch to download engine
  if (capturedUrl) {
    chrome.runtime.sendMessage({
      type: 'download_status',
      id: mid,
      status: 'starting',
      title: title
    });

    const event = new CustomEvent(DOWNLOAD_EVENT, {
      detail: {
        video_src: { video_url: capturedUrl, video_id: mid, page: 'content', download_id: mid },
        type: 'single',
        fileType: 'document',
        title: title,
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
    // Fallback: If we couldn't capture the URL, the document might have already
    // been downloaded by Telegram's native download mechanism triggered by our click.
    // Show a helpful message.
    alert('The file download has been triggered via Telegram. Check your downloads folder. If it did not start, try clicking the file directly in the chat.');
  }

  btn.classList.remove('loading');
  btn.innerText = originalText;
}

// --- UI INJECTION ---

function addDownloadButton(container: HTMLElement, targetEl: HTMLElement, mid: string, type: 'media' | 'audio' | 'document') {
  if (container.hasAttribute(PROCESSED_ATTR)) return;
  container.setAttribute(PROCESSED_ATTR, '1');

  const btn = document.createElement('button');
  btn.className = 'tg-download-btn' + (type === 'audio' ? ' downloadaudio' : type === 'document' ? ' downloaddoc' : '');
  btn.innerText = type === 'audio' ? 'DOWNLOAD AUDIO' : type === 'document' ? 'DOWNLOAD FILE' : 'DOWNLOAD';

  btn.onclick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (type === 'audio') {
      await handleAudioDownload(container, mid, btn);
    } else if (type === 'document') {
      await handleDocumentDownload(container, mid, btn);
    } else {
      await handleMediaDownload(targetEl, mid, btn);
    }
  };

  container.appendChild(btn);
}

// --- SCANNER ---

function scan() {
  // Web A
  document.querySelectorAll('.Message.message-list-item').forEach(el => {
    const mid = el.getAttribute('data-message-id');
    if (!mid) return;

    // Only target media containers, excluding plain text
    const media = el.querySelector('.media-inner, .Album, .media-photo, .media-video') as HTMLElement;
    if (media) addDownloadButton(media, media, mid, 'media');

    const audio = el.querySelector('.Audio') as HTMLElement;
    if (audio) addDownloadButton(audio, audio, mid, 'audio');

    // Documents (PDFs, ZIPs, photos/videos sent as documents)
    const doc = el.querySelector('.Document:not(.Audio)') as HTMLElement;
    if (doc && !media && !audio) addDownloadButton(doc, doc, mid, 'document');
  });

  // Web K
  document.querySelectorAll('.bubble-content-wrapper, .media-container, .audio').forEach(el => {
    const parent = el.closest('[data-mid], [data-message-id]') as HTMLElement;
    const mid = parent?.getAttribute('data-mid') || parent?.getAttribute('data-message-id');
    if (!mid) return;

    if (el.classList.contains('audio')) {
      addDownloadButton(el as HTMLElement, el as HTMLElement, mid, 'audio');
    } else {
      // Check for document container separately from media
      const docContainer = el.querySelector('.document-container, .document') as HTMLElement;
      const media = el.querySelector('.media-photo, .media-video, img.full-media') as HTMLElement;

      if (docContainer && !media) {
        // This is a document (file, photo-as-document, video-as-document)
        addDownloadButton(el as HTMLElement, docContainer, mid, 'document');
      } else if (media) {
        // This is regular media (photo, video)
        addDownloadButton(el as HTMLElement, media, mid, 'media');
      }
    }
  });

  // Web K: Also scan for standalone document messages that may not be in bubble-content-wrapper
  document.querySelectorAll('.document-container, .document').forEach(el => {
    // Skip if already processed or inside an already-processed wrapper
    if ((el as HTMLElement).hasAttribute(PROCESSED_ATTR)) return;
    if (el.closest(`[${PROCESSED_ATTR}]`)) return;

    const parent = el.closest('[data-mid], [data-message-id]') as HTMLElement;
    const mid = parent?.getAttribute('data-mid') || parent?.getAttribute('data-message-id');
    if (!mid) return;

    // Skip audio documents
    if (el.classList.contains('audio') || el.closest('.audio')) return;

    addDownloadButton(el as HTMLElement, el as HTMLElement, mid, 'document');
  });
}

// --- INITIALIZATION ---

function init() {
  detectVersion();

  if (!document.getElementById('tg-dl-styles')) {
    const s = document.createElement('style');
    s.id = 'tg-dl-styles';
    s.textContent = `
      .tg-download-btn {
        color: #ffffff !important;
        background: linear-gradient(135deg, #1677ff 0%, #2aa0ff 100%) !important;
        padding: 6px 12px !important;
        min-width: 84px !important;
        height: 34px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 8px !important;
        border: none !important;
        box-shadow: 0 4px 12px rgba(22, 117, 255, 0.2) !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        font-weight: 600 !important;
        font-size: 12px !important;
        z-index: 1000 !important;
        margin: 4px !important;
        display: block !important;
      }
      .tg-download-btn:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 16px rgba(22, 117, 255, 0.3) !important;
      }
      .tg-download-btn.loading { opacity: 0.7 !important; pointer-events: none !important; }
      .downloadaudio { min-width: 120px !important; }
      .downloaddoc { min-width: 120px !important; background: linear-gradient(135deg, #10b981 0%, #34d399 100%) !important; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2) !important; }
      .downloaddoc:hover { box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3) !important; }
    `;
    document.head.appendChild(s);
  }

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('main.js');
  document.body.appendChild(script);

  setInterval(scan, 3000);
  scan();

  // Listen for control messages from extension sidepanel
  chrome.runtime.onMessage.addListener((msg) => {
    if (['PAUSE_DOWNLOAD', 'RESUME_DOWNLOAD', 'CANCEL_DOWNLOAD'].includes(msg.type)) {
      window.postMessage({ type: msg.type, id: msg.id }, '*');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
