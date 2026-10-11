const { getPublicHostIp } = require('./config/host');

function getPort() {
  return process.env.PORT || 3030;
}

function baseUrl() {
  return `http://${getPublicHostIp()}:${getPort()}`;
}

let ioRef = null;

function setIo(io) {
  ioRef = io;
}

function broadcastPublicUrl() {
  if (!ioRef) return;
  const url = baseUrl();
  ioRef.emit('ip', url);
}

module.exports = { baseUrl, setIo, broadcastPublicUrl, getPort };
