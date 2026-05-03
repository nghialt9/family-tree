# Fan Chart View — Design

**Goal:** Thêm Fan Chart view (sơ đồ quạt) vào ứng dụng gia phả, lấy người dùng đang đăng nhập làm tâm, hiển thị tổ tiên phía trên và con cháu phía dưới theo bán nguyệt.

**Architecture:** Toggle button trên canvas hiện tại chuyển đổi giữa Family Tree view và Fan Chart view. Fan Chart dùng VueFlow với radial layout tự tính tọa độ (x, y) — tái dùng PersonNode cho ring gần, thêm FanArcNode compact cho ring xa. Không cần API mới — tái dùng data từ `treeApi.get()`.

**Tech Stack:** Vue 3 Composition API, VueFlow (`@vue-flow/core`), TypeScript, JWT payload để lấy `personId` của user.

---

## 1. Data & State

### Nguồn dữ liệu
Tái dùng hoàn toàn response từ `treeApi.get()` (nodes + edges). Không cần endpoint mới.

### State mới trong FanChartCanvas
```ts
const fanCenter = ref<string>('')       // personId làm tâm
const fanGenerations = ref<number>(3)   // 1–5, mặc định 3
```

### Maps cần build từ edges
```ts
// ancestorMap: personId → [parentId, ...]  (đi ngược parent_child)
// descendantMap: personId → [childId, ...]  (đi xuôi parent_child)
```

### Lấy center mặc định
JWT payload đã có `personId` (optional). Nếu tồn tại → dùng làm `fanCenter` mặc định.
Nếu không → hiện thông báo "Tài khoản chưa được liên kết với người trong gia phả" + nút về Tree view.

---

## 2. Layout Algorithm

### Coordinate system
- Center person: `(0, 0)`
- Radius mỗi ring: `ring × 260` px
- **Ancestors** → bán nguyệt trên: góc `180°` đến `360°` (sin âm → y âm → lên trên trong screen coords VueFlow)
- **Descendants** → bán nguyệt dưới: góc `0°` đến `180°` (sin dương → y dương → xuống dưới)

### Phân bổ góc
Mỗi người trong cùng ring được chia đều trong phần bán nguyệt của họ:
```
// Ancestors: startAngle=180, endAngle=360
// Descendants: startAngle=0, endAngle=180
angleStep = 180° / count
angle_i = startAngle + angleStep * (i + 0.5)
x = radius * cos(angle_i * π/180)
y = radius * sin(angle_i * π/180)
// VueFlow screen coords: y+ = down, y- = up
// ancestors at 180°–360° → sin negative → y negative → renders above center ✓
// descendants at 0°–180° → sin positive → y positive → renders below center ✓
```

### Node type theo ring
| Ring | Component | Kích thước |
|------|-----------|-----------|
| 0 (tâm) | `PersonNode` | 140×80px |
| 1–2 | `PersonNode` | 140×80px |
| 3–5 | `FanArcNode` | 60×36px |

### Edges
- Type: `straight`, stroke `#d0d7de`, strokeWidth `1.5`
- Không có arrowhead (chỉ để chỉ hướng kết nối, không phân cấp)

### Xử lý người xuất hiện nhiều nhánh
Dùng `Set<string>` track các personId đã thêm. Nếu gặp lại → skip, tránh node trùng.

---

## 3. Components & Files

| File | Thay đổi |
|------|---------|
| `frontend/src/components/FanChartCanvas.vue` | Mới — canvas chính fan view |
| `frontend/src/components/FanArcNode.vue` | Mới — compact node cho ring 3–5 |
| `frontend/src/App.vue` | Thêm toggle button + slider, điều kiện render |
| `frontend/src/components/FamilyTreeCanvas.vue` | Không đổi |

### FanChartCanvas.vue
Expose cùng interface với FamilyTreeCanvas:
```ts
defineExpose({ reload, focusOnNode, personNodes })
```

### FanArcNode.vue
- Avatar 28px (hoặc initials nếu không có ảnh)
- Tên: tối đa 12 ký tự, truncate với `…`
- Click → emit `toggle` (dùng VueFlow node click)

---

## 4. UI Controls

### Toggle button
Đặt góc trên phải canvas (absolute position, z-index cao), bên ngoài VueFlow Controls:
```html
<button class="view-toggle" @click="toggleView">
  {{ isFanView ? '🌳 Tree' : '🌀 Fan' }}
</button>
```

### Slider thế hệ
Chỉ hiện khi đang ở Fan view, ngay dưới toggle button:
```html
<div class="gen-slider">
  <label>Thế hệ: {{ fanGenerations }}</label>
  <input type="range" min="1" max="5" v-model="fanGenerations" />
</div>
```

### Nút reset tâm
Cạnh slider, chỉ hiện khi `fanCenter !== defaultCenter`:
```html
<button @click="fanCenter = defaultCenter">⌂ Về tôi</button>
```

---

## 5. Interactions

| Action | Kết quả |
|--------|---------|
| Click node | Emit `selectPerson` → mở PersonDrawer |
| Double-click node | `fanCenter = node.id` → tính lại layout |
| Kéo slider | Cập nhật `fanGenerations` → re-render ngay, không gọi API |
| Toggle button | Chuyển qua lại giữa FamilyTreeCanvas và FanChartCanvas |
| Nút "⌂ Về tôi" | Reset `fanCenter` về personId của user |

---

## 6. Edge Cases

- **User không có personId**: Hiện overlay "Tài khoản chưa được liên kết với người trong gia phả" + nút "Về Tree view"
- **Tâm không có ancestor/descendant**: Chỉ render 1 node trung tâm, không lỗi
- **Người xuất hiện nhiều nhánh**: Chỉ render lần đầu gặp (BFS order), bỏ qua lần sau
- **Slider thay đổi**: Cắt/thêm rings ngay lập tức, không fetch lại API

---

## 7. Không làm (out of scope)

- Animation khi chuyển từ node này sang node kia làm tâm
- Export fan chart ra ảnh/PDF
- Hiển thị thông tin chi tiết trực tiếp trên arc (chỉ mở qua Drawer)
- Collapse/expand từng nhánh trong fan view
