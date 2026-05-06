const crypto = require('crypto');
const jwt = require('jsonwebtoken');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'missing_fields' });

  if (email.toLowerCase() !== (process.env.ADMIN_EMAIL || '').toLowerCase())
    return res.status(401).json({ error: 'invalid_credentials' });

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== (process.env.ADMIN_PASSWORD_HASH || ''))
    return res.status(401).json({ error: 'invalid_credentials' });

  const token = jwt.sign(
    { email: email.toLowerCase() },
    process.env.SESSION_SECRET || 'secret',
    { expiresIn: '8h' }
  );

  return res.status(200).json({ success: true, token, expires: Date.now() + 8 * 3600000 });
};
