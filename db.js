// db.js — connexion à la base de données réelle (SQLite via fichier sur disque).
// Pour un plus gros volume de trafic, ce même schéma se porte tel quel vers PostgreSQL/MySQL.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'tilus-tech.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  session TEXT,
  description TEXT,
  techs TEXT,          -- stocké en JSON (tableau de chaînes)
  link TEXT,
  image TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_title TEXT,
  meta_description TEXT
);

INSERT OR IGNORE INTO site_settings (id, site_title, meta_description)
VALUES (1, 'Tilus-Tech — Diagnostic, réparation, mise en ligne',
        'Conception de sites web, installation système et dépannage Windows à distance.');
`);

// Migration douce : ajoute la colonne background_image si elle n'existe pas encore
// (utile si vous mettez à jour une base créée avec une version antérieure du schéma).
const columns = db.prepare("PRAGMA table_info(site_settings)").all().map(c => c.name);
if (!columns.includes('background_image')) {
  db.exec("ALTER TABLE site_settings ADD COLUMN background_image TEXT");
}

module.exports = db;
