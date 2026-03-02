<template>
  <div class="side-panel">
    <div class="header">
      <h3>📥 TG Downloader</h3>
      <span class="badge">PRO</span>
    </div>
    
    <div v-if="downloads.length === 0" class="empty-state">
      <p class="hint">Active downloads will appear here.</p>
      <div class="info-card">
        <h4>Quick start:</h4>
        <ol>
          <li>Open <strong>web.telegram.org</strong></li>
          <li>Click <strong>DOWNLOAD</strong> on any media</li>
          <li>Track progress here in real-time</li>
        </ol>
      </div>
    </div>

    <div v-else class="download-list">
      <div v-for="dl in sortedDownloads" :key="dl.id" class="download-item">
        <div class="item-header">
          <span class="file-name" :title="dl.title">{{ truncate(dl.title) }}</span>
          <span class="status-tag" :class="dl.status">{{ dl.status.toUpperCase() }}</span>
        </div>
        
        <div class="progress-container">
          <div class="progress-bar" :style="{ width: dl.progress + '%' }" :class="{ pulse: dl.status === 'downloading' }"></div>
        </div>
        
        <div class="item-footer">
          <div class="controls">
            <button v-if="dl.status === 'downloading'" @click="togglePause(dl)" class="ctrl-btn pause">⏸</button>
            <button v-if="dl.status === 'paused'" @click="togglePause(dl)" class="ctrl-btn resume">▶️</button>
            <button v-if="dl.status !== 'finished' && dl.status !== 'cancelled'" @click="cancelDownload(dl)" class="ctrl-btn cancel">✖️</button>
          </div>
          <div class="info">
            <span>{{ dl.progress }}%</span>
            <span v-if="dl.status === 'finished'" class="check">✅</span>
            <span v-if="dl.status === 'cancelled'" class="cancelled">Cancelled</span>
          </div>
        </div>
      </div>
    </div>

    <button v-if="downloads.length > 0" @click="clearList" class="clear-btn">Clear Finished / Cancelled</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

interface Download {
  id: string;
  title: string;
  progress: number;
  status: 'starting' | 'downloading' | 'paused' | 'finished' | 'cancelled' | 'error';
  timestamp: number;
}

const downloads = ref<Download[]>([]);

const sortedDownloads = computed(() => {
  return [...downloads.value].sort((a, b) => b.timestamp - a.timestamp);
});

const truncate = (str: string) => {
  if (str.length <= 25) return str;
  return str.substring(0, 22) + '...';
};

const loadDownloads = async () => {
  const data = await chrome.storage.local.get(['active_downloads']);
  if (data.active_downloads) {
    downloads.value = data.active_downloads as Download[];
  }
};

const saveDownloads = async () => {
  await chrome.storage.local.set({ active_downloads: downloads.value });
};

const clearList = () => {
  downloads.value = downloads.value.filter(d => d.status !== 'finished' && d.status !== 'cancelled');
  saveDownloads();
};

const togglePause = async (dl: Download) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    const type = dl.status === 'paused' ? 'RESUME_DOWNLOAD' : 'PAUSE_DOWNLOAD';
    chrome.tabs.sendMessage(tab.id, { type, id: dl.id });
  }
};

const cancelDownload = async (dl: Download) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'CANCEL_DOWNLOAD', id: dl.id });
  }
};

onMounted(() => {
  loadDownloads();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'download_status') {
      const idx = downloads.value.findIndex(d => d.id === msg.id);
      if (idx !== -1) {
        downloads.value[idx].progress = msg.progress;
        downloads.value[idx].status = msg.status;
        if (msg.title) downloads.value[idx].title = msg.title;
      } else {
        downloads.value.push({
          id: msg.id,
          title: msg.title || 'Unknown File',
          progress: msg.progress || 0,
          status: msg.status,
          timestamp: Date.now()
        });
      }
      saveDownloads();
    }
  });
});
</script>

<style scoped>
.side-panel {
  padding: 16px;
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  min-height: 100vh;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header h3 { margin: 0; font-size: 18px; font-weight: 700; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

.badge {
  background: linear-gradient(135deg, #1677ff 0%, #2aa0ff 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.hint { color: #94a3b8; font-size: 13px; margin-bottom: 16px; text-align: center; }

.info-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 16px;
}

