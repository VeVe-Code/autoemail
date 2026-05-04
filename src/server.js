const app = require("./app");
const env = require("./config/env");
const { connectDb } = require("./config/db");

async function start() {
  await connectDb();
  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
