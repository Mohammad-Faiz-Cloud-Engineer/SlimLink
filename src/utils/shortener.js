const { nanoid } = require('nanoid');
const db = require('../db/queries');

const CODE_LENGTH = 7;

function generateShortCode() {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = nanoid(CODE_LENGTH);
    if (!db.findLinkByCode(code)) {
      return code;
    }
  }
  throw new Error('Unable to generate unique short code');
}

module.exports = { generateShortCode };
