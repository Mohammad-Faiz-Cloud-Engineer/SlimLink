const db = require('../db/queries');
const nodeCrypto = require('crypto');

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = nodeCrypto.webcrypto;
}

const CODE_LENGTH = 7;
const nanoidPromise = import('nanoid').then(m => m.nanoid);

async function generateShortCode() {
  const nanoid = await nanoidPromise;
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = nanoid(CODE_LENGTH);
    if (!db.findLinkByCode(code)) {
      return code;
    }
  }
  throw new Error('Unable to generate unique short code');
}

module.exports = { generateShortCode };
