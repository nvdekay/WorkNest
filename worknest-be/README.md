# Team Task Management — Backend

Express.js + MongoDB. Triển khai theo `docs/Backend_Features_and_API_Spec.md` và `docs/Database_Schema.md`. Đây là **base skeleton** — model + cấu trúc thư mục + route surface đầy đủ; controller/service trả `501 NOT_IMPLEMENTED` đợi hiện thực theo §17 của spec.

## Khởi động nhanh

```bash
# 1. Cài deps
npm install

# 2. Cấu hình env
cp .env.example .env   # chỉnh MONGO_URI / JWT_*_SECRET

# 3. Áp validator + index lên MongoDB (idempotent)
mongosh "$MONGO_URI" --file docs/setup-database.js
# hoặc: npm run db:setup   (cần export MONGO_URI trước)

# 4. Chạy
npm run dev   # nodemon
npm start     # production
```

Mặc định:
- API: `http://localhost:5001/api`
- Swagger UI: `http://localhost:5001/api-docs`
- Healthcheck: `http://localhost:5001/health`

## Cấu trúc thư mục

Theo spec §16:

```
src/
├── server.js                       # bootstrap, connect DB, graceful shutdown
├── app.js                          # express + middleware pipeline
├── config/
│   ├── env.js                      # đọc & validate biến môi trường
│   ├── db.js                       # mongoose connect
│   ├── logger.js                   # pino
│   └── swagger.js                  # swagger-jsdoc spec
├── common/
│   ├── constants.js                # ROLE, TASK_STATUS, PRIORITY, ... (đồng bộ với DB doc)
│   ├── errors/
│   │   ├── ApiError.js
│   │   └── errorCodes.js           # catalog §13
│   ├── middlewares/
│   │   ├── requireAuth.js          # verify access token, gắn req.user
│   │   ├── requireWorkspaceRole.js # RBAC theo workspace_members
│   │   ├── validate.js             # Joi
│   │   ├── validateObjectId.js
│   │   ├── rateLimiter.js          # global + auth
│   │   ├── errorHandler.js         # vỏ bọc lỗi chuẩn §0
│   │   └── notFound.js
│   └── utils/
│       ├── asyncHandler.js
│       ├── apiResponse.js          # ok/created theo vỏ bọc thành công
│       ├── pagination.js
│       ├── jwt.js                  # sign/verify access & refresh
│       ├── notImpl.js
│       └── requestId.js
├── modules/
│   ├── auth/                       # register/login/refresh/logout/me/change-password
│   ├── users/                      # /users/me + avatar
│   ├── workspaces/                 # workspace CRUD + 3 model (workspace, member, invitation)
│   ├── members/                    # /workspaces/:id/members
│   ├── invitations/                # /workspaces/:id/invitations + /invitations/{accept,preview}
│   ├── projects/
│   ├── tasks/                      # board/list, checklist, attachments, watch
│   ├── comments/                   # threaded 1 cấp + mention
│   ├── notifications/              # + emit() dùng chung
│   ├── activities/                 # audit + log() dùng chung
│   └── dashboard/                  # aggregation
├── jobs/
│   ├── dueDateNotifier.job.js      # daily TASK_DUE_SOON / TASK_OVERDUE
│   ├── invitationSweeper.job.js    # PENDING expired → EXPIRED
│   ├── purge.job.js                # hard delete sau ân hạn
│   └── index.js                    # startJobs() — gọi từ server.js khi sẵn sàng
└── routes/index.js                 # mount mọi module dưới /api
```

Mỗi module tuân thủ pattern: `route → validate → requireAuth → requireWorkspaceRole → controller → service → model`.

## Vỏ bọc response

Thành công:
```json
{ "success": true, "data": { ... }, "meta": { ... } }
```

Lỗi (chuẩn hoá bởi `errorHandler`):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": [ { "field": "body.email", "message": "..." } ],
    "requestId": "req_8f3c1a"
  }
}
```

## Thứ tự hiện thực

Theo spec §17:

1. ✅ Hạ tầng chung (config + common + bộ khung app/server) — *xong*
2. ✅ Models + route skeleton — *xong*
3. ⏳ Auth + Users
4. ⏳ Workspaces + Members + Invitations
5. ⏳ Projects
6. ⏳ Activities + Notifications (service trước)
7. ⏳ Tasks (logic phức tạp nhất)
8. ⏳ Comments
9. ⏳ Dashboard
10. ⏳ Jobs nền + cứng hoá (rate limit prod, redis store, ...)

Fill module nào → mở `<module>/<module>.service.js` viết logic, mở controller wire vào (dùng `asyncHandler`/`ok`/`created`), bỏ stub `notImpl` ở `<module>.controller.js`.

## Tài liệu nguồn

- `docs/Backend_Features_and_API_Spec.md` — đặc tả tính năng + API spec đầy đủ
- `docs/Database_Schema.md` — schema từng collection + index
- `docs/mongodb-schema.json` + `docs/setup-database.js` — JSON validator + script áp dụng
