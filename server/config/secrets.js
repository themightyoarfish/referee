const { execFileSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const KEYCHAIN_SERVICE = 'de.referee.app';
const ACCOUNTS = {
  jwt: 'jwt-secret',
  adminUser: 'admin-username',
  adminPassword: 'admin-password',
};

let loaded = null;
let warnedEnvSecrets = false;

function useKeychain() {
  if (process.env.REFEREE_SECRETS === 'keychain') return true;
  if (process.env.REFEREE_USE_KEYCHAIN === 'true') return true;
  if (process.env.REFEREE_APP_BUNDLE) return true;
  return false;
}

function keychainGet(account) {
  if (process.platform !== 'darwin') return null;
  try {
    return execFileSync(
      'security',
      [
        'find-generic-password',
        '-s',
        KEYCHAIN_SERVICE,
        '-a',
        account,
        '-w',
      ],
      { encoding: 'utf8' }
    ).trim();
  } catch {
    return null;
  }
}

function warnEnvSecretsOnce() {
  if (warnedEnvSecrets) return;
  if (process.env.SECRET || process.env.ADMIN_PASSWORD) {
    console.warn(
      'Referee: SECRET/ADMIN_* from environment are visible to other processes on this machine. Prefer Keychain (Referee.app) in production.'
    );
  }
  warnedEnvSecrets = true;
}

async function loadSecrets() {
  if (loaded) return loaded;

  let jwtSecret = null;
  let adminUser = null;
  let adminPassword = null;
  let source = 'none';

  if (useKeychain() && process.platform === 'darwin') {
    jwtSecret = keychainGet(ACCOUNTS.jwt);
    adminUser = keychainGet(ACCOUNTS.adminUser);
    adminPassword = keychainGet(ACCOUNTS.adminPassword);
    if (jwtSecret || adminUser || adminPassword) {
      source = 'keychain';
    }
  }

  if (!jwtSecret && process.env.SECRET) {
    warnEnvSecretsOnce();
    jwtSecret = process.env.SECRET;
    source = 'env';
  }
  if (!adminUser && process.env.ADMIN_USER) {
    adminUser = process.env.ADMIN_USER;
  }
  if (!adminPassword && process.env.ADMIN_PASSWORD) {
    warnEnvSecretsOnce();
    adminPassword = process.env.ADMIN_PASSWORD;
  }

  if (!jwtSecret) {
    jwtSecret = uuidv4();
    if (source === 'none') source = 'ephemeral';
  }

  loaded = {
    jwtSecret,
    adminUser: adminUser || null,
    adminPassword: adminPassword || null,
    source,
  };
  return loaded;
}

function getLoadedSecrets() {
  if (!loaded) {
    throw new Error('loadSecrets() must be called before getLoadedSecrets()');
  }
  return loaded;
}

module.exports = {
  KEYCHAIN_SERVICE,
  ACCOUNTS,
  loadSecrets,
  getLoadedSecrets,
  useKeychain,
};
