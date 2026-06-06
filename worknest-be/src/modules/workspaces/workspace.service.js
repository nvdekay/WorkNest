// TODO: implement CRUD workspace, transfer ownership atomic, cascade soft-delete.

const list = async (_userId, _query) => { throw new Error('not implemented'); };
const create = async (_userId, _payload) => { throw new Error('not implemented'); };
const getById = async (_workspaceId, _userId) => { throw new Error('not implemented'); };
const update = async (_workspaceId, _payload) => { throw new Error('not implemented'); };
const remove = async (_workspaceId) => { throw new Error('not implemented'); };
const transferOwnership = async (_workspaceId, _newOwnerId, _actorId) => { throw new Error('not implemented'); };

module.exports = { list, create, getById, update, remove, transferOwnership };
