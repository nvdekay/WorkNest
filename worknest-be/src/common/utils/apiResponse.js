// Vỏ bọc response chuẩn theo spec §0.

const ok = (res, data = null, meta) => {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(200).json(body);
};

const created = (res, data = null, meta) => {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(201).json(body);
};

const noContent = (res) => res.status(204).end();

module.exports = { ok, created, noContent };
