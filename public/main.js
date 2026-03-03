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
  let fileMimeType = 'video/mp4';
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
        fileMimeType = mime;
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
      .then(() => {
        if (!_totalSize) {
          throw new Error('_totalSize is NULL');
        }

        if (nextOffset < _totalSize) {
          fetchNextPart();
        } else {
          saveFile();
        }
      })
      .catch((reason) => {
        if (reason.name === 'AbortError') return;
        console.error('downloadVideo fetch error:', reason, fileName);
        updateProgress(0, id, page, download_id, 'error');
        downloadRegistry.delete(id);
      });
  };

  const saveFile = () => {
    if (downloadRegistry.get(id)?.status === 'cancelled') return;

    const customFilename = detail?.customTitle ? detail.customTitle + '_' + fileName : fileName;
    const blob = new Blob(blobs, { type: fileMimeType });
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    document.body.appendChild(a);
    a.href = blobUrl;
    a.download = customFilename;
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);

    downloadRegistry.delete(id);
    updateProgress(100, id, page, download_id, 'finished');
  };

  fetchNextPart();
};

async function fetchUrl(url, abortSignal) {
  let t = await fetch(url, { headers: { Range: 'bytes=0-' }, signal: abortSignal });
  if (!t.ok) throw Error(`HTTP error! Status: ${t.status}`);
  let r = parseInt(t.headers.get('Content-Range').split('/')[1], 10),
    o = parseInt(t.headers.get('Content-Length'), 10),
    n = t.headers.get('Content-Type'),
    s = t.headers.get('Accept-Ranges');
  if ('bytes' !== s) throw Error('Server does not support partial content (byte ranges)');
  return {
    contentType: n,
    segmentCount: Math.ceil(r / o),
    contentSize: r,
    segmentSize: o,
  };
}

async function handleDownload(url, id, page, download_id, detail) {
  if (url.startsWith('blob:')) {
    return downloadVideo(url, id, page, download_id, detail);
  }

  const abortController = new AbortController();
  downloadRegistry.set(id, {
    status: 'downloading',
    page,
    download_id,
    abortController,
    lastProgress: 0
  });

  try {
    // 1. Check for initial Pause/Cancel
    let dl = downloadRegistry.get(id);
    if (!dl || dl.status === 'cancelled') return;
    if (dl.status === 'paused') await waitForResume(id);

    // 2. Initial Metadata Fetch
    let { segmentCount: n, segmentSize: c, contentSize: d, contentType: f } = await fetchUrl(url, abortController.signal);

    // 3. Re-check after Fetch
    dl = downloadRegistry.get(id);
    if (!dl || dl.status === 'cancelled') return;
    if (dl.status === 'paused') await waitForResume(id);

    let progress = Array(n)
      .fill(0)
      .map((e, t) => t * c)
      .map((t, r) => {
        let a = Math.min(t + c - 1, d - 1),
          o = { Range: `bytes=${t}-${a}` };
        return () =>
          fetch(url, { headers: o, signal: abortController.signal }).then((res) => {
            if (408 === res.status) {
              throw Error('fetch Error', {
                cause: {
                  range: `bytes=${t}-${a}`,
                  index: r,
                  response: res,
                },
              });
            }
            let prog = ((a / d) * 100).toFixed(2);

            return (updateProgress(prog, id, page, download_id, downloadRegistry.get(id)?.status || 'downloading'), res.arrayBuffer());
          });
      }),
      // Extract filename from URL as fallback, but prioritize detail.title
      name = detail?.title || extractFileNameFromUrl(url, f) || 'telegram_file';

    // Reducing batch size slightly for better stability in multi-download
    let h = await fetchResults(progress, 15, '11', id, abortController.signal);

    if (downloadRegistry.get(id)?.status === 'cancelled') return;

    let m = new Blob(h, { type: f || 'application/octet-stream' });
    let downloadUrl = URL.createObjectURL(m);
    const customFilename = detail?.customTitle ? detail.customTitle + '_' + name : name;
    saveFile(downloadUrl, customFilename);

    downloadRegistry.delete(id);
    updateProgress(100, id, page, download_id, 'finished');
  } catch (e) {
    if (e.name === 'AbortError' || e.message === 'Download cancelled') {
      console.log('Download cancelled/aborted:', id);
    } else {
      console.error('Download error:', e);
      updateProgress(0, id, page, download_id, 'error');
    }
    downloadRegistry.delete(id);
  }
}

async function fetchResults(tasks, batchSize, retryOnError, downloadId, abortSignal) {
  let results = [],
    currentIndex = 0;

  while (currentIndex < tasks.length) {
    // 1. Check for Cancellation
    if (abortSignal?.aborted || downloadRegistry.get(downloadId)?.status === 'cancelled') {
      throw new Error('Download cancelled');
    }

    // 2. Check for Pause
    const dl = downloadRegistry.get(downloadId);
    if (dl && dl.status === 'paused') {
      await waitForResume(downloadId);
    }

    let batch = tasks.slice(currentIndex, currentIndex + batchSize).map((task) => task());
    try {
      let batchResults = await Promise.all(batch);
      results.push(...batchResults);
      currentIndex += batchSize;
    } catch (error) {
      if (error instanceof Error) {
        if (retryOnError && error.message === 'fetch Error') {
          let { index } = error.cause;
          currentIndex = index;
          await delay(1000);
        }
      } else {
        throw error;
      }
    }
  }
  return results;
}

async function delay(e) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, e);
  });
}
function saveFile(e, t, n) {
  let r = document.createElement('a');
  ((r.href = e), (r.download = t), r.click());
}

function extractFileNameFromUrl(url, type) {
  let fileExtension = type ? type.split('/')[1] : 'file';

  try {
    let fileName = '';
    if (url.includes('progressive/')) {
      // a-version (Web A)
      const parts = url.split('document');
      if (parts.length > 1) {
        const afterDoc = parts[1].split('/')[0];
        fileName = afterDoc.startsWith(':') ? afterDoc.substring(1) : afterDoc;
      }
    } else if (url.includes('stream/')) {
      // k-version (Web K) or Audio
      const jsonStr = decodeURIComponent(url.split('stream/')[1]);
      const metadata = JSON.parse(jsonStr);
      if (metadata.fileName) {
        fileName = metadata.fileName;
      } else if (metadata.location && metadata.location.id) {
        fileName = metadata.location.id + '.' + fileExtension;
      }
    }

    if (fileName) {
      return fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
    }
    return undefined;
  } catch (e) {
    return undefined;
  }
}

function updateProgress(p, id, pa, d_id, status = 'downloading') {
  const dl = downloadRegistry.get(id);
  if (dl) {
    dl.lastProgress = p;
  }

  if (id != '') {
    let media_download_event_progress = new CustomEvent(id + '_download_progress', {
      detail: { video_id: id, progress: p, page: pa, download_id: d_id, status: status },
    });
    document.dispatchEvent(media_download_event_progress);
  }
}
