const { randomUUID } = require("crypto");

const FIRST_NAMES = [
  "alex",
  "sam",
  "jordan",
  "taylor",
  "riley",
  "casey",
  "morgan",
  "jamie"
];

const LAST_NAMES = [
  "walker",
  "cooper",
  "reed",
  "hayes",
  "turner",
  "morris",
  "foster",
  "brooks"
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generatePassword() {
  const token = randomUUID().replace(/-/g, "").slice(0, 10);
  return `Test!${token}A1`;
}

function generateRandomUser() {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const suffix = Date.now().toString().slice(-6);
  const username = `${first}${last}${suffix}`;
  const email = `${username}@example.test`;
  const password = generatePassword();

  return {
    firstName: first,
    lastName: last,
    username,
    email,
    password
  };
}

module.exports = {
  generateRandomUser
};
