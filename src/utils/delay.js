function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function randomDelay(minMs, maxMs) {
  const delay = randomBetween(minMs, maxMs);
  await sleep(delay);
  return delay;
}

module.exports = {
  sleep,
  randomDelay,
  randomBetween
};
