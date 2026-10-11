const path = require('path');

function getDataRoot() {
  if (process.env.REFEREE_DATA_DIR) {
    return process.env.REFEREE_DATA_DIR;
  }
  return path.join(__dirname, '..');
}

function getDatabasePath() {
  const root = getDataRoot();
  if (process.env.REFEREE_DATA_DIR) {
    return path.join(root, 'database');
  }
  return path.join(root, 'db', 'database');
}

module.exports = { getDataRoot, getDatabasePath };
