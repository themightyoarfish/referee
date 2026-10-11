const os = require('os');

/** @type {string | null} */
let memoryOverride = null;

const EXCLUDED_IFACE_PREFIXES = [
  'docker',
  'veth',
  'br-',
  'vmnet',
  'utun',
  'lo',
];

function isPrivateIPv4(address) {
  const parts = address.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function shouldSkipInterface(name) {
  const lower = name.toLowerCase();
  return EXCLUDED_IFACE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function friendlyLabel(ifaceName) {
  if (ifaceName === 'en0') return 'Wi-Fi';
  if (/^en\d+$/.test(ifaceName) && ifaceName !== 'en0') return 'Ethernet';
  if (ifaceName.startsWith('bridge')) return 'Bridge';
  return ifaceName;
}

function listLanCandidates() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [ifaceName, addrs] of Object.entries(nets)) {
    if (shouldSkipInterface(ifaceName) || !addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' && addr.family !== 4) continue;
      if (addr.internal) continue;
      if (!isPrivateIPv4(addr.address)) continue;
      if (addr.address.startsWith('169.254.')) continue;
      candidates.push({
        address: addr.address,
        interface: ifaceName,
        label: friendlyLabel(ifaceName),
        display: `${friendlyLabel(ifaceName)} (${ifaceName}) — ${addr.address}`,
      });
    }
  }

  return candidates;
}

function findCandidateByAddress(address) {
  return listLanCandidates().find((c) => c.address === address);
}

function findCandidateByInterface(iface) {
  return listLanCandidates().find((c) => c.interface === iface);
}

/**
 * Resolve host IP for this process. Throws if ambiguous and unset.
 */
function resolvePublicHostIp() {
  if (process.env.HOST_IP) {
    return process.env.HOST_IP.trim();
  }
  if (memoryOverride) {
    return memoryOverride;
  }
  const candidates = listLanCandidates();
  if (candidates.length === 1) {
    return candidates[0].address;
  }
  if (candidates.length === 0) {
    throw new Error(
      'No local network address found. Connect to Wi-Fi or Ethernet, or set HOST_IP.'
    );
  }
  throw new Error(
    `Multiple local network addresses (${candidates.map((c) => c.address).join(', ')}). ` +
      'Set HOST_IP or start via Referee.app to choose one.'
  );
}

function getPublicHostIp() {
  if (process.env.HOST_IP) {
    return process.env.HOST_IP.trim();
  }
  if (memoryOverride) {
    return memoryOverride;
  }
  return resolvePublicHostIp();
}

function setPublicHostIp(address) {
  const candidate = findCandidateByAddress(address);
  if (!candidate) {
    throw new Error('Address is not on the current local network list.');
  }
  memoryOverride = candidate.address;
  return candidate;
}

function getSelectedHostInfo() {
  const ip = getPublicHostIp();
  const candidate =
    findCandidateByAddress(ip) ||
    listLanCandidates().find((c) => c.address === ip);
  return {
    hostIp: ip,
    interface: candidate?.interface ?? null,
    label: candidate?.label ?? null,
  };
}

module.exports = {
  listLanCandidates,
  findCandidateByAddress,
  findCandidateByInterface,
  resolvePublicHostIp,
  getPublicHostIp,
  setPublicHostIp,
  getSelectedHostInfo,
};
