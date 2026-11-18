const jwt = require('jsonwebtoken')

function secret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 24) throw new Error('JWT_SECRET missing or too short')
  return s
}

function sign(user) {
  return jwt.sign({ uid: user.id, email: user.email }, secret(), { expiresIn: '90d' })
}

function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')
  if (!m) return res.status(401).json({ error: 'unauthenticated' })
  try {
    req.user = jwt.verify(m[1], secret())
    next()
  } catch {
    res.status(401).json({ error: 'unauthenticated' })
  }
}

module.exports = { sign, requireAuth }
