# Team Task Management System — Tính năng & API Spec (Backend-first)

> **Mục đích tài liệu này:** gom đặc tả gốc thành 2 phần dùng được ngay.
> **Phần 1 — Tài liệu tính năng:** viết dễ hiểu, để bất kỳ ai (PM, QA, người mới vào dự án) đọc là hiểu hệ thống có gì, hoạt động ra sao.
> **Phần 2 — API Spec theo module:** dành cho dev backend — biết cần code endpoint nào, luồng xử lý, validation, lỗi trả về, side-effect (activity/notification), và thứ tự build hợp lý.
>
> **Chiến lược triển khai:** làm **backend trước** cho chạy ổn định, test xong rồi mới sang frontend. Vì vậy Phần 2 là phần dày nhất và là "hợp đồng" để frontend bám vào sau này.
>
> **Tech stack backend:** Node.js · ExpressJS · MongoDB + Mongoose · JWT · Zod/Joi (validation) · bcrypt.
> **Kiến trúc:** RESTful API · Modular monolith (mỗi module sở hữu routes → controller → service → model → validator) · RBAC theo workspace.

---

# PHẦN 1 — TÀI LIỆU TÍNH NĂNG HỆ THỐNG

## 1. Hệ thống là gì

Đây là nền tảng **quản lý công việc nhóm đa người thuê (multi-tenant)** — một tập con tập trung của Trello/Jira/ClickUp. Mỗi nhóm tổ chức công việc theo cấu trúc phân cấp lồng nhau nghiêm ngặt:

```
User (tài khoản)
  └── là thành viên của → Workspace   (ranh giới tenant + ranh giới phân quyền)
                            └── chứa → Project   (dự án, định nghĩa các cột của bảng)
                                         └── chứa → Task   (công việc, di chuyển trên bảng Kanban)
                                                      ├── Comments     (bình luận, có @mention + reply 1 cấp)
                                                      ├── Checklist     (danh sách việc con)
                                                      ├── Labels        (nhãn)
                                                      └── Attachments   (tệp đính kèm)
```

**Quy tắc nền tảng quan trọng nhất:** mọi dữ liệu (trừ chính tài khoản `User`) đều bị **giới hạn trong đúng một workspace**. Một người chỉ thấy/thao tác được dữ liệu trong những workspace mà họ là thành viên. Workspace vừa là ranh giới tách dữ liệu giữa các khách hàng (tenant), vừa là nơi gắn vai trò phân quyền.

**Ngoài phạm vi v1:** theo dõi thời gian, sprint/epic, biểu đồ Gantt, task lặp lại, workflow tùy chỉnh, billing, SSO, app mobile native, link chia sẻ công khai.

## 2. Vai trò người dùng (gắn theo từng workspace)

Vai trò **không phải toàn cục** — một người có thể là OWNER ở workspace A nhưng chỉ là MEMBER ở workspace B. Vai trò lưu trên bản ghi join `workspace_members`.

| Vai trò | Là ai | Làm được gì (tóm tắt) |
|---|---|---|
| **OWNER** | Người tạo workspace, quyền cao nhất. Mỗi workspace có **đúng 1** OWNER. | Tất cả mọi thứ. Riêng OWNER mới: xóa workspace, chuyển giao quyền sở hữu, quản lý các ADMIN (thăng/giáng/xóa). |
| **ADMIN** | Quản lý được tin tưởng. | Như OWNER **trừ**: không xóa workspace, không động đến OWNER, không thăng/giáng/xóa ADMIN khác, không chuyển giao quyền sở hữu. |
| **MEMBER** | Người đóng góp tiêu chuẩn (vai trò mặc định khi nhận lời mời). | Làm việc trên project/task, bình luận. **Không** quản lý con người hay thiết lập workspace. |

**Giới hạn quan trọng của MEMBER cần nhớ khi code:**
- Tạo project: chỉ khi workspace bật cờ `memberCanCreateProject` (mặc định bật). Chỉ sửa được project do **chính mình tạo**; không archive/xóa project.
- Sửa / đổi trạng thái / giao task: **chỉ** với task mà họ là người tạo (`createdBy`) **hoặc** người được giao (`assignee`).
- Xóa task: **chỉ** task do chính mình tạo.
- Bình luận: tự thêm/sửa/xóa bình luận của mình; **không** xóa bình luận người khác.

**Bảo vệ OWNER:** OWNER không thể tự rời workspace (phải chuyển giao quyền sở hữu trước); không ai xóa được OWNER. Workspace không bao giờ được phép "không có chủ".

> **Nguyên tắc vàng:** phân quyền luôn được kiểm tra **ở server trên mỗi request**. Frontend chỉ ẩn/hiện nút cho đẹp UX, **không bao giờ được tin**.

## 3. Danh sách tính năng theo từng khu vực

### 3.1 Tài khoản & Xác thực
- Đăng ký, đăng nhập bằng email + mật khẩu.
- Phiên đăng nhập dùng JWT: **access token** (15 phút) + **refresh token** (7 ngày, tự xoay vòng mỗi lần refresh).
- Đăng xuất (vô hiệu refresh token), xem thông tin bản thân, đổi mật khẩu.
- Hỗ trợ nhiều phiên cùng lúc (login nhiều thiết bị).
- Đăng ký **không** tự tạo workspace — người dùng thấy màn hình rỗng kèm gợi ý tạo mới.

### 3.2 Hồ sơ người dùng
- Xem/sửa hồ sơ của chính mình (tên, avatar). **Email không sửa được** ở v1 (là mỏ neo định danh).
- Upload avatar (chỉ ảnh, ≤ 2 MB).
- **Không có** trang "danh sách toàn bộ người dùng" — đây là chủ đích của thiết kế đa tenant. Bộ chọn người (để giao việc/mention) chỉ truy vấn thành viên trong workspace hiện tại.

### 3.3 Workspace
- Tạo workspace (người tạo tự thành OWNER), liệt kê các workspace của mình, xem chi tiết.
- Cập nhật thiết lập (tên, mô tả, avatar, cờ cho phép MEMBER tạo project, múi giờ).
- Xóa workspace (xóa mềm, lan tỏa xuống mọi dữ liệu con).
- Chuyển giao quyền sở hữu sang một thành viên khác.

### 3.4 Thành viên & Lời mời
- Liệt kê thành viên (kèm vai trò, trạng thái, ngày tham gia).
- Mời người mới qua email (gửi link kèm token, hạn 7 ngày).
- Chấp nhận lời mời (kiểm tra token hợp lệ, chưa hết hạn, email khớp).
- Hủy lời mời đang chờ; xem trước lời mời (preview) không tiêu thụ token.
- Thăng/giáng cấp thành viên (chỉ OWNER), xóa thành viên, tự rời workspace.
- Khi một thành viên bị xóa: mọi task đang giao cho họ trong workspace đó tự động được **bỏ giao**.

### 3.5 Project
- Tạo/sửa/xóa project, archive/unarchive (project đã archive là **chỉ-đọc**).
- Mỗi project có một `key` ngắn (2–6 ký tự viết hoa, vd `MKT`) dùng làm tiền tố mã task; **bất biến** sau khi tạo.
- Liệt kê project kèm số liệu tiến độ (số task, số task done, % hoàn thành).
- Mỗi project định nghĩa 4 cột trạng thái chuẩn: `TODO → IN_PROGRESS → IN_REVIEW → DONE` (v1 cho đổi nhãn + sắp xếp lại, nhưng tập 4 key là cố định).

### 3.6 Task (trái tim hệ thống)
- Tạo nhanh (chỉ cần tiêu đề) hoặc đầy đủ (mô tả, người giao, độ ưu tiên, hạn chót, nhãn).
- Mỗi task có **mã dễ đọc bất biến** dạng `<projectKey>-<số>` (vd `MKT-42`).
- Xem chi tiết, sửa từng trường, đổi trạng thái, kéo-thả đổi vị trí trên bảng.
- Giao việc: **0 hoặc 1** người được giao; người được giao phải là thành viên ACTIVE.
- Độ ưu tiên: `LOW / MEDIUM / HIGH / URGENT` (chỉ ảnh hưởng sắp xếp & thống kê, không chặn chuyển trạng thái).
- **Quá hạn (overdue)** được **tính toán, không lưu**: `dueDate < hiện tại && status ≠ DONE`. Vào `DONE` thì hết quá hạn.
- Hai chế độ xem cùng một dữ liệu: **board** (nhóm theo cột Kanban) và **list** (bảng phẳng có phân trang/lọc).
- Tài nguyên con: **Checklist** (≤ 50 mục), **Attachments** (≤ 10 MB/tệp, ≤ 20 tệp), **Labels** nhúng (≤ 10), **Watch/Unwatch** (theo dõi để nhận thông báo).

### 3.7 Bình luận
- Thảo luận trên từng task, **phân luồng sâu 1 cấp** (bình luận gốc + reply; reply của reply gắn vào cùng gốc).
- `@mention` thành viên (autocomplete), sửa bình luận của mình (đánh dấu `editedAt`), xóa mềm.
- Xóa bình luận gốc đang có reply → giữ luồng, gốc hiển thị "đã xóa".

### 3.8 Thông báo
- Báo cho người dùng các sự kiện liên quan: được giao việc, bị mention, có bình luận/reply, task đổi trạng thái, task sắp đến hạn/quá hạn, được mời/được duyệt vào workspace, đổi vai trò, bị xóa khỏi workspace.
- **Người thực hiện không bao giờ nhận thông báo cho hành động của chính mình.**
- Huy hiệu số chưa đọc, đánh dấu đã đọc từng cái / tất cả, deep-link tới thực thể.
- v1 dùng **polling** (~30 giây); WebSocket là nâng cấp tương lai (không đổi hợp đồng API).

### 3.9 Dashboard & Phân tích (chỉ-đọc, mọi thành viên xem được)
- Tổng quan workspace: số project/task/thành viên/quá hạn, phân bố theo trạng thái & độ ưu tiên, xu hướng hoàn thành, khối lượng theo người được giao.
- Dashboard theo project (thêm % tiến độ, thời gian hoàn thành trung bình).
- "My work": task tôi được giao đang mở/quá hạn, sắp đến hạn (7 ngày), task do tôi tạo.

### 3.10 Nhật ký hoạt động (Activity Log)
- **Vết kiểm toán bất biến** (chỉ thêm, không sửa/xóa): mọi thay đổi có ý nghĩa đều sinh một bản ghi.
- Xem theo 3 phạm vi: toàn workspace, theo project, theo từng task (dòng thời gian).
- Mỗi bản ghi tự mô tả qua `type` + `metadata`; frontend tự dịch thành câu cho người đọc.

---

# PHẦN 2 — API SPEC THEO MODULE (cho Backend Dev)

## 0. Quy ước chung (đọc trước khi code bất kỳ endpoint nào)

**Base URL:** `/api`

**Xác thực:** mọi route gửi `Authorization: Bearer <accessToken>`, trừ route đánh dấu *Public*.

**Content type:** `application/json`; riêng upload tệp dùng `multipart/form-data`.

**Path param ID:** mọi `:id` phải là Mongo ObjectId hợp lệ; sai định dạng → `400 INVALID_ID`.

**Phạm vi workspace:** mọi route dưới `/workspaces/:workspaceId/...` chạy 2 middleware theo thứ tự:
1. `requireAuth` — verify JWT → load `User` → gắn `req.user`.
2. `requireWorkspaceRole(minRole)` — tìm bản ghi `workspace_members` cho `(req.user, :workspaceId)` → gắn `req.membership`; từ chối nếu vai trò < ngưỡng hoặc không phải thành viên.

Các kiểm tra cấp tài nguyên (vd MEMBER chỉ sửa task của mình) chạy **bên trong controller**, sau cổng vai trò.

**Vỏ bọc thành công:**
```json
{ "success": true, "data": { /* ... */ }, "meta": { /* tùy chọn */ } }
```

**Vỏ bọc lỗi (chuẩn hóa bởi 1 middleware errorHandler duy nhất):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [ { "field": "email", "message": "Email is already taken." } ],
    "requestId": "req_8f3c1a"
  }
}
```
`details` chỉ có với lỗi validation. `requestId` để tra log.

**Meta phân trang (endpoint danh sách):**
```json
"meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
```

**Query param danh sách dùng chung:** `page` (mặc định 1), `limit` (mặc định 20, **trần cứng 100**), `sort` (csv, tiền tố `-` = giảm dần, chỉ field trong whitelist; field lạ bị bỏ qua không báo lỗi), `search`, cùng các bộ lọc riêng từng endpoint. Filter nhiều giá trị nhận CSV (`status=TODO,DONE`), kết hợp bằng AND; enum sai → `422`.

**Luồng request chuẩn của mỗi endpoint:**
```
route → validate(schema) → requireAuth → requireWorkspaceRole → controller → service → model
                                                                                  ↑
                                              errorHandler bắt mọi lỗi ném ra ────┘
```
`notification.service.emit()` và `activity.service.log()` là 2 service dùng chung; module khác gọi chúng **sau khi** ghi DB chính thành công (fire-and-forget, lỗi của chúng không được làm fail thao tác chính).

---

## 1. MODULE AUTH (`/api/auth`)

**Trách nhiệm:** tạo tài khoản, verify credential, vòng đời JWT.

**Quy tắc nghiệp vụ cần code:**
- Email là định danh duy nhất, lưu chuẩn hóa (lowercase + trim).
- Mật khẩu băm bằng **bcrypt cost 12**; `passwordHash` đặt `select: false`; không bao giờ log mật khẩu.
- Access token TTL 15 phút (`JWT_ACCESS_SECRET`, payload `{ sub: userId, iat, exp }`); refresh token TTL 7 ngày (`JWT_REFRESH_SECRET`), **rotate** sau mỗi lần refresh, token cũ bị blacklist theo `jti`.
- Logout vô hiệu hóa refresh token gửi lên.
- Lỗi login/credential **luôn chung chung** — không bao giờ tiết lộ sai email hay sai mật khẩu (chống user enumeration).
- Rate limit nghiêm ngặt cho các route auth (vd 10 req/phút/IP).

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | Public | Tạo tài khoản |
| POST | `/auth/login` | Public | Đăng nhập |
| POST | `/auth/refresh` | Public | Đổi access token mới (rotate refresh) |
| POST | `/auth/logout` | Auth | Vô hiệu refresh token |
| GET | `/auth/me` | Auth | User hiện tại + danh sách workspace & vai trò |
| POST | `/auth/change-password` | Auth | Đổi mật khẩu |

### POST `/auth/register` — *Public*
**Body:** `{ "name", "email", "password" }`
**Validation:** name 2–60; email RFC hợp lệ ≤254, lowercase, duy nhất; password 8–72, ≥1 chữ cái & ≥1 chữ số, không trùng email.
**Luồng:** chuẩn hóa email → kiểm tra trùng (`409 EMAIL_TAKEN`) → bcrypt hash (cost 12) → tạo `users` (`emailVerified:false`) → cấp access + refresh token.
**Thành công `201`:** `{ user: {_id,name,email,avatarUrl}, accessToken, refreshToken }`
**Lỗi:** `409 EMAIL_TAKEN`, `422 VALIDATION_ERROR`.

### POST `/auth/login` — *Public*
**Body:** `{ "email", "password" }`
**Luồng:** tìm user theo email chuẩn hóa → không thấy → `401 INVALID_CREDENTIALS` (chung chung); `bcrypt.compare` sai → cùng lỗi `401`; thành công → cập nhật `lastLoginAt`, cấp token.
**Thành công `200`:** giống register. **Lỗi:** `401 INVALID_CREDENTIALS`, `422`.

### POST `/auth/refresh` — *Public*
**Body:** `{ "refreshToken" }`
**Luồng:** verify refresh token + kiểm tra chưa blacklist → cấp access + refresh mới (**rotate**, blacklist token cũ).
**Thành công `200`:** `{ accessToken, refreshToken }`. **Lỗi:** `401 TOKEN_INVALID`, `401 TOKEN_EXPIRED`.

### POST `/auth/logout` — *Auth*
**Body:** `{ "refreshToken" }` → vô hiệu hóa token đó. **Thành công `200`:** `{ loggedOut: true }`.

### GET `/auth/me` — *Auth*
**Thành công `200`:** `{ user: {...}, workspaces: [ { _id, name, role } ] }`.

### POST `/auth/change-password` — *Auth*
**Body:** `{ "currentPassword", "newPassword" }` → verify mật khẩu hiện tại trước.
**Lỗi:** `401 INVALID_CREDENTIALS`, `422`.

---

## 2. MODULE USERS (`/api/users`)

**Trách nhiệm:** chỉ quản lý hồ sơ của chính người dùng đã đăng nhập. **Không có** quản trị user toàn cục.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/users/me` | Auth | Alias object user trong `/auth/me` |
| PATCH | `/users/me` | Auth | Sửa `name`/`avatarUrl` (email không sửa) |
| POST | `/users/me/avatar` | Auth | Upload avatar (multipart, ảnh ≤ 2 MB) |

### PATCH `/users/me`
**Body:** `{ "name"?, "avatarUrl"? }` (avatarUrl: chỉ https). **Thành công `200`:** user đã cập nhật. **Lỗi:** `422`.

### POST `/users/me/avatar`
`multipart/form-data`, trường `file`, mime `png/jpeg/webp`, ≤ 2 MB.
**Thành công `200`:** `{ avatarUrl }`. **Lỗi:** `422 INVALID_FILE`.

> Lưu ý: bộ chọn người để giao việc/mention **không** thuộc module này — nó query `workspace_members` join `users` trong phạm vi workspace (xem module Members), tránh lộ toàn bộ user của nền tảng.

---

## 3. MODULE WORKSPACES (`/api/workspaces`)

**Trách nhiệm:** CRUD workspace, thiết lập, chuyển giao quyền sở hữu, ranh giới tenant.

**Quy tắc nghiệp vụ cần code:**
- Người tạo tự động thành OWNER; tạo workspace là một **giao dịch logic**: tạo `workspaces` (`ownerId`) + tạo `workspace_members` (`role:OWNER, status:ACTIVE`) + ghi activity `WORKSPACE_CREATED`.
- Luôn có **đúng 1 OWNER** mọi thời điểm.
- Xóa là **xóa mềm** (`deletedAt`); lan tỏa logic xuống project → task → comment → invitation → notification → activity (đều trở nên không truy cập được). Job purge nền xóa cứng sau khoảng ân hạn.
- Chuyển giao quyền sở hữu: đích phải là thành viên ACTIVE; **nguyên tử** OWNER cũ → ADMIN, đích → OWNER.
- Giới hạn mềm số workspace sở hữu (vd 10) → `403 WORKSPACE_LIMIT_REACHED`.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/workspaces` | Auth | Liệt kê workspace mà tôi là thành viên ACTIVE |
| POST | `/workspaces` | Auth | Tạo workspace (tôi thành OWNER) |
| GET | `/workspaces/:workspaceId` | Member | Chi tiết + `myRole` |
| PATCH | `/workspaces/:workspaceId` | ADMIN+ | Cập nhật tên/mô tả/avatar/settings |
| DELETE | `/workspaces/:workspaceId` | OWNER | Xóa mềm + lan tỏa |
| POST | `/workspaces/:workspaceId/transfer-ownership` | OWNER | Chuyển giao quyền sở hữu |

### GET `/workspaces`
**Query:** `search`, `sort` (`name`,`-createdAt`), `page`, `limit`.
**Thành công `200`:** mảng `{ ...workspace, myRole, memberCount, projectCount }`.

### POST `/workspaces`
**Body:** `{ "name", "description"? }` (name 2–80; description ≤500).
**Thành công `201`:** workspace. **Lỗi:** `422`, `403 WORKSPACE_LIMIT_REACHED`.

### GET `/workspaces/:workspaceId` — *Member*
**Thành công `200`:** chi tiết + `myRole`. **Lỗi:** `404 WORKSPACE_NOT_FOUND` (người không phải thành viên cũng nhận `404` — không xác nhận tồn tại).

### PATCH `/workspaces/:workspaceId` — *ADMIN+*
**Body:** `{ "name"?, "description"?, "avatarUrl"?, "settings"? }` (`settings.memberCanCreateProject` boolean, `settings.timezone` IANA). **Lỗi:** `403`, `422`.

### DELETE `/workspaces/:workspaceId` — *OWNER*
**Thành công `200`:** `{ deleted: true }`. **Lỗi:** `403`.

### POST `/workspaces/:workspaceId/transfer-ownership` — *OWNER*
**Body:** `{ "newOwnerId" }` (ObjectId, thành viên ACTIVE ≠ người gọi). **Lỗi:** `422 USER_NOT_MEMBER`, `403`.

---

## 4. MODULE MEMBERS (`/api/workspaces/:workspaceId/members`)

**Trách nhiệm:** quản lý người trong workspace; là trái tim của RBAC (bảng join `workspace_members`).

**Quy tắc nghiệp vụ cần code:**
- Xóa thành viên = đặt `status: REMOVED` (không xóa hàng, để giữ quy gán lịch sử).
- ADMIN chỉ xóa được MEMBER; OWNER xóa được cả ADMIN & MEMBER; **không ai xóa được OWNER**.
- Đổi vai trò: chỉ OWNER chạy được; không đổi vai trò của chính mình; không nhắm vào OWNER.
- Khi xóa một thành viên: **bỏ giao** mọi task của họ trong workspace (ghi `TASK_UNASSIGNED`).
- OWNER không thể rời (`409 OWNER_CANNOT_LEAVE`) — phải chuyển giao trước.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/.../members` | Member | Liệt kê thành viên |
| PATCH | `/.../members/:memberId/role` | OWNER | Thăng/giáng cấp |
| DELETE | `/.../members/:memberId` | ADMIN+ | Xóa thành viên (status REMOVED) |
| POST | `/.../members/leave` | Member | Tự rời workspace |

### GET `/.../members` — *Member*
**Query:** `search` (tên/email), `role`, `status`, `page`, `limit`, `sort`.
**Thành công `200`:** mảng `{ membershipId, user:{_id,name,email,avatarUrl}, role, status, joinedAt }`.

### PATCH `/.../members/:memberId/role` — *OWNER*
**Body:** `{ "role": "ADMIN" | "MEMBER" }`.
**Side-effect:** thông báo `ROLE_CHANGED` tới người bị ảnh hưởng; ghi activity.
**Lỗi:** `403`, `409 CANNOT_MODIFY_OWNER`, `422`.

### DELETE `/.../members/:memberId` — *ADMIN+*
**Logic:** ADMIN chỉ xóa MEMBER; bỏ giao mọi task của người bị xóa.
**Side-effect:** thông báo `REMOVED_FROM_WORKSPACE`; activity `TASK_UNASSIGNED` cho từng task.
**Lỗi:** `403`, `409 CANNOT_REMOVE_OWNER`.

### POST `/.../members/leave` — *Member*
**Lỗi:** `409 OWNER_CANNOT_LEAVE`.

---

## 5. MODULE INVITATIONS

**Trách nhiệm:** lời mời workspace đang chờ.

**Quy tắc nghiệp vụ cần code:**
- Token = hex ngẫu nhiên 32-byte, **duy nhất**, **không bao giờ** trả về trong response danh sách.
- Mời: người gọi ≥ ADMIN; email chưa phải thành viên ACTIVE (`409 ALREADY_MEMBER`); không có lời mời PENDING trùng (`409 INVITATION_EXISTS`); `expiresAt = now + 7d`.
- Chấp nhận: status PENDING + chưa hết hạn + email khớp người đang đăng nhập.
- Gửi email là **bất đồng bộ**; gửi lỗi thì lời mời vẫn tồn tại, có thể gửi lại.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/invitations` | ADMIN+ | Gửi lời mời |
| GET | `/workspaces/:workspaceId/invitations` | ADMIN+ | Liệt kê (token bị lược) |
| DELETE | `/workspaces/:workspaceId/invitations/:invitationId` | ADMIN+ | Hủy lời mời PENDING |
| POST | `/invitations/accept` | Auth | Chấp nhận bằng token |
| GET | `/invitations/preview?token=...` | Public | Xem trước, không tiêu thụ token |

### POST `/workspaces/:workspaceId/invitations` — *ADMIN+*
**Body:** `{ "email", "role": "ADMIN"|"MEMBER" }` (không bao giờ OWNER).
**Side-effect:** activity `MEMBER_INVITED`; nếu email đã là user đã đăng ký → thông báo `MEMBER_INVITED`.
**Thành công `201`:** lời mời (token bị lược). **Lỗi:** `409 ALREADY_MEMBER`, `409 INVITATION_EXISTS`, `403`, `422`.

### POST `/invitations/accept` — *Auth*
**Body:** `{ "token" }`.
**Luồng:** kiểm tra PENDING (`410 INVITATION_INVALID`) → chưa hết hạn (nếu hết → đánh dấu EXPIRED, `410 INVITATION_EXPIRED`) → email khớp (`403 INVITATION_EMAIL_MISMATCH`) → chưa là thành viên (`409 ALREADY_MEMBER`, idempotent-friendly) → tạo `workspace_members` (`role` của lời mời, ACTIVE) → đánh dấu lời mời ACCEPTED.
**Side-effect:** activity `MEMBER_JOINED`; thông báo cho người mời.
**Thành công `200`:** `{ workspace, role }`.

### DELETE `/.../invitations/:invitationId` — *ADMIN+*
Hủy PENDING → `CANCELLED`. **Lỗi:** `409 INVITATION_NOT_PENDING`, `404`.

### GET `/invitations/preview?token=...` — *Public*
Trả về nhẹ: tên workspace, người mời, vai trò — không tiêu thụ token.

---

## 6. MODULE PROJECTS (`/api/workspaces/:workspaceId/projects`)

**Trách nhiệm:** nhóm task, định nghĩa các cột của bảng.

**Quy tắc nghiệp vụ cần code:**
- `key` 2–6 ký tự `^[A-Z0-9]+$`, **duy nhất theo workspace** (không phân biệt hoa thường), **bất biến** sau khi tạo (đã nung vào `taskCode`). Tự suy ra từ tên nếu để trống.
- Trạng thái mặc định: `["TODO","IN_PROGRESS","IN_REVIEW","DONE"]`; `taskCounter: 0`.
- Project đã **archive là chỉ-đọc**: không tạo/sửa task, không đổi trạng thái; vẫn hiện trong danh sách lọc & dashboard.
- Xóa project = xóa mềm + lan tỏa task/comment.
- Quyền tạo/sửa của MEMBER: tạo chỉ khi `memberCanCreateProject=true`; chỉ sửa project mình tạo; không archive/xóa.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/.../projects` | Member | Liệt kê + số liệu tiến độ |
| POST | `/.../projects` | ADMIN+ / MEMBER nếu được phép | Tạo project |
| GET | `/.../projects/:projectId` | Member | Chi tiết |
| PATCH | `/.../projects/:projectId` | ADMIN+ / MEMBER là người tạo | Cập nhật (key bất biến) |
| POST | `/.../projects/:projectId/archive` | ADMIN+ | Bật/tắt archive |
| DELETE | `/.../projects/:projectId` | ADMIN+ | Xóa mềm + lan tỏa |

### GET `/.../projects` — *Member*
**Query:** `search` (tên/key), `archived` (`true|false|all`, mặc định `false`), `sort` (`name`,`-createdAt`,`-updatedAt`), `page`, `limit`.
**Thành công `200`:** mảng `{ ...project, taskCount, doneCount, progress }` (`progress = doneCount/taskCount`, =0 khi rỗng).

### POST `/.../projects`
**Body:** `{ "name", "description"?, "key"?, "color"? }`.
**Luồng:** kiểm tra quyền MEMBER → kiểm tra `key` duy nhất → tạo với 4 trạng thái mặc định + `taskCounter:0`.
**Side-effect:** activity `PROJECT_CREATED`.
**Lỗi:** `409 PROJECT_KEY_TAKEN`, `403`, `422`.

### PATCH `/.../projects/:projectId`
**Body:** `{ "name"?, "description"?, "color"?, "statuses"? }` — `key` không sửa. `statuses` nếu gửi phải chứa **đúng 4 key chuẩn**, nhãn 1–30 ký tự (chỉ cho đổi nhãn + thứ tự).
**Lỗi:** `403`, `422`.

### POST `/.../projects/:projectId/archive` — *ADMIN+*
**Body:** `{ "archived": true|false }` → bật/tắt `archivedAt`.

---

## 7. MODULE TASKS (`/api/workspaces/:workspaceId/projects/:projectId/tasks`)

**Trách nhiệm:** đơn vị công việc cốt lõi. Đây là module phức tạp nhất — đọc kỹ phần "Logic chi tiết".

### 7.A Logic chi tiết cần hiện thực

**Mã task (`taskCode`):** khi tạo, **tăng nguyên tử** `project.taskCounter` rồi tạo `taskCode = "<projectKey>-<counter>"` (vd `MKT-42`). Bất biến.

**Vị trí (`position`) — sắp xếp thưa kiểu float:**
- Task mới trong một cột → `position = (max position trong cột) + 1024`.
- Thả giữa A và B → `(A.position + B.position) / 2`; thả lên đầu → `firstPosition / 2`; thả xuống cuối → `lastPosition + 1024`.
- **Rebalancing:** nếu khe hở giữa 2 thẻ lân cận `< 0.0001` → chạy thủ tục gán lại vị trí cách đều bằng số nguyên (`1024, 2048, ...`) cho cả cột trong một lần ghi hàng loạt.
- Kéo đồng thời → **last-write-wins** trên `position`; frontend refetch bảng để đối chiếu.

**Chuyển trạng thái (v1: any-to-any):** bảng tự do, thẻ nhảy bất kỳ → bất kỳ. Server vẫn:
- Từ chối status không nằm trong `project.statuses` → `409 INVALID_STATUS_TRANSITION`.
- Từ chối thay đổi trên project đã archive → `409 PROJECT_ARCHIVED`.
- Đặt `completedAt = now` khi vào `DONE`; xóa `completedAt` khi rời `DONE`.
- (Hook kiểm tra chuyển đổi được **tập trung hóa** để sau này bật chế độ tuyến tính chỉ sửa 1 chỗ.)

**Giao việc:** 0/1 assignee; assignee phải là **thành viên ACTIVE** (`422 ASSIGNEE_NOT_MEMBER`); tự giao cho mình → ghi activity nhưng **không** thông báo.

**Quá hạn:** **tính toán, không lưu** → `isOverdue = dueDate != null && dueDate < now && status !== 'DONE'`.

**Ngày:** nếu có cả `startDate` & `dueDate` thì `startDate ≤ dueDate` (`422`). Đặt `dueDate` quá khứ được phép (frontend cảnh báo không chặn).

### 7.B Endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/.../tasks` | Member | Danh sách (board / list) |
| POST | `/.../tasks` | Member | Tạo task |
| GET | `/.../tasks/:taskId` | Member | Chi tiết đầy đủ |
| PATCH | `/.../tasks/:taskId` | Member (giới hạn) | Cập nhật một phần |
| DELETE | `/.../tasks/:taskId` | Member (giới hạn) | Xóa mềm + lan tỏa comment |
| POST | `/.../tasks/:taskId/checklist` | Member (giới hạn) | Thêm mục checklist |
| PATCH | `/.../tasks/:taskId/checklist/:itemId` | Member (giới hạn) | Sửa mục |
| DELETE | `/.../tasks/:taskId/checklist/:itemId` | Member (giới hạn) | Xóa mục |
| POST | `/.../tasks/:taskId/attachments` | Member (giới hạn) | Upload tệp (multipart) |
| DELETE | `/.../tasks/:taskId/attachments/:attachmentId` | Người upload / ADMIN+ | Xóa tệp |
| POST | `/.../tasks/:taskId/watch` | Member | Tự thêm vào watchers |
| DELETE | `/.../tasks/:taskId/watch` | Member | Tự bỏ khỏi watchers |

### GET `/.../tasks` — *Member*
Cấp dữ liệu cho cả Kanban và bảng phẳng.
**Query:** `view` (`board|list`), `status` (csv), `assignee` (ObjectId/`me`/`none`), `priority` (csv), `label` (csv), `dueFrom`/`dueTo` (ISO), `overdue` (`true`), `search`, `sort` (`position` mặc định trong status, `-createdAt`, `dueDate`, `-priority`), `page`/`limit` (chỉ `view=list`).
**`view=board` `200`:**
```json
{ "data": { "columns": [
  { "status": "TODO", "label": "To Do", "tasks": [ /* trang đầu, vd 50, sort position */ ], "total": 12 }
] } }
```
`total` để UI hiện "+N more" và lazy-load.
**`view=list` `200`:** mảng phẳng + `meta` phân trang.

### POST `/.../tasks` — *Member*
**Body:** `{ "title", "description"?, "status"?, "priority"?, "assigneeId"?, "dueDate"?, "startDate"?, "labels"? }`.
**Validation:** title 1–200 (không toàn space); description ≤10000; status ∈ statuses; priority ∈ enum; assignee ACTIVE; labels ≤10 (name 1–20, color hex).
**Luồng:** project thuộc workspace & chưa archive (`409 PROJECT_ARCHIVED`) → verify assignee (`422 ASSIGNEE_NOT_MEMBER`) → tăng `taskCounter` nguyên tử + tạo `taskCode` → tính `position` → tạo task.
**Side-effect:** activity `TASK_CREATED`; nếu giao ngay → `TASK_ASSIGNED` + thông báo assignee.
**Thành công `201`:** task. **Lỗi:** `409 PROJECT_ARCHIVED`, `422 ASSIGNEE_NOT_MEMBER`, `422`, `403`.

### GET `/.../tasks/:taskId` — *Member*
**`200`:** task đầy đủ gồm `checklist`, `labels`, `attachments` nhúng; `assignee`/`createdBy`/`watchers` đã populate; `commentCount`.

### PATCH `/.../tasks/:taskId` — *Member (giới hạn)*
Cập nhật một phần bất kỳ tập con: `title`, `description`, `status`, `position`, `priority`, `assigneeId`, `dueDate`, `startDate`, `labels`.
**Quyền:** ADMIN/OWNER luôn được; MEMBER chỉ khi là `createdBy` hoặc `assignee`.
**Luồng:** đổi status → kiểm tra chuyển đổi + set/clear `completedAt` + activity `TASK_STATUS_CHANGED {from,to}` + thông báo assignee & watchers; đổi assignee → verify ACTIVE + `TASK_ASSIGNED`/`TASK_UNASSIGNED`; đổi priority/due/title → activity tương ứng.
**Lỗi:** `403 FORBIDDEN`, `409 INVALID_STATUS_TRANSITION`, `409 PROJECT_ARCHIVED`, `422`.

### DELETE `/.../tasks/:taskId` — *Member (giới hạn)*
**Quyền:** ADMIN/OWNER bất kỳ; MEMBER chỉ task `createdBy` của mình. Xóa mềm + lan tỏa comment.
**Side-effect:** activity `TASK_DELETED`. **Lỗi:** `403`.

### Checklist (tài nguyên con)
- `POST .../checklist` body `{ "text" }` (1–200); `PATCH .../checklist/:itemId` `{ "text"?, "done"?, "order"? }`; `DELETE .../checklist/:itemId`.
- Quyền giống PATCH task; tối đa 50 mục → `422 CHECKLIST_LIMIT`.

### Attachments (tài nguyên con)
- `POST .../attachments` — `multipart/form-data`, trường `file`, ≤ 10 MB, mime trong allowlist, ≤ 20 tệp/task → trả metadata. Side-effect: activity `TASK_ATTACHMENT_ADDED`.
- `DELETE .../attachments/:attachmentId` — người upload hoặc ADMIN+.
- Blob lưu ở object storage (đĩa cục bộ dev / S3 prod); tên file tạo tự động, không dùng tên người dùng làm path. Xóa task **không** xóa blob đồng bộ — job dọn rác thu hồi file mồ côi.

### Watch
- `POST/DELETE .../watch` — người gọi tự thêm/bỏ mình khỏi `watchers` (để nhận thông báo `TASK_STATUS_CHANGED`/`COMMENT_ADDED`).

---

## 8. MODULE COMMENTS

**Trách nhiệm:** thảo luận phân luồng 1 cấp trên task, có `@mention`.

**Quy tắc nghiệp vụ cần code:**
- Phân luồng **sâu đúng 1 cấp**: `parentId` phải trỏ tới một bình luận **gốc cùng task**. Reply của reply → gắn vào cùng gốc (`409 PARENT_IS_REPLY` nếu parent là reply).
- `@mention` phân giải phía server → mảng `mentions:[userId]`, **chỉ thành viên ACTIVE**; handle lạ giữ làm text thuần.
- Sửa → set `editedAt`, phân giải lại mention; **chỉ mention mới thêm** mới bắn `MENTIONED`.
- Xóa gốc có reply → xóa mềm gốc, giữ reply, gốc render "comment deleted".
- Mỗi thêm/xóa cập nhật `task.commentCount` (phi chuẩn hóa).

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/.../tasks/:taskId/comments` | Member | Liệt kê (phân trang) |
| POST | `/.../tasks/:taskId/comments` | Member | Thêm bình luận / reply |
| PATCH | `/.../comments/:commentId` | Tác giả | Sửa bình luận của mình |
| DELETE | `/.../comments/:commentId` | Tác giả / ADMIN+ | Xóa mềm |

### GET `/.../tasks/:taskId/comments` — *Member*
**Query:** `page`, `limit` (20), `sort` (`createdAt`). Trả gốc kèm reply lồng, hoặc phẳng kèm `parentId` (frontend tự nhóm). `author` đã populate.

### POST `/.../tasks/:taskId/comments` — *Member*
**Body:** `{ "body", "parentId"? }` (body 1–5000, không toàn space).
**Side-effect:** activity `COMMENT_ADDED`; thông báo: `COMMENT_ADDED` → assignee; `MENTIONED` → từng người được nhắc; `COMMENT_REPLY` → tác giả gốc (khi có `parentId`). Áp dụng khử trùng lặp (xem §11).
**Thành công `201`:** bình luận. **Lỗi:** `422`, `409 PARENT_IS_REPLY`, `404 TASK_NOT_FOUND`.

### PATCH `/.../comments/:commentId` — *Tác giả*
**Body:** `{ "body" }` → set `editedAt`, phân giải lại mention. **Lỗi:** `403`.

### DELETE `/.../comments/:commentId` — *Tác giả / ADMIN+*
Xóa mềm; giảm `commentCount`; nếu có reply → hiển thị "deleted".

---

## 9. MODULE NOTIFICATIONS (`/api/notifications`)

**Trách nhiệm:** báo cho người dùng sự kiện liên quan. Một document **cho mỗi người nhận trên mỗi sự kiện**, tự chứa dữ liệu để render + deep-link không cần fetch thêm.

**Quy tắc nghiệp vụ cần code:**
- **Người thực hiện không bao giờ nhận thông báo cho hành động của mình.**
- Khử trùng lặp: `(userId, type, entityId)` giống nhau trong khoảng ngắn → gộp.
- Ưu tiên độ cụ thể: nếu một bình luận vừa mention vừa reply tới cùng người → chỉ gửi `MENTIONED`, chặn các cái khác cho người đó.
- Đánh dấu đã đọc idempotent.

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/notifications` | Auth | Liệt kê (lọc workspace/unread/type) |
| GET | `/notifications/unread-count` | Auth | Số chưa đọc (cho huy hiệu) |
| PATCH | `/notifications/:notificationId/read` | Chủ | Đánh dấu 1 cái đã đọc |
| PATCH | `/notifications/read-all` | Auth | Đánh dấu tất cả đã đọc |
| DELETE | `/notifications/:notificationId` | Chủ | Xóa 1 thông báo |

### GET `/notifications`
**Query:** `workspaceId`, `unread` (`true`), `type`, `page`, `limit`, `sort` (`-createdAt`). **`200`:** mảng + `meta`.

### GET `/notifications/unread-count`
**Query:** `workspaceId?`. **`200`:** `{ count: 7 }` (query dùng index `{userId, read, createdAt}`).

### PATCH `/notifications/read-all`
**Body:** `{ "workspaceId"? }` — đánh dấu tất cả (tùy chọn theo workspace) đã đọc.

**Bảng loại thông báo (`type`) — bắt buộc để code `NotificationService.emit()`:**

| `type` | Sự kiện | Người nhận |
|---|---|---|
| `TASK_ASSIGNED` | Task được giao/giao lại | assignee mới (≠ người thực hiện) |
| `TASK_STATUS_CHANGED` | Task đổi trạng thái | assignee + watchers (≠ người thực hiện) |
| `TASK_DUE_SOON` | Job hằng ngày: đến hạn trong 24h, chưa xong | assignee |
| `TASK_OVERDUE` | Job hằng ngày: task quá hạn | assignee |
| `COMMENT_ADDED` | Bình luận mới | assignee + watchers (≠ người thực hiện, ≠ đã báo qua mention/reply) |
| `COMMENT_REPLY` | Reply một bình luận | tác giả gốc (≠ người thực hiện) |
| `MENTIONED` | Được @mention | từng người được nhắc (≠ người thực hiện) |
| `MEMBER_INVITED` | Mời tới email của user đã tồn tại | người được mời |
| `MEMBER_JOINED` | Lời mời được chấp nhận | người mời |
| `ROLE_CHANGED` | Bị thăng/giáng cấp | người bị ảnh hưởng |
| `REMOVED_FROM_WORKSPACE` | Bị xóa khỏi workspace | người bị ảnh hưởng |
| `PROJECT_CREATED` | Project mới | tùy chọn — mặc định **tắt** để tránh nhiễu |

**Realtime:** v1 polling (chuông poll `unread-count` ~30s). WebSocket là nâng cấp tương lai, không đổi hợp đồng API.

---

## 10. MODULE DASHBOARD & ACTIVITIES

### 10.A Dashboard (`/api/workspaces/:workspaceId/dashboard`)
Chỉ-đọc; mọi thành viên xem được. Mọi con số đến từ **aggregation pipeline tại thời điểm request** (không có bộ đếm tính sẵn ở v1, trừ `taskCounter` vốn để đánh mã). Workspace rỗng → trả tập dữ liệu **đúng định dạng rỗng**, không phải lỗi. Có thể cache TTL ngắn (vd 60s) khóa theo `(workspaceId, from, to)`.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/workspaces/:workspaceId/dashboard` | Tổng quan workspace |
| GET | `/workspaces/:workspaceId/projects/:projectId/dashboard` | Theo project (thêm `progress`, `avgCompletionTimeHours`) |
| GET | `/workspaces/:workspaceId/dashboard/my-work` | Theo người gọi |

**GET `/dashboard`** — Query `from`,`to` (ISO, mặc định 30 ngày). **`200`:**
```json
{ "data": {
  "totals": { "projects": 8, "tasks": 214, "members": 12, "overdue": 9 },
  "tasksByStatus": { "TODO": 60, "IN_PROGRESS": 40, "IN_REVIEW": 14, "DONE": 100 },
  "tasksByPriority": { "LOW": 30, "MEDIUM": 120, "HIGH": 50, "URGENT": 14 },
  "completionTrend": [ { "date": "2026-05-01", "completed": 5 } ],
  "workloadByAssignee": [ { "user": {}, "open": 12, "overdue": 2 } ]
} }
```

**GET `/dashboard/my-work`** — trả `assignedOpen`, `assignedOverdue`, `dueSoon` (7 ngày), `createdByMe`, hoạt động gần đây liên quan người gọi.

Mẫu aggregation (phân bố trạng thái):
```js
Task.aggregate([
  { $match: { workspaceId, deletedAt: null } },
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);
```

### 10.B Activities (`/api/workspaces/:workspaceId/activities`)
Vết kiểm toán **bất biến** (append-only, không sửa/xóa bởi logic ứng dụng).

**GET `/workspaces/:workspaceId/activities`** — Query `projectId?`, `taskId?`, `actorId?`, `type?`, `from?`, `to?`, `page`, `limit`, `sort` (`-createdAt`). **`200`:** mảng với `actor` populate + `metadata` sẵn render.

**`type` của task** (cho `ActivityService.log()`): `TASK_CREATED {title}`, `TASK_STATUS_CHANGED {from,to}`, `TASK_ASSIGNED {assigneeId}`, `TASK_UNASSIGNED {previousAssigneeId}`, `TASK_PRIORITY_CHANGED {from,to}`, `TASK_DUE_CHANGED {from,to}`, `TASK_RENAMED {from,to}`, `COMMENT_ADDED {commentId}`, `TASK_ATTACHMENT_ADDED {fileName}`, `TASK_DELETED {title}`. Ngoài ra: `WORKSPACE_CREATED`, `PROJECT_CREATED`, `MEMBER_INVITED`, `MEMBER_JOINED`.

> Activity lưu `entityLabel` phi chuẩn hóa (vd tiêu đề task lúc đó) để vẫn render được khi thực thể gốc đã bị xóa.

---

## 11. Mô hình dữ liệu (MongoDB + Mongoose)

**Quy ước chung:** mọi document có `createdAt`/`updatedAt` (`timestamps:true`); collection xóa mềm có `deletedAt: Date|null` + default scope loại trừ document đã xóa; tham chiếu chéo là `ObjectId`; thời gian dùng `Date` UTC.

| Collection | Vai trò | Trường chính | Index quan trọng |
|---|---|---|---|
| `users` | Định danh toàn cục (duy nhất không bị giới hạn tenant) | `name`, `email`(unique,lowercase), `passwordHash`(select:false), `avatarUrl`, `emailVerified`, `lastLoginAt` | `{email:1}` unique |
| `workspaces` | Ranh giới tenant | `name`, `description`, `ownerId`, `settings.memberCanCreateProject`, `settings.timezone`, `deletedAt` | `{ownerId:1}`, `{deletedAt:1}` |
| `workspace_members` | Bảng join — trái tim RBAC | `workspaceId`, `userId`, `role`(OWNER\|ADMIN\|MEMBER), `status`(ACTIVE\|REMOVED), `joinedAt` | `{workspaceId,userId}` **unique**, `{userId,status}`, `{workspaceId,role}` |
| `invitations` | Lời mời chờ | `workspaceId`, `email`, `role`, `token`(hex32,unique), `status`(PENDING\|ACCEPTED\|EXPIRED\|CANCELLED), `invitedBy`, `expiresAt` | `{token}` unique, `{workspaceId,email,status}`, `{expiresAt}` |
| `projects` | Container task | `workspaceId`, `name`, `key`(unique/ws,bất biến), `color`, `statuses[]`, `taskCounter`, `createdBy`, `archivedAt`, `deletedAt` | `{workspaceId,deletedAt}`, `{workspaceId,key}` unique, `{workspaceId,archivedAt}` |
| `tasks` | Đơn vị công việc | `workspaceId`(phi chuẩn hóa), `projectId`, `taskCode`(unique/ws), `title`, `description`, `status`, `priority`, `position`(float), `assignee`, `createdBy`, `dueDate`, `startDate`, `completedAt`, `labels[]`, `checklist[]`, `attachments[]`, `watchers[]`, `commentCount`, `deletedAt` | `{projectId,status,position}` (quan trọng nhất), `{workspaceId,assignee}`, `{workspaceId,dueDate}`, `{taskCode}`, text `{title,description}` |
| `comments` | Thảo luận | `taskId`, `workspaceId`, `authorId`, `body`, `parentId`, `mentions[]`, `editedAt`, `deletedAt` | `{taskId,parentId,createdAt}`, `{workspaceId,authorId}` |
| `notifications` | Thông báo | `userId`, `workspaceId`, `type`, `title`, `body`, `entityType`, `entityId`, `actorId`, `read`, `readAt` | `{userId,read,createdAt:-1}` (+ TTL tùy chọn) |
| `activities` | Audit bất biến | `workspaceId`, `projectId?`, `taskId?`, `actorId`, `type`, `entityLabel`, `metadata`, `createdAt` (không `updatedAt`) | `{workspaceId,createdAt:-1}`, `{projectId,createdAt:-1}`, `{taskId,createdAt:-1}` |

**Cascade xóa mềm:** xóa workspace → ẩn project → task → comment; xóa project → ẩn task → comment; xóa task → ẩn comment. Hard purge là job nền.

Schema mẫu (`users`):
```js
const userSchema = new Schema({
  name:          { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash:  { type: String, required: true, select: false },
  avatarUrl:     { type: String, default: null },
  emailVerified: { type: Boolean, default: false },
  lastLoginAt:   { type: Date, default: null },
}, { timestamps: true });
```

---

## 12. Validation (tóm tắt — backend là tầng có thẩm quyền, trả `422` + `details[]`)

| Khu vực | Quy tắc cốt lõi |
|---|---|
| **Auth/User** | name 2–60; email RFC ≤254 lowercase unique; password 8–72 (≥1 chữ + ≥1 số, ≠ email); avatarUrl chỉ https; avatar file png/jpeg/webp ≤2MB |
| **Workspace** | name 2–80; description ≤500; `settings.timezone` IANA; `newOwnerId` ObjectId, ACTIVE ≠ người gọi |
| **Project** | name 2–80; description ≤1000; key 2–6 `^[A-Z0-9]+$` unique/ws bất biến; color `^#[0-9A-Fa-f]{6}$`; statuses (nếu có) đúng 4 key, nhãn 1–30 |
| **Task** | title 1–200 (không toàn space); description ≤10000; status ∈ project.statuses; priority enum; assigneeId ACTIVE; nếu có cả 2 ngày thì start≤due; position số hữu hạn ≥0; labels ≤10 (name 1–20, color hex); checklist text 1–200, ≤50; attachment mime allowlist ≤10MB ≤20 |
| **Comment** | body 1–5000 (không toàn space); parentId trỏ bình luận **gốc cùng task** |
| **Invitation** | email hợp lệ chuẩn hóa, chưa ACTIVE, không PENDING trùng; role ADMIN\|MEMBER (không OWNER); token 64-hex PENDING chưa hết hạn email khớp |
| **List query** | page≥1 (mặc định 1); limit 1–100 (mặc định 20); sort chỉ field whitelist; filter enum/ngày kiểm tra; sai → `422` (trừ field sort lạ → bỏ qua) |

---

## 13. Danh mục lỗi (Error Catalogue)

| HTTP | `code` | Khi nào |
|---:|---|---|
| 400 | `BAD_REQUEST` | JSON sai, query xấu |
| 400 | `INVALID_ID` | Path param không phải ObjectId |
| 401 | `UNAUTHENTICATED` | Thiếu token |
| 401 | `TOKEN_EXPIRED` | Access token hết hạn (kích hoạt refresh) |
| 401 | `TOKEN_INVALID` | Chữ ký/định dạng sai |
| 401 | `INVALID_CREDENTIALS` | Sai login / đổi mật khẩu |
| 403 | `FORBIDDEN` | Đã auth nhưng vai trò/quyền sở hữu không đủ |
| 403 | `INVITATION_EMAIL_MISMATCH` | Chấp nhận bằng tài khoản sai |
| 404 | `WORKSPACE_NOT_FOUND` | Không tồn tại / đã xóa / không phải thành viên |
| 404 | `PROJECT_NOT_FOUND` / `TASK_NOT_FOUND` / `COMMENT_NOT_FOUND` | Không tồn tại / đã xóa |
| 409 | `EMAIL_TAKEN` | Đăng ký trùng |
| 409 | `ALREADY_MEMBER` | Mời/chấp nhận khi đã là thành viên |
| 409 | `INVITATION_EXISTS` | Lời mời PENDING trùng |
| 409 | `PROJECT_KEY_TAKEN` | Key project trùng |
| 409 | `PROJECT_ARCHIVED` | Sửa task trên project đã archive |
| 409 | `INVALID_STATUS_TRANSITION` | Status không thuộc project |
| 409 | `CANNOT_MODIFY_OWNER` / `CANNOT_REMOVE_OWNER` / `OWNER_CANNOT_LEAVE` | Bảo vệ OWNER |
| 409 | `PARENT_IS_REPLY` | Reply một reply |
| 410 | `INVITATION_INVALID` / `INVITATION_EXPIRED` | Token lời mời cũ/hỏng |
| 422 | `VALIDATION_ERROR` | Lỗi field (kèm `details`) |
| 422 | `ASSIGNEE_NOT_MEMBER` | Giao cho người không phải thành viên |
| 422 | `CHECKLIST_LIMIT` / `INVALID_FILE` | Giới hạn tài nguyên con |
| 429 | `RATE_LIMITED` | Quá nhiều request (kèm `Retry-After`) |
| 500 | `INTERNAL_ERROR` | Không xử lý được; chi tiết chỉ trong log |

**Mẫu backend:** controller/service `throw new ApiError(status, code, message, details?)`; async handler được bọc để lỗi tới được `errorHandler`; `ValidationError`/`CastError` của Mongoose và lỗi JWT chuẩn hóa về danh mục trên trước khi serialize; mọi lỗi log kèm `requestId`, route, userId, (≥500 kèm stack).

---

## 14. Bảo mật (checklist cho backend)

- **JWT:** access 15' (`JWT_ACCESS_SECRET`) + refresh 7d (`JWT_REFRESH_SECRET`) rotate + blacklist jti. Token **không** mang vai trò — vai trò phân giải mới từ `workspace_members` mỗi request (giáng cấp có hiệu lực ngay).
- **Mật khẩu:** bcrypt cost 12, `select:false`, không log.
- **Cô lập tenant:** mọi query project/task/comment/activity/notification phải kèm `workspaceId` (hoặc tới qua cha đã giới hạn). Không endpoint nào nhận `taskId` thô mà bỏ qua kiểm tra tư cách thành viên.
- **Chống IDOR:** truy cập chéo tenant trả `404` (không `403`) để không xác nhận tồn tại.
- **Rate limit:** toàn cục (vd 300/phút/IP) + nghiêm ngặt cho auth (vd 10/phút/IP); store Redis ở prod.
- **Làm sạch input:** validator ép kiểu + loại field lạ; `express-mongo-sanitize` chặn tiêm `$`/`.`; `helmet`; CORS giới hạn origin.
- **Upload:** mime allowlist + giới hạn kích thước + tên file tạo tự động, ngoài web root.
- **Secrets** qua `.env` (git-ignore) + commit `.env.example`.

---

## 15. Jobs nền (node-cron / BullMQ)

| Job | Nhiệm vụ |
|---|---|
| `dueDateNotifier.job` | Hằng ngày: phát `TASK_DUE_SOON` (đến hạn 24h) và `TASK_OVERDUE` (đã quá hạn, chưa DONE) |
| `invitationSweeper.job` | Hết hạn các lời mời PENDING quá `expiresAt` → `EXPIRED` |
| `purge.job` | Xóa cứng dữ liệu đã xóa mềm sau khoảng ân hạn; thu hồi file đính kèm mồ côi |

> Quá hạn là **tính toán**, không lưu cờ — job chỉ để *phát thông báo*, không set trạng thái.

---

## 16. Cấu trúc thư mục Backend đề xuất

```
backend/
├── src/
│   ├── config/            env.js · db.js · logger.js
│   ├── common/
│   │   ├── errors/        ApiError.js · errorCodes.js
│   │   ├── middlewares/   requireAuth · requireWorkspaceRole · validate · rateLimiter · errorHandler
│   │   ├── utils/         asyncHandler · pagination · jwt
│   │   └── constants.js   roles, statuses, enums
│   ├── modules/
│   │   ├── auth/          routes · controller · service · validation
│   │   ├── users/         + model
│   │   ├── workspaces/    + workspace.model · workspaceMember.model · invitation.model
│   │   ├── projects/      + model
│   │   ├── tasks/         + model
│   │   ├── comments/      + model
│   │   ├── notifications/ notification.service.emit() dùng chung + model
│   │   ├── activities/    activity.service.log() dùng chung + model
│   │   └── dashboard/     service = aggregation pipelines
│   ├── jobs/              dueDateNotifier · invitationSweeper · purge
│   ├── app.js             express app + middleware
│   └── server.js          bootstrap, connect db, listen
├── tests/                 integration/ · unit/
├── .env.example
└── package.json
```

**Thư viện đề xuất:** Zod/Joi (validation) · jsonwebtoken + bcrypt · pino (+pino-http) · helmet · express-mongo-sanitize · express-rate-limit (+rate-limit-redis) · multer (+@aws-sdk/client-s3 prod) · dotenv · mongoose · cors · node-cron (hoặc BullMQ) · Jest + supertest + mongodb-memory-server · nodemon/eslint/prettier.

---

## 17. Thứ tự build đề xuất (Backend-first)

Làm theo thứ tự dưới đây để mỗi bước đều test được độc lập, và bước sau dựa trên bước trước:

1. **Hạ tầng chung:** `config/` (env validate + kết nối Mongo + logger), `common/` (ApiError, errorHandler, asyncHandler, validate, pagination, jwt util), bộ khung `app.js`/`server.js`. → Mục tiêu: server chạy, `/health` trả 200, errorHandler hoạt động.
2. **Auth + Users:** model `users`, register/login/refresh/logout/me/change-password, middleware `requireAuth`. → Test toàn bộ vòng đời token.
3. **Workspaces + Members + Invitations:** 3 model join, middleware `requireWorkspaceRole`, RBAC, transfer ownership, luồng mời/chấp nhận. → Đây là nền tảng phân quyền cho mọi thứ sau.
4. **Projects:** CRUD, key duy nhất/bất biến, archive, quyền MEMBER theo cờ workspace.
5. **Activities + Notifications (service trước):** dựng `activity.service.log()` và `notification.service.emit()` **trước** module Tasks, vì Tasks/Comments sẽ gọi chúng. Endpoint đọc activities/notifications làm sau cũng được.
6. **Tasks:** model + logic `taskCode`/`position`/chuyển trạng thái/giao việc, danh sách board+list, tài nguyên con (checklist/attachments/watch). Đấu activity + notification vào đây.
7. **Comments:** phân luồng 1 cấp, mention, đấu notification (`COMMENT_ADDED`/`COMMENT_REPLY`/`MENTIONED`).
8. **Dashboard:** aggregation pipelines (làm cuối vì cần dữ liệu task thật để verify).
9. **Jobs nền:** dueDateNotifier, invitationSweeper, purge.
10. **Cứng hóa:** rate limit, helmet, mongo-sanitize, CORS, viết integration test cho từng luồng nghiệp vụ ở Phần 1 → khi tất cả xanh thì backend "chạy mượt ổn định", sẵn sàng làm frontend.

> **Mẹo test theo từng bước:** sau mỗi module, viết integration test (supertest + mongodb-memory-server) cho happy path + các case lỗi chính (403/404/409/422). Đừng để dồn test tới cuối.

---

*Hết tài liệu. File này là hợp đồng API để frontend bám vào ở giai đoạn sau.*
