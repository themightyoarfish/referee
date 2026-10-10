const { JUDGE_POSITIONS } = require('./judgeTokens');

/** At most one active socket per judge position (left, main, right). */
const positionBySocket = new Map();
const socketByPosition = new Map();

function registerJudgeSocket(socketId, position) {
  if (!JUDGE_POSITIONS.includes(position)) {
    return { ok: true };
  }

  const holder = socketByPosition.get(position);
  if (holder && holder !== socketId) {
    return { ok: false, reason: 'position_taken', position };
  }

  const previous = positionBySocket.get(socketId);
  if (previous && previous !== position) {
    socketByPosition.delete(previous);
  }

  positionBySocket.set(socketId, position);
  socketByPosition.set(position, socketId);
  return { ok: true, position };
}

function unregisterSocket(socketId) {
  const position = positionBySocket.get(socketId);
  if (position) {
    socketByPosition.delete(position);
  }
  positionBySocket.delete(socketId);
}

function isJudgePosition(position) {
  return JUDGE_POSITIONS.includes(position);
}

module.exports = {
  registerJudgeSocket,
  unregisterSocket,
  isJudgePosition,
};
