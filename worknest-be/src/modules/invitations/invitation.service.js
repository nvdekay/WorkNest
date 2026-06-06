// TODO: random hex 32-byte token; expiresAt = now + 7d; gửi email async fire-and-forget.

const list = async (_workspaceId) => { throw new Error('not implemented'); };
const send = async (_workspaceId, _payload, _actor) => { throw new Error('not implemented'); };
const cancel = async (_workspaceId, _invitationId) => { throw new Error('not implemented'); };
const accept = async (_token, _user) => { throw new Error('not implemented'); };
const preview = async (_token) => { throw new Error('not implemented'); };

module.exports = { list, send, cancel, accept, preview };
