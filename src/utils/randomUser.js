const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

function randomChars(charset, length) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += charset[Math.floor(Math.random() * charset.length)];
  }
  return out;
}

function shuffle(str) {
  const arr = str.split("");
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

function generateRandomUsername({ length = 12, prefix = "" } = {}) {
  const safeLength = Math.max(3, Number(length) || 12);
  const safePrefix = String(prefix || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const randomLen = Math.max(1, safeLength - safePrefix.length);
  const suffix = randomChars(LOWER_ALNUM, randomLen);
  return `${safePrefix}${suffix}`.slice(0, safeLength);
}

function generateRandomPassword({ length = 12 } = {}) {
  const safeLength = Math.max(8, Number(length) || 12);
  const mandatory = [
    randomChars(UPPER, 1),
    randomChars(LOWER, 1),
    randomChars(NUMBERS, 1),
    randomChars(SYMBOLS, 1)
  ].join("");
  const all = UPPER + LOWER + NUMBERS + SYMBOLS;
  const rest = randomChars(all, Math.max(0, safeLength - mandatory.length));
  return shuffle(mandatory + rest);
}

function generateRandomUser({ usernameLength = 12, passwordLength = 12, prefix = "" } = {}) {
  const username = generateRandomUsername({ length: usernameLength, prefix });
  const email = `${username}@example.test`;
  const password = generateRandomPassword({ length: passwordLength });
  return { username, email, password };
}

module.exports = {
  generateRandomUser,
  generateRandomUsername,
  generateRandomPassword
};
