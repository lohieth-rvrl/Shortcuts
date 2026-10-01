import crypto from 'node:crypto';
import express from 'express';

// Single-user sign-in. Credentials come from the environment; the demo values are only a fallback.
const EMAIL = (process.env.AUTH_EMAIL || 'demo@gmail.com').trim().toLowerCase();
const PASSWORD = process.env.AUTH_PASSWORD || 'demo@123';
const SECRET = process.env.AUTH_SECRET
  || crypto.createHash('sha256').update(`shortcuts|${EMAIL}|${PASSWORD}|${process.env.MONGODB_URI || ''}`).digest('hex');
const COOKIE = 'shortcuts_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60 * 1000;

if (!process.env.AUTH_PASSWORD) {
  console.warn('AUTH_PASSWORD is not set, so the demo password is active. Set AUTH_EMAIL and AUTH_PASSWORD before going public.');
}

const salt = crypto.createHash('sha256').update(`shortcuts-salt|${SECRET}`).digest();
const derive = (value) => crypto.scryptSync(String(value), salt, 32);
const EMAIL_KEY = derive(EMAIL);
const PASSWORD_KEY = derive(PASSWORD);

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(crypto.createHmac('sha256', SECRET).update(body).digest('base64url'));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.sub === EMAIL && payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

function readCookie(request, name) {
  for (const part of (request.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

const fails = new Map();
function blocked(ip) {
  const entry = fails.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) { fails.delete(ip); return false; }
  return entry.count >= MAX_FAILS;
}
function recordFail(ip) {
  const entry = fails.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) fails.set(ip, { count: 1, first: Date.now() });
  else entry.count += 1;
}

export const authRouter = express.Router();
authRouter.use((request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });

authRouter.post('/login', async (request, response) => {
  const ip = request.ip || 'unknown';
  if (blocked(ip)) {
    response.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    return;
  }
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase().slice(0, 200) : '';
  const password = typeof request.body?.password === 'string' ? request.body.password.slice(0, 200) : '';
  const emailOk = crypto.timingSafeEqual(derive(email), EMAIL_KEY);
  const passwordOk = crypto.timingSafeEqual(derive(password), PASSWORD_KEY);
  if (!(emailOk && passwordOk)) {
    recordFail(ip);
    await new Promise((resolve) => setTimeout(resolve, 500));
    response.status(401).json({ error: 'Incorrect email or password.' });
    return;
  }
  fails.delete(ip);
  response.cookie(COOKIE, sign({ sub: EMAIL, exp: Date.now() + SESSION_SECONDS * 1000 }), {
    httpOnly: true, sameSite: 'lax', secure: request.secure, path: '/', maxAge: SESSION_SECONDS * 1000,
  });
  response.json({ authenticated: true, email: EMAIL });
});

authRouter.post('/logout', (request, response) => {
  response.clearCookie(COOKIE, { path: '/' });
  response.json({ authenticated: false });
});

authRouter.get('/me', (request, response) => {
  if (!verify(readCookie(request, COOKIE))) {
    response.status(401).json({ authenticated: false });
    return;
  }
  response.json({ authenticated: true, email: EMAIL });
});

export function requireAuth(request, response, next) {
  if (!verify(readCookie(request, COOKIE))) {
    response.status(401).json({ error: 'Please sign in.' });
    return;
  }
  next();
}
