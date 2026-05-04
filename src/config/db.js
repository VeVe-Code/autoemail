const mongoose = require("mongoose");
const env = require("./env");

async function connectDb() {
  await mongoose.connect(env.mongodbUri, {
    autoIndex: true
  });
}

module.exports = {
  connectDb
};
