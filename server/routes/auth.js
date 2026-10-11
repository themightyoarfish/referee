const express = require('express');
const router = express.Router();

const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../const');

const bcrypt = require('bcrypt');

const { dbMemory } = require('../db/db');
const { dbFind, dbGet, getRefTokenFromRequest } = require('../helper');

async function authRefByToken(req, res) {
  const token = getRefTokenFromRequest(req);
  const ref = await dbFind(dbMemory, 'token', token);

  if (!ref) return res.status(401).send({ msg: 'Unauthorized' });
  return res.status(200).send(ref[0]);
}

// auth ref by token (GET query kept for QR deep links)
router.get('/ref', authRefByToken);
router.post('/ref', authRefByToken);

// auth admin
router.post('/admin', async function (req, res) {
  const { user, password } = req.body;
  const adminUser = await dbGet(dbMemory, 'admin');

  if (
    !adminUser?.password ||
    adminUser.bootstrapRequired ||
    !adminUser.name
  ) {
    return res.status(401).send({ mgs: 'Unauthorized' });
  }

  const passCheck = await bcrypt.compare(password, adminUser.password);

  if (user === adminUser.name && passCheck) {
    const token = await jwt.sign(
      {
        user: 'admin',
      },
      getJwtSecret(),
      { expiresIn: '6h' }
    );

    res.header({ 'content-type': 'application/json' });
    return res.status(200).send({ token: token });
  } else {
    return res.status(401).send({ mgs: 'Unauthorized' });
  }
});

// check if a token is still valid (for the client to restore session on reload)
router.get('/check', (req, res) => {
  const token = req?.headers?.authorization?.split(' ')[1];
  try {
    jwt.verify(token, getJwtSecret());
    res.status(200).send({ valid: true });
  } catch (err) {
    res.status(401).send({ valid: false });
  }
});

module.exports = router;
