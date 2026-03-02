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
