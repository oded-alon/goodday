const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const express = require('express')
const { getDb } = require('../services/firestore')
const { sign } = require('../middlewares/auth')
const { validEmail } = require('../services/validate')

const router = express.Router()

// User docs are keyed by a hash of the email: lookups need no query or index.
const userRef = (email) =>
  getDb().collection('goodday_users').doc(crypto.createHash('sha256').update(email).digest('hex').slice(0, 40))

function creds(body) {
  return { email: String(body?.email || '').trim().toLowerCase(), password: String(body?.password || '') }
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = creds(req.body)
    if (!validEmail(email)) return res.status(400).json({ error: 'bad_email' })
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'bad_password' })
    const ref = userRef(email)
    const hash = await bcrypt.hash(password, 10)
    try {
      await ref.create({ email, password: hash, createdAt: Date.now() })
    } catch (e) {
      if (e.code === 6 /* ALREADY_EXISTS */) return res.status(409).json({ error: 'exists' })
      throw e
    }
    const user = { id: ref.id, email }
    res.json({ token: sign(user), user })
  } catch (e) { next(e) }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = creds(req.body)
    const snap = validEmail(email) ? await userRef(email).get() : null
    // Same answer for "no such user" and "wrong password"
    if (!snap?.exists || !(await bcrypt.compare(password, snap.data().password))) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    const user = { id: snap.id, email }
    res.json({ token: sign(user), user })
  } catch (e) { next(e) }
})

module.exports = router
