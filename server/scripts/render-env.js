// Writes ../render-env.txt (gitignored) with the env vars to paste into the Render dashboard.
// Reads the Firestore service account from config/cred.json, so the key never goes through chat or git.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const cred = require('../config/cred.json')

require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString('base64url')
const lines = [
  'NODE_ENV=production',
  `JWT_SECRET=${jwtSecret}`,
  `PROJECT_ID=${cred.project_id}`,
  `PRIVATE_KEY_ID=${cred.private_key_id}`,
  `PRIVATE_KEY=${cred.private_key.replace(/\n/g, '\\n')}`,
  `CLIENT_EMAIL=${cred.client_email}`,
  `CLIENT_ID=${cred.client_id}`,
  `CLIENT_X509_CERT_URL=${cred.client_x509_cert_url}`,
  // Web Push reminders (keys generated once into server/.env) and the secret for the cron URL
  `VAPID_PUBLIC=${process.env.VAPID_PUBLIC}`,
  `VAPID_PRIVATE=${process.env.VAPID_PRIVATE}`,
  `VAPID_SUBJECT=${process.env.VAPID_SUBJECT}`,
  `CRON_SECRET=${process.env.CRON_SECRET}`,
]
const out = path.resolve(__dirname, '../../render-env.txt')
fs.writeFileSync(out, lines.join('\n') + '\n')
console.log('Wrote ' + out + ' (gitignored). Paste into Render > Environment, then delete it.')
