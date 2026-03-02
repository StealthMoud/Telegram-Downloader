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
}

function cancelDownload(id) {
  const dl = downloadRegistry.get(id);
  if (dl) {
    dl.status = 'cancelled';
    if (dl.abortController) dl.abortController.abort();
    downloadRegistry.delete(id);
    updateProgress(0, id, dl.page, dl.download_id, 'cancelled');
  }
}

function waitForResume(id) {
  return new Promise((resolve) => {
    const handler = () => {
      resumeSignals.removeEventListener('resume_' + id, handler);
      resolve();
    };
    resumeSignals.addEventListener('resume_' + id, handler);
  });
}

//监听自定义事件
document.addEventListener('media_download_event', function (e) {
  if (e.detail.type == 'single') {
    //单个下载
    handleDownload(e.detail.video_src.video_url, e.detail.video_src.video_id, e.detail.video_src.page, e.detail.video_src.download_id, e.detail);
  } else if (e.detail.type == 'batch') {
    //批量下载
    let video_list = e.detail.video_src;
    for (let i = 0; i < video_list.length; i++) {
      handleDownload(video_list[i].video_url, video_list[i].video_id, video_list[i].page, video_list[i].download_id, e.detail);
    }
  }
});

const downloadVideo = (url, id = '', page, download_id, detail) => {
  let blobs = [];
  let nextOffset = 0;
  let _totalSize = null;
  let fileExtension = 'mp4';
  const UserAgent = 'User-Agent Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0';

  const abortController = new AbortController();
  downloadRegistry.set(id, {
    status: 'downloading',
    page,
    download_id,
    abortController,
    lastProgress: 0
  });

  let fileName = detail?.title || (Math.random() + 1).toString(36).substring(2, 10);
  try {
    const metadata = JSON.parse(decodeURIComponent(url.split('/')[url.split('/').length - 1]));
    if (metadata.fileName) {
      fileName = metadata.fileName;
    }
  } catch (e) { }

  const fetchNextPart = async () => {
    // 1. Check for Cancellation
    const dl = downloadRegistry.get(id);
    if (!dl || dl.status === 'cancelled') return;

    // 2. Check for Pause
    if (dl.status === 'paused') {
      await waitForResume(id);
    }

    fetch(url, {
      method: 'GET',
      headers: {
        Range: `bytes=${nextOffset}-`,
      },
      'User-Agent': UserAgent,
      signal: abortController.signal
    })
      .then((res) => {
        if (![200, 206].includes(res.status)) {
          throw new Error('Non 200/206 response was received: ' + res.status);
        }
        const mime = res.headers.get('Content-Type').split(';')[0];
        fileExtension = mime.split('/')[1];
        fileName = detail?.title || fileName.substring(0, fileName.indexOf('.') + 1) + fileExtension;
        fileName = detail?.customTitle ? detail.customTitle + '_' + fileName : fileName;

        const match = res.headers.get('Content-Range').match(contentRangeRegexRule);

        const startOffset = parseInt(match[1]);
        const endOffset = parseInt(match[2]);
        const totalSize = parseInt(match[3]);

        if (startOffset !== nextOffset) {
          throw 'Gap detected between responses.';
        }
        if (_totalSize && totalSize !== _totalSize) {
          throw 'Total size differs';
        }

        nextOffset = endOffset + 1;
        _totalSize = totalSize;

        //触发进度更新
        if (id != '') {
          const prog = ((nextOffset * 100) / totalSize).toFixed(0);
          updateProgress(prog, id, page, download_id, downloadRegistry.get(id)?.status || 'downloading');
        }
        return res.blob();
      })
      .then((resBlob) => {
        if (resBlob) blobs.push(resBlob);
      })
