// helper - get hash for your password
// visit: /api/setup?password=YOUR_PASSWORD
// copy the hash -> set as ADMIN_PASSWORD_HASH in Vercel env vars
// DELETE this file after use!
const crypto = require('crypto');
module.exports = async function(req, res) {
  const { password } = req.query;
  if (!password) return res.status(400).json({ usage: '/api/setup?password=YOUR_PASSWORD' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return res.status(200).json({ hash, warning: 'Delete this file after use!' });
};
