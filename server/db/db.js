const PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
PouchDB.plugin(require('pouchdb-adapter-memory'));

const { dbInit, dbGet, dbUpdate, dbFind } = require('../helper');

//persistent database
const db = new PouchDB('./db/database');

//clone from database above as in memory cache
const dbMemory = new PouchDB('myDB', { adapter: 'memory' });

db.replicate.to(dbMemory, {
  live: true,
  retry: true,
});

const doc = [
  {
    _id: 'admin',
    name: 'admin',
    role: 'admin',
    password: '$2a$10$f6DCKDU18EwgNWBPnRVqZu6szCqsMQFXw3OQJYlBDQStdcuzqIoUK',
  },
  {
    _id: 'left',
    position: 'left',
    token: '4711',
    role: 'ref',
  },
  {
    _id: 'right',
    position: 'right',
    token: '6969',
    role: 'ref',
  },
  {
    _id: 'main',
    position: 'main',
    token: '6666',
    role: 'ref',
  },
  {
    _id: 'timekeeper',
    position: 'timekeeper',
    token: '7373',
    role: 'ref',
  },
  {
    _id: 'settings',
    refMenu: false,
    autoReset: true,
    autoResetTimer: 20,
    judgeQrOnDisplay: true,
  },
];

async function migrateDB() {
  //check for new timer user
  const timer = await dbFind(db, 'position', 'timekeeper');
  !timer &&
    dbUpdate(db, 'timekeeper', {
      _id: 'timekeeper',
      position: 'timekeeper',
      token: '7373',
      role: 'ref',
    });

  const settings = await dbGet(db, 'settings');
  if (settings && settings.judgeQrOnDisplay === undefined) {
    dbUpdate(db, 'settings', { judgeQrOnDisplay: true });
  }
}

async function prepareDatabase() {
  await dbInit(db, doc);
  await migrateDB();
}

/** Resolves when seed data and migrations have finished (await before token rotation). */
const dbReady = prepareDatabase();

module.exports = { db, dbMemory, dbReady };
