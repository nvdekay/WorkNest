/**
 * setup-database.js — Áp dụng toàn bộ schema (validator + index) từ mongodb-schema.json
 *
 * MongoDB không có khái niệm "import schema": mongoimport chỉ nạp DỮ LIỆU.
 * Script này đọc mongodb-schema.json và:
 *   1. Tạo collection nếu chưa có (kèm $jsonSchema validator), hoặc cập nhật validator nếu đã có (collMod).
 *   2. Tạo toàn bộ index đã định nghĩa.
 *
 * CÁCH CHẠY (cần file mongodb-schema.json nằm cùng thư mục):
 *   mongosh "mongodb://localhost:27017" --file setup-database.js
 *   # hoặc với Atlas:
 *   mongosh "mongodb+srv://USER:PASS@cluster.xxx.mongodb.net" --file setup-database.js
 *
 * Idempotent: chạy lại nhiều lần an toàn (validator được cập nhật, index trùng bị bỏ qua).
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve('mongodb-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const targetDb = db.getSiblingDB(schema.database);
print(`\n=== Setting up database: ${schema.database} ===\n`);

const existing = new Set(targetDb.getCollectionNames());

for (const col of schema.collections) {
  const { name, validator, indexes } = col;

  // 1) Collection + validator
  if (existing.has(name)) {
    targetDb.runCommand({
      collMod: name,
      validator: validator,
      validationLevel: 'moderate',
      validationAction: 'error',
    });
    print(`✓ updated validator on '${name}'`);
  } else {
    targetDb.createCollection(name, {
      validator: validator,
      validationLevel: 'moderate',
      validationAction: 'error',
    });
    print(`✓ created collection '${name}'`);
  }

  // 2) Indexes
  for (const idx of indexes || []) {
    try {
      targetDb.getCollection(name).createIndex(idx.key, idx.options || {});
      print(`    └─ index ${idx.options && idx.options.name ? idx.options.name : JSON.stringify(idx.key)}`);
    } catch (e) {
      print(`    └─ ⚠ index ${JSON.stringify(idx.key)} skipped: ${e.message}`);
    }
  }
}

print(`\n=== Done. ${schema.collections.length} collections ready. ===\n`);
