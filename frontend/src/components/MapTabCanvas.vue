<template>
  <div class="map-canvas">
    <div class="filter-bar">
      <span class="filter-label">Bộ lọc:</span>
      <button :class="['filter-btn', filterMode === 'all' && 'active']" @click="filterMode = 'all'">Tất cả</button>
      <button :class="['filter-btn', filterMode === 'hometown' && 'active']" @click="filterMode = 'hometown'">🏘 Quê quán</button>
      <button :class="['filter-btn', filterMode === 'current' && 'active']" @click="filterMode = 'current'">🏠 Hiện tại</button>
      <span class="filter-count">{{ totalWithLocation }} người có địa điểm</span>
    </div>

    <div v-if="loading" class="map-loading">Đang tải...</div>

    <div v-else-if="loadError" class="no-data-overlay">
      <div class="no-data-box">
        <div class="no-data-icon">⚠️</div>
        <div class="no-data-text">Không thể tải dữ liệu.</div>
        <div class="no-data-hint">Kiểm tra kết nối và thử lại.</div>
      </div>
    </div>

    <div v-else-if="totalWithLocation === 0" class="no-data-overlay">
      <div class="no-data-box">
        <div class="no-data-icon">🗺</div>
        <div class="no-data-text">Chưa có dữ liệu địa điểm.</div>
        <div class="no-data-hint">Editor có thể thêm từ form sửa người.</div>
      </div>
    </div>

    <div v-else class="map-wrap">
      <l-map :zoom="6" :center="[16.0, 108.0]" style="height:100%;width:100%">
        <l-tile-layer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <template v-if="filterMode !== 'current'">
          <l-marker
            v-for="p in hometownPins"
            :key="'h-' + p.id"
            :lat-lng="[p.homeLat, p.homeLng]"
            :icon="hometownIcon"
          >
            <l-popup>
              <div class="pin-popup">
                <div class="pin-name">{{ p.fullName }}</div>
                <div class="pin-sub">🏘 Quê: {{ p.hometown }}</div>
                <button class="pin-detail" @click="$emit('selectPerson', p.id)">Xem chi tiết →</button>
              </div>
            </l-popup>
          </l-marker>
        </template>

        <template v-if="filterMode !== 'hometown'">
          <l-marker
            v-for="p in currentPins"
            :key="'c-' + p.id"
            :lat-lng="[p.currentLat, p.currentLng]"
            :icon="currentIcon"
          >
            <l-popup>
              <div class="pin-popup">
                <div class="pin-name">{{ p.fullName }}</div>
                <div class="pin-sub">🏠 Hiện tại: {{ p.address }}</div>
                <button class="pin-detail" @click="$emit('selectPerson', p.id)">Xem chi tiết →</button>
              </div>
            </l-popup>
          </l-marker>
        </template>
      </l-map>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import L from 'leaflet';
import { personsApi } from '../api';

// defineEmits với TypeScript generic — khai báo kiểu event emit type-safe, không cần runtime validator
const emit = defineEmits<{ (e: 'selectPerson', id: string): void }>();

// ref() bọc array/primitive — Vue theo dõi khi .value thay thế toàn bộ
const persons = ref<any[]>([]);
const loading = ref(true);
const loadError = ref(false);
// ref() với union type — chỉ cho phép 3 giá trị hợp lệ, TypeScript bắt lỗi tại compile time
const filterMode = ref<'all' | 'hometown' | 'current'>('all');

// Icon pin quê quán — màu cam để phân biệt với pin địa chỉ hiện tại
const hometownIcon = L.divIcon({
  html: '<span style="font-size:22px;line-height:1;display:block">🟠</span>',
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// Icon pin địa chỉ hiện tại — màu xanh để phân biệt với pin quê quán
const currentIcon = L.divIcon({
  html: '<span style="font-size:22px;line-height:1;display:block">🔵</span>',
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// computed() — tự cache, chỉ tính lại khi persons thay đổi; lọc người có toạ độ quê quán hợp lệ
const hometownPins = computed(() =>
  persons.value.filter(p => p.homeLat != null && p.homeLng != null)
);

// computed() — tương tự, lọc người có toạ độ địa chỉ hiện tại hợp lệ
const currentPins = computed(() =>
  persons.value.filter(p => p.currentLat != null && p.currentLng != null)
);

// computed() — đếm người duy nhất có ít nhất một địa điểm
const totalWithLocation = computed(() => {
  // new Set([...arr1, ...arr2]) — spread merge 2 mảng rồi loại trùng lặp tự động;
  // người có cả quê quán lẫn địa chỉ hiện tại chỉ được đếm một lần
  const ids = new Set([
    ...hometownPins.value.map((p: any) => p.id),
    ...currentPins.value.map((p: any) => p.id),
  ]);
  // Set.size — số phần tử duy nhất trong Set
  return ids.size;
});

// onMounted — Vue lifecycle hook, chạy sau khi component được gắn vào DOM
// async callback được phép — Vue bắt unhandled rejection nếu có
onMounted(async () => {
  try {
    const res = await personsApi.list();
    persons.value = res.data;
  } catch {
    loadError.value = true;
  } finally {
    // finally — luôn chạy dù thành công hay lỗi, đảm bảo loading được tắt
    loading.value = false;
  }
});
</script>

<style scoped>
.map-canvas { height: 100%; display: flex; flex-direction: column; }

.filter-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fff;
  border-bottom: 1px solid #d0d7de;
  height: 44px;
}
.filter-label { font-size: 12px; color: #57606a; margin-right: 4px; }
.filter-btn {
  padding: 3px 10px;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  background: #f6f8fa;
  color: #24292f;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.filter-btn:hover { background: #eaeef2; }
.filter-btn.active { background: #ddf4ff; border-color: #54aeff; color: #0969da; font-weight: 600; }
.filter-count { font-size: 11px; color: #57606a; }

.map-wrap { flex: 1; min-height: 0; }

.map-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #57606a;
}

.no-data-overlay {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.no-data-box { text-align: center; }
.no-data-icon { font-size: 48px; margin-bottom: 12px; }
.no-data-text { font-size: 15px; color: #24292f; font-weight: 500; margin-bottom: 6px; }
.no-data-hint { font-size: 13px; color: #57606a; }

:deep(.pin-popup) { font-size: 13px; min-width: 160px; }
:deep(.pin-name) { font-weight: 700; color: #24292f; margin-bottom: 3px; }
:deep(.pin-sub) { color: #57606a; font-size: 12px; margin-bottom: 6px; }
:deep(.pin-detail) {
  background: none;
  border: none;
  color: #0969da;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
:deep(.pin-detail):hover { text-decoration: underline; }
</style>
