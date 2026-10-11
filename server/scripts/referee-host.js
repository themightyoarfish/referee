#!/usr/bin/env node
const {
  listLanCandidates,
  findCandidateByInterface,
  findCandidateByAddress,
} = require('../config/host');

const [command, ...args] = require('node:process').argv.slice(2);

function printList() {
  const candidates = listLanCandidates();
  if (process.env.REFEREE_HOST_FORMAT === 'json') {
    console.log(JSON.stringify(candidates, null, 2));
    return;
  }
  for (const c of candidates) {
    console.log(`${c.display}\t${c.address}\t${c.interface}`);
  }
}

function cmdResolve() {
  let iface = null;
  let address = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--interface' && args[i + 1]) {
      iface = args[++i];
    } else if (args[i] === '--address' && args[i + 1]) {
      address = args[++i];
    }
  }
  const candidate =
    (address && findCandidateByAddress(address)) ||
    (iface && findCandidateByInterface(iface));
  if (!candidate) {
    console.error('No matching network address.');
    process.exit(1);
  }
  console.log(candidate.address);
}

switch (command) {
  case 'list':
    printList();
    break;
  case 'resolve':
    cmdResolve();
    break;
  default:
    console.error('Usage: referee-host.js list | resolve --interface NAME | resolve --address IP');
    process.exit(1);
}
