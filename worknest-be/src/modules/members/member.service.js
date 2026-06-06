// TODO: implement RBAC actions. Khi xóa member → bỏ giao tất cả task của họ trong workspace.

const list = async (_workspaceId, _query) => { throw new Error('not implemented'); };
const updateRole = async (_workspaceId, _memberId, _role, _actor) => { throw new Error('not implemented'); };
const remove = async (_workspaceId, _memberId, _actor) => { throw new Error('not implemented'); };
const leave = async (_workspaceId, _userId) => { throw new Error('not implemented'); };

module.exports = { list, updateRole, remove, leave };
