const assert = require('assert');
const os = require('os');
const host = require('./host');

const original = os.networkInterfaces;

function withInterfaces(fake) {
  os.networkInterfaces = () => fake;
  try {
    return fake;
  } finally {
    // restored after tests
  }
}

function restore() {
  os.networkInterfaces = original;
}

try {
  withInterfaces({
    lo0: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    en0: [
      {
        family: 'IPv4',
        internal: false,
        address: '192.168.1.50',
      },
    ],
  });
  const list = host.listLanCandidates();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].address, '192.168.1.50');

  delete process.env.HOST_IP;
  host.setPublicHostIp('192.168.1.50');
  assert.strictEqual(host.getPublicHostIp(), '192.168.1.50');

  process.env.HOST_IP = '10.0.0.1';
  assert.strictEqual(host.getPublicHostIp(), '10.0.0.1');
  delete process.env.HOST_IP;

  console.log('host.test.js: ok');
} finally {
  restore();
}
