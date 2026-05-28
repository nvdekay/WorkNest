# Team Task Management System — Tài liệu Đặc tả Phần mềm

**Phiên bản tài liệu:** 1.0
**Trạng thái:** Sẵn sàng để triển khai (Implementation-ready)
**Tech stack:** Node.js · ExpressJS · MongoDB · Mongoose · JWT (backend) — ReactJS · React Router · Axios · TanStack Query · Zustand · TailwindCSS · shadcn/ui (frontend)
**Kiến trúc:** RESTful API · Phân quyền theo vai trò (Role-Based Access Control) · Modular monolith (khối nguyên khối phân mô-đun)

---

## Mục lục

1. Tóm tắt tổng quan (Executive Summary)
2. Vai trò người dùng & Quyền hạn
3. Các luồng nghiệp vụ cốt lõi
4. Các mô-đun hệ thống
5. Thiết kế cơ sở dữ liệu
6. Đặc tả REST API
7. Đặc tả Frontend
8. Đặc tả chi tiết Quản lý Task
9. Hệ thống thông báo (Notification)
10. Dashboard & Phân tích
11. Quy tắc kiểm tra dữ liệu (Validation)
12. Đặc tả xử lý lỗi
13. Cân nhắc về bảo mật
14. Đề xuất cấu trúc thư mục Backend
15. Đề xuất cấu trúc thư mục Frontend
16. Các thư viện bên thứ ba được đề xuất
17. Các tính năng nâng cấp trong tương lai

---

# 1. Tóm tắt tổng quan

## 1.1 Hệ thống làm gì

Team Task Management System là một nền tảng cộng tác đa người thuê (multi-tenant) cho phép các nhóm tổ chức công việc thành các **workspace** (không gian làm việc), chia workspace thành các **project** (dự án), và chia project thành các **task** (công việc) di chuyển trên một bảng trạng thái kiểu Kanban. Đây là một tập con tập trung của Trello/Jira/ClickUp: nó bao gồm việc lập kế hoạch, giao việc, theo dõi tiến độ, thảo luận và báo cáo — nhưng không có theo dõi thời gian (time-tracking), thanh toán (billing), hay các nghi thức sprint/agile.

Hệ thống được tổ chức theo một hệ thống phân cấp chứa đựng (containment hierarchy) nghiêm ngặt:

```
User
  └── là thành viên của → Workspace (ranh giới tenant)
                          └── chứa → Project
                                       └── chứa → Task
                                                    ├── Comments (bình luận)
                                                    ├── Checklist items (mục danh sách kiểm)
                                                    ├── Labels (nhãn)
                                                    └── Attachments (tệp đính kèm)
```

Mọi dữ liệu, ngoại trừ chính tài khoản `User`, đều được giới hạn (scoped) trong đúng một workspace. Workspace là **ranh giới tenant** và **ranh giới phân quyền**: một người dùng chỉ có thể nhìn thấy hoặc thao tác trên dữ liệu bên trong các workspace mà họ là thành viên.

## 1.2 Mục tiêu chính

| # | Mục tiêu | Kết quả đo lường được |
|---|-----------|--------------------|
| 1 | Tập trung công việc của nhóm vào một nơi | Mỗi task có một nguồn sự thật duy nhất: trạng thái, người được giao, hạn chót, thảo luận |
| 2 | Làm rõ trách nhiệm | Mỗi task có 0–1 người được giao; mọi thay đổi trạng thái đều quy được về một người dùng |
| 3 | Làm cho tiến độ trực quan | Bảng Kanban + dashboard hiển thị số lượng theo trạng thái, các mục quá hạn, khối lượng công việc — theo thời gian thực |
| 4 | Giữ lịch sử có thể kiểm toán | Mỗi thay đổi có ý nghĩa đều tạo ra một bản ghi hoạt động bất biến |
| 5 | Thực thi nguyên tắc đặc quyền tối thiểu | RBAC ở cấp workspace; không rò rỉ dữ liệu giữa các tenant |
| 6 | Sẵn sàng triển khai | Mọi thực thể, endpoint và màn hình trong tài liệu này ánh xạ 1:1 với code |

## 1.3 Người dùng mục tiêu

| Chân dung (Persona) | Vai trò thường nắm | Nhu cầu chính |
|---------|------------------------|---------------|
| Team Lead / Founder | OWNER | Tạo workspace, mời người, xem tiến độ tổng thể, quản lý các thiết lập tương đương billing |
| Project Manager | ADMIN | Tạo project, tổ chức bảng, giao task, quản lý thành viên |
| Contributor / Developer / Designer | MEMBER | Xem task được giao, cập nhật trạng thái, bình luận, đính kèm tệp |
| Stakeholder / Observer (người quan sát) | MEMBER (chủ yếu đọc) | Xem dashboard và bảng mà không thay đổi cấu trúc |

## 1.4 Ngoài phạm vi (phiên bản v1)

Theo dõi thời gian, sprint/epic, biểu đồ Gantt, task lặp lại, trạng thái workflow tùy chỉnh, billing/đăng ký, SSO, ứng dụng mobile native, liên kết chia sẻ công khai. Một vài trong số này xuất hiện ở Mục 17 như các tính năng nâng cấp tương lai.

---

# 2. Vai trò người dùng & Quyền hạn

Vai trò được gắn **theo từng workspace**, không phải toàn cục (global). Một người dùng có thể đồng thời là OWNER của workspace A và MEMBER của workspace B. Vai trò được lưu trên bản ghi join `workspace_members`, không bao giờ lưu trên document `users`.

## 2.1 Định nghĩa vai trò

| Vai trò | Mô tả | Cách có được |
|------|-------------|--------------|
| OWNER | Người tạo workspace và có quyền cao nhất. Mỗi workspace có đúng **một** OWNER. | Tự động gán cho người tạo workspace. Có thể chuyển giao. |
| ADMIN | Người quản lý được tin tưởng. Làm được mọi thứ OWNER làm, ngoại trừ: xóa workspace, quản lý các admin khác, hoặc chuyển giao quyền sở hữu. | Được OWNER thăng cấp. |
| MEMBER | Người đóng góp tiêu chuẩn. Thao tác trên project và task nhưng không thể quản lý con người hay thiết lập workspace. | Vai trò mặc định khi chấp nhận lời mời. |

## 2.2 Ma trận phân quyền

Chú giải: ✅ được phép · ⚠️ được phép kèm điều kiện · ❌ bị cấm

| Năng lực (Capability) | OWNER | ADMIN | MEMBER |
|-----------|:-----:|:-----:|:------:|
| **Workspace** | | | |
| Xem workspace | ✅ | ✅ | ✅ |
| Cập nhật tên/mô tả/avatar workspace | ✅ | ✅ | ❌ |
| Xóa workspace | ✅ | ❌ | ❌ |
| Chuyển giao quyền sở hữu | ✅ | ❌ | ❌ |
| **Thành viên (Members)** | | | |
| Xem danh sách thành viên | ✅ | ✅ | ✅ |
| Mời thành viên | ✅ | ✅ | ❌ |
| Hủy một lời mời đang chờ | ✅ | ✅ | ❌ |
| Xóa một MEMBER | ✅ | ✅ | ❌ |
| Xóa một ADMIN | ✅ | ❌ | ❌ |
| Thăng cấp MEMBER → ADMIN | ✅ | ❌ | ❌ |
| Giáng cấp ADMIN → MEMBER | ✅ | ❌ | ❌ |
| Rời khỏi workspace | ❌¹ | ✅ | ✅ |
| **Projects** | | | |
| Xem project | ✅ | ✅ | ✅ |
| Tạo project | ✅ | ✅ | ⚠️² |
| Cập nhật project | ✅ | ✅ | ⚠²/❌ |
| Lưu trữ (archive) project | ✅ | ✅ | ❌ |
| Xóa project | ✅ | ✅ | ❌ |
| **Tasks** | | | |
| Xem task | ✅ | ✅ | ✅ |
| Tạo task | ✅ | ✅ | ✅ |
| Cập nhật bất kỳ task nào | ✅ | ✅ | ⚠️³ |
| Đổi trạng thái bất kỳ task nào | ✅ | ✅ | ⚠️³ |
| Giao task cho bất kỳ ai | ✅ | ✅ | ⚠️³ |
| Xóa task | ✅ | ✅ | ⚠️⁴ |
| **Comments (Bình luận)** | | | |
| Thêm bình luận | ✅ | ✅ | ✅ |
| Sửa bình luận của mình | ✅ | ✅ | ✅ |
| Xóa bình luận của mình | ✅ | ✅ | ✅ |
| Xóa bình luận của người khác | ✅ | ✅ | ❌ |
| **Dashboard / Activity (Hoạt động)** | | | |
| Xem dashboard | ✅ | ✅ | ✅ |
| Xem nhật ký hoạt động | ✅ | ✅ | ✅ |

**Ghi chú / điều kiện**

1. OWNER không thể rời khỏi workspace. Họ phải chuyển giao quyền sở hữu cho một thành viên khác trước; workspace không bao giờ được phép không có chủ. Để thoát ra, họ chuyển giao rồi rời đi, hoặc xóa workspace.
2. **Quyền tạo project của MEMBER được điều khiển bởi một thiết lập workspace** `memberCanCreateProject` (boolean, mặc định `true`). Khi `false`, MEMBER không thể tạo project. MEMBER chỉ có thể cập nhật những project mà họ là `createdBy`, và không bao giờ được archive/xóa.
3. MEMBER chỉ có thể cập nhật, giao, hoặc đổi trạng thái của một task **nếu** họ là `createdBy` (người tạo) hoặc `assignee` (người được giao) hiện tại của task đó. Họ không thể sửa các task tùy ý do người khác tạo. ADMIN/OWNER bỏ qua hạn chế này.
4. MEMBER chỉ có thể xóa một task **nếu** họ là `createdBy` của nó. ADMIN/OWNER có thể xóa bất kỳ task nào.

## 2.3 Tóm tắt các giới hạn

- **Giới hạn của MEMBER:** không quản lý con người, không thiết lập workspace, chỉnh sửa task có giới hạn (chỉ task của mình/được giao), không archive/xóa project.
- **Giới hạn của ADMIN:** không thể xóa workspace, không thể chuyển giao quyền sở hữu, không thể thăng/giáng/xóa các ADMIN khác, không thể đụng đến OWNER.
- **Giới hạn của OWNER:** không thể rời đi mà chưa chuyển giao quyền sở hữu; không thể bị bất kỳ ai xóa.

## 2.4 Nguyên tắc thực thi phân quyền

Phân quyền được thực thi **ở phía server trên mỗi request**, không bao giờ tin tưởng từ client. Frontend chỉ dùng cùng ma trận này để **hiển thị/ẩn/vô hiệu hóa các thành phần UI** nhằm nâng cao chất lượng trải nghiệm. Hai tầng middleware chạy theo thứ tự:

1. `requireAuth` — kiểm tra JWT, tải `User`, gắn vào `req.user`.
2. `requireWorkspaceRole(minRole)` — phân giải bản ghi `workspace_members` cho `(req.user, :workspaceId)`, gắn vào `req.membership`, và từ chối nếu vai trò thấp hơn ngưỡng yêu cầu hoặc nếu không tồn tại membership (→ `403`/`404`, xem §12).

Các kiểm tra cấp tài nguyên (ghi chú 3 & 4 ở trên) chạy bên trong controller sau cổng kiểm tra vai trò.

---

# 3. Các luồng nghiệp vụ cốt lõi

Mỗi luồng dưới đây là một kịch bản theo từng bước, bao gồm luồng thành công (happy path), các tác dụng phụ (nhật ký hoạt động + thông báo) và các trường hợp đặc biệt quan trọng. Các luồng này là hợp đồng giữa backend và frontend.

## 3.1 Đăng ký & Đăng nhập người dùng

### 3.1.1 Đăng ký

1. Người dùng mở màn hình **Register**, gửi `name`, `email`, `password`.
2. Frontend kiểm tra dữ liệu cục bộ (xem §11) và gọi `POST /api/auth/register`.
3. Backend:
   a. Chuẩn hóa `email` về chữ thường + cắt khoảng trắng.
   b. Kiểm tra tính duy nhất — nếu đã tồn tại người dùng với email đó → `409 EMAIL_TAKEN`.
   c. Băm mật khẩu bằng bcrypt (cost 12).
   d. Tạo document `users` với `emailVerified: false`.
   e. Cấp một **access token** (JWT, 15 phút) và một **refresh token** (JWT, 7 ngày).
4. Phản hồi `201` kèm `{ user, accessToken, refreshToken }`.
5. Frontend lưu token (xem §13.1), thiết lập auth store, chuyển hướng tới `/workspaces`.

**Trường hợp đặc biệt:** email trùng → 409; mật khẩu yếu → 422; định dạng email sai → 422. Việc đăng ký **không** tự động tạo workspace — màn hình danh sách workspace hiển thị trạng thái rỗng kèm gợi ý tạo mới.

### 3.1.2 Đăng nhập

1. Người dùng gửi `email`, `password` trên màn hình **Login**.
2. `POST /api/auth/login`.
3. Backend tìm người dùng theo email đã chuẩn hóa; nếu không tìm thấy → `401 INVALID_CREDENTIALS` (thông báo chung chung, không bao giờ tiết lộ trường nào sai). So sánh mật khẩu qua `bcrypt.compare`; không khớp → cùng lỗi `401`.
4. Nếu thành công → cấp access + refresh token, phản hồi `200`.
5. Frontend lưu token, chuyển hướng tới route đã ghé trước đó hoặc `/workspaces`.

### 3.1.3 Làm mới token (Token refresh)

1. Bất kỳ lệnh gọi API nào trả về `401 TOKEN_EXPIRED` đều kích hoạt interceptor phản hồi của Axios.
2. Interceptor gọi `POST /api/auth/refresh` với refresh token, **một lần duy nhất**, và xếp hàng các request thất bại đồng thời.
3. Nếu thành công → access token mới, các request đã xếp hàng tự động chạy lại.
4. Nếu thất bại (refresh hết hạn/không hợp lệ) → xóa auth store, chuyển hướng tới `/login`.

## 3.2 Tạo Workspace

1. Từ danh sách workspace, người dùng bấm **New workspace**.
2. Modal thu thập `name` (bắt buộc) và `description` (tùy chọn).
3. `POST /api/workspaces`.
4. Backend, trong một giao dịch logic duy nhất:
   a. Tạo document `workspaces` với `ownerId = req.user._id`.
   b. Tạo một bản ghi `workspace_members` `{ workspaceId, userId, role: 'OWNER', status: 'ACTIVE' }`.
   c. Ghi một bản ghi `activities` loại `WORKSPACE_CREATED`.
5. Phản hồi `201` kèm workspace; người tạo đã là thành viên.
6. Frontend làm mất hiệu lực (invalidate) query `['workspaces']` và điều hướng tới workspace mới.

**Trường hợp đặc biệt:** tên rỗng → 422; giới hạn mềm theo người dùng (ví dụ 10 workspace sở hữu) → `403 WORKSPACE_LIMIT_REACHED`.

## 3.3 Luồng mời thành viên

### 3.3.1 Gửi lời mời

1. OWNER/ADMIN mở **Members** → **Invite**, nhập `email` và `role` đích (`ADMIN` hoặc `MEMBER`).
2. `POST /api/workspaces/:workspaceId/invitations`.
3. Backend kiểm tra:
   - Vai trò của người gọi ≥ ADMIN.
   - Email được mời **chưa phải thành viên ACTIVE** → nếu không thì `409 ALREADY_MEMBER`.
   - **Không có lời mời PENDING** cho email đó trong workspace này → nếu không thì `409 INVITATION_EXISTS`.
   - Một người không phải OWNER không thể mời với vai trò `ADMIN` chỉ khi nghiệp vụ chọn hạn chế — mặc định ADMIN *có thể* mời ADMIN; quy tắc "chỉ OWNER mới được mời ADMIN" là một quy tắc có thể cấu hình.
4. Tạo một document `invitations` `{ workspaceId, email, role, token (hex ngẫu nhiên 32-byte), status: 'PENDING', invitedBy, expiresAt: now + 7d }`.
5. Gửi một email chứa liên kết `/<frontend>/invitations/accept?token=...` (việc gửi email là bất đồng bộ; nếu thất bại thì lời mời vẫn tồn tại và có thể gửi lại).
6. Ghi hoạt động `MEMBER_INVITED`. Tạo một thông báo trong ứng dụng cho người được mời **nếu** email đó đã thuộc về một người dùng đã đăng ký.
7. Phản hồi `201` kèm lời mời (token bị lược bỏ khỏi các phản hồi danh sách, xem §13).

### 3.3.2 Chấp nhận lời mời

1. Người được mời mở liên kết. Frontend đọc `token` từ query string.
2. Nếu chưa đăng nhập → điều hướng tới login/register trước, giữ lại `token`.
3. `POST /api/invitations/accept` với `{ token }`.
4. Backend kiểm tra:
   - Lời mời tồn tại và `status === 'PENDING'` → nếu không thì `410 INVITATION_INVALID`.
   - `expiresAt > now` → nếu không thì đánh dấu `EXPIRED`, trả về `410 INVITATION_EXPIRED`.
   - **Email của người đang đăng nhập khớp** với email của lời mời → nếu không thì `403 INVITATION_EMAIL_MISMATCH`.
   - Người dùng chưa phải là thành viên → nếu không thì đánh dấu lời mời `ACCEPTED`, trả về `409 ALREADY_MEMBER` (thân thiện với idempotent).
5. Tạo `workspace_members` `{ role: invitation.role, status: 'ACTIVE' }`, đánh dấu lời mời `ACCEPTED`, ghi hoạt động `MEMBER_JOINED`, thông báo cho người mời.
6. Phản hồi `200`; frontend điều hướng vào workspace.

**Trường hợp đặc biệt:** token bị giả mạo → 410; lời mời bị hủy trong lúc đó → 410; người dùng chấp nhận bằng tài khoản khác → 403.

## 3.4 Tạo Project

1. Bên trong một workspace, người dùng bấm **New project**.
2. Modal: `name` (bắt buộc), `description`, `color`/`icon`, `key` (tùy chọn 2–6 ký tự viết hoa; tự suy ra từ tên nếu để trống — dùng làm tiền tố mã task).
3. `POST /api/workspaces/:workspaceId/projects`.
4. Backend kiểm tra quyền người gọi (§2.2 ghi chú 2), tính duy nhất của `key` trong workspace, rồi tạo document `projects` với các trạng thái mặc định `["TODO","IN_PROGRESS","IN_REVIEW","DONE"]` và `taskCounter: 0`.
5. Ghi hoạt động `PROJECT_CREATED`. Phản hồi `201`.
6. Frontend invalidate `['projects', workspaceId]`, điều hướng tới bảng của project mới.

## 3.5 Tạo Task

1. Trên bảng project, người dùng bấm **+ Add task** trên một cột trạng thái (trạng thái mặc định = cột đó) hoặc dùng nút **New task** toàn cục (trạng thái mặc định = `TODO`).
2. Tạo nhanh chỉ cần `title`. Form đầy đủ thêm `description`, `assigneeId`, `priority`, `dueDate`, `labelIds`.
3. `POST /api/workspaces/:wid/projects/:pid/tasks`.
4. Backend:
   a. Kiểm tra project thuộc workspace và chưa bị archive → nếu không thì `409 PROJECT_ARCHIVED`.
   b. Nếu có `assigneeId`, xác minh người đó là thành viên ACTIVE của workspace → nếu không thì `422 ASSIGNEE_NOT_MEMBER`.
   c. Tăng `project.taskCounter` một cách nguyên tử (atomic), tạo `taskCode = "<projectKey>-<counter>"` (ví dụ `MKT-42`).
   d. Tính `position` = (vị trí lớn nhất trong trạng thái đích) + 1024 (sắp xếp thưa, xem §8).
   e. Tạo document `tasks`.
   f. Ghi hoạt động `TASK_CREATED`; nếu được giao ngay khi tạo, ghi thêm `TASK_ASSIGNED` + thông báo cho người được giao.
5. Phản hồi `201`. Frontend chèn thẻ một cách lạc quan (optimistic), rồi đối chiếu lại.

## 3.6 Giao Task

1. Người dùng mở chi tiết task hoặc control assignee trên thẻ, chọn một thành viên (hoặc "Unassigned").
2. `PATCH /api/.../tasks/:taskId` với `{ assigneeId }` (hoặc `null`).
3. Backend kiểm tra quyền (§2.2 ghi chú 3), xác minh tư cách thành viên của assignee, cập nhật `assignee`.
4. Nếu assignee thay đổi: hoạt động `TASK_ASSIGNED` (hoặc `TASK_UNASSIGNED`); thông báo cho assignee mới `TASK_ASSIGNED`; **không** thông báo khi tự giao cho mình.
5. Phản hồi `200` kèm task đã cập nhật.

## 3.7 Quy trình trạng thái Task (Status Workflow)

Các trạng thái: `TODO → IN_PROGRESS → IN_REVIEW → DONE`. Quy tắc di chuyển (chi tiết đầy đủ ở §8.2):

1. Người dùng kéo một thẻ giữa các cột hoặc đổi trạng thái trong khung chi tiết.
2. `PATCH /api/.../tasks/:taskId` với `{ status, position }`.
3. Backend kiểm tra việc chuyển đổi có được phép không, trạng thái mới có tồn tại cho project không, tính lại `position`, và nếu task chuyển vào `DONE` thì đặt `completedAt = now` (xóa nó nếu task rời `DONE`).
4. Hoạt động `TASK_STATUS_CHANGED` kèm `from`/`to`. Thông báo cho assignee (nếu không phải người thực hiện) và bất kỳ ai đang theo dõi (watch) task.
5. Phản hồi `200`. Bảng sắp xếp lại.

**Trường hợp đặc biệt:** chuyển một task quá hạn sang `DONE` sẽ xóa cờ quá hạn của nó; các thao tác kéo đồng thời được giải quyết bằng cách "ghi sau thắng" (last-write-wins) trên `position` cộng với việc tải lại bảng.

## 3.8 Luồng bình luận (Comment)

1. Trên chi tiết task, người dùng gõ bình luận; `@mention` kích hoạt gợi ý tự động (autocomplete) các thành viên.
2. `POST /api/.../tasks/:taskId/comments` với `{ body, parentId? }` (`parentId` cho reply phân luồng một cấp).
3. Backend lưu bình luận, phân tích `@mentions` thành một mảng `mentions` chứa userId (được xác minh là thành viên workspace), ghi hoạt động `COMMENT_ADDED`.
4. Thông báo: `COMMENT_ADDED` tới assignee của task (nếu không phải người bình luận); `MENTIONED` tới mỗi người được nhắc đến; `COMMENT_REPLY` tới tác giả của bình luận gốc khi có `parentId`.
5. Phản hồi `201`. Frontend thêm vào một cách lạc quan.

## 3.9 Luồng thông báo (Notification)

1. Bất kỳ sự kiện kích hoạt nào (giao việc, nhắc đến, bình luận, đổi trạng thái, lời mời, v.v. — danh sách đầy đủ ở §9.2) đều gọi `NotificationService.emit()`.
2. Service tạo một document `notifications` **cho mỗi người nhận** với `read: false`.
3. **Khử trùng lặp & tự loại trừ:** người thực hiện không bao giờ nhận thông báo cho hành động của chính mình; các thông báo giống hệt nhau gửi cùng một người về cùng một thực thể trong một khoảng thời gian ngắn sẽ được gộp lại (coalesced).
4. Frontend poll (thăm dò) `GET /api/notifications?unread=true` (hoặc đăng ký qua WebSocket trong phiên bản tương lai) và hiển thị huy hiệu chưa đọc.
5. Mở trung tâm thông báo sẽ đánh dấu các mục là đã đọc — từng cái một hoặc qua **Mark all read**.

## 3.10 Luồng nhật ký hoạt động (Activity Log)

1. Mỗi thao tác thay đổi trạng thái, **sau khi** ghi vào database thành công, sẽ thêm một document `activities`. Việc ghi hoạt động không bao giờ được chặn hoặc làm thất bại thao tác chính — nó theo kiểu "bắn rồi quên" (fire-and-forget) kèm ghi log lỗi.
2. Một hoạt động ghi lại: `workspaceId`, `projectId`/`taskId` (tùy chọn), `actorId`, `type`, một đối tượng `metadata` có cấu trúc (ví dụ `{ from, to }` cho thay đổi trạng thái), và `createdAt`.
3. Các hoạt động là **bất biến (immutable)** — không bao giờ bị cập nhật hay xóa bởi logic ứng dụng (chỉ bởi TTL/chính sách lưu trữ nếu được cấu hình).
4. Chúng được hiển thị ở ba phạm vi: feed toàn workspace, feed theo project, và dòng thời gian lịch sử theo từng task.
---

# 4. Các mô-đun hệ thống

Backend là một modular monolith (khối nguyên khối phân mô-đun). Mỗi mô-đun sở hữu routes, controller, service, model(s) và validators riêng. Các mô-đun giao tiếp qua các lệnh gọi service, không bao giờ thò tay trực tiếp vào model của mô-đun khác.

## 4.1 Mô-đun Xác thực (Authentication)

**Mục đích:** Tạo tài khoản, xác minh thông tin đăng nhập, vòng đời JWT.

**Tính năng:** register, login, refresh token, logout, lấy người dùng hiện tại (`/me`), đổi mật khẩu.

**Quy tắc nghiệp vụ**
- Email là định danh đăng nhập duy nhất; lưu ở dạng chuẩn hóa (chữ thường, đã cắt khoảng trắng).
- Mật khẩu không bao giờ được lưu hay ghi log ở dạng văn bản thuần; bcrypt cost 12.
- TTL của access token là 15 phút; TTL của refresh token là 7 ngày. Refresh token được xoay vòng (rotate) sau mỗi lần refresh (cái cũ bị vô hiệu hóa).
- Logout làm vô hiệu hóa refresh token được gửi lên (blacklist hoặc xóa token đã lưu).

**Trường hợp đặc biệt**
- Đăng ký lại một email đã tồn tại → `409`.
- Đăng nhập khi đang có phiên khác hoạt động → được phép; hỗ trợ nhiều phiên.
- Refresh bằng token đã bị xoay vòng/blacklist → `401`, buộc đăng nhập lại.
- Lệch đồng hồ (clock skew): token được kiểm tra với một độ trễ nhỏ (ví dụ 10 giây).

**Validation:** xem §11.1.

**Quyền hạn:** mọi endpoint là công khai, ngoại trừ `/me`, `/logout`, `/change-password` (yêu cầu đăng nhập).

## 4.2 Mô-đun Quản lý Người dùng

**Mục đích:** Quản lý hồ sơ của chính người dùng đã xác thực. Hệ thống **không có quản trị người dùng toàn cục** — không có endpoint "liệt kê tất cả người dùng", theo thiết kế đa tenant.

**Tính năng:** xem hồ sơ của mình, cập nhật hồ sơ (`name`, `avatarUrl`), đổi mật khẩu, tìm kiếm người dùng *trong một workspace* (cho bộ chọn giao việc/nhắc đến).

**Quy tắc nghiệp vụ**
- Người dùng chỉ có thể đọc/cập nhật document `users` của chính mình.
- Bộ chọn thành viên truy vấn `workspace_members` join với `users`, không phải collection user toàn cục — điều này ngăn việc liệt kê toàn bộ người dùng của nền tảng.
- Email **không** chỉnh sửa được ở v1 (nó là mỏ neo định danh).

**Trường hợp đặc biệt**
- Upload avatar bị từ chối về kích thước/loại tệp → `422`.
- Xóa tài khoản (tương lai) phải gán lại hoặc làm rỗng các tài nguyên sở hữu.

**Quyền hạn:** chỉ chính mình.

## 4.3 Mô-đun Quản lý Workspace

**Mục đích:** CRUD workspace, thiết lập, chuyển giao quyền sở hữu, ranh giới tenant.

**Tính năng:** tạo, liệt kê (chỉ các workspace của người gọi), lấy chi tiết, cập nhật thiết lập, xóa, chuyển giao quyền sở hữu.

**Quy tắc nghiệp vụ**
- Người tạo tự động trở thành OWNER (§3.2).
- Luôn có đúng một OWNER tại mọi thời điểm.
- Xóa là **xóa mềm (soft delete)** (`deletedAt`) theo mặc định; một job dọn dẹp triệt để (hard purge) gỡ dữ liệu sau một khoảng ân hạn. Việc xóa lan tỏa về mặt logic xuống project, task, comment, invitation, notification, activity (tất cả trở nên không truy cập được).
- Chuyển giao quyền sở hữu: đích phải là thành viên ACTIVE; khi chuyển giao, OWNER cũ trở thành ADMIN, đích trở thành OWNER, một cách nguyên tử.
- `settings.memberCanCreateProject` điều khiển việc MEMBER tạo project.

**Trường hợp đặc biệt**
- Xóa một workspace có thành viên đang hoạt động → được phép; thành viên đơn giản mất quyền truy cập.
- Chuyển giao cho một MEMBER → thành viên đó được thăng thẳng lên OWNER.
- Thành viên cuối cùng/duy nhất là OWNER → không thể rời đi, chỉ có thể xóa.

**Quyền hạn:** xem §2.2.

## 4.4 Mô-đun Quản lý Project

**Mục đích:** Nhóm các task; định nghĩa các cột của bảng.

**Tính năng:** tạo, liệt kê (kèm phân trang/lọc/tìm kiếm/sắp xếp), lấy chi tiết, cập nhật, archive/unarchive, xóa, sắp xếp lại các trạng thái.

**Quy tắc nghiệp vụ**
- Một project thuộc đúng một workspace; nó không bao giờ được chuyển sang workspace khác.
- `key` là duy nhất trong một workspace (không phân biệt hoa thường), 2–6 ký tự chữ-số viết hoa; bất biến sau khi tạo (vì nó đã được nung vào các `taskCode` hiện có).
- Trạng thái mặc định khi tạo: `TODO, IN_PROGRESS, IN_REVIEW, DONE`. v1 cho phép sắp xếp lại và đổi tên nhãn nhưng **tập trạng thái là cố định** với bốn key chuẩn này (workflow tùy chỉnh là tính năng tương lai).
- Project đã archive là chỉ-đọc: không tạo/cập nhật task, không đổi trạng thái; chúng vẫn hiển thị trong danh sách đã lọc và trên dashboard.
- Xóa một project sẽ xóa mềm nó cùng tất cả task/comment của nó.

**Trường hợp đặc biệt**
- Tạo project với `key` trùng → `409 PROJECT_KEY_TAKEN`.
- Archive một project có task đang làm dở → được phép; các task đóng băng tại chỗ.
- Xóa một project mà người dùng khác đang xem → thao tác kế tiếp của họ trả về `404`/`409`, frontend chuyển hướng tới danh sách project.

**Validation:** xem §11.3.

**Quyền hạn:** xem §2.2.

## 4.5 Mô-đun Quản lý Task

**Mục đích:** Đơn vị công việc cốt lõi. Chi tiết đầy đủ ở §8.

**Tính năng:** tạo, liệt kê (chế độ xem bảng Kanban + dạng bảng table, kèm phân trang/lọc/tìm kiếm/sắp xếp), lấy chi tiết, cập nhật trường, đổi trạng thái, đổi vị trí (kéo-thả), giao việc, quản lý label, quản lý checklist, quản lý tệp đính kèm, xóa, theo dõi/bỏ theo dõi (watch/unwatch).

**Quy tắc nghiệp vụ** (tóm tắt — đầy đủ ở §8)
- Mỗi task có một `taskCode` bất biến, dễ đọc cho con người (`<projectKey>-<n>`).
- 0 hoặc 1 assignee; assignee phải là thành viên ACTIVE của workspace.
- `position` là số thực (float) để sắp xếp thưa trong một cột trạng thái.
- `completedAt` được đặt khi trạng thái chuyển thành `DONE`, ngược lại bị xóa.
- Một task *quá hạn (overdue)* khi `dueDate < now` và trạng thái ≠ `DONE` (được tính toán, không lưu trữ).

**Trường hợp đặc biệt**
- Giao một task rồi xóa thành viên đó khỏi workspace → `assignee` của task tự động bị làm rỗng bởi luồng xóa thành viên, ghi hoạt động `TASK_UNASSIGNED`.
- Di chuyển một thẻ trong cột có hàng nghìn task → job tái cân bằng vị trí chạy khi khe hở trở nên quá nhỏ (§8.6).
- Đặt `dueDate` trong quá khứ → được phép nhưng bị đánh dấu quá hạn ngay lập tức; frontend cảnh báo.

**Validation:** xem §11.4.

**Quyền hạn:** xem §2.2 ghi chú 3 & 4.

## 4.6 Mô-đun Hệ thống Bình luận

**Mục đích:** Thảo luận phân luồng trên task.

**Tính năng:** thêm bình luận, liệt kê bình luận (phân trang), sửa của mình, xóa (của mình, hoặc bất kỳ với ADMIN/OWNER), reply phân luồng một cấp, `@mention`.

**Quy tắc nghiệp vụ**
- Bình luận thuộc về một task; xóa task sẽ xóa mềm các bình luận của nó.
- Phân luồng **sâu một cấp**: một reply có `parentId` trỏ tới một bình luận gốc; một reply không thể được reply tiếp (reply của một reply sẽ gắn vào cùng bình luận gốc).
- Sửa bình luận sẽ đặt `editedAt`; lịch sử nội dung không được giữ ở v1.
- Xóa một bình luận gốc có replies → xóa mềm bình luận gốc, giữ các reply, hiển thị bình luận gốc là "comment deleted" (bình luận đã bị xóa).
- `mentions` chỉ phân giải thành các thành viên ACTIVE của workspace; các `@handle` không xác định được giữ làm văn bản thuần.

**Trường hợp đặc biệt**
- Sửa một bình luận để thêm một mention mới → phát ra `MENTIONED` chỉ cho các mention mới được thêm.
- Nhắc đến một người dùng đã bị xóa khỏi workspace → mention bị bỏ qua, không thông báo.
- Nội dung rỗng/chỉ có khoảng trắng → `422`.

**Validation:** xem §11.5.

**Quyền hạn:** xem §2.2.

## 4.7 Mô-đun Hệ thống Thông báo

**Mục đích:** Báo cho người dùng về các sự kiện liên quan đến họ. Chi tiết đầy đủ ở §9.

**Tính năng:** liệt kê thông báo (phân trang, lọc chưa đọc), số lượng chưa đọc, đánh dấu một cái đã đọc, đánh dấu tất cả đã đọc, xóa một thông báo.

**Quy tắc nghiệp vụ**
- Một document `notifications` cho mỗi người nhận trên mỗi sự kiện.
- Người thực hiện không bao giờ được thông báo về hành động của chính mình.
- Thông báo được giới hạn theo workspace; chuyển workspace sẽ lọc danh sách.
- Một thông báo lưu đủ dữ liệu phi chuẩn hóa (`title`, `entityType`, `entityId`, `workspaceId`) để render và deep-link mà không cần fetch thêm.

**Trường hợp đặc biệt**
- Thực thể được tham chiếu bị xóa sau khi thông báo được tạo → bấm vào nó hiển thị toast "mục này không còn tồn tại"; thông báo vẫn được đánh dấu đã đọc.
- Sự kiện hàng loạt (ví dụ import nhiều task) → gộp lại khi hợp lý để tránh "bão thông báo".

**Quyền hạn:** một người dùng chỉ đọc/thay đổi thông báo của chính mình.

## 4.8 Mô-đun Dashboard & Phân tích

**Mục đích:** Cái nhìn tổng hợp, chỉ-đọc. Chi tiết đầy đủ ở §10.

**Tính năng:** số liệu tổng quan workspace, số liệu tiến độ project, số liệu cá nhân "my work", dữ liệu biểu đồ (phân bố trạng thái, xu hướng hoàn thành, khối lượng công việc theo người được giao).

**Quy tắc nghiệp vụ**
- Mọi con số đều được tính qua các pipeline tổng hợp (aggregation) của MongoDB tại thời điểm request (không có bộ đếm tính sẵn ở v1, ngoại trừ `project.taskCounter` vốn là bộ đếm đánh số mã, không phải số liệu thống kê).
- Dashboard tôn trọng tính đa tenant và tư cách thành viên của người gọi.
- Bộ lọc khoảng ngày mặc định là 30 ngày gần nhất ở những nơi hiển thị xu hướng.

**Trường hợp đặc biệt**
- Một workspace không có project/task → mọi biểu đồ trả về tập dữ liệu rỗng đúng định dạng, không phải lỗi.
- Workspace rất lớn → các phép tổng hợp được giới hạn bởi index (§5) và có thể được cache trong TTL ngắn.

**Quyền hạn:** bất kỳ thành viên nào cũng có thể xem dashboard (chỉ-đọc).

## 4.9 Mô-đun Nhật ký Hoạt động (Activity Logs)

**Mục đích:** Vết kiểm toán bất biến. Luồng ở §3.10.

**Tính năng:** liệt kê hoạt động workspace, liệt kê hoạt động project, liệt kê hoạt động task (tất cả đều phân trang, lọc được theo `type`, `actorId`, khoảng ngày).

**Quy tắc nghiệp vụ**
- Chỉ thêm (append-only); không bao giờ bị cập nhật hay xóa bởi logic ứng dụng.
- Mỗi hoạt động tự mô tả qua `type` + `metadata`; frontend định dạng các chuỗi dễ đọc cho con người từ chúng.
- Lưu trữ TTL tùy chọn (ví dụ 365 ngày) có thể cấu hình lúc deploy.

**Trường hợp đặc biệt**
- Một hoạt động tham chiếu đến một thực thể nay đã bị xóa vẫn render được (nó lưu một `entityLabel` phi chuẩn hóa, ví dụ tiêu đề task tại thời điểm đó).
- Lưu lượng ghi cao → các hoạt động được ghi bất đồng bộ và đánh index để đọc theo thời gian giảm dần.

**Quyền hạn:** bất kỳ thành viên nào cũng có thể đọc hoạt động của workspace của họ.

---

# 5. Thiết kế cơ sở dữ liệu

MongoDB với Mongoose. Quy ước: mọi document đều có `createdAt`/`updatedAt` (Mongoose `timestamps: true`); các collection có thể xóa mềm sẽ có `deletedAt: Date | null` và một phạm vi truy vấn mặc định loại trừ các document đã xóa; mọi tham chiếu chéo là `ObjectId`; tiền/thời gian dùng `Date` theo UTC.

## 5.1 Collection: `users`

**Mục đích:** Định danh tài khoản toàn cục. Là collection duy nhất không bị giới hạn theo tenant.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK (khóa chính) |
| `name` | String | ✅ | 2–60 ký tự |
| `email` | String | ✅ | duy nhất, chữ thường, có index |
| `passwordHash` | String | ✅ | bcrypt; không bao giờ trả ra API |
| `avatarUrl` | String | ❌ | URL hoặc null |
| `emailVerified` | Boolean | ✅ | mặc định `false` |
| `lastLoginAt` | Date | ❌ | cập nhật khi đăng nhập |
| `createdAt` / `updatedAt` | Date | ✅ | timestamps |

**Quan hệ:** được tham chiếu bởi `workspace_members.userId`, `tasks.assignee`, `tasks.createdBy`, `comments.authorId`, `activities.actorId`, `notifications.userId`.

**Index:** `{ email: 1 }` unique.

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

## 5.2 Collection: `workspaces`

**Mục đích:** Ranh giới tenant; container cấp cao nhất.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `name` | String | ✅ | 2–80 ký tự |
| `description` | String | ❌ | ≤ 500 ký tự |
| `avatarUrl` | String | ❌ | |
| `ownerId` | ObjectId → users | ✅ | OWNER duy nhất |
| `settings.memberCanCreateProject` | Boolean | ✅ | mặc định `true` |
| `settings.timezone` | String | ❌ | múi giờ IANA, mặc định `UTC` |
| `deletedAt` | Date | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | Date | ✅ | |

**Quan hệ:** 1—N `projects`, 1—N `workspace_members`, 1—N `invitations`, 1—N `activities`.

**Index:** `{ ownerId: 1 }`, `{ deletedAt: 1 }`.

## 5.3 Collection: `workspace_members`

**Mục đích:** Bảng join giữa `users` và `workspaces`; lưu vai trò theo từng workspace. Đây là trái tim của RBAC.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `workspaceId` | ObjectId → workspaces | ✅ | |
| `userId` | ObjectId → users | ✅ | |
| `role` | String enum `OWNER\|ADMIN\|MEMBER` | ✅ | |
| `status` | String enum `ACTIVE\|REMOVED` | ✅ | mặc định `ACTIVE` |
| `joinedAt` | Date | ✅ | |
| `createdAt` / `updatedAt` | Date | ✅ | |

**Quan hệ:** N—1 `users`, N—1 `workspaces`.

**Index:** `{ workspaceId: 1, userId: 1 }` **compound unique** (một người dùng tham gia một workspace một lần); `{ userId: 1, status: 1 }` (liệt kê workspace của tôi); `{ workspaceId: 1, role: 1 }`.

**Ghi chú nghiệp vụ:** xóa một thành viên sẽ đặt `status: 'REMOVED'` thay vì xóa hàng, nhằm bảo toàn việc quy gán lịch sử.

## 5.4 Collection: `invitations`

**Mục đích:** Các lời mời workspace đang chờ.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `workspaceId` | ObjectId → workspaces | ✅ | |
| `email` | String | ✅ | email được mời, chữ thường |
| `role` | String enum `ADMIN\|MEMBER` | ✅ | vai trò được cấp khi chấp nhận |
| `token` | String | ✅ | hex ngẫu nhiên 32-byte, duy nhất, không bao giờ trả về trong phản hồi danh sách |
| `status` | String enum `PENDING\|ACCEPTED\|EXPIRED\|CANCELLED` | ✅ | mặc định `PENDING` |
| `invitedBy` | ObjectId → users | ✅ | |
| `expiresAt` | Date | ✅ | now + 7 ngày |
| `createdAt` / `updatedAt` | Date | ✅ | |

**Index:** `{ token: 1 }` unique; `{ workspaceId: 1, email: 1, status: 1 }` (chặn lời mời PENDING trùng lặp); `{ expiresAt: 1 }` (TTL hoặc job quét).

## 5.5 Collection: `projects`

**Mục đích:** Container chứa task; định nghĩa các cột của bảng.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `workspaceId` | ObjectId → workspaces | ✅ | phạm vi tenant |
| `name` | String | ✅ | 2–80 ký tự |
| `description` | String | ❌ | ≤ 1000 ký tự |
| `key` | String | ✅ | 2–6 ký tự chữ-số viết hoa, duy nhất theo workspace, bất biến |
| `color` | String | ❌ | mã hex, màu nhấn UI |
| `statuses` | Mảng `{ key, label, order }` | ✅ | mặc định 4 trạng thái chuẩn |
| `taskCounter` | Number | ✅ | mặc định 0; tăng đơn điệu cho `taskCode` |
| `createdBy` | ObjectId → users | ✅ | |
| `archivedAt` | Date | ❌ | đã archive = chỉ-đọc |
| `deletedAt` | Date | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | Date | ✅ | |

**Quan hệ:** N—1 `workspaces`, 1—N `tasks`.

**Index:** `{ workspaceId: 1, deletedAt: 1 }`; `{ workspaceId: 1, key: 1 }` unique; `{ workspaceId: 1, archivedAt: 1 }`.

## 5.6 Collection: `tasks`

**Mục đích:** Đơn vị công việc cốt lõi.

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `workspaceId` | ObjectId → workspaces | ✅ | phi chuẩn hóa để truy vấn theo tenant |
| `projectId` | ObjectId → projects | ✅ | |
| `taskCode` | String | ✅ | `<projectKey>-<n>`, duy nhất theo workspace, bất biến |
| `title` | String | ✅ | 1–200 ký tự |
| `description` | String | ❌ | ≤ 10 000 ký tự, markdown |
| `status` | String | ✅ | một trong các key trạng thái của project; mặc định `TODO` |
| `priority` | String enum `LOW\|MEDIUM\|HIGH\|URGENT` | ✅ | mặc định `MEDIUM` |
| `position` | Number (float) | ✅ | sắp xếp thưa trong một trạng thái |
| `assignee` | ObjectId → users | ❌ | null = chưa giao |
| `createdBy` | ObjectId → users | ✅ | |
| `dueDate` | Date | ❌ | null = không có hạn chót |
| `startDate` | Date | ❌ | tùy chọn |
| `completedAt` | Date | ❌ | đặt khi trạng thái → DONE |
| `labels` | Mảng `{ name, color }` | ❌ | nhúng (embedded); ≤ 10 |
| `checklist` | Mảng `{ _id, text, done, order }` | ❌ | nhúng; ≤ 50 mục |
| `attachments` | Mảng `{ _id, fileName, fileUrl, fileSize, mimeType, uploadedBy, uploadedAt }` | ❌ | metadata nhúng |
| `watchers` | Mảng ObjectId → users | ❌ | người dùng được thông báo mọi thay đổi |
| `commentCount` | Number | ✅ | phi chuẩn hóa, mặc định 0 |
| `deletedAt` | Date | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | Date | ✅ | |

**Quan hệ:** N—1 `projects`, N—1 `workspaces`, N—1 `users` (assignee/createdBy), 1—N `comments`.

**Index:**
- `{ projectId: 1, status: 1, position: 1 }` — render bảng, index quan trọng nhất.
- `{ workspaceId: 1, assignee: 1 }` — "task của tôi".
- `{ workspaceId: 1, dueDate: 1 }` — truy vấn quá hạn.
- `{ taskCode: 1 }` — tra cứu theo mã.
- Text index `{ title: 'text', description: 'text' }` — tìm kiếm.

## 5.7 Collection: `comments`

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `taskId` | ObjectId → tasks | ✅ | |
| `workspaceId` | ObjectId → workspaces | ✅ | phi chuẩn hóa |
| `authorId` | ObjectId → users | ✅ | |
| `body` | String | ✅ | 1–5000 ký tự |
| `parentId` | ObjectId → comments | ❌ | null = gốc; có giá trị = reply một cấp |
| `mentions` | Mảng ObjectId → users | ❌ | các thành viên được nhắc đến đã phân giải |
| `editedAt` | Date | ❌ | đặt khi sửa |
| `deletedAt` | Date | ❌ | xóa mềm |
| `createdAt` / `updatedAt` | Date | ✅ | |

**Index:** `{ taskId: 1, parentId: 1, createdAt: 1 }`; `{ workspaceId: 1, authorId: 1 }`.

## 5.8 Collection: `notifications`

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `userId` | ObjectId → users | ✅ | người nhận |
| `workspaceId` | ObjectId → workspaces | ✅ | phạm vi/lọc |
| `type` | String enum (§9.2) | ✅ | |
| `title` | String | ✅ | văn bản render phi chuẩn hóa |
| `body` | String | ❌ | văn bản phụ |
| `entityType` | String enum `TASK\|PROJECT\|WORKSPACE\|COMMENT\|INVITATION` | ✅ | loại đích deep-link |
| `entityId` | ObjectId | ✅ | id đích deep-link |
| `actorId` | ObjectId → users | ❌ | ai đã kích hoạt nó |
| `read` | Boolean | ✅ | mặc định `false` |
| `readAt` | Date | ❌ | |
| `createdAt` / `updatedAt` | Date | ✅ | |

**Index:** `{ userId: 1, read: 1, createdAt: -1 }` — liệt kê + huy hiệu chưa đọc; TTL tùy chọn trên `createdAt` để lưu trữ.

## 5.9 Collection: `activities`

| Trường | Kiểu | Bắt buộc | Ghi chú |
|-------|------|:--------:|-------|
| `_id` | ObjectId | ✅ | PK |
| `workspaceId` | ObjectId → workspaces | ✅ | |
| `projectId` | ObjectId → projects | ❌ | có mặt cho sự kiện project/task |
| `taskId` | ObjectId → tasks | ❌ | có mặt cho sự kiện task |
| `actorId` | ObjectId → users | ✅ | |
| `type` | String enum (§9.2 / §3.10) | ✅ | ví dụ `TASK_STATUS_CHANGED` |
| `entityLabel` | String | ❌ | tên phi chuẩn hóa tại thời điểm sự kiện (ví dụ tiêu đề task) |
| `metadata` | Mixed | ❌ | có cấu trúc, ví dụ `{ from:'TODO', to:'DONE' }` |
| `createdAt` | Date | ✅ | (không có `updatedAt` — bất biến) |

**Index:** `{ workspaceId: 1, createdAt: -1 }`; `{ projectId: 1, createdAt: -1 }`; `{ taskId: 1, createdAt: -1 }`.

## 5.10 Tóm tắt Quan hệ Thực thể (Entity-Relationship)

```
users 1───N workspace_members N───1 workspaces
users 1───N invitations(invitedBy)        workspaces 1───N invitations
workspaces 1───N projects 1───N tasks 1───N comments
tasks N───1 users (assignee, createdBy)
comments N───1 users (authorId);  comments 1───N comments (parentId, 1 cấp)
users 1───N notifications N───1 workspaces
workspaces 1───N activities  (───0..1 projects, ───0..1 tasks)
```

Hành vi lan tỏa (cascade) khi xóa mềm: xóa một workspace sẽ ẩn về mặt logic các project → task → comment của nó; xóa một project ẩn các task → comment của nó; xóa một task ẩn các comment của nó. Dọn dẹp triệt để (hard purge) là một job nền.
---

# 6. Đặc tả REST API

## 6.0 Quy ước

- **Base URL:** `/api`
- **Auth:** `Authorization: Bearer <accessToken>` trừ khi được đánh dấu *Public*.
- **Content type:** `application/json` (upload tệp dùng `multipart/form-data`).
- **ID:** mọi path param là chuỗi Mongo ObjectId; định dạng không hợp lệ → `400 INVALID_ID`.
- **Phạm vi workspace:** mọi route dưới `/workspaces/:workspaceId/...` chạy `requireAuth` → `requireWorkspaceRole` (kiểm tra tư cách thành viên). Người không phải thành viên nhận `404` (không tiết lộ sự tồn tại của workspace) — xem §12.
- **Vỏ bọc thành công (Success envelope):**
  ```json
  { "success": true, "data": { ... }, "meta": { ... } }
  ```
- **Vỏ bọc lỗi (Error envelope):** xem §12.1.
- **Meta phân trang** (các endpoint danh sách):
  ```json
  "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
  ```
- **Tham số truy vấn danh sách thường dùng:** `page` (mặc định 1), `limit` (mặc định 20, tối đa 100), `sort` (ví dụ `-createdAt`), `search`, cùng các bộ lọc riêng theo endpoint.

---

## 6.1 API Xác thực (Auth)

### `POST /api/auth/register` — *Public*

Tạo tài khoản.

**Body của request**
```json
{ "name": "Lan Pham", "email": "lan@acme.com", "password": "S3curePass!" }
```
**Validation:** name 2–60; email đúng định dạng; password 8–72 ký tự, ≥1 chữ cái & ≥1 chữ số.

**Thành công `201`**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "665...", "name": "Lan Pham", "email": "lan@acme.com", "avatarUrl": null },
    "accessToken": "eyJ...", "refreshToken": "eyJ..."
  }
}
```
**Lỗi:** `409 EMAIL_TAKEN`, `422 VALIDATION_ERROR`.

### `POST /api/auth/login` — *Public*

**Body của request** `{ "email": "...", "password": "..." }`
**Thành công `200`** — cùng dạng với register.
**Lỗi:** `401 INVALID_CREDENTIALS` (chung chung), `422 VALIDATION_ERROR`.
**Logic:** cập nhật `lastLoginAt`. Không bao giờ tiết lộ sai email hay sai password.

### `POST /api/auth/refresh` — *Public*

**Body của request** `{ "refreshToken": "eyJ..." }`
**Thành công `200`** `{ "data": { "accessToken": "...", "refreshToken": "..." } }` — refresh token được **xoay vòng (rotate)**.
**Lỗi:** `401 TOKEN_INVALID`, `401 TOKEN_EXPIRED`.

### `POST /api/auth/logout` — *Auth*

**Body của request** `{ "refreshToken": "eyJ..." }` — vô hiệu hóa refresh token đó.
**Thành công `200`** `{ "data": { "loggedOut": true } }`.

### `GET /api/auth/me` — *Auth*

Trả về người dùng hiện tại cùng một danh sách nhẹ các workspace & vai trò của họ.
**Thành công `200`**
```json
{ "data": { "user": {...}, "workspaces": [ { "_id":"...", "name":"Acme", "role":"OWNER" } ] } }
```

### `POST /api/auth/change-password` — *Auth*

**Body** `{ "currentPassword": "...", "newPassword": "..." }`
**Lỗi:** `401 INVALID_CREDENTIALS` (mật khẩu hiện tại sai), `422 VALIDATION_ERROR`.

---

## 6.2 API Người dùng (User)

### `GET /api/users/me` — *Auth*
Bí danh (alias) của object user trong `/auth/me`.

### `PATCH /api/users/me` — *Auth*
**Body** `{ "name"?: "...", "avatarUrl"?: "..." }` — email không sửa được.
**Thành công `200`** user đã cập nhật. **Lỗi:** `422`.

### `POST /api/users/me/avatar` — *Auth*
`multipart/form-data`, trường `file`. Chỉ ảnh, ≤ 2 MB.
**Thành công `200`** `{ "data": { "avatarUrl": "https://..." } }`. **Lỗi:** `422 INVALID_FILE`.

---

## 6.3 API Workspace

### `GET /api/workspaces` — *Auth*
Liệt kê các workspace mà người gọi là thành viên ACTIVE.
**Query:** `search`, `sort` (`name`,`-createdAt`), `page`, `limit`.
**Thành công `200`** mảng các `{ ...workspace, myRole, memberCount, projectCount }`.

### `POST /api/workspaces` — *Auth*
**Body** `{ "name": "...", "description"?: "..." }`
**Thành công `201`** workspace; người gọi là OWNER. **Lỗi:** `422`, `403 WORKSPACE_LIMIT_REACHED`.

### `GET /api/workspaces/:workspaceId` — *Auth, thành viên*
**Thành công `200`** chi tiết workspace + `myRole`. **Lỗi:** `404 WORKSPACE_NOT_FOUND` (cũng trả về cho người không phải thành viên).

### `PATCH /api/workspaces/:workspaceId` — *Auth, ADMIN+*
**Body** `{ "name"?, "description"?, "avatarUrl"?, "settings"? }`
**Lỗi:** `403 FORBIDDEN`, `422`.

### `DELETE /api/workspaces/:workspaceId` — *Auth, OWNER*
Xóa mềm workspace và lan tỏa.
**Thành công `200`** `{ "data": { "deleted": true } }`. **Lỗi:** `403 FORBIDDEN`.

### `POST /api/workspaces/:workspaceId/transfer-ownership` — *Auth, OWNER*
**Body** `{ "newOwnerId": "665..." }`
**Logic:** đích phải là thành viên ACTIVE; nguyên tử OWNER→ADMIN (cũ), MEMBER/ADMIN→OWNER (mới).
**Lỗi:** `422 USER_NOT_MEMBER`, `403 FORBIDDEN`.

---

## 6.4 API Thành viên (Member)

### `GET /api/workspaces/:workspaceId/members` — *Auth, thành viên*
**Query:** `search` (tên/email), `role`, `status`, `page`, `limit`, `sort`.
**Thành công `200`** mảng các `{ membershipId, user:{_id,name,email,avatarUrl}, role, status, joinedAt }`.

### `PATCH /api/workspaces/:workspaceId/members/:memberId/role` — *Auth, OWNER*
**Body** `{ "role": "ADMIN" | "MEMBER" }` — thăng/giáng cấp.
**Logic:** không thể đổi vai trò của chính mình; không thể nhắm vào OWNER; chỉ OWNER mới chạy được lệnh này.
**Lỗi:** `403 FORBIDDEN`, `409 CANNOT_MODIFY_OWNER`, `422`.

### `DELETE /api/workspaces/:workspaceId/members/:memberId` — *Auth, ADMIN+*
Xóa một thành viên (đặt `status: REMOVED`).
**Logic:** ADMIN chỉ có thể xóa MEMBER; OWNER có thể xóa ADMIN & MEMBER; không ai xóa được OWNER. Khi bị xóa, mọi task được giao cho người đó trong workspace sẽ bị bỏ giao (hoạt động `TASK_UNASSIGNED`).
**Lỗi:** `403 FORBIDDEN`, `409 CANNOT_REMOVE_OWNER`.

### `POST /api/workspaces/:workspaceId/members/leave` — *Auth, thành viên*
Người gọi rời khỏi workspace.
**Lỗi:** `409 OWNER_CANNOT_LEAVE` (phải chuyển giao quyền sở hữu trước).

---

## 6.5 API Lời mời (Invitation)

### `POST /api/workspaces/:workspaceId/invitations` — *Auth, ADMIN+*
**Body** `{ "email": "new@acme.com", "role": "MEMBER" }`
**Validation:** email hợp lệ; role ∈ {ADMIN, MEMBER}.
**Thành công `201`** lời mời (token bị lược bỏ).
**Lỗi:** `409 ALREADY_MEMBER`, `409 INVITATION_EXISTS`, `403 FORBIDDEN`, `422`.

### `GET /api/workspaces/:workspaceId/invitations` — *Auth, ADMIN+*
Liệt kê lời mời. **Query:** `status`, `page`, `limit`. Token không bao giờ được trả về.

### `DELETE /api/workspaces/:workspaceId/invitations/:invitationId` — *Auth, ADMIN+*
Hủy một lời mời PENDING → `status: CANCELLED`.
**Lỗi:** `409 INVITATION_NOT_PENDING`, `404`.

### `POST /api/invitations/accept` — *Auth*
**Body** `{ "token": "abcd..." }`
**Logic:** §3.3.2 — kiểm tra status, hạn dùng, khớp email.
**Thành công `200`** `{ "data": { "workspace": {...}, "role": "MEMBER" } }`.
**Lỗi:** `410 INVITATION_INVALID`, `410 INVITATION_EXPIRED`, `403 INVITATION_EMAIL_MISMATCH`, `409 ALREADY_MEMBER`.

### `GET /api/invitations/preview?token=...` — *Public*
Xem trước nhẹ cho màn hình chấp nhận (tên workspace, tên người mời, vai trò) mà không tiêu thụ (consume) lời mời.

---

## 6.6 API Project

### `GET /api/workspaces/:workspaceId/projects` — *Auth, thành viên*
**Query:** `search` (tên/key), `archived` (`true|false|all`, mặc định `false`), `sort` (`name`,`-createdAt`,`-updatedAt`), `page`, `limit`.
**Thành công `200`** mảng các `{ ...project, taskCount, doneCount, progress }` trong đó `progress` = `doneCount/taskCount` (bằng 0 khi rỗng).

### `POST /api/workspaces/:workspaceId/projects` — *Auth, ADMIN+ hoặc MEMBER nếu được phép*
**Body** `{ "name": "...", "description"?, "key"?, "color"? }`
**Logic:** §3.4; `key` tự suy ra nếu thiếu; thực thi tính duy nhất.
**Lỗi:** `409 PROJECT_KEY_TAKEN`, `403 FORBIDDEN`, `422`.

### `GET /api/workspaces/:workspaceId/projects/:projectId` — *Auth, thành viên*
**Thành công `200`** chi tiết project gồm `statuses[]`, `taskCounter`, các số đếm tổng hợp.

### `PATCH /api/workspaces/:workspaceId/projects/:projectId` — *Auth, ADMIN+ hoặc MEMBER là người tạo*
**Body** `{ "name"?, "description"?, "color"?, "statuses"? }` — `key` bất biến.
**Lỗi:** `403 FORBIDDEN`, `422`.

### `POST /api/workspaces/:workspaceId/projects/:projectId/archive` — *Auth, ADMIN+*
**Body** `{ "archived": true | false }` — bật/tắt `archivedAt`.

### `DELETE /api/workspaces/:workspaceId/projects/:projectId` — *Auth, ADMIN+*
Xóa mềm project + lan tỏa task/comment. **Lỗi:** `403 FORBIDDEN`.

---

## 6.7 API Task

### `GET /api/workspaces/:workspaceId/projects/:projectId/tasks` — *Auth, thành viên*
Endpoint danh sách chính, cung cấp dữ liệu cho cả chế độ Kanban và dạng bảng (table).

**Tham số truy vấn (Query params)**

| Tham số | Kiểu | Mục đích |
|-------|------|---------|
| `view` | `board\|list` | `board` trả về task được nhóm theo trạng thái (xem bên dưới); `list` trả về một mảng phẳng có phân trang |
| `status` | string (csv) | lọc, ví dụ `TODO,IN_PROGRESS` |
| `assignee` | ObjectId / `me` / `none` | lọc theo người được giao |
| `priority` | string (csv) | `HIGH,URGENT` |
| `label` | string (csv) | tên label |
| `dueFrom` / `dueTo` | ISO date | khoảng ngày hết hạn |
| `overdue` | `true` | chỉ các task quá hạn |
| `search` | string | tìm kiếm văn bản trên title/description |
| `sort` | string | `position` (mặc định cho list trong một status), `-createdAt`, `dueDate`, `-priority` |
| `page` / `limit` | number | chỉ dành cho `view=list` |

**Thành công `200` — `view=board`**
```json
{
  "data": {
    "columns": [
      { "status": "TODO", "label": "To Do", "tasks": [ {task}, {task} ], "total": 12 },
      { "status": "IN_PROGRESS", "label": "In Progress", "tasks": [...], "total": 5 }
    ]
  }
}
```
Mỗi cột trả về trang đầu tiên các task của nó (ví dụ 50) sắp xếp theo `position`; `total` cho phép UI hiển thị "+N more" và tải lười (lazy-load).

**Thành công `200` — `view=list`** mảng phẳng + `meta` phân trang.

### `POST /api/workspaces/:workspaceId/projects/:projectId/tasks` — *Auth, thành viên*
**Body**
```json
{
  "title": "Design login screen",
  "description": "## Goal\n...",
  "status": "TODO",
  "priority": "HIGH",
  "assigneeId": "665...",
  "dueDate": "2026-06-10T00:00:00.000Z",
  "labels": [ { "name": "design", "color": "#8b5cf6" } ]
}
```
**Validation:** §11.4. **Logic:** §3.5 — gán `taskCode`, `position`.
**Thành công `201`** task đã tạo.
**Lỗi:** `409 PROJECT_ARCHIVED`, `422 ASSIGNEE_NOT_MEMBER`, `422 VALIDATION_ERROR`, `403`.

### `GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId` — *Auth, thành viên*
**Thành công `200`** task đầy đủ gồm `checklist`, `labels`, `attachments` nhúng, `assignee`/`createdBy`/`watchers` đã populate, `commentCount`.

### `PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId` — *Auth, thành viên (có giới hạn)*
Cập nhật một phần — bất kỳ tập con nào của: `title`, `description`, `status`, `position`, `priority`, `assigneeId`, `dueDate`, `startDate`, `labels`.
**Quyền:** ADMIN/OWNER luôn được; MEMBER chỉ khi là `createdBy` hoặc `assignee` (§2.2 ghi chú 3).
**Logic:** đổi trạng thái → kiểm tra chuyển đổi (§8.2), đặt/xóa `completedAt`, phát hoạt động + thông báo; đổi assignee → kiểm tra tư cách thành viên, phát `TASK_ASSIGNED`.
**Lỗi:** `403 FORBIDDEN`, `409 INVALID_STATUS_TRANSITION`, `409 PROJECT_ARCHIVED`, `422`.

### `DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId` — *Auth, thành viên (có giới hạn)*
**Quyền:** ADMIN/OWNER bất kỳ; MEMBER chỉ task của mình (`createdBy`). Xóa mềm + lan tỏa comment.
**Lỗi:** `403 FORBIDDEN`.

### Tài nguyên con Checklist

- `POST .../tasks/:taskId/checklist` — body `{ "text": "..." }` → thêm mục.
- `PATCH .../tasks/:taskId/checklist/:itemId` — body `{ "text"?, "done"?, "order"? }`.
- `DELETE .../tasks/:taskId/checklist/:itemId`.
Tất cả đều có giới hạn quyền như cập nhật task; tối đa 50 mục → `422 CHECKLIST_LIMIT`.

### Tài nguyên con Attachment (tệp đính kèm)

- `POST .../tasks/:taskId/attachments` — `multipart/form-data`, trường `file`, ≤ 10 MB, danh sách mime cho phép → trả về metadata tệp đính kèm.
- `DELETE .../tasks/:taskId/attachments/:attachmentId` — người upload hoặc ADMIN+.

### Tài nguyên con Watch (theo dõi)

- `POST .../tasks/:taskId/watch` / `DELETE .../tasks/:taskId/watch` — người gọi thêm/bỏ chính mình khỏi `watchers`.

---

## 6.8 API Bình luận (Comment)

### `GET .../tasks/:taskId/comments` — *Auth, thành viên*
**Query:** `page`, `limit` (mặc định 20), `sort` (`createdAt` mặc định). Trả về các bình luận gốc kèm reply lồng bên trong, hoặc dạng phẳng kèm `parentId` (frontend tự nhóm).
**Thành công `200`** mảng bình luận, `author` đã populate.

### `POST .../tasks/:taskId/comments` — *Auth, thành viên*
**Body** `{ "body": "Looks good @[Lan](665...)", "parentId"?: "664..." }`
**Logic:** §3.8 — phân tích mention, tăng `task.commentCount`, phát hoạt động/thông báo.
**Thành công `201`** bình luận.
**Lỗi:** `422 VALIDATION_ERROR`, `409 PARENT_IS_REPLY` (không thể reply một reply), `404 TASK_NOT_FOUND`.

### `PATCH .../comments/:commentId` — *Auth, chỉ tác giả*
**Body** `{ "body": "..." }` → đặt `editedAt`, phân giải lại mention.
**Lỗi:** `403 FORBIDDEN`.

### `DELETE .../comments/:commentId` — *Auth, tác giả hoặc ADMIN+*
Xóa mềm; giảm `commentCount`. Nếu có reply, hiển thị là "deleted".

---

## 6.9 API Thông báo (Notification)

### `GET /api/notifications` — *Auth*
**Query:** `workspaceId` (lọc), `unread` (`true`), `type`, `page`, `limit`, `sort` (`-createdAt`).
**Thành công `200`** mảng + `meta`.

### `GET /api/notifications/unread-count` — *Auth*
**Query:** `workspaceId?`. **Thành công `200`** `{ "data": { "count": 7 } }`.

### `PATCH /api/notifications/:notificationId/read` — *Auth, chủ của thông báo*
Đánh dấu một cái đã đọc (`read:true`, `readAt:now`).

### `PATCH /api/notifications/read-all` — *Auth*
**Body** `{ "workspaceId"?: "..." }` — đánh dấu tất cả (tùy chọn theo phạm vi workspace) đã đọc.

### `DELETE /api/notifications/:notificationId` — *Auth, chủ sở hữu*
Xóa một thông báo.

---

## 6.10 API Dashboard

### `GET /api/workspaces/:workspaceId/dashboard` — *Auth, thành viên*
Tổng quan workspace.
**Query:** `from`, `to` (ISO; mặc định 30 ngày gần nhất).
**Thành công `200`**
```json
{
  "data": {
    "totals": { "projects": 8, "tasks": 214, "members": 12, "overdue": 9 },
    "tasksByStatus": { "TODO": 60, "IN_PROGRESS": 40, "IN_REVIEW": 14, "DONE": 100 },
    "tasksByPriority": { "LOW": 30, "MEDIUM": 120, "HIGH": 50, "URGENT": 14 },
    "completionTrend": [ { "date": "2026-05-01", "completed": 5 }, ... ],
    "workloadByAssignee": [ { "user": {...}, "open": 12, "overdue": 2 }, ... ]
  }
}
```

### `GET /api/workspaces/:workspaceId/projects/:projectId/dashboard` — *Auth, thành viên*
Cùng dạng, giới hạn trong một project, thêm `progress` (% hoàn thành) và `avgCompletionTimeHours`.

### `GET /api/workspaces/:workspaceId/dashboard/my-work` — *Auth, thành viên*
Giới hạn theo người gọi: `assignedOpen`, `assignedOverdue`, `dueSoon` (7 ngày tới), `createdByMe`, hoạt động gần đây liên quan tới người gọi.

---

## 6.11 API Hoạt động (Activity)

### `GET /api/workspaces/:workspaceId/activities` — *Auth, thành viên*
**Query:** `projectId?`, `taskId?`, `actorId?`, `type?`, `from?`, `to?`, `page`, `limit`, `sort` (`-createdAt`).
**Thành công `200`** mảng hoạt động với `actor` đã populate và `metadata` sẵn sàng để render.

---

## 6.12 Phân trang / Lọc / Tìm kiếm / Sắp xếp — hành vi toàn cục

| Mối quan tâm | Quy tắc |
|---------|------|
| **Phân trang** | Dựa trên offset (`page`/`limit`). `limit` giới hạn tối đa 100; `page` ngoài khoảng trả về mảng rỗng kèm `meta` đúng (không phải 404). |
| **Sắp xếp** | `sort` là danh sách phân tách bằng dấu phẩy; tiền tố `-` = giảm dần. Chỉ các trường nằm trong whitelist theo endpoint mới được áp dụng; trường lạ bị bỏ qua, không báo lỗi. |
| **Tìm kiếm** | `search` dùng Mongo text index trên `tasks` (title/description) và khớp tiền tố regex cho các trường ngắn như `name`/`key` của project. Tối thiểu 1 ký tự; đã cắt khoảng trắng. |
| **Lọc** | Bộ lọc nhiều giá trị chấp nhận CSV (`status=TODO,DONE`). Giá trị enum không hợp lệ → `422 VALIDATION_ERROR`. Các bộ lọc kết hợp bằng phép AND. |
| **Tính nhất quán** | Mọi phản hồi danh sách đều dùng chung vỏ bọc `data` + `meta` để tầng table/board của frontend là tổng quát (generic). |
---

# 7. Đặc tả Frontend

## 7.0 Quy ước

- **Định tuyến (Routing)** (React Router): `/login`, `/register`, `/invitations/accept`, `/workspaces`, `/w/:workspaceId`, `/w/:workspaceId/projects`, `/w/:workspaceId/projects/:projectId` (bảng), `/w/:workspaceId/projects/:projectId/tasks/:taskId` (chi tiết task, cũng mở được dưới dạng modal overlay), `/w/:workspaceId/dashboard`, `/notifications`, `/profile`, `/w/:workspaceId/settings`.
- **Tầng dữ liệu (Data layer):** TanStack Query cho mọi server state (query được khóa theo entity + params, mutation có optimistic update + rollback). Zustand chỉ giữ client state: token/user xác thực, id workspace đang chọn, tùy chọn UI (theme, độ dày bảng).
- **Mỗi màn hình bộc lộ bốn trạng thái UI chuẩn:** `loading` (skeleton), `empty` (hình minh họa + CTA chính), `error` (thông báo + Retry), `success` (nội dung).
- **Xử lý quyền hạn:** một hook `usePermissions()` suy ra các năng lực từ `myRole` của workspace đang chọn và bộc lộ các boolean (`canCreateProject`, `canManageMembers`, `canEditTask(task)`...). Các phần tử UI người dùng không dùng được thì **bị ẩn** với hành động cấu trúc và **bị vô hiệu hóa kèm tooltip** với hành động trong ngữ cảnh.
- **Responsive:** ưu tiên desktop; ≥1024px layout đầy đủ; 768–1024px sidebar có thể thu gọn; <768px bảng Kanban chuyển sang chế độ một cột, có tab theo trạng thái.

## 7.1 Màn hình Đăng nhập — `/login`

| Khía cạnh | Đặc tả |
|--------|------|
| Mục đích | Xác thực một người dùng đã tồn tại. |
| Thành phần | Thẻ căn giữa; `EmailInput`, `PasswordInput` (nút bật/tắt hiển thị), nút `Submit`, liên kết tới Register, liên kết quên-mật-khẩu (stub). |
| Tương tác | Submit khi bấm hoặc nhấn Enter; vô hiệu nút trong lúc chờ. |
| API | `POST /auth/login`. |
| Kiểm tra form | Định dạng email; password không rỗng. Lỗi từng trường hiển thị bên dưới input. |
| Loading | Spinner trên nút + input bị vô hiệu. |
| Error | `401` → cảnh báo cấp form "Email or password is incorrect"; `422` → lỗi từng trường; lỗi mạng → Retry. |
| Success | Lưu token vào Zustand + bộ lưu trữ an toàn, chuyển hướng tới route dự định hoặc `/workspaces`. |
| Quyền hạn | Public; nếu đã xác thực, chuyển hướng ra khỏi `/login`. |
| Responsive | Một cột; thẻ rộng toàn màn dưới 480px. |

## 7.2 Màn hình Đăng ký — `/register`

Khung tương tự Login. Các trường `name`, `email`, `password`, `confirmPassword`. Validation: name 2–60, định dạng email, thanh đo độ mạnh mật khẩu (8–72, chữ cái+số), confirm phải khớp. `409 EMAIL_TAKEN` → lỗi cấp trường ở email. Thành công → giống login, đáp xuống `/workspaces` (trạng thái rỗng nếu chưa có).

## 7.3 Màn hình Chấp nhận Lời mời — `/invitations/accept?token=...`

Mục đích: hoàn tất việc tham gia một workspace. Khi mount, gọi `GET /invitations/preview?token=` và hiển thị "{{inviter}} đã mời bạn vào **{{workspace}}** với vai trò {{role}}". Nếu chưa xác thực → CTA "Đăng nhập / Đăng ký để chấp nhận" giữ lại `token`. Nếu đã xác thực → nút **Accept** → `POST /invitations/accept`. Các trạng thái: `410` → "Lời mời này không còn hợp lệ"; `403` không khớp → "Lời mời này được gửi tới một email khác"; `409` đã là thành viên → thông tin + "Đi tới workspace". Thành công → chuyển hướng vào workspace.

## 7.4 Danh sách Workspace — `/workspaces`

| Khía cạnh | Đặc tả |
|--------|------|
| Mục đích | Chọn hoặc tạo một workspace. |
| Thành phần | Thanh trên cùng (menu người dùng, chuông thông báo), lưới các `WorkspaceCard` (tên, avatar, huy hiệu vai trò, số đếm thành viên/project), nút `New workspace` → `CreateWorkspaceModal`. |
| API | `GET /workspaces`; `POST /workspaces`. |
| Loading | Lưới thẻ skeleton. |
| Empty | Hình minh họa + "Bạn chưa ở trong workspace nào" + nút **Create workspace** nổi bật. |
| Error | Khối lỗi inline + Retry. |
| Success | Lưới thẻ; bấm một thẻ → `/w/:id`. |
| Quyền hạn | Bất kỳ người dùng đã xác thực nào. |

## 7.5 Chi tiết Workspace / Khung (Shell) — `/w/:workspaceId`

Là một khung layout, không phải một trang đơn lẻ: **sidebar trái** cố định (bộ chuyển workspace, điều hướng: Dashboard, Projects, Members, Activity, Settings) và một outlet nội dung. Khi mount fetch chi tiết workspace (`myRole` điều khiển `usePermissions`). Nếu `404` → "Không tìm thấy workspace hoặc bạn không còn quyền truy cập" → chuyển hướng `/workspaces`. Các mục điều hướng Members/Settings bị ẩn với MEMBER ở những chỗ phù hợp.

## 7.6 Danh sách Project — `/w/:workspaceId/projects`

| Khía cạnh | Đặc tả |
|--------|------|
| Mục đích | Duyệt/quản lý project. |
| Thành phần | Thanh công cụ: `SearchInput`, bộ lọc `archived` (`Active/Archived/All`), dropdown `sort`, nút `New project` (ẩn nếu `!canCreateProject`). Lưới/danh sách các `ProjectCard` (tên, huy hiệu key, màu, thanh tiến độ `doneCount/taskCount`, số đếm task). |
| API | `GET .../projects` kèm query params; `POST .../projects`. |
| Loading | Thẻ skeleton. |
| Empty | "Chưa có project nào" + **New project** (hoặc, với MEMBER bị hạn chế, "Hãy nhờ một admin tạo project"). |
| Error | Khối + Retry. |
| Success | Các thẻ; bấm → bảng. Thẻ đã archive bị làm mờ kèm huy hiệu "Archived". |
| Quyền hạn | Xem: tất cả. Tạo: theo `canCreateProject`. Menu ngữ cảnh của thẻ (archive/xóa) chỉ cho ADMIN+. |

## 7.7 Chi tiết Project / Bảng Task (Kanban) — `/w/:workspaceId/projects/:projectId`

Màn hình phức tạp nhất.

| Khía cạnh | Đặc tả |
|--------|------|
| Mục đích | Trực quan hóa và quản lý task trên các trạng thái. |
| Thành phần | Header (tên project, key, nút chuyển chế độ Board/List, liên kết dashboard). Thanh lọc: assignee, priority, label, ngày hết hạn, bật/tắt overdue, search. **Board**: một `Column` cho mỗi trạng thái; mỗi cột có header (nhãn + số đếm), danh sách `TaskCard` cuộn được, và một bộ soạn nội tuyến `+ Add task`. `TaskCard` hiển thị `taskCode`, tiêu đề, avatar assignee, viên thuốc (pill) priority, chip ngày hết hạn (đỏ nếu quá hạn), chấm label, tiến độ checklist (`3/5`), số đếm bình luận. |
| Tương tác | Kéo một thẻ trong/giữa các cột (dnd-kit); thêm nhanh nội tuyến; bấm thẻ → modal chi tiết task; bộ lọc cập nhật query. |
| API | `GET .../tasks?view=board&<filters>`; kéo → `PATCH .../tasks/:id { status, position }` (optimistic); thêm nhanh → `POST .../tasks`. |
| Logic kéo | Khi thả, tính `position` là điểm giữa của các thẻ lân cận; di chuyển thẻ một cách lạc quan; nếu lỗi thì rollback + toast + refetch bảng. |
| Loading | Cột skeleton kèm thẻ giữ chỗ. |
| Empty | Cả bảng rỗng → "Chưa có task nào, hãy thêm task đầu tiên". Một cột rỗng đơn lẻ → khung gạch nét đứt "Thả task vào đây / + Add task". |
| Error | Lỗi cấp bảng + Retry; lỗi từng mutation → toast, không chiếm toàn màn hình. |
| Quyền hạn | Kéo/sửa/xóa bị kiểm soát bởi `canEditTask(task)`; với MEMBER, các thẻ họ không sửa được vẫn bị chặn kéo kèm tooltip "Bạn chỉ có thể di chuyển task được giao cho bạn hoặc do bạn tạo". Nếu project có `archivedAt` → banner bảng chỉ-đọc, mọi thành phần thao tác bị vô hiệu. |
| Responsive | <768px → tab trạng thái, mỗi lần hiện một cột; kéo được thay bằng một `Select` trạng thái trên thẻ. |

## 7.8 Chi tiết Task — modal trên bảng hoặc trang đầy đủ `/.../tasks/:taskId`

| Khía cạnh | Đặc tả |
|--------|------|
| Mục đích | Xem/sửa mọi thứ về một task + thảo luận về nó. |
| Thành phần | Tiêu đề (sửa nội tuyến), `Select` trạng thái, `Select` priority, bộ chọn assignee, bộ chọn ngày hết hạn/bắt đầu, mô tả (trình soạn/xem markdown), `LabelEditor`, `Checklist` (thêm/đánh dấu/sắp xếp lại/xóa, thanh tiến độ), `Attachments` (upload/xem trước/xóa), `Watchers`, thanh phải = **Dòng thời gian Hoạt động** cho task này, dưới cùng = **Comments** (bộ soạn có autocomplete `@mention`, reply phân luồng một cấp). |
| API | `GET .../tasks/:id`; sửa trường → `PATCH`; các endpoint tài nguyên con checklist/attachment; `GET/POST .../comments`; `GET .../activities?taskId=`. |
| Tương tác | Mỗi trường tự lưu khi blur/đổi qua mutation riêng (optimistic update chi tiết từng phần). Đổi trạng thái được kiểm tra phía client dựa trên các chuyển đổi được phép, với server là nguồn sự thật. |
| Loading | Skeleton của layout; bình luận tải độc lập với spinner riêng. |
| Empty | Không có bình luận → "Chưa có bình luận nào, hãy bắt đầu thảo luận". Không có checklist/attachment → gợi ý thêm nhẹ nhàng. |
| Error | Lưu trường thất bại → hoàn lại trường đó + toast inline. `404` (task đã xóa) → "Task này không còn tồn tại" → đóng modal / chuyển hướng tới bảng. `409 INVALID_STATUS_TRANSITION` → hoàn lại trạng thái + giải thích. |
| Quyền hạn | Các control chỉnh sửa bị vô hiệu (kèm tooltip) khi `!canEditTask(task)`; nút xóa chỉ hiện khi được phép; bộ soạn bình luận có sẵn cho mọi thành viên; sửa/xóa trên một bình luận theo quy tắc tác giả/ADMIN. |

## 7.9 Màn hình Thành viên — `/w/:workspaceId/members`

Bảng các thành viên (avatar, tên, email, huy hiệu vai trò, ngày tham gia, trạng thái) + tab/mục cho **Pending invitations** (lời mời đang chờ). ADMIN+ thấy nút `Invite` → `InviteModal` (email + vai trò). Hành động trên hàng (theo RBAC): thăng/giáng cấp (chỉ OWNER), xóa (ADMIN+ trong giới hạn), hủy lời mời. Trạng thái: hàng skeleton khi loading; lời mời rỗng → "Không có lời mời đang chờ"; lỗi → toast. MEMBER thấy danh sách chỉ-đọc (không có cột hành động, không có nút Invite).

## 7.10 Màn hình / Panel Thông báo — `/notifications` + dropdown chuông

Chuông trên thanh trên cùng hiển thị số lượng chưa đọc (`GET /notifications/unread-count`, poll mỗi ~30 giây). Dropdown hiển thị ~10 mục mới nhất; trang đầy đủ hiển thị danh sách phân trang kèm bộ lọc (`All / Unread`, theo loại). Mỗi mục: icon theo loại, văn bản, thời gian tương đối, kiểu hiển thị đã đọc/chưa đọc; bấm → đánh dấu đã đọc + deep-link tới thực thể (`entityType`+`entityId`). Hành động: **Mark all read**, xóa một cái. Empty → "Bạn đã xem hết". Bấm vào thực thể đã xóa → toast "Mục này không còn tồn tại", vẫn đánh dấu đã đọc.

## 7.11 Dashboard — `/w/:workspaceId/dashboard`

Các thẻ KPI (Projects, Tasks, Overdue, Members), một biểu đồ donut **phân bố trạng thái**, một biểu đồ đường **xu hướng hoàn thành** (bộ lọc khoảng ngày, mặc định 30 ngày), một biểu đồ cột **khối lượng theo người được giao**, và một panel "My work". Biểu đồ qua Recharts. Loading → skeleton thẻ + biểu đồ. Workspace rỗng → trạng thái-không thân thiện kèm CTA "Create a project", biểu đồ render trục rỗng thay vì báo lỗi. Lỗi → retry theo từng widget để một phép tổng hợp lỗi không làm hỏng cả trang.

## 7.12 Hồ sơ Người dùng — `/profile`

Sửa `name`, upload avatar, form đổi mật khẩu. Upload avatar hiển thị tiến trình, kiểm tra loại/kích thước phía client trước khi `POST /users/me/avatar`. Lưu → optimistic update auth store. Đổi mật khẩu → khi `401` thì hiện inline "Mật khẩu hiện tại không đúng".

## 7.13 Thiết lập Workspace — `/w/:workspaceId/settings`

Chỉ ADMIN+ (MEMBER truy cập → chuyển hướng tới dashboard kèm toast). Các mục: chung (tên/mô tả/avatar), công tắc quyền thành viên (`memberCanCreateProject`), múi giờ. Chỉ OWNER: **Transfer ownership** (bộ chọn thành viên + hộp thoại xác nhận gõ tên workspace) và **Delete workspace** (vùng nguy hiểm, xác nhận bằng cách gõ tên). Mỗi mục lưu độc lập; các hành động phá hủy dùng modal xác nhận-bằng-cách-gõ.

---

# 8. Quản lý Task — Đặc tả chi tiết

## 8.1 Vòng đời Task

```
[created] ──▶ TODO ──▶ IN_PROGRESS ──▶ IN_REVIEW ──▶ DONE
                ▲           │              │           │
                └───────────┴──────────────┴───────────┘   (cho phép di chuyển lùi)
```

Một task ra đời trong một trạng thái (mặc định `TODO`, hoặc cột nó được tạo ra). Nó di chuyển tiến hoặc lùi qua bốn trạng thái chuẩn cho đến khi đạt `DONE`. `DONE` mang tính kết thúc ở chỗ nó đặt `completedAt`, nhưng một task có thể được mở lại (di chuyển ra khỏi `DONE`), việc này xóa `completedAt`. Việc xóa là xóa mềm và độc lập (orthogonal) với trạng thái.

## 8.2 Các trạng thái Task & quy tắc chuyển đổi

| Key trạng thái | Nhãn | Ý nghĩa | `completedAt` |
|------------|-------|---------|---------------|
| `TODO` | To Do | Tồn đọng / chưa bắt đầu | null |
| `IN_PROGRESS` | In Progress | Đang được làm | null |
| `IN_REVIEW` | In Review | Chờ review/QA | null |
| `DONE` | Done | Đã hoàn thành | được đặt |

**Chính sách chuyển đổi (v1): cho phép bất kỳ-sang-bất kỳ (any-to-any).** Bảng là tự do — một thẻ có thể nhảy từ `TODO` thẳng sang `DONE` hoặc ngược lại. Server vẫn:
- Từ chối một giá trị trạng thái không nằm trong tập `statuses` của project → `409 INVALID_STATUS_TRANSITION`.
- Từ chối thay đổi trạng thái trên một project đã archive → `409 PROJECT_ARCHIVED`.
- Đặt `completedAt = now` khi vào `DONE`; xóa nó khi di chuyển ra khỏi `DONE`.

(Một chế độ chuyển đổi tuyến tính nghiêm ngặt hơn là tính năng tương lai đã được ghi nhận; hook kiểm tra đã được tập trung hóa nên bật nó lên chỉ là thay đổi một chỗ.)

## 8.3 Hệ thống độ ưu tiên (Priority)

| Priority | Hạng | UI |
|----------|-----:|----|
| `LOW` | 1 | viên thuốc xám |
| `MEDIUM` | 2 | viên thuốc xanh dương (mặc định) |
| `HIGH` | 3 | viên thuốc cam |
| `URGENT` | 4 | viên thuốc đỏ |

Priority mang tính thông tin — nó điều khiển việc sắp xếp (`sort=-priority` xếp URGENT lên đầu) và phân tích dashboard; nó không hạn chế việc chuyển đổi.

## 8.4 Logic ngày hết hạn & quá hạn (Due date & overdue)

- `dueDate` là tùy chọn. `startDate` là tùy chọn và, nếu cả hai được đặt, phải thỏa `startDate ≤ dueDate` → nếu không thì `422`.
- **Quá hạn được tính toán, không bao giờ lưu trữ:** `isOverdue = dueDate != null && dueDate < now && status !== 'DONE'`. Điều này giữ nó luôn đúng mà không cần cron job; một job hằng ngày tồn tại chỉ để *phát thông báo quá hạn*, không phải để đặt một cờ.
- Đặt `dueDate` trong quá khứ là được phép (import công việc cũ) — thẻ ngay lập tức render là quá hạn; form tạo/sửa hiển thị một cảnh báo không chặn (non-blocking).
- Hoàn thành một task (`→ DONE`) làm cho `isOverdue` thành false một cách tự động ngay cả khi `dueDate` đã ở quá khứ.
- **Sắp đến hạn (Due-soon)** = `dueDate` trong vòng 7 ngày tới và chưa hoàn thành — dùng bởi "My work" và thông báo.

## 8.5 Quy tắc giao việc (Assignment)

- Một task có 0 hoặc 1 `assignee`. Đa người được giao nằm ngoài phạm vi.
- Assignee phải là một **thành viên ACTIVE** của workspace của task tại thời điểm giao → nếu không thì `422 ASSIGNEE_NOT_MEMBER`.
- Giao lại phát `TASK_ASSIGNED` tới assignee mới (và một bản ghi hoạt động); bỏ giao phát hoạt động `TASK_UNASSIGNED`, không thông báo.
- Tự giao cho mình tạo ra một hoạt động nhưng **không thông báo** (không tự-thông-báo).
- Khi một thành viên bị xóa khỏi workspace, một bước hậu-xóa sẽ làm rỗng `assignee` trên mọi task của họ trong workspace đó và ghi các hoạt động `TASK_UNASSIGNED`.
- MEMBER chỉ có thể giao lại một task nếu họ hiện đang thỏa quy tắc chỉnh-sửa-có-giới-hạn (người tạo hoặc assignee hiện tại).

## 8.6 Sắp xếp & trường `position`

- `position` là một số thực (float) cho mỗi task một khe có thể sắp xếp trong cột `(projectId, status)` của nó.
- Task mới trong một cột → `position = (vị trí lớn nhất trong cột) + 1024`.
- Thả giữa hai thẻ A và B → `position = (A.position + B.position) / 2`. Thả lên trên cùng → `firstPosition / 2`; thả xuống dưới cùng → `lastPosition + 1024`.
- **Tái cân bằng (Rebalancing):** nếu khe hở giữa các thẻ lân cận giảm xuống dưới một ngưỡng (ví dụ `< 0.0001`), một thủ tục chuẩn hóa sẽ gán lại các vị trí cách đều bằng số nguyên (`1024, 2048, 3072, ...`) cho cột đó trong một lần ghi hàng loạt.
- Kéo đồng thời: ghi sau thắng (last write wins) trên `position`; frontend refetch bảng sau khi mutation kéo hoàn tất để đối chiếu.

## 8.7 Labels / tags (Nhãn)

- Labels được **nhúng (embedded)** trên task dưới dạng các object `{ name, color }`, tối đa 10 mỗi task.
- v1 không có registry label riêng — label là tự do theo từng task; bộ lọc label tổng hợp các tên label khác biệt trên toàn project cho dropdown lọc.
- Tên label 1–20 ký tự; màu là chuỗi hex. (Một danh mục label cấp workspace là tính năng tương lai.)

## 8.8 Attachments (Tệp đính kèm)

- Lưu dưới dạng metadata nhúng `{ fileName, fileUrl, fileSize, mimeType, uploadedBy, uploadedAt }`; phần nhị phân nằm trong object storage (đĩa cục bộ ở dev, S3-compatible ở prod).
- Giới hạn: ≤ 10 MB/tệp, danh sách mime cho phép (ảnh, PDF, doc/archive thông dụng), ≤ 20 tệp đính kèm/task.
- Upload là một endpoint multipart riêng; `PATCH` task không bao giờ mang theo nhị phân.
- Xóa một task không xóa blob một cách đồng bộ — một job dọn dẹp thu hồi các tệp mồ côi.

## 8.9 Hỗ trợ Checklist

- Mảng nhúng `{ _id, text, done, order }`, tối đa 50 mục.
- Tiến độ = `số mục done / tổng` — hiển thị trên thẻ và chi tiết.
- Hoàn thành checklist **độc lập** với trạng thái task (một checklist được tích đầy đủ không tự động chuyển task sang `DONE`; điều này là cố ý và có thể trở thành một quy tắc tùy chọn sau này).
- Các mục có thể sắp xếp lại qua `order`; cùng cách tiếp cận thưa như `position` nhưng số nguyên là đủ ở quy mô này.

## 8.10 Phân luồng bình luận & nhắc đến (mentions)

- Chỉ hai cấp: bình luận gốc và reply (`parentId` → một bình luận gốc). Một reply của một reply gắn vào cùng bình luận gốc.
- `@mention`: bộ soạn cung cấp autocomplete các thành viên workspace; một mention được chọn sẽ được lưu trong body ở dạng có thể phân tích và được phân giải phía server thành `mentions: [userId]` (chỉ thành viên ACTIVE; những người khác bị bỏ).
- Sửa một bình luận sẽ phân giải lại mention; chỉ các mention **mới được thêm** mới kích hoạt thông báo `MENTIONED`.
- Xóa một bình luận gốc có reply sẽ giữ luồng, bình luận gốc render là "comment deleted".

## 8.11 Theo dõi hoạt động trên task

Mỗi mutation của task thêm một bản ghi `activities` được dòng thời gian của task tiêu thụ:

| Sự kiện | `type` | `metadata` |
|-------|--------|-----------|
| Tạo | `TASK_CREATED` | `{ title }` |
| Đổi trạng thái | `TASK_STATUS_CHANGED` | `{ from, to }` |
| Được giao | `TASK_ASSIGNED` | `{ assigneeId }` |
| Bỏ giao | `TASK_UNASSIGNED` | `{ previousAssigneeId }` |
| Đổi độ ưu tiên | `TASK_PRIORITY_CHANGED` | `{ from, to }` |
| Đổi ngày hết hạn | `TASK_DUE_CHANGED` | `{ from, to }` |
| Đổi tên | `TASK_RENAMED` | `{ from, to }` |
| Thêm bình luận | `COMMENT_ADDED` | `{ commentId }` |
| Thêm tệp đính kèm | `TASK_ATTACHMENT_ADDED` | `{ fileName }` |
| Xóa | `TASK_DELETED` | `{ title }` |

Dòng thời gian render các mục này mới-nhất-trước; frontend ánh xạ `type` + `metadata` + `actor` đã populate thành các câu cho con người ("Lan đã chuyển mục này từ In Progress sang Done").

---

# 9. Hệ thống thông báo (Notification)

## 9.1 Thiết kế

Một document `notifications` **cho mỗi người nhận trên mỗi sự kiện**. Các document tự chứa (phi chuẩn hóa `title`/`body`/`entityType`/`entityId`) nên danh sách render và deep-link mà không cần N lần fetch thêm. Thông báo được giới hạn theo workspace để lọc. Người thực hiện không bao giờ là người nhận của chính hành động mình.

## 9.2 Các loại thông báo & sự kiện

| `type` | Sự kiện kích hoạt | Người nhận |
|--------|---------------|--------------|
| `TASK_ASSIGNED` | Task được giao/giao lại cho một người dùng | assignee mới (nếu ≠ người thực hiện) |
| `TASK_STATUS_CHANGED` | Trạng thái task thay đổi | assignee + watchers (≠ người thực hiện) |
| `TASK_DUE_SOON` | Job hằng ngày: task đến hạn trong 24h, chưa xong | assignee |
| `TASK_OVERDUE` | Job hằng ngày: task trở nên quá hạn | assignee |
| `COMMENT_ADDED` | Bình luận mới trên một task | assignee + watchers (≠ người thực hiện, ≠ đã được báo qua mention/reply) |
| `COMMENT_REPLY` | Reply được thêm vào một bình luận | tác giả của bình luận gốc (≠ người thực hiện) |
| `MENTIONED` | Người dùng được `@mention` trong bình luận/mô tả | mỗi người dùng được nhắc đến (≠ người thực hiện) |
| `MEMBER_INVITED` | Lời mời được gửi tới email của một người dùng đã tồn tại | người dùng được mời |
| `MEMBER_JOINED` | Lời mời được chấp nhận | người mời |
| `ROLE_CHANGED` | Một người dùng được thăng/giáng cấp | người dùng bị ảnh hưởng |
| `REMOVED_FROM_WORKSPACE` | Một người dùng bị xóa | người dùng bị ảnh hưởng |
| `PROJECT_CREATED` | Project mới trong workspace | tùy chọn/cấu hình được — mặc định tắt để tránh nhiễu |

**Thứ tự ưu tiên / khử trùng lặp:** với một bình luận vừa nhắc đến một người dùng vừa là reply tới họ, gửi cái cụ thể nhất (`MENTIONED`) và chặn các cái còn lại cho người dùng đó. Các thông báo `(userId, type, entityId)` giống hệt nhau trong một khoảng thời gian ngắn sẽ được gộp lại.

## 9.3 Logic đã đọc / chưa đọc

- Thông báo mới → `read: false`.
- `PATCH /notifications/:id/read` → `read: true, readAt: now` (idempotent).
- `PATCH /notifications/read-all` → cập nhật hàng loạt, phạm vi `workspaceId` tùy chọn.
- Số lượng chưa đọc qua `GET /notifications/unread-count` (truy vấn có index `{userId, read}`).
- Đánh dấu đã đọc độc lập với việc bấm vào; bấm một thông báo vừa đánh dấu đã đọc vừa điều hướng.

## 9.4 Cân nhắc về thời gian thực (Real-time)

v1 dùng **polling (thăm dò)**: chuông poll `unread-count` mỗi ~30 giây và panel đang mở refetch khi được focus. Payload rất nhỏ và có index. Mục 17 mô tả nâng cấp WebSocket: một namespace `Socket.IO` cho mỗi workspace, server phát `notification:new` tới phòng socket của người nhận, client đẩy nó vào cache của TanStack Query — không cần thay đổi hợp đồng API, polling đơn giản trở thành phương án dự phòng.

## 9.5 Hành vi UI

Huy hiệu chuông hiển thị số lượng chưa đọc (hiển thị tối đa "9+"). Dropdown liệt kê các mục gần đây, cái chưa đọc được nhấn mạnh trực quan; một đường phân cách tách mới với đã xem. Bấm vào sẽ đánh dấu đã đọc + deep-link. "Mark all read" xóa nhấn mạnh ngay lập tức (optimistic). Empty → "Bạn đã xem hết". Trang đầy đủ `/notifications` thêm phân trang và bộ lọc `type`/`unread`.

---

# 10. Dashboard & Phân tích

## 10.1 Các chỉ số KPI

| KPI | Định nghĩa | Nguồn |
|-----|-----------|--------|
| Tổng project | project chưa xóa trong workspace | đếm (count) |
| Tổng task | task chưa xóa trong workspace | đếm |
| Task quá hạn | `dueDate < now && status != DONE` | tổng hợp (aggregation) |
| Tỷ lệ hoàn thành | `DONE / tổng` trong khoảng ngày | tổng hợp |
| Thành viên | `workspace_members` ACTIVE | đếm |
| Thời gian hoàn thành trung bình | trung bình(`completedAt - createdAt`) cho các task done trong khoảng | tổng hợp |

## 10.2 Biểu đồ

| Biểu đồ | Loại | Dữ liệu |
|-------|------|------|
| Phân bố trạng thái | Donut | `tasksByStatus` — `$group` trên `status` |
| Xu hướng hoàn thành | Đường (Line) | `completionTrend` — `$group` trên `completedAt` cắt theo ngày |
| Phân tích độ ưu tiên | Cột (Bar) | `tasksByPriority` — `$group` trên `priority` |
| Khối lượng theo người được giao | Cột ngang | `workloadByAssignee` — `$group` trên `assignee`, mở (open) so với quá hạn |

## 10.3 Logic tổng hợp (Aggregation)

Mọi con số đến từ các pipeline tổng hợp của MongoDB tại thời điểm request, được giới hạn bởi các index ở §5.6. Mẫu cho phân bố trạng thái:

```js
Task.aggregate([
  { $match: { workspaceId, deletedAt: null } },
  { $group: { _id: "$status", count: { $sum: 1 } } }
]);
```

Xu hướng hoàn thành:

```js
Task.aggregate([
  { $match: { workspaceId, deletedAt: null, completedAt: { $gte: from, $lte: to } } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
              completed: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);
```

Workspace rỗng cho ra mảng rỗng/số đếm bằng 0 — API luôn trả về một tập dữ liệu đúng định dạng, không bao giờ là lỗi, nên biểu đồ render trục rỗng. Các phép tổng hợp nặng có thể được cache với TTL ngắn (ví dụ 60 giây) khóa theo `(workspaceId, from, to)`.

## 10.4 Bộ lọc

Khoảng ngày `from`/`to` (mặc định 30 ngày gần nhất) áp dụng cho các phép tính xu hướng và tỷ lệ hoàn thành; `projectId` giới hạn dashboard của project; `my-work` được lọc ngầm theo id của người gọi. Mọi bộ lọc đều được kiểm tra; ngày không hợp lệ → `422`.
---

# 11. Quy tắc kiểm tra dữ liệu (Validation)

Validation chạy ở hai tầng: **frontend** (phản hồi UX tức thì, không bao giờ được tin tưởng) và **backend** (có thẩm quyền, ở cấp schema qua một validator như Zod/Joi + ràng buộc Mongoose). Backend từ chối với `422 VALIDATION_ERROR` và một mảng `details` theo từng trường (§12).

## 11.1 Auth / User

| Trường | Quy tắc |
|-------|-------|
| `name` | bắt buộc; chuỗi; đã cắt khoảng trắng; 2–60 ký tự |
| `email` | bắt buộc; email RFC hợp lệ; ≤ 254 ký tự; chuẩn hóa chữ thường; duy nhất |
| `password` | bắt buộc; 8–72 ký tự; ít nhất một chữ cái và một chữ số; không trùng với email |
| `currentPassword` (đổi mật khẩu) | bắt buộc; phải khớp hash đã lưu |
| `avatarUrl` | tùy chọn; URL hợp lệ; chỉ `https` |
| tệp avatar | mime ảnh (`png/jpeg/webp`); ≤ 2 MB |

## 11.2 Workspace

| Trường | Quy tắc |
|-------|-------|
| `name` | bắt buộc; 2–80 ký tự; đã cắt khoảng trắng |
| `description` | tùy chọn; ≤ 500 ký tự |
| `settings.memberCanCreateProject` | boolean |
| `settings.timezone` | tùy chọn; chuỗi múi giờ IANA hợp lệ |
| `newOwnerId` (chuyển giao) | bắt buộc; ObjectId hợp lệ; phải là thành viên ACTIVE ≠ người gọi |

## 11.3 Project

| Trường | Quy tắc |
|-------|-------|
| `name` | bắt buộc; 2–80 ký tự |
| `description` | tùy chọn; ≤ 1000 ký tự |
| `key` | tùy chọn khi nhập; 2–6 ký tự; `^[A-Z0-9]+$`; duy nhất theo workspace (không phân biệt hoa thường); bất biến sau khi tạo |
| `color` | tùy chọn; `^#[0-9A-Fa-f]{6}$` |
| `statuses` | nếu cung cấp, phải chứa đúng 4 key chuẩn; nhãn 1–30 ký tự |

## 11.4 Task

| Trường | Quy tắc |
|-------|-------|
| `title` | bắt buộc; 1–200 ký tự; đã cắt khoảng trắng; không chỉ toàn khoảng trắng |
| `description` | tùy chọn; ≤ 10 000 ký tự |
| `status` | phải là một trong các key trạng thái của project |
| `priority` | một trong `LOW/MEDIUM/HIGH/URGENT` |
| `assigneeId` | tùy chọn/null; ObjectId hợp lệ; thành viên ACTIVE của workspace |
| `dueDate` / `startDate` | tùy chọn; ngày ISO hợp lệ; nếu cả hai có mặt thì `startDate ≤ dueDate` |
| `position` | số; hữu hạn; ≥ 0 |
| `labels` | mảng ≤ 10; mỗi `name` 1–20 ký tự, `color` hex |
| `checklist[].text` | bắt buộc; 1–200 ký tự; mảng ≤ 50 |
| tệp đính kèm | danh sách mime cho phép; ≤ 10 MB; ≤ 20 mỗi task |

**Validation nghiệp vụ:** tạo/sửa task bị chặn trên project đã archive (`409`); trạng thái phải tồn tại trong project; tư cách thành viên của assignee được kiểm tra lại trên mỗi lần giao.

## 11.5 Comment

| Trường | Quy tắc |
|-------|-------|
| `body` | bắt buộc; 1–5000 ký tự; không chỉ toàn khoảng trắng |
| `parentId` | tùy chọn; ObjectId hợp lệ; phải tham chiếu một bình luận **gốc** của **cùng task** (nếu không thì `409 PARENT_IS_REPLY` / `422`) |
| `mentions` | suy ra phía server; chỉ thành viên ACTIVE còn lại |

## 11.6 Invitation

| Trường | Quy tắc |
|-------|-------|
| `email` | bắt buộc; email hợp lệ; chuẩn hóa; không phải thành viên ACTIVE hiện có; không có lời mời PENDING nào tồn tại |
| `role` | bắt buộc; `ADMIN` hoặc `MEMBER` (không bao giờ `OWNER`) |
| `token` (chấp nhận) | bắt buộc; 64-hex; PENDING; chưa hết hạn; email khớp với người gọi |

## 11.7 Tham số truy vấn danh sách (List query params)

`page` ≥ 1 số nguyên (mặc định 1); `limit` 1–100 số nguyên (mặc định 20); `sort` chỉ các trường trong whitelist; bộ lọc enum được kiểm tra theo enum của chúng; bộ lọc ngày là ISO hợp lệ; giá trị không hợp lệ → `422` (ngoại trừ trường `sort` lạ, bị bỏ qua).

---

# 12. Đặc tả xử lý lỗi

## 12.1 Định dạng phản hồi lỗi chuẩn

Mọi lỗi — từ bất kỳ tầng nào — đều được tuần tự hóa bởi một middleware xử lý lỗi trung tâm thành:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "email", "message": "Email is already taken." },
      { "field": "password", "message": "Password must be at least 8 characters." }
    ],
    "requestId": "req_8f3c1a"
  }
}
```

`details` chỉ có mặt cho các lỗi validation. `requestId` tương quan với log của server. Mã trạng thái HTTP và `code` cùng nhau điều khiển việc xử lý ở frontend.

## 12.2 Danh mục lỗi (Error catalogue)

| HTTP | `code` | Khi nào |
|-----:|--------|------|
| 400 | `BAD_REQUEST` | JSON sai định dạng, hình dạng query xấu |
| 400 | `INVALID_ID` | Path param không phải ObjectId hợp lệ |
| 401 | `UNAUTHENTICATED` | Thiếu/không có token |
| 401 | `TOKEN_EXPIRED` | Access token hết hạn (kích hoạt refresh) |
| 401 | `TOKEN_INVALID` | Chữ ký sai / token sai định dạng |
| 401 | `INVALID_CREDENTIALS` | Sai khi login / đổi mật khẩu |
| 403 | `FORBIDDEN` | Đã xác thực nhưng vai trò/quyền sở hữu không đủ |
| 403 | `INVITATION_EMAIL_MISMATCH` | Chấp nhận bằng tài khoản sai |
| 404 | `WORKSPACE_NOT_FOUND` | Không tồn tại, đã xóa, hoặc người gọi không phải thành viên |
| 404 | `PROJECT_NOT_FOUND` / `TASK_NOT_FOUND` / `COMMENT_NOT_FOUND` | Không tồn tại hoặc đã xóa |
| 409 | `EMAIL_TAKEN` | Đăng ký trùng |
| 409 | `ALREADY_MEMBER` | Mời/chấp nhận khi đã là thành viên |
| 409 | `INVITATION_EXISTS` | Lời mời PENDING trùng lặp |
| 409 | `PROJECT_KEY_TAKEN` | Key project trùng |
| 409 | `PROJECT_ARCHIVED` | Thay đổi task trên một project đã archive |
| 409 | `INVALID_STATUS_TRANSITION` | Trạng thái không nằm trong tập của project |
| 409 | `CANNOT_MODIFY_OWNER` / `CANNOT_REMOVE_OWNER` / `OWNER_CANNOT_LEAVE` | Quy tắc bảo vệ OWNER |
| 409 | `PARENT_IS_REPLY` | Reply một reply |
| 410 | `INVITATION_INVALID` / `INVITATION_EXPIRED` | Token lời mời cũ/hỏng |
| 422 | `VALIDATION_ERROR` | Lỗi validation cấp trường (mang theo `details`) |
| 422 | `ASSIGNEE_NOT_MEMBER` | Giao cho người không phải thành viên |
| 422 | `CHECKLIST_LIMIT` / `INVALID_FILE` | Giới hạn tài nguyên con |
| 429 | `RATE_LIMITED` | Quá nhiều request (mang theo `Retry-After`) |
| 500 | `INTERNAL_ERROR` | Không xử lý được; thông báo chung chung, chi tiết chỉ trong log |

## 12.3 Xử lý theo từng tầng

- **Lỗi validation (422):** bắt từ validator, ánh xạ thành `details[]`. Frontend render lỗi inline theo trường; trên một list/form, trường lỗi đầu tiên được focus.
- **Lỗi xác thực (401):** `TOKEN_EXPIRED` được chặn bởi luồng refresh của Axios (§3.1.3); các lỗi 401 khác xóa phiên và chuyển hướng tới `/login`.
- **Lỗi quyền hạn (403):** frontend hiển thị toast hoặc panel "Bạn không có quyền"; nó **không** retry. Lý tưởng là chúng được ngăn trước bằng cách ẩn UI, nên một lỗi 403 cho thấy client state đã cũ → refetch.
- **Lỗi không tìm thấy (404):** frontend hiển thị trạng thái không-tìm-thấy và chuyển hướng lên một cấp (task→bảng, project→danh sách project, workspace→danh sách workspace). 404 của workspace cố ý gộp "không tồn tại" và "không có quyền" để tránh việc liệt kê tenant.
- **Lỗi xung đột (409):** hiển thị thành toast/thông báo inline cụ thể, dễ đọc cho con người (ví dụ "Đã tồn tại project với key MKT"); form vẫn được giữ dữ liệu để sửa.
- **Lỗi server (500):** chung chung "Something went wrong" + Retry; `requestId` hiển thị nhỏ cho mục đích hỗ trợ. Không bao giờ rò rỉ stack trace ra client.

## 12.4 Mẫu triển khai phía backend

Một middleware `errorHandler` duy nhất là nơi duy nhất ghi các phản hồi lỗi. Controller/service `throw new ApiError(status, code, message, details?)`; các async route handler được bọc lại để lỗi ném/reject đến được middleware. `ValidationError`/`CastError` của Mongoose và lỗi JWT được chuẩn hóa về danh mục ở trên trước khi tuần tự hóa. Mọi lỗi đều được ghi log kèm `requestId`, route, user id, và (với ≥500) là stack.

---

# 13. Cân nhắc về bảo mật

## 13.1 Luồng JWT

- **Access token:** ngắn hạn (15 phút), JWT ký với `JWT_ACCESS_SECRET`, payload `{ sub: userId, iat, exp }`. Gửi dưới dạng `Authorization: Bearer`.
- **Refresh token:** dài hạn hơn (7 ngày), ký với một `JWT_REFRESH_SECRET` riêng, **xoay vòng (rotate)** sau mỗi lần refresh; token trước bị vô hiệu hóa (blacklist theo token id / jti đã lưu). Logout vô hiệu hóa refresh token được gửi lên.
- **Lưu trữ:** thiết lập được khuyến nghị là lưu refresh token trong một cookie `httpOnly`, `Secure`, `SameSite=Strict` và access token trong bộ nhớ (Zustand, không persist). Nếu thay vào đó dùng mô hình token thuần-SPA, cả hai sống trong bộ nhớ với việc refresh-khi-reload; localStorage không được khuyến khích do nguy cơ XSS.
- Token không mang dữ liệu vai trò — vai trò là theo từng workspace và được phân giải mới từ `workspace_members` trên mỗi request, nên một lần giáng cấp có hiệu lực ngay lập tức mà không phải chờ token hết hạn.

## 13.2 Băm mật khẩu (Password hashing)

`bcrypt` với hệ số cost 12. `passwordHash` có `select: false` nên nó không bao giờ vô tình lọt vào kết quả truy vấn. Mật khẩu không bao giờ được ghi log. Một chính sách độ-mạnh-tối-thiểu được thực thi (§11.1). Đổi mật khẩu yêu cầu mật khẩu hiện tại.

## 13.3 Kiểm soát truy cập (Access control)

- Middleware hai giai đoạn: `requireAuth` rồi `requireWorkspaceRole(minRole)` (§2.4). Các kiểm tra quyền-sở-hữu-tài-nguyên (chỉnh sửa task có giới hạn của MEMBER, quyền tác giả bình luận) chạy trong controller.
- **Cô lập tenant:** mọi truy vấn dữ liệu project/task/comment/activity/notification đều bao gồm `workspaceId` (hoặc chỉ được tới qua một cha đã giới hạn `workspaceId`). Không endpoint nào chấp nhận một `taskId` thô mà không cũng phân giải và kiểm tra tư cách thành viên workspace của nó.
- Phòng vệ IDOR: biết một id không bao giờ là đủ — cổng kiểm tra tư cách thành viên là bắt buộc; truy cập chéo tenant trả về `404`, không phải `403`, để tránh xác nhận sự tồn tại.

## 13.4 Giới hạn tần suất (Rate limiting)

- Bộ giới hạn toàn cục (ví dụ `express-rate-limit`): trần theo từng IP (ví dụ 300 req/phút).
- Bộ giới hạn nghiêm ngặt hơn trên các endpoint auth (`/auth/login`, `/auth/register`, `/auth/refresh`, `/invitations/accept`): ví dụ 10 req/phút mỗi IP để cùn hóa credential stuffing.
- Vượt giới hạn → `429 RATE_LIMITED` kèm header `Retry-After`. Ở production, kho lưu của bộ giới hạn dựa trên Redis để hoạt động xuyên các instance.

## 13.5 Làm sạch đầu vào (Input sanitization)

- Body/query/params được kiểm tra và **ép kiểu (type-coerce)** bởi validator trước khi tới controller — các trường ngoài dự kiến bị loại bỏ.
- `express-mongo-sanitize` xóa các key chứa `$`/`.` để chặn tiêm toán tử (operator-injection) (ví dụ `{ "email": { "$ne": null } }`).
- `helmet` đặt các header bảo mật; CORS bị giới hạn về (các) origin frontend đã biết.
- Văn bản do người dùng tạo (mô tả, bình luận) được lưu thô nhưng **được escape/làm sạch khi render** — frontend React coi nó là văn bản; nếu markdown được render, nó đi qua một bộ làm sạch (ví dụ `DOMPurify`) với một allowlist nghiêm ngặt để ngăn XSS lưu trữ (stored XSS).
- Upload tệp: danh sách mime cho phép + giới hạn kích thước + kiểm tra phần mở rộng; tệp được lưu với tên được tạo (không bao giờ dùng tên do người dùng cung cấp làm đường dẫn) bên ngoài web root / trong object storage.

## 13.6 Cân nhắc bảo mật MongoDB

- Kết nối qua TLS; thông tin đăng nhập và URI nằm trong biến môi trường, không bao giờ trong code.
- Người dùng database được giới hạn đặc quyền tối thiểu vào một database ứng dụng duy nhất.
- Tiêm toán tử bị chặn bởi việc làm sạch (§13.5) cộng với xác thực schema — truy vấn không bao giờ nội suy đầu vào thô của người dùng vào toán tử.
- Xóa mềm + một job purge riêng nghĩa là các lần xóa nhầm có thể khôi phục trong một cửa sổ ân hạn.
- Index (§5) cũng là một biện pháp kiểm soát bảo mật: chúng giữ cho các endpoint tổng hợp/danh sách không bị biến thành vector DoS bởi các phép quét tốn kém; `limit` bị giới hạn cứng ở 100.
- Backup được mã hóa khi lưu (at rest); PII (email, tên) chỉ sống ở nơi cần thiết; `passwordHash` không bao giờ rời server.

## 13.7 Khác

- Bí mật (secrets) qua `.env` / một secrets manager; `.env` bị git-ignore; một `.env.example` được commit ghi lại các key cần thiết.
- Lỗi auth chung chung (§12) tránh việc liệt kê người dùng.
- Vết kiểm toán (`activities`) cung cấp lịch sử pháp y (forensic) cho việc review bảo mật.
- Quét phụ thuộc (dependency scanning) (ví dụ `npm audit`, Dependabot) trong CI.

---

# 14. Đề xuất cấu trúc thư mục Backend

Bố cục ExpressJS sẵn-sàng-production, phân mô-đun theo tính năng. Mỗi mô-đun tính năng sở hữu chuỗi route → controller → service → model → validator; code xuyên suốt (cross-cutting) nằm trong `common`/`config`/`middlewares`.

```
backend/
├── src/
│   ├── config/
│   │   ├── env.js                 # tải env đã được kiểm tra
│   │   ├── db.js                  # kết nối Mongoose
│   │   └── logger.js              # instance pino/winston
│   ├── common/
│   │   ├── errors/
│   │   │   ├── ApiError.js
│   │   │   └── errorCodes.js
│   │   ├── middlewares/
│   │   │   ├── requireAuth.js
│   │   │   ├── requireWorkspaceRole.js
│   │   │   ├── validate.js        # chạy schema Zod/Joi
│   │   │   ├── rateLimiter.js
│   │   │   └── errorHandler.js    # bộ tuần tự hóa lỗi duy nhất
│   │   ├── utils/
│   │   │   ├── asyncHandler.js
│   │   │   ├── pagination.js
│   │   │   └── jwt.js
│   │   └── constants.js           # roles, statuses, enums
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.validation.js
│   │   ├── users/
│   │   │   ├── user.routes.js
│   │   │   ├── user.controller.js
│   │   │   ├── user.service.js
│   │   │   ├── user.model.js
│   │   │   └── user.validation.js
│   │   ├── workspaces/            # workspace + members + invitations
│   │   │   ├── workspace.routes.js
│   │   │   ├── workspace.controller.js
│   │   │   ├── workspace.service.js
│   │   │   ├── workspace.model.js
│   │   │   ├── workspaceMember.model.js
│   │   │   ├── invitation.model.js
│   │   │   └── workspace.validation.js
│   │   ├── projects/
│   │   │   ├── project.routes.js
│   │   │   ├── project.controller.js
│   │   │   ├── project.service.js
│   │   │   ├── project.model.js
│   │   │   └── project.validation.js
│   │   ├── tasks/
│   │   │   ├── task.routes.js
│   │   │   ├── task.controller.js
│   │   │   ├── task.service.js
│   │   │   ├── task.model.js
│   │   │   └── task.validation.js
│   │   ├── comments/
│   │   │   ├── comment.routes.js
│   │   │   ├── comment.controller.js
│   │   │   ├── comment.service.js
│   │   │   ├── comment.model.js
│   │   │   └── comment.validation.js
│   │   ├── notifications/
│   │   │   ├── notification.routes.js
│   │   │   ├── notification.controller.js
│   │   │   ├── notification.service.js   # emit() được các mô-đun khác dùng
│   │   │   └── notification.model.js
│   │   ├── activities/
│   │   │   ├── activity.routes.js
│   │   │   ├── activity.controller.js
│   │   │   ├── activity.service.js       # log() được các mô-đun khác dùng
│   │   │   └── activity.model.js
│   │   └── dashboard/
│   │       ├── dashboard.routes.js
│   │       ├── dashboard.controller.js
│   │       └── dashboard.service.js      # các pipeline tổng hợp
│   ├── jobs/
│   │   ├── dueDateNotifier.job.js        # due-soon / overdue hằng ngày
│   │   ├── invitationSweeper.job.js      # hết hạn các lời mời cũ
│   │   └── purge.job.js                  # xóa cứng dữ liệu đã xóa mềm
│   ├── app.js                            # express app, đấu nối middleware
│   └── server.js                         # bootstrap, kết nối db, listen
├── tests/
│   ├── integration/
│   └── unit/
├── .env.example
├── .eslintrc.js
├── package.json
└── README.md
```

**Luồng request:** `route → validate(schema) → requireAuth → requireWorkspaceRole → controller → service → model`, với `errorHandler` bắt mọi thứ được ném ra. `notification.service` và `activity.service` là các service dùng chung mà các mô-đun khác gọi sau khi việc ghi của chúng thành công.

---

# 15. Đề xuất cấu trúc thư mục Frontend

Bố cục ReactJS có khả năng mở rộng, phân lát theo tính năng (feature-sliced).

```
frontend/
├── src/
│   ├── app/
│   │   ├── router.jsx              # cây route + guards
│   │   ├── providers.jsx          # QueryClient, Theme, Auth providers
│   │   └── App.jsx
│   ├── lib/
│   │   ├── axios.js               # instance + interceptor auth/refresh
│   │   ├── queryClient.js
│   │   └── utils.js
│   ├── store/
│   │   ├── authStore.js           # Zustand: user + tokens
│   │   └── uiStore.js             # workspace đang chọn, theme, tùy chọn bảng
│   ├── components/
│   │   ├── ui/                    # primitive của shadcn/ui
│   │   ├── layout/                # AppShell, Sidebar, Topbar
│   │   └── common/                # EmptyState, ErrorState, Skeletons, ConfirmDialog
│   ├── hooks/
│   │   ├── usePermissions.js
│   │   ├── useDebounce.js
│   │   └── useWorkspace.js
│   ├── features/
│   │   ├── auth/
│   │   │   ├── pages/             # LoginPage, RegisterPage
│   │   │   ├── api/               # authApi.js + useLogin/useRegister
│   │   │   └── components/
│   │   ├── workspaces/
│   │   │   ├── pages/             # WorkspaceListPage, WorkspaceSettingsPage
│   │   │   ├── api/
│   │   │   └── components/        # WorkspaceCard, CreateWorkspaceModal
│   │   ├── members/
│   │   │   ├── pages/             # MembersPage
│   │   │   ├── api/
│   │   │   └── components/        # MemberTable, InviteModal, AcceptInvitePage
│   │   ├── projects/
│   │   │   ├── pages/             # ProjectListPage
│   │   │   ├── api/
│   │   │   └── components/        # ProjectCard, CreateProjectModal
│   │   ├── tasks/
│   │   │   ├── pages/             # BoardPage, TaskDetailPage
│   │   │   ├── api/               # taskApi.js + useTasks/useUpdateTask...
│   │   │   └── components/        # KanbanBoard, Column, TaskCard,
│   │   │                          # TaskDetailModal, Checklist, LabelEditor,
│   │   │                          # CommentList, CommentComposer
│   │   ├── notifications/
│   │   │   ├── pages/             # NotificationsPage
│   │   │   ├── api/
│   │   │   └── components/        # NotificationBell, NotificationItem
│   │   ├── dashboard/
│   │   │   ├── pages/             # DashboardPage
│   │   │   ├── api/
│   │   │   └── components/        # KpiCard, StatusDonut, TrendChart
│   │   └── profile/
│   │       └── pages/             # ProfilePage
│   ├── constants/                 # roles, statuses, priorities, enums
│   └── main.jsx
├── public/
├── index.html
├── tailwind.config.js
├── .env.example
└── package.json
```

**Quy ước:** server state chỉ qua các hook TanStack Query được đặt cùng chỗ trong `api/` của mỗi tính năng; query key là các mảng (`['tasks', projectId, filters]`); mutation thực hiện optimistic update + rollback cho việc kéo bảng và sửa trường; Zustand không giữ gì thuộc về server. Route guard: một `<AuthGuard>` chuyển hướng người dùng chưa xác thực tới `/login`; một `<WorkspaceGuard>` đảm bảo workspace đang chọn đã được tải và người dùng là thành viên.

---

# 16. Các thư viện bên thứ ba được đề xuất

## 16.1 Backend

| Mối quan tâm | Thư viện | Tại sao |
|---------|---------|-----|
| Validation | **Zod** (hoặc Joi) | Xác thực schema + suy luận kiểu; cung cấp sức mạnh cho middleware `validate` |
| Auth | **jsonwebtoken**, **bcrypt** | Ký/xác minh JWT; băm mật khẩu |
| Logging | **pino** (+ `pino-http`) | Log JSON có cấu trúc, nhanh, kèm `requestId` |
| Header bảo mật | **helmet** | Các header mặc định hợp lý |
| Phòng vệ injection | **express-mongo-sanitize** | Loại bỏ tiêm toán tử `$`/`.` |
| Rate limiting | **express-rate-limit** (+ `rate-limit-redis`) | Giới hạn theo IP / route, phân tán |
| Upload tệp | **multer** (+ `@aws-sdk/client-s3` cho prod) | Phân tích multipart; object storage |
| Cấu hình env | **dotenv** + `env.js` được Zod kiểm tra | Fail nhanh khi env thiếu/không hợp lệ |
| ODM | **mongoose** | Schema, hook, index |
| CORS | **cors** | Giới hạn origin |
| Job định kỳ | **node-cron** (hoặc BullMQ cho hàng đợi) | Bộ thông báo ngày hết hạn, bộ quét, purge |
| Testing | **Jest** + **supertest** + **mongodb-memory-server** | Test unit + integration |
| Dev | **nodemon**, **eslint**, **prettier** | Trải nghiệm dev (DX), tính nhất quán |

## 16.2 Frontend

| Mối quan tâm | Thư viện | Tại sao |
|---------|---------|-----|
| Xử lý form | **React Hook Form** + **Zod** (`@hookform/resolvers`) | Form hiệu năng cao, chia sẻ schema với mô hình tư duy của backend |
| Quản lý state | **Zustand** | Client state tối thiểu (auth, tùy chọn UI) |
| Server state | **TanStack Query** | Cache, refetch, optimistic update, invalidation |
| Xử lý API | **Axios** | Interceptor cho auth + refresh token |
| Routing | **React Router** | Route lồng nhau, guard |
| Component UI | **shadcn/ui** + **TailwindCSS** | Các primitive có thể kết hợp, hỗ trợ accessibility |
| Icon | **lucide-react** | Bộ icon nhất quán |
| Bảng (Table) | **TanStack Table** | Bảng headless cho các chế độ xem danh sách thành viên/task |
| Kéo & thả | **dnd-kit** | Kéo-thả Kanban hỗ trợ accessibility (vị trí) |
| Biểu đồ | **Recharts** | Biểu đồ donut/đường/cột cho dashboard |
| Ngày tháng | **date-fns** | Tính toán ngày hết hạn, thời gian tương đối |
| Markdown | **react-markdown** + **DOMPurify** | Render an toàn mô tả task |
| Thông báo/UI | **sonner** (toast) | Phản hồi toast cho mutation/lỗi |
| Realtime (tương lai) | **socket.io-client** | Thông báo qua WebSocket |
| Testing | **Vitest** + **React Testing Library** | Test component/hook |

---

# 17. Các tính năng nâng cấp trong tương lai

| Lĩnh vực | Nâng cấp | Ghi chú / tác động |
|------|-------------|----------------|
| **Cộng tác thời gian thực** | Namespace WebSocket (Socket.IO) cho mỗi workspace; cập nhật bảng trực tiếp, hiện diện (presence), chỉ báo đang gõ | Server phát `task:updated`, `notification:new`; client trộn vào cache TanStack Query. Polling vẫn là dự phòng — không thay đổi hợp đồng REST. |
| **Thông báo qua WebSocket** | Push thông báo thay vì polling 30 giây | Tái dùng các loại sự kiện ở §9; phòng socket của người nhận khóa theo `userId`. |
| **Nhật ký kiểm toán nâng cao** | Diff cấp trường, export ra CSV, chính sách lưu trữ, các view review bảo mật | Mở rộng `activities.metadata` với ảnh chụp before/after; thêm một endpoint export. |
| **Phân tích nâng cao** | Burndown/burnup, cycle-time & lead-time, throughput, năng suất theo từng thành viên, cohort ngày tùy chỉnh | Các pipeline tổng hợp mới; cân nhắc các collection rollup hằng ngày tính sẵn cho workspace lớn. |
| **Workflow tùy chỉnh** | Trạng thái cấu hình được theo từng project + chuyển đổi tuyến tính được thực thi | Bộ kiểm tra chuyển đổi đã được tập trung hóa (§8.2) — chuyển từ bất-kỳ-sang-bất-kỳ thành một đồ thị cấu hình được. |
| **Thông báo qua Email** | Email tóm tắt (digest) + email giao dịch (giao việc, mention, due-soon) qua SendGrid/SES với tùy chọn theo từng người dùng | Móc vào `NotificationService.emit()`; thêm một collection `notification_preferences`. |
| **Hỗ trợ ứng dụng Mobile** | Client React Native tái dùng cùng REST API; hoặc một PWA | API đã thân thiện với mobile; thêm push token + một endpoint `/devices`. |
| **View & bộ lọc đã lưu** | Bộ lọc bảng được persist, "bộ lọc của tôi", view nhóm được chia sẻ | Một collection `views` mới giới hạn theo project/user. |
| **Danh mục label (Labels catalog)** | Label tái dùng được ở cấp workspace thay vì label nhúng tự do | Migrate label nhúng → một collection `labels` + `labelIds` trên task. |
| **Thao tác hàng loạt & import** | Chọn nhiều task, đổi trạng thái/assignee hàng loạt, import CSV | Endpoint batch với ngữ nghĩa giao dịch + gộp activity/notification. |
| **Dịch vụ tìm kiếm** | Tìm kiếm toàn văn trên task/comment/project với xếp hạng độ liên quan | Chuyển từ Mongo text index sang Atlas Search / OpenSearch khi khối lượng tăng. |
| **Task lặp lại & phụ thuộc** | Lịch lặp lại; quan hệ chặn/bị chặn (blocks/blocked-by) | Trường mới + một job scheduler; xác thực đồ thị phụ thuộc. |

---

*Kết thúc đặc tả.*
