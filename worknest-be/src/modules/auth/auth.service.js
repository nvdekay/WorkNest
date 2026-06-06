// TODO: implement vòng đời JWT, blacklist refresh token theo jti, bcrypt cost 12.

const register = async (_payload) => {
  throw new Error('auth.service.register not implemented');
};

const login = async (_payload) => {
  throw new Error('auth.service.login not implemented');
};

const refresh = async (_refreshToken) => {
  throw new Error('auth.service.refresh not implemented');
};

const logout = async (_refreshToken) => {
  throw new Error('auth.service.logout not implemented');
};

const me = async (_userId) => {
  throw new Error('auth.service.me not implemented');
};

const changePassword = async (_userId, _payload) => {
  throw new Error('auth.service.changePassword not implemented');
};

module.exports = { register, login, refresh, logout, me, changePassword };
