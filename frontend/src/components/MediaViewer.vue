<template>
  <div class="viewer-overlay" @click.self="$emit('close')">
    <div class="viewer-box">
      <button class="close-btn" @click="$emit('close')">✕</button>

      <div v-if="media.caption" class="caption">{{ media.caption }}</div>

      <div class="media-wrap">
        <img
          v-if="media.resourceType === 'IMAGE'"
          :src="media.url"
          :alt="media.caption || ''"
          class="media-img"
        />

        <video
          v-else-if="media.resourceType === 'VIDEO'"
          :src="media.url"
          controls
          class="media-video"
        />

        <div v-else class="pdf-wrap">
          <iframe :src="media.url" class="media-pdf" />
          <a :href="media.url" target="_blank" class="pdf-download">Tải xuống PDF</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  media: {
    url: string;
    resourceType: 'IMAGE' | 'VIDEO' | 'RAW';
    caption?: string | null;
  };
}>();

defineEmits<{ (e: 'close'): void }>();
</script>

<style scoped>
.viewer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 300; display: flex; align-items: center; justify-content: center; }
.viewer-box { position: relative; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center; }
.close-btn { position: absolute; top: -36px; right: 0; background: none; border: none; color: #fff; font-size: 22px; cursor: pointer; }
.caption { color: #e6edf3; font-size: 13px; margin-bottom: 8px; max-width: 80vw; text-align: center; }
.media-wrap { display: flex; align-items: center; justify-content: center; }
.media-img { max-width: 85vw; max-height: 80vh; border-radius: 4px; object-fit: contain; }
.media-video { max-width: 85vw; max-height: 80vh; border-radius: 4px; }
.pdf-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.media-pdf { width: 70vw; height: 75vh; border: none; border-radius: 4px; }
.pdf-download { color: #79c0ff; font-size: 13px; }
</style>