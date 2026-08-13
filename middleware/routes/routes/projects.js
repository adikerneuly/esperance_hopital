const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return { ...row, techs: row.techs ? JSON.parse(row.techs) : [] };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(rows.map(serialize));
});

router.post('/', requireAdmin, (req, res) => {
  const { title, session, description, techs, link, image } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire.' });
  }
  const stmt = db.prepare(`
    INSERT INTO projects (title, session, description, techs, link, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    title.trim(),
    (session || '').trim(),
    (description || '').trim(),
    JSON.stringify(Array.isArray(techs) ? techs : []),
    (link || '').trim(),
    (image || '').trim()
  );
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serialize(row));
});

router.put('/:id', requireAdmin, (req, res) => {
  const { title, session, description, techs, link, image } = req.body;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Projet introuvable.' });

  db.prepare(`
    UPDATE projects SET title=?, session=?, description=?, techs=?, link=?, image=?
    WHERE id=?
  `).run(
    title?.trim() || existing.title,
    session?.trim() ?? existing.session,
    description?.trim() ?? existing.description,
    JSON.stringify(Array.isArray(techs) ? techs : JSON.parse(existing.techs || '[]')),
    link?.trim() ?? existing.link,
    image?.trim() ?? existing.image,
    req.params.id
  );
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(serialize(row));
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
