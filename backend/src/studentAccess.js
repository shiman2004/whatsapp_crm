import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { ExamError, requireValue } from './examPolicy.js';
import { orderKey } from './examOperations.js';

const scrypt = promisify(crypto.scrypt);
const at = () => Date.now();
const iso = ms => new Date(ms).toISOString();
const IDLE = 60 * 60000;
const ABSOLUTE = 24 * 3600000;

export class StudentAccess {
  constructor(store, secret) { this.store = store; this.key = crypto.createHash('sha256').update(secret).digest(); }
  digest(value) { return crypto.createHmac('sha256', this.key).update(value).digest('hex'); }
  equal(a, b) { return typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
  seal(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: data.toString('base64') };
  }
  async hashPassword(password) {
    requireValue(typeof password === 'string' && password.length >= 15 && password.length <= 256, 'PASSWORD_POLICY', 'Use a password of 15–256 characters.');
    requireValue(!/^(.)\1+$/.test(password) && !/^(password|123456789|qwerty|letmein)/i.test(password), 'PASSWORD_POLICY', 'Choose a less common password.');
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, 64);
    return salt + ':' + Buffer.from(derived).toString('hex');
  }
  async verifyPassword(password, stored) {
    if (typeof password !== 'string' || password.length > 256) return false;
    const [salt, digest] = String(stored || '').split(':');
    // Perform work even for an unknown account to reduce account enumeration.
    const candidate = Buffer.from(await scrypt(password, salt || 'unknown-account-salt', 64)).toString('hex');
    return Boolean(digest && this.equal(candidate, digest));
  }
  async limit(tx, key, limit, windowMs) {
    await tx.lock('rate:' + key);
    const old = await tx.get('rate', key, true);
    const record = !old || old.until < at() ? { count: 0, until: at() + windowMs } : old;
    requireValue(record.count < limit, 'RATE_LIMIT', 'Too many attempts. Try again later.', 429);
    record.count++;
    await tx.put('rate', key, record);
  }
  async queue(tx, student, purpose, content, requirementId = null) {
    const id = crypto.randomUUID();
    await tx.put('outbox', id, { id, to: student.email, purpose, requirementId, status: 'PENDING', attempts: 0, createdAt: iso(at()), payload: this.seal(content) });
  }
  async invite(user, studentId, portalOrigin) {
    requireValue(user?.role === 'super_admin', 'FORBIDDEN', 'Administrator access required.', 403);
    requireValue(/^https:\/\//.test(portalOrigin) || /^http:\/\/localhost(?::\d+)?$/.test(portalOrigin), 'PORTAL_URL', 'Configure a trusted portal origin.');
    const token = crypto.randomBytes(32).toString('base64url');
    const digest = this.digest(token);
    await this.store.transaction(async tx => {
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      requireValue(student && student.status === 'PENDING', 'NOT_PENDING', 'No pending student activation found.', 409);
      await this.limit(tx, 'invite:' + studentId, 5, 3600000);
      student.activationDigest = digest;
      await tx.put('student', studentId, student);
      await tx.put('challenge', digest, { id: digest, studentId, purpose: 'activate', expiresAt: at() + 86400000, consumed: false });
      await this.queue(tx, student, 'activate', { link: portalOrigin + '/student#activate=' + token });
      await tx.audit(user.id, 'student.invitation.queued', studentId);
    });
    return { queued: true };
  }
  async activate(token, password, browser) {
    requireValue(typeof token === 'string' && token.length <= 200 && typeof browser === 'string', 'INVALID_ACTIVATION', 'Activation link is invalid.');
    const passwordHash = await this.hashPassword(password);
    const digest = this.digest(token);
    return this.store.transaction(async tx => {
      const preview = await tx.get('challenge', digest);
      requireValue(preview, 'INVALID_ACTIVATION', 'Activation link is invalid or expired.');
      await tx.lock('student:' + preview.studentId);
      const challenge = await tx.get('challenge', digest, true);
      const student = await tx.get('student', preview.studentId, true);
      requireValue(challenge?.purpose === 'activate' && !challenge.consumed && challenge.expiresAt > at() && student?.status === 'PENDING' && student.activationDigest === digest, 'INVALID_ACTIVATION', 'Activation link is invalid or expired.');
      student.passwordHash = passwordHash;
      student.status = 'ACTIVE';
      student.activatedAt = iso(at());
      student.emailVerifiedAt = iso(at());
      challenge.consumed = true;
      await tx.put('challenge', digest, challenge);
      // At most 500 entitlements can be active for an individual in this release.
      const accesses = await tx.list('entitlement', student.id);
      for (const access of accesses) if (access.startTrigger === 'activation' && !access.startsAt) {
        access.startsAt = student.activatedAt;
        access.endsAt = iso(at() + access.durationDays * 86400000);
        await tx.put('entitlement', access.id, access);
      }
      await tx.audit(student.id, 'student.activated', student.id);
      return this.newSession(tx, student, browser);
    });
  }
  async newSession(tx, student, browser) {
    const token = crypto.randomBytes(32).toString('base64url');
    student.generation = (student.generation || 0) + 1;
    student.sessionDigest = this.digest(token);
    student.browserDigest = this.digest(browser);
    student.idleExpiresAt = at() + IDLE;
    student.absoluteExpiresAt = at() + ABSOLUTE;
    await tx.put('student', student.id, student);
    await tx.put('session', student.sessionDigest, { studentId: student.id, generation: student.generation });
    return { token, student: { id: student.id, name: student.name, email: student.email }, expiresAt: student.absoluteExpiresAt };
  }
  async login(email, password, browser, network = 'unknown') {
    requireValue(typeof email === 'string' && email.length <= 320 && typeof browser === 'string', 'INVALID_LOGIN', 'Invalid sign-in request.');
    const studentId = orderKey(email.trim().toLowerCase());
    // Commit rate counters separately so rejected logins cannot roll them back.
    await this.store.transaction(async tx => {
      await this.limit(tx, 'network:' + this.digest(network), 60, 3600000);
      await this.limit(tx, 'login:' + studentId, 20, 3600000);
    });
    const student = await this.store.transaction(tx => tx.get('student', studentId));
    const passwordValid = await this.verifyPassword(password, student?.passwordHash);
    requireValue(passwordValid && student?.status === 'ACTIVE', 'INVALID_LOGIN', 'Unable to sign in with those details.', 401);
    return this.store.transaction(async tx => {
      await tx.lock('student:' + studentId);
      const current = await tx.get('student', studentId, true);
      requireValue(current?.status === 'ACTIVE' && current.passwordHash === student.passwordHash, 'INVALID_LOGIN', 'Unable to sign in with those details.', 401);
      if (current.browserDigest === this.digest(browser)) return this.newSession(tx, current, browser);
      await this.limit(tx, 'otp:' + studentId, 5, 3600000);
      if (current.lastOtpAt) requireValue(at() - current.lastOtpAt >= 60000, 'RESEND_WAIT', 'Wait at least 60 seconds before another code.', 429);
      const challengeId = crypto.randomBytes(32).toString('base64url');
      const code = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
      current.lastOtpAt = at();
      current.pendingChallenge = this.digest(challengeId);
      await tx.put('student', studentId, current);
      await tx.put('challenge', current.pendingChallenge, { id: current.pendingChallenge, studentId, browserDigest: this.digest(browser), generation: current.generation, purpose: 'device', codeDigest: this.digest(challengeId + ':' + code), failures: 0, consumed: false, expiresAt: at() + 300000 });
      await this.queue(tx, current, 'device-code', { code });
      return { challengeId, requiresOtp: true };
    });
  }
  async verifyDevice(challengeId, code, browser) {
    requireValue(typeof challengeId === 'string' && challengeId.length <= 200 && /^\d{8}$/.test(String(code)), 'INVALID_CODE', 'Invalid or expired code.');
    const result = await this.store.transaction(async tx => {
      const id = this.digest(challengeId);
      const preview = await tx.get('challenge', id);
      if (!preview) return { invalid: true };
      await tx.lock('student:' + preview.studentId);
      const challenge = await tx.get('challenge', id, true);
      const student = await tx.get('student', preview.studentId, true);
      if (challenge?.purpose !== 'device' || challenge.consumed || challenge.expiresAt <= at() || challenge.failures >= 5 || student?.status !== 'ACTIVE' || challenge.generation !== student.generation || student.pendingChallenge !== id || challenge.browserDigest !== this.digest(browser)) return { invalid: true };
      if (!this.equal(challenge.codeDigest, this.digest(challengeId + ':' + code))) {
        challenge.failures++;
        await tx.put('challenge', id, challenge);
        return { invalid: true };
      }
      challenge.consumed = true;
      await tx.put('challenge', id, challenge);
      const session = await this.newSession(tx, student, browser);
      await this.queue(tx, student, 'device-notice', { message: 'A new browser was verified and your previous session was signed out.' });
      await tx.audit(student.id, 'student.device.switched', student.id);
      return session;
    });
    requireValue(!result.invalid, 'INVALID_CODE', 'Invalid or expired code.', 401);
    return result;
  }
  async authenticate(tx, token, browser, touch = false) {
    requireValue(token && browser, 'UNAUTHORIZED', 'Sign in to continue.', 401);
    const session = await tx.get('session', this.digest(token));
    requireValue(session, 'UNAUTHORIZED', 'Sign in to continue.', 401);
    await tx.lock('student:' + session.studentId);
    const student = await tx.get('student', session.studentId, true);
    requireValue(student?.status === 'ACTIVE' && student.sessionDigest === this.digest(token) && student.generation === session.generation && student.browserDigest === this.digest(browser) && student.idleExpiresAt > at() && student.absoluteExpiresAt > at(), 'SESSION_EXPIRED', 'Your session expired or was replaced. Sign in again.', 401);
    if (touch) { student.idleExpiresAt = Math.min(at() + IDLE, student.absoluteExpiresAt); await tx.put('student', student.id, student); }
    return student;
  }
  async portal(token, browser) {
    return this.store.transaction(async tx => {
      const student = await this.authenticate(tx, token, browser, true);
      const accesses = (await tx.list('entitlement', student.id)).filter(a => a.status === 'ACTIVE' && a.startsAt && Date.parse(a.startsAt) <= at() && Date.parse(a.endsAt) > at());
      const assets = [];
      for (const access of accesses) for (const id of access.materialIds || []) {
        const asset = await tx.get('asset', id);
        if (asset?.status === 'PUBLISHED') assets.push({ id, title: asset.title, version: asset.version, entitlementId: access.id });
      }
      // Dashboard GET does not count as delivery; explicit entry confirmation does.
      return { student: { id: student.id, name: student.name, email: student.email }, accesses, assets };
    });
  }
  async logout(token, browser) {
    return this.store.transaction(async tx => {
      const student = await this.authenticate(tx, token, browser);
      student.generation++;
      student.sessionDigest = null;
      await tx.put('student', student.id, student);
      await tx.audit(student.id, 'student.logout', student.id);
      return { signedOut: true };
    });
  }
}
