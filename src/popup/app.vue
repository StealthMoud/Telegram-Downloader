<template>
  <div class="popup-container">
    <div class="popup-header">
      <img :src="iconUrl" alt="icon" class="popup-icon" />
      <h2>TG Downloader</h2>
    </div>
    <p class="popup-version">v2.3.0 — Free Edition</p>

    <div v-if="isOnTelegram" class="popup-status success">
      <span class="status-dot green"></span>
      Active on this page
    </div>
    <div v-else class="popup-status inactive">
      <span class="status-dot grey"></span>
      Not on Telegram Web
    </div>

    <div class="popup-actions">
      <button v-if="!isOnTelegram" class="btn btn-primary" @click="openTelegram">
        Open Telegram Web
      </button>
      <button class="btn btn-secondary" @click="openOptions">
        ⚙ Settings
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isOnTelegram = ref(false);
const iconUrl = chrome.runtime.getURL('src/assets/icon_128.png');

onMounted(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('web.telegram.org')) {
    isOnTelegram.value = true;
  }
});

const openTelegram = () => {
  chrome.tabs.create({ url: 'https://web.telegram.org/k' });
  window.close();
};

const openOptions = () => {
  chrome.runtime.openOptionsPage();
  window.close();
};
</script>

<style scoped>
.popup-container {
  width: 280px;
  padding: 20px;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
}
.popup-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.popup-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}
.popup-header h2 {
  margin: 0;
  font-size: 16px;
  color: #ffffff;
}
.popup-version {
  margin: 0 0 14px;
  font-size: 11px;
  color: #888;
}
.popup-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 14px;
}
.popup-status.success {
  background: rgba(76, 175, 80, 0.15);
  color: #81c784;
}
.popup-status.inactive {
  background: rgba(158, 158, 158, 0.15);
  color: #aaa;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.status-dot.green { background: #4caf50; }
.status-dot.grey { background: #888; }
.popup-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.btn {
  padding: 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;
}
.btn-primary {
  background: #0088cc;
  color: white;
}
.btn-primary:hover { background: #006da3; }
.btn-secondary {
  background: rgba(255,255,255,0.08);
  color: #ccc;
}
.btn-secondary:hover { background: rgba(255,255,255,0.15); }
</style>
