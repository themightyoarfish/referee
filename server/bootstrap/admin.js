const bcrypt = require('bcrypt');
const crypto = require('crypto');

const saltRounds = 10;

/** Bcrypt hash for the legacy default password "admin" from seed data. */
const LEGACY_ADMIN_BCRYPT =
  '$2a$10$f6DCKDU18EwgNWBPnRVqZu6szCqsMQFXw3OQJYlBDQStdcuzqIoUK';

function credentialsFingerprint(name, password) {
  return crypto
    .createHash('sha256')
    .update(`${name}\0${password}`)
    .digest('hex');
}

async function isLegacyWeakAdmin(adminDoc) {
  if (!adminDoc?.password) return true;
  if (adminDoc.bootstrapRequired) return true;
  if (adminDoc.password === LEGACY_ADMIN_BCRYPT) return true;
  try {
    return await bcrypt.compare('admin', adminDoc.password);
  } catch {
    return false;
  }
}

async function bootstrapAdmin(db, secrets) {
  const adminDoc = await db.get('admin').catch(() => null);
  const meta = await db.get('adminBootstrap').catch(() => null);

  const { adminUser, adminPassword } = secrets;
  if (!adminUser || !adminPassword) {
    if (adminDoc && (await isLegacyWeakAdmin(adminDoc))) {
      return { ok: false, reason: 'bootstrap_required' };
    }
    if (!adminDoc?.password) {
      return { ok: false, reason: 'bootstrap_required' };
    }
    return { ok: true, reason: 'existing_admin' };
  }

  const fingerprint = credentialsFingerprint(adminUser, adminPassword);
  if (meta?.fingerprint === fingerprint && adminDoc?.password) {
    return { ok: true, reason: 'unchanged' };
  }

  const hashPassword = await bcrypt.hash(adminPassword.trim(), saltRounds);
  const payload = {
    _id: 'admin',
    name: adminUser.trim(),
    role: 'admin',
    password: hashPassword,
    bootstrapRequired: false,
  };

  if (adminDoc) {
    payload._rev = adminDoc._rev;
    await db.put(payload);
  } else {
    await db.put(payload);
  }

  const metaPayload = {
    _id: 'adminBootstrap',
    fingerprint,
    updatedAt: new Date().toISOString(),
  };
  if (meta?._rev) metaPayload._rev = meta._rev;
  await db.put(metaPayload);

  return { ok: true, reason: 'bootstrapped' };
}

module.exports = {
  LEGACY_ADMIN_BCRYPT,
  isLegacyWeakAdmin,
  bootstrapAdmin,
};
