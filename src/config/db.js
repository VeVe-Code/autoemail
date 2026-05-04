const mongoose = require("mongoose");
const env = require("./env");

const globalCache = global;
if (!globalCache.__mongooseConnectPromise) {
  globalCache.__mongooseConnectPromise = null;
}

async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!globalCache.__mongooseConnectPromise) {
    globalCache.__mongooseConnectPromise = mongoose.connect(env.mongodbUri, {
      autoIndex: true
    });
  }

  await globalCache.__mongooseConnectPromise;
  return mongoose.connection;
}

module.exports = {
  connectDb
};
