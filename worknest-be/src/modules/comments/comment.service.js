// TODO: parentId chỉ trỏ comment gốc cùng task; mention chỉ ACTIVE member; cập nhật task.commentCount.

const list = async (_taskId, _query) => { throw new Error('not implemented'); };
const create = async (_taskId, _payload, _actor) => { throw new Error('not implemented'); };
const update = async (_commentId, _payload, _actor) => { throw new Error('not implemented'); };
const remove = async (_commentId, _actor) => { throw new Error('not implemented'); };

module.exports = { list, create, update, remove };
