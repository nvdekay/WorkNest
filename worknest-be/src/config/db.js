const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(env.MONGO_URI);
  console.log(`[mongo] connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};

module.exports = connectDB;
