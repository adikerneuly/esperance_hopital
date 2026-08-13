const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = ALLOWED_TYPES[file.mimetype] || '';
    cb(null, 'background-' + crypto.randomBytes(8).toString('hex') + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(new Error('Format non pris en charge. Utilisez JPG, PNG ou WEBP.'));
    }
    cb(null, true);
  }
});

router.get('/', (req, res) => {
  const row = db.prepare('SELECT site_title, meta_description, background_image FROM site_settings WHERE id = 1').get();
  res.json(row);
});

router.put('/', requireAdmin, (req, res) => {
  const { site_title, meta_description } = req.body;
  db.prepare('UPDATE site_settings SET site_title = ?, meta_description = ? WHERE id = 1')
    .run((site_title || '').trim(), (meta_description || '').trim());
  const row = db.prepare('SELECT site_title, meta_description, background_image FROM site_settings WHERE id = 1').get();
  res.json(row);
});

router.post('/background', requireAdmin, (req, res) => {
  upload.single('background')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });

    const previous = db.prepare('SELECT background_image FROM site_settings WHERE id = 1').get();
    if (previous?.background_image) {
      const oldPath = path.join(uploadsDir, path.basename(previous.background_image));
      fs.unlink(oldPath, () => {});
    }

    const publicPath = '/uploads/' + req.file.filename;
    db.prepare('UPDATE site_settings SET background_image = ? WHERE id = 1').run(publicPath);
    res.json({ background_image: publicPath });
  });
});

router.delete('/background', requireAdmin, (req, res) => {
  const previous = db.prepare('SELECT background_image FROM site_settings WHERE id = 1').get();
  if (previous?.background_image) {
    const oldPath = path.join(uploadsDir, path.basename(previous.background_image));
    fs.unlink(oldPath, () => {});
  }
  db.prepare('UPDATE site_settings SET background_image = NULL WHERE id = 1').run();
  res.json({ ok: true });
});

module.exports = router;
