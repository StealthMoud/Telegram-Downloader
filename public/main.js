const contentRangeRegexRule = /^bytes (\d+)-(\d+)\/(\d+)$/;
const REFRESH_DELAY = 500;

// Global Download Registry
const downloadRegistry = new Map();

// Global EventEmitter-like pattern for resume signals
const resumeSignals = new EventTarget();

// Listen for control messages from sidepanel/content-script
window.addEventListener('message', (e) => {
  const { type, id } = e.data || {};
  if (type === 'PAUSE_DOWNLOAD') pauseDownload(id);
  if (type === 'RESUME_DOWNLOAD') resumeDownload(id);
  if (type === 'CANCEL_DOWNLOAD') cancelDownload(id);
});

function pauseDownload(id) {
  const dl = downloadRegistry.get(id);
  if (dl) {
    dl.status = 'paused';
    updateProgress(dl.lastProgress, id, dl.page, dl.download_id, 'paused');
  }
}

function resumeDownload(id) {
  const dl = downloadRegistry.get(id);
  if (dl && dl.status === 'paused') {
    dl.status = 'downloading';
    resumeSignals.dispatchEvent(new CustomEvent('resume_' + id));
    updateProgress(dl.lastProgress, id, dl.page, dl.download_id, 'downloading');
  }
