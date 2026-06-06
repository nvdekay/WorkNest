# WorkNest Backend

Express.js + MongoDB backend, tổ chức theo hướng module hoá.

## Yêu cầu

- Node.js >= 18
- MongoDB (local hoặc Atlas)

## Bắt đầu

```bash
npm install
cp .env.example .env   # chỉnh sửa MONGO_URI, JWT_SECRET...
npm run dev            # chạy với nodemon
# hoặc
npm start              # chạy production
```

Server mặc định: `http://localhost:5000`.

- Healthcheck: `GET /health`
- Swagger UI: `GET /api-docs`
- OpenAPI JSON: `GET /api-docs.json`

## Cấu trúc thư mục

```
src/
├── app.js                  # khởi tạo express app, middleware chung
├── server.js               # entrypoint, kết nối DB & start server
├── config/
│   ├── env.js              # đọc & validate biến môi trường
│   └── db.js               # kết nối MongoDB (mongoose)
├── routes/
│   └── index.js            # gom toàn bộ route /api/v1
├── middlewares/
│   ├── auth.middleware.js      # xác thực JWT + phân quyền
│   ├── validate.middleware.js  # validate request bằng Joi
│   ├── error.middleware.js     # bắt & format error
│   └── notFound.middleware.js  # 404 handler
├── utils/
│   ├── ApiError.js         # error class tự định nghĩa
│   ├── apiResponse.js      # helper trả response chuẩn
│   └── catchAsync.js       # wrap async controller
└── modules/                # MỖI feature 1 folder
    ├── auth/
    │   ├── auth.controller.js
    │   ├── auth.service.js
    │   ├── auth.route.js
    │   └── auth.validation.js
    └── user/
        ├── user.controller.js
        ├── user.service.js
        ├── user.route.js
        ├── user.model.js
        └── user.validation.js
```

## Quy ước thêm module mới

Tạo folder `src/modules/<feature>/` gồm:

- `<feature>.model.js` — Mongoose schema
- `<feature>.service.js` — business logic, thao tác DB
- `<feature>.controller.js` — nhận `req`/`res`, gọi service
- `<feature>.validation.js` — Joi schema
- `<feature>.route.js` — định nghĩa route

Sau đó mount route trong `src/routes/index.js`:

```js
router.use('/<feature>', require('../modules/<feature>/<feature>.route'));
```

## Endpoint mẫu

| Method | URL | Mô tả |
|---|---|---|
| POST | `/api/v1/auth/register` | đăng ký |
| POST | `/api/v1/auth/login` | đăng nhập, trả JWT |
| GET | `/api/v1/auth/me` | thông tin user hiện tại (cần Bearer token) |
| GET | `/api/v1/users` | danh sách user (auth) |
| GET | `/api/v1/users/:id` | chi tiết user (auth) |
| POST | `/api/v1/users` | tạo user (admin) |
| PATCH | `/api/v1/users/:id` | cập nhật user (auth) |
| DELETE | `/api/v1/users/:id` | xoá user (admin) |
