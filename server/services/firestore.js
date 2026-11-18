const admin = require('firebase-admin')

let db = null

/**
 * Same Firestore project as personal-diary-backend. In production (Render) the
 * service account comes from env vars; locally from config/cred.json (gitignored).
 */
function loadServiceAccount() {
  if (process.env.NODE_ENV === 'production') {
    return {
      type: 'service_account',
      project_id: process.env.PROJECT_ID,
      private_key_id: process.env.PRIVATE_KEY_ID,
      // Render stores multi-line values with literal \n sequences
      private_key: (process.env.PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      client_email: process.env.CLIENT_EMAIL,
      client_id: process.env.CLIENT_ID,
      token_uri: 'https://oauth2.googleapis.com/token',
      client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
    }
  }
  return require('../config/cred.json')
}

function getDb() {
  if (db) return db
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) })
  }
  db = admin.firestore()
  db.settings({ ignoreUndefinedProperties: true })
  return db
}

module.exports = { getDb }
