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
