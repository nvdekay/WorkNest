# Team Task Management System — Tài liệu Database (MongoDB)

> Tài liệu này mô tả schema MongoDB **khớp 1:1** với `Backend_Features_and_API_Spec.md`. Đi kèm:
> - `mongodb-schema.json` — định nghĩa schema có cấu trúc (JSON Schema validator + index) cho cả 9 collection.
> - `setup-database.js` — script `mongosh` đọc file JSON và tạo/cập nhật collection + validator + index.
>
> **Engine:** MongoDB + Mongoose. **Database mặc định:** `team_task_management`.

---

## 0. Cách dùng nhanh

MongoDB **không** import schema qua `mongoimport` (lệnh đó chỉ nạp *dữ liệu*). Để dựng schema, chạy script kèm theo:

```bash
# Đặt 3 file cùng thư mục: mongodb-schema.json, setup-database.js
mongosh "mongodb://localhost:27017" --file setup-database.js

# Atlas:
mongosh "mongodb+srv://USER:PASS@cluster.xxx.mongodb.net" --file setup-database.js
```

Script là **idempotent** (chạy lại an toàn): tạo collection kèm `$jsonSchema` validator, hoặc cập nhật validator nếu collection đã tồn tại, rồi tạo toàn bộ index.

> **Vì sao `validationLevel: moderate` + cho phép thuộc tính dư:** Mongoose tự thêm `createdAt`, `updatedAt`, `__v`. Validator được thiết kế khoan dung để không chặn các trường này. Ràng buộc nghiệp vụ chính (kiểu, enum, min/max, required) vẫn được thực thi ở tầng DB như một lưới an toàn bổ sung cho validation ở tầng ứng dụng (Zod/Joi + Mongoose).

---

## 1. Quy ước chung

- **Timestamps:** mọi collection (trừ `activities`) bật `timestamps: true` → có `createdAt` + `updatedAt`. `activities` là **bất biến** nên chỉ có `createdAt`.
- **Xóa mềm:** các collection có vòng đời (`workspaces`, `projects`, `tasks`, `comments`) có `deletedAt: Date | null`. Query mặc định loại trừ `deletedAt != null`. Hard purge là job nền.
- **Tham chiếu chéo:** luôn là `ObjectId` (không nhúng document người dùng). Một số trường được **phi chuẩn hóa** có chủ đích (vd `tasks.workspaceId`, `comments.workspaceId`) để query theo tenant nhanh mà không phải join nhiều cấp.
- **Thời gian:** kiểu `Date`, lưu UTC.
- **Tiền tệ:** không áp dụng (v1 không có billing).
- **Cô lập tenant:** mọi document (trừ `users`) đều mang `workspaceId` hoặc tới được `workspaceId` qua cha — đây là khóa để mọi query phải lọc theo workspace.

---

## 2. Sơ đồ quan hệ (ERD)

```
users 1───N workspace_members N───1 workspaces
users 1───N invitations(invitedBy)          workspaces 1───N invitations
workspaces 1───N projects 1───N tasks 1───N comments
tasks N───1 users (assignee, createdBy)
comments N───1 users (authorId)              comments 1───N comments (parentId, đúng 1 cấp)
users 1───N notifications N───1 workspaces
workspaces 1───N activities  (───0..1 projects, ───0..1 tasks)
```

**Cascade xóa mềm:** xóa workspace → ẩn logic project → task → comment; xóa project → ẩn task → comment; xóa task → ẩn comment.

---

## 3. Bảng enum dùng chung

| Enum | Giá trị | Dùng ở |
|---|---|---|
| `role` | `OWNER`, `ADMIN`, `MEMBER` | `workspace_members.role` |
| `memberStatus` | `ACTIVE`, `REMOVED` | `workspace_members.status` |
| `invitationRole` | `ADMIN`, `MEMBER` | `invitations.role` (không bao giờ OWNER) |
| `invitationStatus` | `PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELLED` | `invitations.status` |
| `taskStatus` | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` | `tasks.status`, `projects.statuses[].key` |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` | `tasks.priority` |
| `entityType` | `TASK`, `PROJECT`, `WORKSPACE`, `COMMENT`, `INVITATION` | `notifications.entityType` |
| `notificationType` | 12 giá trị (§9.2 backend spec) | `notifications.type` |
| `activityType` | 14 giá trị (§8.11 + §10.B backend spec) | `activities.type` |

---

## 4. Chi tiết từng collection

### 4.1 `users`
Định danh tài khoản toàn cục. **Collection duy nhất không bị giới hạn tenant.**

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `name` | string | ✅ | 2–60 ký tự, trim |
| `email` | string | ✅ | ≤254, lowercase, **unique**, định dạng email |
| `passwordHash` | string | ✅ | bcrypt; `select:false`; không bao giờ trả ra API |
| `avatarUrl` | string \| null | ❌ | URL https |
| `emailVerified` | bool | ✅ | mặc định `false` |
| `lastLoginAt` | date \| null | ❌ | cập nhật khi login |
| `createdAt` / `updatedAt` | date | ✅ | timestamps |

**Index:** `{ email: 1 }` **unique**.
**Quan hệ:** được tham chiếu bởi `workspace_members.userId`, `tasks.assignee`/`createdBy`, `comments.authorId`, `activities.actorId`, `notifications.userId`.

```jsonc
// document mẫu
{
  "_id": ObjectId("665000000000000000000001"),
  "name": "Lan Pham",
  "email": "lan@acme.com",
  "passwordHash": "$2b$12$....",
  "avatarUrl": null,
  "emailVerified": false,
  "lastLoginAt": ISODate("2026-06-01T08:00:00Z"),
  "createdAt": ISODate("2026-05-01T00:00:00Z"),
  "updatedAt": ISODate("2026-06-01T08:00:00Z")
}
```

### 4.2 `workspaces`
Ranh giới tenant, container cấp cao nhất.

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `name` | string | ✅ | 2–80 |
| `description` | string \| null | ❌ | ≤500 |
| `avatarUrl` | string \| null | ❌ | |
| `ownerId` | objectId → users | ✅ | OWNER duy nhất |
| `settings.memberCanCreateProject` | bool | ✅ | mặc định `true` |
| `settings.timezone` | string | ❌ | IANA, mặc định `UTC` |
| `deletedAt` | date \| null | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | date | ✅ | |

**Index:** `{ ownerId: 1 }`, `{ deletedAt: 1 }`.

```jsonc
{
  "_id": ObjectId("665100000000000000000001"),
  "name": "Acme Marketing",
  "description": "Team marketing nội bộ",
  "avatarUrl": null,
  "ownerId": ObjectId("665000000000000000000001"),
  "settings": { "memberCanCreateProject": true, "timezone": "Asia/Ho_Chi_Minh" },
  "deletedAt": null,
  "createdAt": ISODate("2026-05-02T00:00:00Z"),
  "updatedAt": ISODate("2026-05-02T00:00:00Z")
}
```

### 4.3 `workspace_members`
Bảng join `users` ↔ `workspaces`, lưu vai trò theo từng workspace. **Trái tim của RBAC.**

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `workspaceId` | objectId → workspaces | ✅ | |
| `userId` | objectId → users | ✅ | |
| `role` | enum `role` | ✅ | OWNER\|ADMIN\|MEMBER |
| `status` | enum `memberStatus` | ✅ | mặc định `ACTIVE` |
| `joinedAt` | date | ✅ | |
| `createdAt` / `updatedAt` | date | ✅ | |

**Index:** `{ workspaceId, userId }` **compound unique** (một người vào một workspace một lần); `{ userId, status }` (liệt kê workspace của tôi); `{ workspaceId, role }`.
**Ghi chú:** xóa thành viên = đặt `status: REMOVED` (không xóa hàng) để bảo toàn quy gán lịch sử.

### 4.4 `invitations`
Lời mời workspace đang chờ.

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `workspaceId` | objectId → workspaces | ✅ | |
| `email` | string | ✅ | lowercase, định dạng email |
| `role` | enum `invitationRole` | ✅ | ADMIN\|MEMBER |
| `token` | string | ✅ | hex 32-byte (64 ký tự), **unique**, không trả về trong list |
| `status` | enum `invitationStatus` | ✅ | mặc định `PENDING` |
| `invitedBy` | objectId → users | ✅ | |
| `expiresAt` | date | ✅ | now + 7 ngày |
| `createdAt` / `updatedAt` | date | ✅ | |

**Index:** `{ token }` **unique**; `{ workspaceId, email, status }` (chặn PENDING trùng); `{ expiresAt }` (job sweeper / TTL).

### 4.5 `projects`
Container chứa task; định nghĩa các cột bảng.

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `workspaceId` | objectId → workspaces | ✅ | phạm vi tenant |
| `name` | string | ✅ | 2–80 |
| `description` | string \| null | ❌ | ≤1000 |
| `key` | string | ✅ | `^[A-Z0-9]{2,6}$`, **unique theo workspace**, bất biến |
| `color` | string \| null | ❌ | `^#[0-9A-Fa-f]{6}$` |
| `statuses` | array | ✅ | **đúng 4** mục `{ key, label, order }`; key ∈ taskStatus, label 1–30 |
| `taskCounter` | int | ✅ | mặc định 0; tăng đơn điệu cho `taskCode` |
| `createdBy` | objectId → users | ✅ | |
| `archivedAt` | date \| null | ❌ | archive = chỉ-đọc |
| `deletedAt` | date \| null | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | date | ✅ | |

**Index:** `{ workspaceId, deletedAt }`; `{ workspaceId, key }` **unique**; `{ workspaceId, archivedAt }`.

```jsonc
{
  "_id": ObjectId("665200000000000000000001"),
  "workspaceId": ObjectId("665100000000000000000001"),
  "name": "Website Redesign",
  "description": null,
  "key": "MKT",
  "color": "#8b5cf6",
  "statuses": [
    { "key": "TODO", "label": "To Do", "order": 0 },
    { "key": "IN_PROGRESS", "label": "In Progress", "order": 1 },
    { "key": "IN_REVIEW", "label": "In Review", "order": 2 },
    { "key": "DONE", "label": "Done", "order": 3 }
  ],
  "taskCounter": 42,
  "createdBy": ObjectId("665000000000000000000001"),
  "archivedAt": null,
  "deletedAt": null,
  "createdAt": ISODate("2026-05-03T00:00:00Z"),
  "updatedAt": ISODate("2026-06-01T00:00:00Z")
}
```

### 4.6 `tasks`
Đơn vị công việc cốt lõi. Có **3 mảng nhúng**: `labels`, `checklist`, `attachments`.

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `workspaceId` | objectId → workspaces | ✅ | phi chuẩn hóa (query theo tenant) |
| `projectId` | objectId → projects | ✅ | |
| `taskCode` | string | ✅ | `<projectKey>-<n>`, unique theo workspace, bất biến |
| `title` | string | ✅ | 1–200 |
| `description` | string \| null | ❌ | ≤10000, markdown |
| `status` | enum `taskStatus` | ✅ | phải ∈ `project.statuses`; mặc định `TODO` |
| `priority` | enum `priority` | ✅ | mặc định `MEDIUM` |
| `position` | double | ✅ | sắp xếp thưa trong một status, ≥0 |
| `assignee` | objectId \| null | ❌ | null = chưa giao |
| `createdBy` | objectId → users | ✅ | |
| `dueDate` | date \| null | ❌ | |
| `startDate` | date \| null | ❌ | nếu cùng `dueDate` thì `start ≤ due` |
| `completedAt` | date \| null | ❌ | set khi → DONE, clear khi rời DONE |
| `labels` | array `{name,color}` | ❌ | ≤10; name 1–20, color hex |
| `checklist` | array `{_id,text,done,order}` | ❌ | ≤50; text 1–200 |
| `attachments` | array (metadata) | ❌ | ≤20; mỗi tệp `fileSize ≤ 10 MB` |
| `watchers` | array objectId | ❌ | người nhận thông báo |
| `commentCount` | int | ✅ | phi chuẩn hóa, mặc định 0 |
| `deletedAt` | date \| null | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | date | ✅ | |

**Mảng nhúng — chi tiết:**
- `labels[]`: `{ name: string(1–20), color: hex }`.
- `checklist[]`: `{ _id: objectId, text: string(1–200), done: bool, order: int }`.
- `attachments[]`: `{ _id, fileName, fileUrl, fileSize(≤10485760), mimeType, uploadedBy: objectId, uploadedAt: date }`.

**Index:**
- `{ projectId, status, position }` — render bảng (**quan trọng nhất**).
- `{ workspaceId, assignee }` — "task của tôi".
- `{ workspaceId, dueDate }` — quét quá hạn.
- `{ taskCode }` — tra theo mã.
- Text index `{ title, description }` — tìm kiếm.

> **Overdue không lưu:** `isOverdue` được tính lúc đọc (`dueDate < now && status != DONE`), không có trường cờ trong schema.

```jsonc
{
  "_id": ObjectId("665300000000000000000001"),
  "workspaceId": ObjectId("665100000000000000000001"),
  "projectId": ObjectId("665200000000000000000001"),
  "taskCode": "MKT-42",
  "title": "Design login screen",
  "description": "## Goal\n...",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "position": 2048,
  "assignee": ObjectId("665000000000000000000002"),
  "createdBy": ObjectId("665000000000000000000001"),
  "dueDate": ISODate("2026-06-10T00:00:00Z"),
  "startDate": null,
  "completedAt": null,
  "labels": [ { "name": "design", "color": "#8b5cf6" } ],
  "checklist": [
    { "_id": ObjectId("665300000000000000000010"), "text": "Wireframe", "done": true, "order": 0 }
  ],
  "attachments": [],
  "watchers": [ ObjectId("665000000000000000000001") ],
  "commentCount": 3,
  "deletedAt": null,
  "createdAt": ISODate("2026-06-01T00:00:00Z"),
  "updatedAt": ISODate("2026-06-02T00:00:00Z")
}
```

### 4.7 `comments`
Thảo luận phân luồng đúng 1 cấp.

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `taskId` | objectId → tasks | ✅ | |
| `workspaceId` | objectId → workspaces | ✅ | phi chuẩn hóa |
| `authorId` | objectId → users | ✅ | |
| `body` | string | ✅ | 1–5000 |
| `parentId` | objectId \| null | ❌ | null = gốc; có giá trị = reply (trỏ tới **gốc** cùng task) |
| `mentions` | array objectId | ❌ | thành viên ACTIVE đã phân giải |
| `editedAt` | date \| null | ❌ | set khi sửa |
| `deletedAt` | date \| null | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | date | ✅ | |

**Index:** `{ taskId, parentId, createdAt }`; `{ workspaceId, authorId }`.

### 4.8 `notifications`
Một document **cho mỗi người nhận trên mỗi sự kiện**, tự chứa dữ liệu để render + deep-link.

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `userId` | objectId → users | ✅ | người nhận |
| `workspaceId` | objectId → workspaces | ✅ | phạm vi/lọc |
| `type` | enum `notificationType` | ✅ | 12 giá trị |
| `title` | string | ✅ | text render phi chuẩn hóa |
| `body` | string \| null | ❌ | text phụ |
| `entityType` | enum `entityType` | ✅ | loại đích deep-link |
| `entityId` | objectId | ✅ | id đích deep-link |
| `actorId` | objectId \| null | ❌ | ai kích hoạt |
| `read` | bool | ✅ | mặc định `false` |
| `readAt` | date \| null | ❌ | |
| `createdAt` / `updatedAt` | date | ✅ | |

**Index:** `{ userId, read, createdAt: -1 }` — liệt kê + huy hiệu chưa đọc (có thể thêm TTL trên `createdAt` để lưu trữ).

### 4.9 `activities`
Vết kiểm toán **bất biến** (chỉ thêm). **Không có `updatedAt`.**

| Trường | BSON type | Bắt buộc | Ràng buộc / ghi chú |
|---|---|:--:|---|
| `_id` | objectId | ✅ | PK |
| `workspaceId` | objectId → workspaces | ✅ | |
| `projectId` | objectId \| null | ❌ | có cho sự kiện project/task |
| `taskId` | objectId \| null | ❌ | có cho sự kiện task |
| `actorId` | objectId → users | ✅ | |
| `type` | enum `activityType` | ✅ | 14 giá trị |
| `entityLabel` | string \| null | ❌ | tên phi chuẩn hóa lúc xảy ra (vd tiêu đề task) — render được kể cả khi thực thể đã xóa |
| `metadata` | object \| null | ❌ | có cấu trúc, vd `{ from: "TODO", to: "DONE" }` |
| `createdAt` | date | ✅ | (không có `updatedAt`) |

**Index:** `{ workspaceId, createdAt: -1 }`; `{ projectId, createdAt: -1 }`; `{ taskId, createdAt: -1 }`.

```jsonc
{
  "_id": ObjectId("665400000000000000000001"),
  "workspaceId": ObjectId("665100000000000000000001"),
  "projectId": ObjectId("665200000000000000000001"),
  "taskId": ObjectId("665300000000000000000001"),
  "actorId": ObjectId("665000000000000000000002"),
  "type": "TASK_STATUS_CHANGED",
  "entityLabel": "Design login screen",
  "metadata": { "from": "TODO", "to": "IN_PROGRESS" },
  "createdAt": ISODate("2026-06-02T09:30:00Z")
}
```

---

## 5. Khớp với tầng Mongoose (lưu ý khi code model)

- Schema JSON ở đây là **lưới an toàn ở tầng DB**; nguồn sự thật chính vẫn là Mongoose schema + validator Zod/Joi (xem §11, §12 backend spec).
- Các ràng buộc **unique nhiều trường** (`workspace_members {workspaceId,userId}`, `projects {workspaceId,key}`) chỉ được thực thi qua **unique index**, không qua `$jsonSchema`. Khi insert vi phạm → Mongo ném duplicate key error → backend ánh xạ thành `409` tương ứng (`ALREADY_MEMBER` / `PROJECT_KEY_TAKEN`).
- `passwordHash` để `select: false` trong Mongoose nhưng vẫn là một string ở DB; validator vẫn yêu cầu nó tồn tại.
- `position` là `double`; khi rebalancing gán lại số nguyên cũng hợp lệ (`int`/`long` được chấp nhận).
- `checklist[]._id` và `attachments[]._id` là subdocument `_id` (Mongoose tự sinh) — kiểu `objectId`.
- TTL index (nếu muốn tự hết hạn `invitations`/`notifications`) **không** nằm trong file mặc định để tránh xóa dữ liệu ngoài ý muốn; bật thủ công bằng `createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })` khi sẵn sàng.

---

## 6. Thứ tự seed dữ liệu test (nếu cần nạp data mẫu)

Tôn trọng quan hệ phụ thuộc khi seed: `users` → `workspaces` → `workspace_members` → `projects` → `tasks` → `comments`; `notifications`/`activities` sinh kèm theo sự kiện. Dùng `mongoimport --db team_task_management --collection users --file users.json --jsonArray` cho từng collection **sau khi** đã chạy `setup-database.js`.

---

*Hết tài liệu database. Khớp với `Backend_Features_and_API_Spec.md`.*
