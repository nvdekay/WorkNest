// TODO: aggregation pipelines theo workspace/project; cache TTL 60s.

const workspaceOverview = async (_workspaceId, _query) => { throw new Error('not implemented'); };
const projectOverview = async (_workspaceId, _projectId, _query) => { throw new Error('not implemented'); };
const myWork = async (_workspaceId, _userId, _query) => { throw new Error('not implemented'); };

module.exports = { workspaceOverview, projectOverview, myWork };
