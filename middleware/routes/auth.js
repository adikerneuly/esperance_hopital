const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' }
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  };
}

router.get('/status', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS n FROM admin_users').get();
  res.json({ initialized: row.n > 0 });
});

router.post('/setup', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const existing = db.prepare('SELECT COUNT(*) AS n FROM admin_users').get();
  if (existing.n > 0) {
    return res.status(403).json({ error: "Un compte administrateur existe déjà." });
  }
  if (!username || !password || password.length < 8) {
    return res.status(400).json({ error: 'Identifiant requis et mot de passe de 8 caractères minimum.' });
  }
  const hash = await bcrypt.hash(password, 12);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  res.cookie('admin_session', token, cookieOptions());
  res.json({ ok: true });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  res.cookie('admin_session', token, cookieOptions());
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

router.post('/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(req.admin.username);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
  }
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(hash, req.admin.username);
  res.json({ ok: true });
});

module.exports = router;
