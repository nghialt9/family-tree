<template>
  <div
    class="cropper-overlay"
    @mouseup="stopDrag"
    @mouseleave="stopDrag"
    @mousemove="onMouseMove"
  >
    <div class="cropper-modal">
      <h3>Cắt ảnh đại diện</h3>
      <div
        class="canvas-wrap"
        @mousedown.prevent="startDrag"
        @touchstart.prevent="startTouch"
        @touchmove.prevent="onTouchMove"
        @touchend="stopDrag"
      >
        <canvas ref="cvs" :width="SIZE" :height="SIZE" />
      </div>
      <p class="hint">Kéo để điều chỉnh · Dùng thanh kéo để thu phóng</p>
      <div class="zoom-row">
        <span>−</span>
        <input type="range" v-model.number="zoom" :min="minZoom" :max="maxZoom" :step="0.005" />
        <span>+</span>
      </div>
      <div class="crop-actions">
        <button type="button" @click="$emit('cancel')">Hủy</button>
        <button type="button" class="btn-ok" @click="confirm">Xác nhận</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{ src: string }>();
const emit = defineEmits<{
  (e: 'confirm', blob: Blob): void;
  (e: 'cancel'): void;
}>();

const SIZE = 280;
const OUTPUT = 256;

const cvs = ref<HTMLCanvasElement | null>(null);
const zoom = ref(1);
const minZoom = ref(1);
const maxZoom = ref(4);
const ox = ref(0);
const oy = ref(0);

let imgEl: HTMLImageElement | null = null;
let dragging = false;
let lx = 0, ly = 0;

function draw() {
  if (!cvs.value || !imgEl) return;
  const ctx = cvs.value.getContext('2d')!;
  const cx = SIZE / 2, cy = SIZE / 2;
  const s = zoom.value;
  const iw = imgEl.naturalWidth * s;
  const ih = imgEl.naturalHeight * s;
  const ix = cx + ox.value - iw / 2;
  const iy = cy + oy.value - ih / 2;

  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(imgEl, ix, iy, iw, ih);

  // Dimming overlay with circular cutout (evenodd fill rule)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.rect(0, 0, SIZE, SIZE);
  ctx.arc(cx, cy, SIZE / 2 - 2, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.restore();

  // Circle border
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, SIZE / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

watch([zoom, ox, oy], draw);

onMounted(() => {
  imgEl = new Image();
  imgEl.onload = () => {
    const fit = Math.max(SIZE / imgEl!.naturalWidth, SIZE / imgEl!.naturalHeight);
    minZoom.value = fit;
    maxZoom.value = fit * 4;
    zoom.value = fit;
    ox.value = 0;
    oy.value = 0;
    draw();
  };
  imgEl.src = props.src;
});

onUnmounted(() => {
  if (imgEl) { imgEl.onload = null; imgEl = null; }
});

function startDrag(e: MouseEvent) { dragging = true; lx = e.clientX; ly = e.clientY; }

function onMouseMove(e: MouseEvent) {
  if (!dragging) return;
  ox.value += e.clientX - lx;
  oy.value += e.clientY - ly;
  lx = e.clientX;
  ly = e.clientY;
}

function stopDrag() { dragging = false; }

function startTouch(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  dragging = true;
  lx = e.touches[0].clientX;
  ly = e.touches[0].clientY;
}

function onTouchMove(e: TouchEvent) {
  if (!dragging || e.touches.length !== 1) return;
  ox.value += e.touches[0].clientX - lx;
  oy.value += e.touches[0].clientY - ly;
  lx = e.touches[0].clientX;
  ly = e.touches[0].clientY;
}

function confirm() {
  if (!imgEl) return;
  const out = document.createElement('canvas');
  out.width = OUTPUT;
  out.height = OUTPUT;
  const ctx = out.getContext('2d')!;

  // Circular clip for output
  ctx.beginPath();
  ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
  ctx.clip();

  // Map preview canvas coordinates to output canvas (same visual result at higher res)
  const ratio = OUTPUT / SIZE;
  const s = zoom.value;
  const iw = imgEl.naturalWidth * s;
  const ih = imgEl.naturalHeight * s;
  const ix = SIZE / 2 + ox.value - iw / 2;
  const iy = SIZE / 2 + oy.value - ih / 2;
  ctx.drawImage(imgEl, ix * ratio, iy * ratio, iw * ratio, ih * ratio);

  out.toBlob(blob => { if (blob) emit('confirm', blob); }, 'image/jpeg', 0.92);
}
</script>

<style scoped>
.cropper-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.65);
  z-index: 300; display: flex; align-items: center; justify-content: center;
}
.cropper-modal {
  background: #fff; border-radius: 12px; padding: 20px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
}
.cropper-modal h3 { margin: 0; font-size: 0.95rem; color: #24292f; font-weight: 700; }
.canvas-wrap { cursor: grab; border-radius: 6px; overflow: hidden; line-height: 0; }
.canvas-wrap:active { cursor: grabbing; }
canvas { display: block; }
.hint { margin: 0; font-size: 11px; color: #57606a; }
.zoom-row { display: flex; align-items: center; gap: 8px; width: 280px; }
.zoom-row span { color: #57606a; font-size: 16px; font-weight: 700; user-select: none; width: 16px; text-align: center; }
.zoom-row input { flex: 1; cursor: pointer; }
.crop-actions { display: flex; gap: 10px; }
.crop-actions button { padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
.crop-actions button:first-child { background: #f6f8fa; border: 1px solid #d0d7de; color: #24292f; }
.crop-actions button:first-child:hover { background: #eaeef2; }
.btn-ok { background: #2da44e; border: 1px solid #2da44e; color: #fff; }
.btn-ok:hover { background: #2c974b; }
</style>
