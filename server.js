require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { updateResources } = require('./scripts/update-resources');

const PORT = Number(process.env.PORT) || 8000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'users.db');
const BASE_URL = (process.env.BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET || 'queencityconnect-local-dev';
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_state (
    user_id INTEGER PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const statements = {
  insertUser: db.prepare(`
    INSERT INTO users (name, email, password_hash, google_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  findByGoogle: db.prepare('SELECT * FROM users WHERE google_id = ?'),
  linkGoogle: db.prepare('UPDATE users SET google_id = ?, name = COALESCE(NULLIF(name, \'\'), ?) WHERE id = ?'),
  getState: db.prepare('SELECT state_json FROM user_state WHERE user_id = ?'),
  upsertState: db.prepare(`
    INSERT INTO user_state (user_id, state_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `)
};

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
`);

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this._get = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
    this._set = db.prepare(`
      INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
    `);
    this._destroy = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._touch = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this._purge = db.prepare('DELETE FROM sessions WHERE expires < ?');
  }

  get(sid, callback) {
    try {
      this._purge.run(Date.now());
      const row = this._get.get(sid);
      if (!row) return callback(null, undefined);
      if (Number(row.expires) < Date.now()) {
        this._destroy.run(sid);
        return callback(null, undefined);
      }
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) || 1000 * 60 * 60 * 24 * 30;
      const expires = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + maxAge;
      this._set.run(sid, JSON.stringify(sess), expires);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this._destroy.run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sess, callback) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) || 1000 * 60 * 60 * 24 * 30;
      const expires = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + maxAge;
      this._touch.run(expires, sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

function defaultState() {
  return {
    bookmarks: [],
    hubPrefs: {
      categories: ['All'],
      search: '',
      hours: 'All',
      sort: 'default',
      view: 'list'
    },
    recentlyViewed: [],
    submissions: [],
    newsletterEmail: null,
    activity: []
  };
}

function readState(userId) {
  const row = statements.getState.get(userId);
  if (!row) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(row.state_json) };
  } catch {
    return defaultState();
  }
}

function writeState(userId, state) {
  statements.upsertState.run(userId, JSON.stringify(state), new Date().toISOString());
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    hasGoogle: Boolean(user.google_id),
    hasPassword: Boolean(user.password_hash)
  };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  const user = statements.findById.get(req.session.userId);
  if (!user) {
    req.session.userId = null;
    return res.status(401).json({ error: 'Sign in required.' });
  }
  req.currentUser = user;
  next();
}

function mergeBookmarks(a, b) {
  return [...new Set([...(a || []), ...(b || [])].map(Number).filter((n) => Number.isFinite(n) && n > 0))];
}

function sanitizeStatePatch(incoming, current) {
  const next = {
    ...defaultState(),
    ...current
  };

  if (Array.isArray(incoming.bookmarks)) {
    next.bookmarks = mergeBookmarks(incoming.mergeBookmarks ? current.bookmarks : [], incoming.bookmarks);
    if (!incoming.mergeBookmarks) {
      next.bookmarks = mergeBookmarks([], incoming.bookmarks);
    }
  }

  if (incoming.hubPrefs && typeof incoming.hubPrefs === 'object') {
    const prefs = incoming.hubPrefs;
    next.hubPrefs = {
      categories: Array.isArray(prefs.categories) && prefs.categories.length
        ? prefs.categories.map(String).slice(0, 20)
        : current.hubPrefs.categories,
      search: typeof prefs.search === 'string' ? prefs.search.slice(0, 120) : current.hubPrefs.search,
      hours: typeof prefs.hours === 'string' ? prefs.hours : current.hubPrefs.hours,
      sort: typeof prefs.sort === 'string' ? prefs.sort : current.hubPrefs.sort,
      view: prefs.view === 'map' ? 'map' : prefs.view === 'list' ? 'list' : current.hubPrefs.view
    };
  }

  if (Array.isArray(incoming.recentlyViewed)) {
    next.recentlyViewed = incoming.recentlyViewed
      .filter((item) => item && Number.isFinite(Number(item.id)))
      .slice(0, 50)
      .map((item) => ({
        id: Number(item.id),
        at: String(item.at || new Date().toISOString())
      }));
  }

  if (Array.isArray(incoming.submissions)) {
    next.submissions = incoming.submissions.slice(-100);
  }

  if (incoming.newsletterEmail !== undefined) {
    const email = incoming.newsletterEmail ? normalizeEmail(incoming.newsletterEmail) : null;
    next.newsletterEmail = email && isValidEmail(email) ? email : null;
  }

  if (Array.isArray(incoming.activity)) {
    next.activity = incoming.activity.slice(-200).map((item) => ({
      type: String(item.type || 'view').slice(0, 40),
      resourceId: item.resourceId == null ? null : Number(item.resourceId),
      at: String(item.at || new Date().toISOString())
    }));
  }

  return next;
}

function createUser({ name, email, passwordHash, googleId }) {
  const info = statements.insertUser.run(
    String(name || 'Neighbor').trim().slice(0, 80) || 'Neighbor',
    email,
    passwordHash || null,
    googleId || null,
    new Date().toISOString()
  );
  const user = statements.findById.get(Number(info.lastInsertRowid));
  writeState(user.id, defaultState());
  return user;
}

function startUserSession(req, res, user) {
  const payload = { user: publicUser(user), state: readState(user.id), googleEnabled };
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not start a session. Try again.' });
    req.session.userId = user.id;
    req.session.save((saveErr) => {
      if (saveErr) return res.status(500).json({ error: 'Could not save your session. Try again.' });
      res.json(payload);
    });
  });
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'qcc.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new SqliteSessionStore(),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));
app.use(passport.initialize());

if (googleEnabled) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE_URL}/api/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = normalizeEmail(
        (profile.emails && profile.emails[0] && profile.emails[0].value) || `${googleId}@google.local`
      );
      const name = (profile.displayName || 'Neighbor').slice(0, 80);
      let user = statements.findByGoogle.get(googleId);
      if (!user) {
        user = statements.findByEmail.get(email);
        if (user) {
          statements.linkGoogle.run(googleId, name, user.id);
          user = statements.findById.get(user.id);
        } else {
          user = createUser({ name, email, googleId });
        }
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

app.get('/api/auth/config', (_req, res) => {
  res.json({ googleEnabled });
});

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  if (statements.findByEmail.get(email)) {
    return res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUser({ name, email, passwordHash });
  startUserSession(req, res, user);
});

app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const user = statements.findByEmail.get(email);

  if (!user) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (!user.password_hash) {
    return res.status(401).json({ error: 'This account uses Google. Continue with Google instead.' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  startUserSession(req, res, user);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('qcc.sid', { path: '/' });
    res.json({ ok: true });
  });
});

app.get('/api/auth/google', (req, res, next) => {
  if (!googleEnabled) {
    return res.redirect('/signin.html?error=google-setup');
  }
  if (req.query.next) {
    req.session.afterLogin = String(req.query.next);
  }
  req.session.save((err) => {
    if (err) return next(err);
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false
    })(req, res, next);
  });
});

app.get('/api/auth/google/callback', (req, res, next) => {
  if (!googleEnabled) {
    return res.redirect('/signin.html?error=google-setup');
  }
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect('/signin.html?error=google');
    }
    const nextUrl = req.session.afterLogin || '/hub.html';
    delete req.session.afterLogin;
    const safeNext = String(nextUrl).startsWith('/') ? nextUrl : '/hub.html';
    req.session.regenerate((regenErr) => {
      if (regenErr) return res.redirect('/signin.html?error=google');
      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) return res.redirect('/signin.html?error=google');
        res.redirect(safeNext);
      });
    });
  })(req, res, next);
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    user: publicUser(req.currentUser),
    state: readState(req.currentUser.id),
    googleEnabled
  });
});

function saveUserState(req, res) {
  const current = readState(req.currentUser.id);
  const next = sanitizeStatePatch(req.body || {}, current);
  writeState(req.currentUser.id, next);
  res.json({ user: publicUser(req.currentUser), state: next, googleEnabled });
}

app.put('/api/me/state', requireAuth, saveUserState);
app.post('/api/me/state', requireAuth, saveUserState);

const META_PATH = path.join(DATA_DIR, 'resources-meta.json');
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
let directoryRefreshing = false;

function readDirectoryMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  } catch {
    return { lastUpdated: null, count: 0, nextUpdateDays: 14, source: 'curated-only' };
  }
}

async function refreshDirectoryIfStale(force) {
  const meta = readDirectoryMeta();
  const last = Date.parse(meta.lastUpdated || 0) || 0;
  const lastTry = Date.parse(meta.lastAttempt || 0) || 0;
  const hasLive = meta.source && meta.source !== 'curated-only';
  if (!force) {
    if (hasLive && last && Date.now() - last < TWO_WEEKS_MS) return meta;
    if (!hasLive && lastTry && Date.now() - lastTry < 60 * 60 * 1000) return meta;
  }
  if (directoryRefreshing) return meta;
  directoryRefreshing = true;
  try {
    return await updateResources({ geocode: false });
  } catch (err) {
    console.error('Directory refresh failed:', err.message || err);
    return meta;
  } finally {
    directoryRefreshing = false;
  }
}

app.get('/api/resources/meta', (_req, res) => {
  res.json(readDirectoryMeta());
});

app.use(express.static(ROOT, {
  extensions: ['html'],
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`QueenCityConnect running at http://127.0.0.1:${PORT}`);
  if (!googleEnabled) {
    console.log('Google Sign-In is off until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env');
  }
  setTimeout(() => {
    refreshDirectoryIfStale(false).then((meta) => {
      if (meta && meta.count) console.log(`Resource directory: ${meta.count} listings (${meta.source})`);
    }).catch(() => {});
  }, 4000);
  setInterval(() => {
    refreshDirectoryIfStale(false).catch(() => {});
  }, 6 * 60 * 60 * 1000);
});
