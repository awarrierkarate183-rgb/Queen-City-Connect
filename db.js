require('dotenv').config();
const { createClient } = require('@libsql/client');

let client = null;

function requireClient() {
  if (!client) {
    throw new Error('Database is not initialized. Call initDb() first.');
  }
  return client;
}

function toPlain(row) {
  if (!row) return null;
  const out = {};
  for (const key of Object.keys(row)) {
    if (/^\d+$/.test(key)) continue;
    const value = row[key];
    out[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return out;
}

async function execute(sql, args = []) {
  return requireClient().execute({ sql, args });
}

async function one(sql, args = []) {
  const result = await execute(sql, args);
  return toPlain(result.rows[0]);
}

async function all(sql, args = []) {
  const result = await execute(sql, args);
  return result.rows.map(toPlain);
}

async function run(sql, args = []) {
  const result = await execute(sql, args);
  return {
    lastInsertRowid: result.lastInsertRowid == null ? null : Number(result.lastInsertRowid),
    rowsAffected: Number(result.rowsAffected || 0)
  };
}

async function initDb() {
  const url = (process.env.TURSO_DATABASE_URL || '').trim();
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim();
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in the environment.');
  }

  client = createClient({ url, authToken });

  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS user_state (
      user_id INTEGER PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      method TEXT NOT NULL,
      at TEXT NOT NULL,
      ip TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    )`
  ], 'write');

  return client;
}

module.exports = {
  initDb,
  getClient: requireClient,
  insertUser(name, email, passwordHash, googleId, createdAt) {
    return run(
      'INSERT INTO users (name, email, password_hash, google_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, googleId, createdAt]
    );
  },
  findUserByEmail(email) {
    return one('SELECT * FROM users WHERE email = ?', [email]);
  },
  findUserById(id) {
    return one('SELECT * FROM users WHERE id = ?', [id]);
  },
  findUserByGoogle(googleId) {
    return one('SELECT * FROM users WHERE google_id = ?', [googleId]);
  },
  linkGoogle(googleId, name, userId) {
    return run(
      'UPDATE users SET google_id = ?, name = COALESCE(NULLIF(name, \'\'), ?) WHERE id = ?',
      [googleId, name, userId]
    );
  },
  updateName(name, userId) {
    return run('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
  },
  getState(userId) {
    return one('SELECT state_json FROM user_state WHERE user_id = ?', [userId]);
  },
  upsertState(userId, stateJson, updatedAt) {
    return run(
      `INSERT INTO user_state (user_id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`,
      [userId, stateJson, updatedAt]
    );
  },
  updatePassword(passwordHash, userId) {
    return run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  },
  updateCreatedAt(createdAt, userId) {
    return run('UPDATE users SET created_at = ? WHERE id = ?', [createdAt, userId]);
  },
  listUsers() {
    return all('SELECT id, name, email, password_hash, google_id, created_at FROM users ORDER BY created_at DESC');
  },
  listUserStates() {
    return all('SELECT user_id, state_json FROM user_state');
  },
  insertReset(tokenHash, userId, expires) {
    return run('INSERT INTO password_resets (token_hash, user_id, expires) VALUES (?, ?, ?)', [tokenHash, userId, expires]);
  },
  findReset(tokenHash) {
    return one('SELECT * FROM password_resets WHERE token_hash = ?', [tokenHash]);
  },
  deleteReset(tokenHash) {
    return run('DELETE FROM password_resets WHERE token_hash = ?', [tokenHash]);
  },
  deleteResetsForUser(userId) {
    return run('DELETE FROM password_resets WHERE user_id = ?', [userId]);
  },
  insertLogin(userId, method, at, ip) {
    return run('INSERT INTO login_events (user_id, method, at, ip) VALUES (?, ?, ?, ?)', [userId, method, at, ip]);
  },
  getSession(sid) {
    return one('SELECT sess, expires FROM sessions WHERE sid = ?', [sid]);
  },
  setSession(sid, sess, expires) {
    return run(
      `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`,
      [sid, sess, expires]
    );
  },
  destroySession(sid) {
    return run('DELETE FROM sessions WHERE sid = ?', [sid]);
  },
  touchSession(expires, sid) {
    return run('UPDATE sessions SET expires = ? WHERE sid = ?', [expires, sid]);
  },
  purgeSessions(now) {
    return run('DELETE FROM sessions WHERE expires < ?', [now]);
  }
};
