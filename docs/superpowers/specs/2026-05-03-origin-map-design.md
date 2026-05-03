# Origin Map (Bản đồ nguồn cội) — Design Spec

## Goal

Hiển thị quê quán và địa chỉ hiện tại của từng thành viên gia phả trên bản đồ tương tác Leaflet, tích hợp như tab thứ ba trong TreePage.

## Architecture

**Backend:**
- Mở rộng `Person` model với 5 field mới (hometown text + 2 cặp lat/lng)
- Endpoint `GET /api/geocode?q=...` proxy Nominatim (OpenStreetMap), tránh CORS và ẩn implementation detail khỏi frontend
- `PUT /api/persons/:id` nhận thêm các field mới (không breaking change)

**Frontend:**
- Cài `leaflet` + `@vue-leaflet/vue-leaflet` (Vue 3 wrapper chính thức)
- `MapTabCanvas.vue` — component Leaflet map dùng làm tab thứ 3
- `TreePage.vue` — thêm toggle "🗺 Bản đồ" cạnh Tree / Fan
- `PersonForm.vue` — thêm UI geocoding cho hometown + address
- `PersonDrawer.vue` — hiện hometown nếu có

## Data Model

```prisma
model Person {
  // ... existing fields ...
  hometown   String?
  homeLat    Float?
  homeLng    Float?
  currentLat Float?
  currentLng Float?
}
```

- `address` (đã có) = địa chỉ hiện tại (text)
- `hometown` (mới) = quê quán (text)
- `homeLat/homeLng` = tọa độ geocoded của `hometown`
- `currentLat/currentLng` = tọa độ geocoded của `address`

Migration: `add_person_location_fields`

## Backend

### GET /api/geocode

```
GET /api/geocode?q=Đồng Tháp, Việt Nam
→ 200 [{ lat: 10.339, lng: 105.688, displayName: "Đồng Tháp, ..." }, ...]
→ 400 { error: "q is required" }
→ 502 { error: "Geocoding service unavailable" }
```

- Gọi `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=3`
- Header `User-Agent: FamilyTreeApp/1.0` (bắt buộc theo Nominatim policy)
- Route yêu cầu `requireViewer` (chỉ user đăng nhập mới gọi)
- Không cache — Nominatim rate limit 1 req/s cho personal use, đủ cho editor dùng thủ công

### PUT /api/persons/:id

Nhận thêm trong body (tất cả optional):
```ts
{ hometown?, homeLat?, homeLng?, currentLat?, currentLng? }
```

`personService.updatePerson` cho phép cập nhật các field này. Nếu editor xóa địa chỉ (gửi `address: ""`), lat/lng tương ứng phải được reset về `null`.

## Frontend

### MapTabCanvas.vue

- Leaflet map, center mặc định: Việt Nam (16.0, 108.0), zoom 6
- Gọi `GET /api/persons` để lấy toàn bộ danh sách
- Lọc ra người có `homeLat/homeLng` hoặc `currentLat/currentLng`
- Pin cam (🟠) cho quê quán, pin xanh dương (🔵) cho địa chỉ hiện tại
- Click pin → Leaflet popup hiện tên + loại địa điểm + nút "Xem chi tiết"
- Nút "Xem chi tiết" emit `selectPerson(id)` → TreePage mở PersonDrawer
- Filter bar phía trên map: [Tất cả | Quê quán | Hiện tại] — toggle hiển thị pin
- Hiện số người có địa điểm ở góc map
- Nếu không có ai có địa điểm → overlay "Chưa có dữ liệu địa điểm. Editor có thể thêm từ form sửa người."

### TreePage.vue

- Thêm "🗺 Bản đồ" vào toggle (hiện có: 🌳 Tree / 🌀 Fan)
- `mapView ref(false)` — toggle riêng, không ảnh hưởng `fanView`
- Khi mapView = true: render `MapTabCanvas`, ẩn canvas tree/fan
- `MapTabCanvas` nhận prop `@select-person` → set `selectedPersonId` → mở PersonDrawer
- Khi chuyển về Tree/Fan, map unmount (không cần keep-alive)

### PersonForm.vue — geocoding UX

Thêm 2 section dưới form:

**Quê quán:**
- Text input bind `hometown`
- Nút "📍 Geocode" → `GET /api/geocode?q=hometown` → lấy kết quả đầu tiên
- Nếu geocode thành công: hiện mini-map (200px) với `DraggableMarker` tại `homeLat/homeLng`
- Kéo marker → cập nhật `homeLat/homeLng` realtime
- Hiện display name từ Nominatim dưới mini-map
- Nút "✕ Xóa vị trí" → clear `homeLat`, `homeLng`

**Địa chỉ hiện tại** (field `address` hiện có):
- Tương tự, geocode → `currentLat/currentLng`
- Nút "✕ Xóa vị trí" → clear `currentLat`, `currentLng`

Geocoding errors hiện inline dưới nút (không block save).

### PersonDrawer.vue

Thêm vào info section:
```html
<div v-if="person.hometown" class="info-row">
  <span class="icon">🏘</span>
  <div><div class="info-label">Quê quán</div><div>{{ person.hometown }}</div></div>
</div>
```

### API client (api/index.ts)

```ts
export const geocodeApi = {
  search: (q: string) => api.get('/geocode', { params: { q } }),
};
```

`personsApi` đã có `update(id, data)` — không cần thay đổi.

## Error Handling

| Scenario | Behavior |
|---|---|
| Nominatim không tìm thấy | Hiện "Không tìm thấy địa điểm, thử từ khóa khác" |
| Nominatim unavailable (502) | Hiện "Dịch vụ geocoding tạm thời không khả dụng" |
| Person không có lat/lng | Không hiện pin trên map, không lỗi |
| Tất cả persons không có vị trí | Overlay thông báo trên map tab |

## File Structure

| File | Thay đổi |
|---|---|
| `backend/prisma/schema.prisma` | +5 fields vào Person |
| `backend/prisma/migrations/…add_person_location_fields/` | Migration mới |
| `backend/src/routes/geocode.ts` | Mới — proxy Nominatim |
| `backend/src/app.ts` | Mount geocodeRouter |
| `backend/src/services/personService.ts` | Cho phép update 5 field mới |
| `frontend/src/components/MapTabCanvas.vue` | Mới — Leaflet map tab |
| `frontend/src/components/PersonForm.vue` | Thêm geocoding UX |
| `frontend/src/components/PersonDrawer.vue` | Thêm hometown display |
| `frontend/src/pages/TreePage.vue` | Thêm Map toggle |
| `frontend/src/api/index.ts` | Thêm geocodeApi |

## Out of Scope

- Timeline view
- Search theo địa lý (tìm "người ở TP.HCM")
- Cluster markers khi nhiều người cùng địa điểm
- Routing / chỉ đường
- Import/export tọa độ
