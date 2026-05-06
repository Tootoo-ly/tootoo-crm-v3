const { Redis } = require('@upstash/redis');
const jwt = require('jsonwebtoken');

const KEY = 'tootoo:contacts';

function auth(req) {
  try {
    const h = req.headers.authorization || '';
    if (h === 'Bearer public') return { public: true };
    return jwt.verify(h.replace('Bearer ', ''), process.env.SESSION_SECRET || 'secret');
  } catch(e) { return null; }
}

function redis() {
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = auth(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (user.public && req.method !== 'POST') return res.status(401).json({ error: 'unauthorized' });

  const db = redis();

  if (req.method === 'GET') {
    const contacts = await db.get(KEY) || [];
    return res.status(200).json({ contacts });
  }

  if (req.method === 'POST') {
    const contacts = await db.get(KEY) || [];
    const contact = { ...req.body, id: Date.now(), createdAt: Date.now() };
    contacts.push(contact);
    await db.set(KEY, contacts);
    return res.status(200).json({ success: true, contact });
  }

  if (req.method === 'PUT') {
    const contacts = await db.get(KEY) || [];
    const i = contacts.findIndex(c => c.id === req.body.id);
    if (i >= 0) contacts[i] = { ...contacts[i], ...req.body };
    await db.set(KEY, contacts);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    let contacts = await db.get(KEY) || [];
    contacts = contacts.filter(c => c.id !== req.body.id);
    await db.set(KEY, contacts);
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
