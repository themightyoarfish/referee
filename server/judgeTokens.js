const crypto = require('crypto');

const { db, dbMemory, dbReady } = require('./db/db');

const JUDGE_POSITIONS = ['left', 'main', 'right'];

function randomToken() {
  return crypto.randomBytes(4).toString('hex');
}

async function putTokenOnDb(database, position, token) {
  try {
    const doc = await database.get(position);
    doc.token = token;
    await database.put(doc);
    return true;
  } catch (err) {
    if (err.status !== 404) {
      console.error(`Failed to update ${position} token:`, err);
    }
    return false;
  }
}

/** New random secrets for the three judge roles on each server start. */
async function rotateJudgeTokens() {
  await dbReady;

  for (const position of JUDGE_POSITIONS) {
    const token = randomToken();
    await putTokenOnDb(db, position, token);
    await putTokenOnDb(dbMemory, position, token);
  }

  console.log(
    'Judge referee tokens rotated for this session (8-char hex per judge)'
  );
}

async function getJudgeRefUrls(baseUrl) {
  const urls = {};
  for (const position of JUDGE_POSITIONS) {
    try {
      const doc = await db.get(position);
      if (doc?.token) {
        urls[position] = `${baseUrl}/ref?token=${doc.token}`;
      }
    } catch {
      // missing judge doc
    }
  }
  return urls;
}

module.exports = { rotateJudgeTokens, getJudgeRefUrls, JUDGE_POSITIONS };
