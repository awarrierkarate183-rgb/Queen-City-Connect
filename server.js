require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { updateResources } = require('./scripts/update-resources');
const { sendMail, notifyNewAccount, mailConfigured, NOTIFY_EMAIL } = require('./mail');
const db = require('./db');

const PORT = Number(process.env.PORT) || 8000;
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const BASE_URL = (process.env.BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
const isProd = process.env.NODE_ENV === 'production' || BASE_URL.startsWith('https://');
const SESSION_SECRET = (process.env.SESSION_SECRET || '').trim() || (isProd ? '' : crypto.randomBytes(32).toString('hex'));
if (!SESSION_SECRET) {
  console.error('SESSION_SECRET must be set in the environment for production.');
  process.exit(1);
}
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const ALLOWED_ORIGINS = String(
  process.env.CORS_ORIGINS ||
  'https://queencityconnect.org,https://www.queencityconnect.org,http://127.0.0.1:8000,http://localhost:8000'
).split(',').map((item) => item.trim()).filter(Boolean);

function readAuthConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'auth-config.json'), 'utf8'));
  } catch {
    try {
      return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'auth-config.json'), 'utf8'));
    } catch {
      return {};
    }
  }
}

const fileAuthConfig = readAuthConfigFile();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || fileAuthConfig.googleClientId || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const googleEnabled = Boolean(GOOGLE_CLIENT_ID);
const googleRedirectEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const LOCAL_HASH_PREFIX = 'local-v1$';

fs.mkdirSync(DATA_DIR, { recursive: true });

class TursoSessionStore extends session.Store {
  get(sid, callback) {
    db.purgeSessions(Date.now())
      .then(() => db.getSession(sid))
      .then((row) => {
        if (!row) return callback(null, undefined);
        if (Number(row.expires) < Date.now()) {
          return db.destroySession(sid).then(() => callback(null, undefined));
        }
        callback(null, JSON.parse(row.sess));
      })
      .catch(callback);
  }

  set(sid, sess, callback) {
    const maxAge = (sess.cookie && sess.cookie.maxAge) || 1000 * 60 * 60 * 24 * 30;
    const expires = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).getTime()
      : Date.now() + maxAge;
    db.setSession(sid, JSON.stringify(sess), expires)
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(sid, callback) {
    db.destroySession(sid)
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sid, sess, callback) {
    const maxAge = (sess.cookie && sess.cookie.maxAge) || 1000 * 60 * 60 * 24 * 30;
    const expires = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).getTime()
      : Date.now() + maxAge;
    db.touchSession(expires, sid)
      .then(() => callback(null))
      .catch(callback);
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
      description: String(resource.description || '').slice(0, 2000),
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
  const candidates = [
    path.join(DATA_DIR, 'resources.json'),
    path.join(ROOT, 'data', 'resources.json')
  ];
  for (const file of candidates) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data.resources)) return data.resources;
    } catch {
      /* try the next known path */
    }
  }
  return [];
}

async function remapAccountSaves() {
  const resources = loadDirectoryResources();
  const byId = new Map(resources.map((resource) => [Number(resource.id), resource]));
  const byKey = new Map(resources.map((resource) => [keyName(resource.name), resource]));
  const rows = await db.listUserStates();
  for (const row of rows) {
    let state;
    try {
      state = { ...defaultState(), ...JSON.parse(row.state_json) };
    } catch {
      continue;
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
    await writeState(row.user_id, {
      ...state,
      bookmarks: [...new Set(nextIds)],
      bookmarkSnapshots: nextSnaps
    });
  }
}

async function readState(userId) {
  const row = await db.getState(userId);
  if (!row) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(row.state_json) };
  } catch {
    return defaultState();
  }
}

async function writeState(userId, state) {
  await db.upsertState(userId, JSON.stringify(state), new Date().toISOString());
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function encodeLocalPassword(salt, hash) {
  return LOCAL_HASH_PREFIX + String(salt || '') + '$' + String(hash || '');
}

function parseLocalPassword(stored) {
  const value = String(stored || '');
  if (!value.startsWith(LOCAL_HASH_PREFIX)) return null;
  const rest = value.slice(LOCAL_HASH_PREFIX.length);
  const index = rest.indexOf('$');
  if (index < 0) return null;
  return { salt: rest.slice(0, index), hash: rest.slice(index + 1) };
}

function passwordsMatch(password, stored) {
  const local = parseLocalPassword(stored);
  if (local) {
    const guess = crypto.createHash('sha256').update(local.salt + '\n' + password).digest('hex');
    return guess === local.hash;
  }
  try {
    return bcrypt.compareSync(password, stored);
  } catch {
    return false;
  }
}

function secretsEqual(given, expected) {
  if (!expected) return false;
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

const rateBuckets = new Map();

function clientIp(req) {
  return String((req.headers['x-forwarded-for'] || req.ip || '')).split(',')[0].trim() || 'unknown';
}

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const fresh = (rateBuckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (fresh.length >= limit) {
    rateBuckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  rateBuckets.set(key, fresh);
  return true;
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

async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  try {
    const user = await db.findUserById(req.session.userId);
    if (!user) {
      req.session.userId = null;
      return res.status(401).json({ error: 'Sign in required.' });
    }
    req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
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

function mergeAccountState(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return current;
  const submissions = [...(current.submissions || []), ...(Array.isArray(incoming.submissions) ? incoming.submissions : [])];
  const activity = [...(current.activity || []), ...(Array.isArray(incoming.activity) ? incoming.activity : [])];
  return sanitizeStatePatch({
    mergeBookmarks: true,
    bookmarks: Array.isArray(incoming.bookmarks) ? incoming.bookmarks : undefined,
    hubPrefs: incoming.hubPrefs,
    recentlyViewed: incoming.recentlyViewed,
    submissions,
    newsletterEmail: incoming.newsletterEmail,
    activity,
    bookmarkSnapshots: {
      ...(current.bookmarkSnapshots || {}),
      ...(incoming.bookmarkSnapshots && typeof incoming.bookmarkSnapshots === 'object' ? incoming.bookmarkSnapshots : {})
    }
  }, current);
}

async function createUser({ name, email, passwordHash, googleId, createdAt }) {
  const when = createdAt && !Number.isNaN(Date.parse(createdAt))
    ? new Date(createdAt).toISOString()
    : new Date().toISOString();
  const info = await db.insertUser(
    String(name || 'Neighbor').trim().slice(0, 80) || 'Neighbor',
    email,
    passwordHash || null,
    googleId || null,
    when
  );
  const user = await db.findUserById(Number(info.lastInsertRowid));
  await writeState(user.id, defaultState());
  return user;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function logLoginEvent(req, user, method) {
  try {
    await db.insertLogin(
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

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  const parts = header.split(';');
  for (const part of parts) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return part.slice(index + 1).trim();
    }
  }
  return '';
}

function safeNextPath(value) {
  let raw = String(value || '/saved.html').trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  if (!raw || raw.includes('://') || raw.includes('\\') || raw.startsWith('//')) {
    return '/saved.html';
  }
  if (!raw.startsWith('/')) raw = '/' + raw.replace(/^\//, '');
  return raw;
}

function wantsHtmlRedirect(req) {
  const type = String(req.headers['content-type'] || '');
  return type.includes('application/x-www-form-urlencoded') || String(req.query.redirect || '') === '1';
}

async function startUserSession(req, res, user, method, redirectTo) {
  await logLoginEvent(req, user, method);
  if (redirectTo) {
    attachSession(req, user, (err) => {
      if (err) return res.redirect('/signin.html?error=google');
      res.redirect(redirectTo);
    });
    return;
  }
  const payload = { user: publicUser(user), state: await readState(user.id), ...googlePublicConfig() };
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
const behindHttps = isProd || BASE_URL.startsWith('https://');
if (behindHttps) {
  app.set('trust proxy', 1);
}
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'qcc.sid',
  secret: SESSION_SECRET,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  proxy: behindHttps,
  store: new TursoSessionStore(),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: behindHttps,
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

async function findOrCreateGoogleUser({ googleId, email, name }) {
  let user = await db.findUserByGoogle(googleId);
  if (user) return { user, created: false };
  user = await db.findUserByEmail(email);
  if (user) {
    await db.linkGoogle(googleId, name, user.id);
    return { user: await db.findUserById(user.id), created: false };
  }
  return { user: await createUser({ name, email, googleId }), created: true };
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
    const googleId = profile.id;
    const email = normalizeEmail(
      (profile.emails && profile.emails[0] && profile.emails[0].value) || `${googleId}@google.local`
    );
    const name = (profile.displayName || 'Neighbor').slice(0, 80);
    findOrCreateGoogleUser({ googleId, email, name })
      .then(({ user, created }) => {
        if (created) queueNewAccountEmail(user, 'google');
        done(null, user);
      })
      .catch(done);
  }));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/config', (_req, res) => {
  res.json(googlePublicConfig());
});

app.post('/api/auth/migrate-local', async (req, res) => {
  if (!rateLimit('migrate:' + clientIp(req), 20, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many migration attempts. Try again later.' });
  }
  const incoming = Array.isArray(req.body && req.body.accounts) ? req.body.accounts : [];
  if (!incoming.length) {
    return res.json({ ok: true, created: 0, merged: 0, skipped: 0, results: [] });
  }
  if (incoming.length > 25) {
    return res.status(400).json({ error: 'Too many accounts in one request.' });
  }

  const results = [];
  let created = 0;
  let merged = 0;
  let skipped = 0;

  for (const raw of incoming) {
    const email = normalizeEmail(raw && raw.email);
    try {
      const name = String((raw && raw.name) || 'Neighbor').trim().slice(0, 80) || 'Neighbor';
      const googleSub = String((raw && (raw.googleSub || raw.google_id)) || '').trim();
      const passwordHash = String((raw && raw.passwordHash) || '').trim();
      const salt = String((raw && raw.salt) || '');
      const createdAt = String((raw && raw.createdAt) || '');
      if (!isValidEmail(email)) {
        skipped += 1;
        results.push({ email, status: 'skipped', reason: 'invalid-email' });
        continue;
      }
      if (!googleSub && (!passwordHash || !salt)) {
        skipped += 1;
        results.push({ email, status: 'skipped', reason: 'missing-credentials' });
        continue;
      }

      let user = googleSub ? await db.findUserByGoogle(googleSub) : null;
      if (!user) user = await db.findUserByEmail(email);
      const encoded = passwordHash && salt ? encodeLocalPassword(salt, passwordHash) : null;

      if (user) {
        if (googleSub && !user.google_id) {
          const taken = await db.findUserByGoogle(googleSub);
          if (!taken) await db.linkGoogle(googleSub, name, user.id);
        } else if (name && user.name === 'Neighbor' && name !== user.name) {
          await db.updateName(name, user.id);
        }
        if (encoded && !user.password_hash) {
          await db.updatePassword(encoded, user.id);
        }
        if (createdAt && !Number.isNaN(Date.parse(createdAt))) {
          const incomingTime = Date.parse(createdAt);
          const existingTime = Date.parse(user.created_at || '') || Date.now();
          if (incomingTime < existingTime) {
            await db.updateCreatedAt(new Date(incomingTime).toISOString(), user.id);
          }
        }
        await writeState(user.id, mergeAccountState(await readState(user.id), raw && raw.state));
        merged += 1;
        results.push({ email, status: 'merged' });
        continue;
      }

      user = await createUser({
        name,
        email,
        passwordHash: encoded,
        googleId: googleSub || null,
        createdAt
      });
      if (raw && raw.state) {
        await writeState(user.id, mergeAccountState(await readState(user.id), raw.state));
      }
      created += 1;
      results.push({ email, status: 'created' });
    } catch (err) {
      console.error('Migrate account failed:', err.message || err);
      skipped += 1;
      results.push({ email, status: 'skipped', reason: 'error' });
    }
  }

  if (created && NOTIFY_EMAIL) {
    sendMail({
      to: NOTIFY_EMAIL,
      subject: `Migrated ${created} QueenCityConnect account${created === 1 ? '' : 's'}`,
      text: `Browser accounts were saved to the server database.\n\nCreated: ${created}\nAlready on file (merged): ${merged}\nSkipped: ${skipped}\nTime: ${new Date().toISOString()}`
    }).catch((err) => console.error('Migration notice email failed:', err.message || err));
  }

  res.json({ ok: true, created, merged, skipped, results });
});

app.post('/api/admin/users', async (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin access is not configured on this server.' });
  }
  if (!rateLimit('admin:' + clientIp(req), 20, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  if (!secretsEqual(req.body && req.body.password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  try {
    const users = (await db.listUsers()).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      method: row.google_id && row.password_hash ? 'Google + email' : row.google_id ? 'Google' : 'email',
      created_at: row.created_at
    }));
    res.json({ total: users.length, users });
  } catch (err) {
    console.error('Admin user list failed:', err);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

app.post('/api/auth/google/id-token', async (req, res) => {
  const redirectTo = wantsHtmlRedirect(req) ? safeNextPath(req.query.next || req.body.next) : '';
  const credential = String((req.body && req.body.credential) || '');
  const csrfBody = String((req.body && req.body.g_csrf_token) || '');
  const csrfCookie = readCookie(req, 'g_csrf_token');
  if (csrfBody || csrfCookie) {
    if (!csrfBody || !csrfCookie || csrfBody !== csrfCookie) {
      if (redirectTo) return res.redirect('/signin.html?error=google');
      return res.status(401).json({ error: 'Google Sign-In did not complete.' });
    }
  }
  if (!credential) {
    if (redirectTo) return res.redirect('/signin.html?error=google');
    return res.status(400).json({ error: 'Google sign-in token is missing.' });
  }
  try {
    const profile = await verifyGoogleIdToken(credential);
    const { user, created } = await findOrCreateGoogleUser(profile);
    if (created) queueNewAccountEmail(user, 'google');
    await startUserSession(req, res, user, 'google', redirectTo);
  } catch (err) {
    if (redirectTo) return res.redirect('/signin.html?error=google');
    res.status(401).json({ error: err.message || 'Google Sign-In did not complete.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = await db.findUserByEmail(email);
    const passwordHash = bcrypt.hashSync(password, 10);
    if (existing) {
      if (!existing.password_hash) {
        await db.updatePassword(passwordHash, existing.id);
        if (name && name !== existing.name) {
          await db.updateName(name, existing.id);
        }
        const user = await db.findUserById(existing.id);
        await startUserSession(req, res, user, 'password');
        return;
      }
      return res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
    }

    const user = await createUser({ name, email, passwordHash });
    queueNewAccountEmail(user, 'password');
    await startUserSession(req, res, user, 'register');
  } catch (err) {
    console.error('Register failed:', err);
    res.status(500).json({ error: 'Could not create account. Try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail((req.body && (req.body.email || req.body.username)) || '');
    const password = String((req.body && req.body.password) || '');
    let user = await db.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google. Continue with Google instead.' });
    }
    if (!passwordsMatch(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    if (parseLocalPassword(user.password_hash)) {
      await db.updatePassword(bcrypt.hashSync(password, 10), user.id);
      user = await db.findUserById(user.id);
    }

    await startUserSession(req, res, user, 'password');
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

app.post('/api/auth/forgot', async (req, res) => {
  const generic = {
    ok: true,
    message: 'If that email is on file, we sent a reset link. Check your inbox and spam folder.'
  };
  try {
    const email = normalizeEmail(req.body && req.body.email);
    if (!isValidEmail(email)) return res.json(generic);
    const user = await db.findUserByEmail(email);
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
    await db.deleteResetsForUser(user.id);
    await db.insertReset(tokenHash, user.id, expires);
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

app.post('/api/auth/reset', async (req, res) => {
  try {
    const token = String((req.body && req.body.token) || '');
    const password = String((req.body && req.body.password) || '');
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const row = await db.findReset(hashToken(token));
    if (!row || Number(row.expires) < Date.now()) {
      return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.updatePassword(passwordHash, row.user_id);
    await db.deleteResetsForUser(row.user_id);
    const user = await db.findUserById(row.user_id);
    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
    }
    await startUserSession(req, res, user, 'reset');
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
    logLoginEvent(req, user, 'google').catch((logErr) => {
      console.error('Could not log sign-in:', logErr.message || logErr);
    });
    attachSession(req, user, (sessionErr) => {
      if (sessionErr) return res.redirect('/signin.html?error=google');
      res.redirect(safeNext);
    });
  })(req, res, next);
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null, state: null, ...googlePublicConfig() });
  }
  try {
    const user = await db.findUserById(req.session.userId);
    if (!user) {
      req.session.userId = null;
      return res.json({ user: null, state: null, ...googlePublicConfig() });
    }
    res.json({
      user: publicUser(user),
      state: await readState(user.id),
      ...googlePublicConfig()
    });
  } catch (err) {
    console.error('Could not load account:', err);
    res.status(500).json({ error: 'Could not load account.' });
  }
});

async function saveUserState(req, res) {
  try {
    const current = await readState(req.currentUser.id);
    const next = sanitizeStatePatch(req.body || {}, current);
    await writeState(req.currentUser.id, next);
    res.json({ user: publicUser(req.currentUser), state: next, ...googlePublicConfig() });
  } catch (err) {
    console.error('Could not save account data:', err);
    res.status(500).json({ error: 'Could not save account data.' });
  }
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
      await remapAccountSaves();
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
    if (filePath.endsWith(`${path.sep}admin.html`) || filePath.endsWith('/admin.html')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
  }
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  await db.initDb();
  app.listen(PORT, HOST, () => {
    console.log(`QueenCityConnect listening on ${HOST}:${PORT}`);
    console.log(`Public URL: ${BASE_URL}`);
    console.log('Account database: Turso');
    if (!googleEnabled) {
      console.log('Google Sign-In is off until GOOGLE_CLIENT_ID is set in .env or data/auth-config.json');
    } else if (googleRedirectEnabled) {
      console.log(`Google OAuth callback: ${BASE_URL}/api/auth/google/callback`);
    }
    if (!mailConfigured()) {
      console.log('Account emails are off until GMAIL_USER and GMAIL_APP_PASSWORD are set in .env');
    }
    if (!ADMIN_PASSWORD) {
      console.log('Admin user list is off until ADMIN_PASSWORD is set in .env');
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
}

start().catch((err) => {
  console.error('Could not start QueenCityConnect:', err.message || err);
  process.exit(1);
});
