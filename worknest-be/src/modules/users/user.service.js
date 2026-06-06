const getMe = async (_userId) => {
  throw new Error('user.service.getMe not implemented');
};

const updateMe = async (_userId, _payload) => {
  throw new Error('user.service.updateMe not implemented');
};

const uploadAvatar = async (_userId, _file) => {
  throw new Error('user.service.uploadAvatar not implemented');
};

module.exports = { getMe, updateMe, uploadAvatar };
