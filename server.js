require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { updateResources } = require('./scripts/update-resources');
const { sendMail, notifyNewAccount, mailConfigured, NOTIFY_EMAIL } = require('./mail');

const PORT = Number(process.env.PORT) || 8000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'users.db');
const BASE_URL = (process.env.BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET || 'queencityconnect-local-dev';
function readAuthConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'auth-config.json'), 'utf8'));
  } catch {
    return {};
  }
}

const fileAuthConfig = readAuthConfigFile();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || fileAuthConfig.googleClientId || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || fileAuthConfig.googleClientSecret || '').trim();
const googleEnabled = Boolean(GOOGLE_CLIENT_ID);
const googleRedirectEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

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
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS login_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    method TEXT NOT NULL,
    at TEXT NOT NULL,
    ip TEXT,
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
  updateName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  getState: db.prepare('SELECT state_json FROM user_state WHERE user_id = ?'),
  upsertState: db.prepare(`
    INSERT INTO user_state (user_id, state_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `),
  updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  insertReset: db.prepare('INSERT INTO password_resets (token_hash, user_id, expires) VALUES (?, ?, ?)'),
  findReset: db.prepare('SELECT * FROM password_resets WHERE token_hash = ?'),
  deleteReset: db.prepare('DELETE FROM password_resets WHERE token_hash = ?'),
  deleteResetsForUser: db.prepare('DELETE FROM password_resets WHERE user_id = ?'),
  insertLogin: db.prepare('INSERT INTO login_events (user_id, method, at, ip) VALUES (?, ?, ?, ?)')
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
      view: 'list',
      opportunity: 'All'
    },
    recentlyViewed: [],
    submissions: [],
    newsletterEmail: null,
    activity: [],
    bookmarkSnapshots: {}
  };
}

function keyName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function snapshotFromResource(resource, previous) {
  const now = new Date().toISOString();
  return {
    id: Number(resource.id),
    key: keyName(resource.name),
    name: String(resource.name || '').slice(0, 160),
    category: String(resource.category || '').slice(0, 60),
    description: String(resource.description || '').slice(0, 800),
    address: String(resource.address || '').slice(0, 200),
    phone: String(resource.phone || '').slice(0, 80),
    website: String(resource.website || '').slice(0, 300),
    hours: String(resource.hours || '').slice(0, 160),
    opportunities: Array.isArray(resource.opportunities) ? resource.opportunities.map(String).slice(0, 8) : [],
    verified: resource.verified === true,
    savedAt: (previous && previous.savedAt) || now,
    updatedAt: now
  };
}

function sanitizeSnapshots(incoming, bookmarks) {
  const allowed = new Set((bookmarks || []).map(Number));
  const out = {};
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return out;
  Object.keys(incoming).slice(0, 400).forEach((key) => {
    const id = Number(key);
    if (!allowed.has(id)) return;
    const snap = incoming[key];
    if (!snap || typeof snap !== 'object') return;
    out[String(id)] = {
      id,
      key: String(snap.key || keyName(snap.name)).slice(0, 160),
      name: String(snap.name || '').slice(0, 160),
      category: String(snap.category || '').slice(0, 60),
      description: String(snap.description || '').slice(0, 800),
      address: String(snap.address || '').slice(0, 200),
      phone: String(snap.phone || '').slice(0, 80),
      website: String(snap.website || '').slice(0, 300),
      hours: String(snap.hours || '').slice(0, 160),
      opportunities: Array.isArray(snap.opportunities) ? snap.opportunities.map(String).slice(0, 8) : [],
      verified: snap.verified === true,
      savedAt: String(snap.savedAt || new Date().toISOString()),
      updatedAt: String(snap.updatedAt || new Date().toISOString())
    };
  });
  return out;
}

function loadDirectoryResources() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'resources.json'), 'utf8'));
    return Array.isArray(data.resources) ? data.resources : [];
  } catch {
    return [];
  }
}

function remapAccountSaves() {
  const resources = loadDirectoryResources();
  const byId = new Map(resources.map((resource) => [Number(resource.id), resource]));
  const byKey = new Map(resources.map((resource) => [keyName(resource.name), resource]));
  const rows = db.prepare('SELECT user_id, state_json FROM user_state').all();
  rows.forEach((row) => {
    let state;
    try {
      state = { ...defaultState(), ...JSON.parse(row.state_json) };
    } catch {
      return;
    }
    const snaps = state.bookmarkSnapshots || {};
    const nextIds = [];
    const nextSnaps = {};
    (state.bookmarks || []).forEach((rawId) => {
      const id = Number(rawId);
      const snap = snaps[String(id)] || {};
      const live = byId.get(id) || byKey.get(snap.key || keyName(snap.name));
      if (live) {
        nextIds.push(Number(live.id));
        nextSnaps[String(live.id)] = snapshotFromResource(live, snap);
      } else if (snap.name) {
        nextIds.push(id);
        nextSnaps[String(id)] = snap;
      }
    });
    writeState(row.user_id, {
      ...state,
      bookmarks: [...new Set(nextIds)],
      bookmarkSnapshots: nextSnaps
    });
  });
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
      view: prefs.view === 'map' ? 'map' : prefs.view === 'list' ? 'list' : current.hubPrefs.view,
      opportunity: typeof prefs.opportunity === 'string' ? prefs.opportunity.slice(0, 40) : current.hubPrefs.opportunity
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

  if (incoming.bookmarkSnapshots && typeof incoming.bookmarkSnapshots === 'object') {
    next.bookmarkSnapshots = sanitizeSnapshots(incoming.bookmarkSnapshots, next.bookmarks);
  } else if (Array.isArray(incoming.bookmarks)) {
    next.bookmarkSnapshots = sanitizeSnapshots(current.bookmarkSnapshots, next.bookmarks);
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

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function logLoginEvent(req, user, method) {
  try {
    statements.insertLogin.run(
      user.id,
      String(method || 'password').slice(0, 40),
      new Date().toISOString(),
      String((req.headers['x-forwarded-for'] || req.ip || '')).slice(0, 80)
    );
  } catch (err) {
    console.error('Could not log sign-in:', err.message || err);
  }
}

function attachSession(req, user, callback) {
  req.session.regenerate((err) => {
    if (err) return callback(err);
    req.session.userId = user.id;
    req.session.save(callback);
  });
}

function startUserSession(req, res, user, method) {
  logLoginEvent(req, user, method);
  const payload = { user: publicUser(user), state: readState(user.id), ...googlePublicConfig() };
  attachSession(req, user, (err) => {
    if (err) return res.status(500).json({ error: 'Could not start a session. Try again.' });
    res.json(payload);
  });
}

function queueNewAccountEmail(user, method) {
  notifyNewAccount(user, method, BASE_URL).catch((err) => {
    console.error('Welcome email failed:', err.message || err);
  });
}

const app = express();
app.disable('x-powered-by');
if (BASE_URL.startsWith('https://')) {
  app.set('trust proxy', 1);
}
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'qcc.sid',
  secret: SESSION_SECRET,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  store: new SqliteSessionStore(),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: BASE_URL.startsWith('https://'),
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));
app.use(passport.initialize());

function googlePublicConfig() {
  return {
    googleEnabled,
    googleClientId: GOOGLE_CLIENT_ID,
    googleRedirectEnabled
  };
}

function findOrCreateGoogleUser({ googleId, email, name }) {
  let user = statements.findByGoogle.get(googleId);
  if (user) return { user, created: false };
  user = statements.findByEmail.get(email);
  if (user) {
    statements.linkGoogle.run(googleId, name, user.id);
    return { user: statements.findById.get(user.id), created: false };
  }
  return { user: createUser({ name, email, googleId }), created: true };
}

async function verifyGoogleIdToken(credential) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Sign-In is not configured.');
  }
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error('Google Sign-In did not complete.');
  }
  if (String(data.aud) !== GOOGLE_CLIENT_ID) {
    throw new Error('Google Sign-In client does not match this site.');
  }
  if (Number(data.exp) * 1000 < Date.now()) {
    throw new Error('Google Sign-In expired. Try again.');
  }
  if (data.email_verified !== true && data.email_verified !== 'true') {
    throw new Error('Google email is not verified.');
  }
  return {
    googleId: String(data.sub),
    email: normalizeEmail(data.email),
    name: String(data.name || data.given_name || 'Neighbor').slice(0, 80)
  };
}

if (googleRedirectEnabled) {
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
      const { user, created } = findOrCreateGoogleUser({ googleId, email, name });
      if (created) queueNewAccountEmail(user, 'google');
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

app.get('/api/auth/config', (_req, res) => {
  res.json(googlePublicConfig());
});

app.post('/api/auth/google/id-token', async (req, res) => {
  const credential = String((req.body && req.body.credential) || '');
  if (!credential) {
    return res.status(400).json({ error: 'Google sign-in token is missing.' });
  }
  try {
    const profile = await verifyGoogleIdToken(credential);
    const { user, created } = findOrCreateGoogleUser(profile);
    if (created) queueNewAccountEmail(user, 'google');
    startUserSession(req, res, user, 'google');
  } catch (err) {
    res.status(401).json({ error: err.message || 'Google Sign-In did not complete.' });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = statements.findByEmail.get(email);
    const passwordHash = bcrypt.hashSync(password, 10);
    if (existing) {
      if (!existing.password_hash) {
        statements.updatePassword.run(passwordHash, existing.id);
        if (name && name !== existing.name) {
          statements.updateName.run(name, existing.id);
        }
        const user = statements.findById.get(existing.id);
        startUserSession(req, res, user, 'password');
        return;
      }
      return res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
    }

    const user = createUser({ name, email, passwordHash });
    queueNewAccountEmail(user, 'password');
    startUserSession(req, res, user, 'register');
  } catch (err) {
    console.error('Register failed:', err);
    res.status(500).json({ error: 'Could not create account. Try again.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const email = normalizeEmail((req.body && (req.body.email || req.body.username)) || '');
    const password = String((req.body && req.body.password) || '');
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

    startUserSession(req, res, user, 'password');
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Could not sign in. Try again.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('qcc.sid', { path: '/' });
    res.json({ ok: true });
  });
});

app.post('/api/auth/forgot', (req, res) => {
  const generic = {
    ok: true,
    message: 'If that email is on file, we sent a reset link. Check your inbox and spam folder.'
  };
  try {
    const email = normalizeEmail(req.body && req.body.email);
    if (!isValidEmail(email)) return res.json(generic);
    const user = statements.findByEmail.get(email);
    if (!user) return res.json(generic);

    if (!user.password_hash) {
      sendMail({
        to: user.email,
        subject: 'Sign in to QueenCityConnect',
        text: `This QueenCityConnect account uses Google Sign-In. Open ${BASE_URL}/signin.html and choose Continue with Google.\n\nIf you did not ask for this, you can ignore this email.`
      }).catch((err) => console.error('Forgot-password email failed:', err.message || err));
      return res.json(generic);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expires = Date.now() + 60 * 60 * 1000;
    statements.deleteResetsForUser.run(user.id);
    statements.insertReset.run(tokenHash, user.id, expires);
    const link = `${BASE_URL}/reset.html?token=${encodeURIComponent(token)}`;
    sendMail({
      to: user.email,
      subject: 'Reset your QueenCityConnect password',
      text: `Reset your password (this link expires in 1 hour):\n${link}\n\nIf you did not ask for this, ignore this email.`
    }).then((sent) => {
      if (!sent) console.log('[mail skipped] password reset link:', link);
    }).catch((err) => console.error('Forgot-password email failed:', err.message || err));
    res.json(generic);
  } catch (err) {
    console.error('Forgot password failed:', err);
    res.json(generic);
  }
});

app.post('/api/submit', async (req, res) => {
  try {
    const org = (req.body && req.body.organization) || {};
    const person = (req.body && req.body.submitter) || {};
    const name = String(org.name || '').trim();
    const phone = String(org.phone || '').trim();
    const description = String(org.description || '').trim();
    const submitterName = String(person.name || '').trim();
    if (!name || !phone || !description || !submitterName) {
      return res.status(400).json({ error: 'Organization name, phone, description, and your name are required.' });
    }
    const text = [
      'New QueenCityConnect resource submission',
      '',
      `Organization: ${name}`,
      `Category: ${org.category || 'Not provided'}`,
      `Phone: ${phone}`,
      `Website: ${org.website || 'Not provided'}`,
      `Address: ${org.address || 'Not provided'}`,
      `Hours: ${org.hours || 'Not provided'}`,
      `Service area: ${org.serviceArea || 'Not provided'}`,
      '',
      description,
      '',
      `Submitted by: ${submitterName}`,
      `Submitter email: ${person.email || 'Not provided'}`,
      `Connection: ${person.role || 'Not provided'}`,
      `Time: ${new Date().toISOString()}`
    ].join('\n');
    const sent = await sendMail({
      to: NOTIFY_EMAIL,
      subject: `New QueenCityConnect resource: ${name}`.slice(0, 120),
      text
    });
    const submitterEmail = normalizeEmail(person.email);
    if (submitterEmail && isValidEmail(submitterEmail)) {
      await sendMail({
        to: submitterEmail,
        subject: 'We received your QueenCityConnect submission',
        text: `Hi ${submitterName},\n\nWe received your listing for ${name}. Our team will review it before it goes live.\n\n— QueenCityConnect`
      });
    }
    if (!sent) {
      return res.status(503).json({ error: 'Email is not configured on the server yet.', fallback: true });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Resource submission email failed:', err);
    res.status(500).json({ error: 'Could not send the submission.', fallback: true });
  }
});

app.post('/api/auth/reset', (req, res) => {
  try {
    const token = String((req.body && req.body.token) || '');
    const password = String((req.body && req.body.password) || '');
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const row = statements.findReset.get(hashToken(token));
    if (!row || Number(row.expires) < Date.now()) {
      return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    statements.updatePassword.run(passwordHash, row.user_id);
    statements.deleteResetsForUser.run(row.user_id);
    const user = statements.findById.get(row.user_id);
    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
    }
    startUserSession(req, res, user, 'reset');
  } catch (err) {
    console.error('Password reset failed:', err);
    res.status(500).json({ error: 'Could not reset password. Try again.' });
  }
});

app.get('/api/auth/google', (req, res, next) => {
  if (!googleRedirectEnabled) {
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
  if (!googleRedirectEnabled) {
    return res.redirect('/signin.html?error=google-setup');
  }
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect('/signin.html?error=google');
    }
    const nextUrl = req.session.afterLogin || '/saved.html';
    delete req.session.afterLogin;
    const safeNext = String(nextUrl).startsWith('/') ? nextUrl : '/saved.html';
    logLoginEvent(req, user, 'google');
    attachSession(req, user, (sessionErr) => {
      if (sessionErr) return res.redirect('/signin.html?error=google');
      res.redirect(safeNext);
    });
  })(req, res, next);
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null, state: null, ...googlePublicConfig() });
  }
  const user = statements.findById.get(req.session.userId);
  if (!user) {
    req.session.userId = null;
    return res.json({ user: null, state: null, ...googlePublicConfig() });
  }
  res.json({
    user: publicUser(user),
    state: readState(user.id),
    ...googlePublicConfig()
  });
});

function saveUserState(req, res) {
  const current = readState(req.currentUser.id);
  const next = sanitizeStatePatch(req.body || {}, current);
  writeState(req.currentUser.id, next);
  res.json({ user: publicUser(req.currentUser), state: next, ...googlePublicConfig() });
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
    const meta = await updateResources({ geocode: false });
    try {
      remapAccountSaves();
    } catch (err) {
      console.error('Could not refresh saved listings:', err.message || err);
    }
    return meta;
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
    console.log('Google Sign-In is off until GOOGLE_CLIENT_ID is set in .env or data/auth-config.json');
  }
  if (!mailConfigured()) {
    console.log('Account emails are off until GMAIL_USER and GMAIL_APP_PASSWORD are set in .env');
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
