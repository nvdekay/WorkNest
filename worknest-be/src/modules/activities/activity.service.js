// Service dùng chung — module khác gọi log() để ghi vết audit.
// TODO: snapshot entityLabel tại thời điểm xảy ra; fire-and-forget.

const list = async (_workspaceId, _query) => { throw new Error('not implemented'); };

const log = async (_payload) => {
  // TODO: tạo activity document; lỗi không chặn caller.
};

module.exports = { list, log };
