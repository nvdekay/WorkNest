// TODO: key duy nhất/bất biến; archive = readonly; cascade soft-delete; quyền MEMBER theo cờ workspace.

const list = async (_workspaceId, _query) => { throw new Error('not implemented'); };
const create = async (_workspaceId, _payload, _actor) => { throw new Error('not implemented'); };
const getById = async (_workspaceId, _projectId) => { throw new Error('not implemented'); };
const update = async (_workspaceId, _projectId, _payload, _actor) => { throw new Error('not implemented'); };
const archive = async (_workspaceId, _projectId, _archived) => { throw new Error('not implemented'); };
const remove = async (_workspaceId, _projectId) => { throw new Error('not implemented'); };

module.exports = { list, create, getById, update, archive, remove };
