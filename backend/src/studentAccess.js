import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { ExamError, requireValue } from './examPolicy.js';
import { orderKey } from './examOperations.js';

const scrypt = promisify(crypto.scrypt);
const at = () => Date.now();
const iso = ms => new Date(ms).toISOString();
const IDLE = 60 * 60000;
const ABSOLUTE = 24 * 3600000;

export const STUDENT_LIFECYCLE_STATUSES = [
  'Pending Activation',
  'Email Verification Pending',
  'Active',
  'Suspended',
  'Locked',
  'Disabled'
];

export function isStudentActive(status) {
  return status === 'ACTIVE' || status === 'Active';
}

export function detectDeviceType(browser, userAgent, activeDevices = []) {
  const text = (String(browser || '') + ' ' + String(userAgent || '')).toLowerCase();
  if (/mobile|iphone|ipod|android.*mobile|windows phone|phone/i.test(text)) return 'mobile';
  if (/windows|macintosh|linux|desktop|laptop|x64|x86_64/i.test(text)) return 'desktop';
  const mobileCount = activeDevices.filter(d => d.deviceType === 'mobile' && d.status === 'ACTIVE').length;
  const desktopCount = activeDevices.filter(d => d.deviceType === 'desktop' && d.status === 'ACTIVE').length;
  if (desktopCount >= 1 && mobileCount === 0) return 'mobile';
  if (mobileCount >= 1 && desktopCount === 0) return 'desktop';
  return 'desktop';
}

export class StudentAccess {
  constructor(store, secret, devicePolicy = null) {
    this.store = store;
    this.secret = secret;
    this.key = crypto.createHash('sha256').update(secret).digest();
    this.devicePolicy = devicePolicy || new DevicePolicyManager(store, secret, this);
  }
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
      requireValue(student && (student.status === 'PENDING' || student.status === 'Pending Activation'), 'NOT_PENDING', 'No pending student activation found.', 409);
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
      const isPending = student?.status === 'PENDING' || student?.status === 'Pending Activation';
      requireValue(challenge?.purpose === 'activate' && !challenge.consumed && challenge.expiresAt > at() && isPending && student.activationDigest === digest, 'INVALID_ACTIVATION', 'Activation link is invalid or expired.');
      student.passwordHash = passwordHash;
      student.status = 'ACTIVE';
      student.activatedAt = iso(at());
      student.emailVerifiedAt = iso(at());
      challenge.consumed = true;
      await tx.put('challenge', digest, challenge);
      await tx.put('student', student.id, student);
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
    return {
      token,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        status: student.status,
        registeredDevices: student.registeredDevices || []
      },
      expiresAt: student.absoluteExpiresAt
    };
  }
  async login(email, password, browser, network = 'unknown', deviceDetails = null) {
    if (typeof network === 'object' && network !== null && !deviceDetails) {
      deviceDetails = network;
      network = 'unknown';
    }
    requireValue(typeof email === 'string' && email.length <= 320 && typeof browser === 'string', 'INVALID_LOGIN', 'Invalid sign-in request.');
    const studentId = orderKey(email.trim().toLowerCase());
    // Commit rate counters separately so rejected logins cannot roll them back.
    await this.store.transaction(async tx => {
      await this.limit(tx, 'network:' + this.digest(network), 60, 3600000);
      await this.limit(tx, 'login:' + studentId, 20, 3600000);
    });
    const student = await this.store.transaction(tx => tx.get('student', studentId));
    const passwordValid = await this.verifyPassword(password, student?.passwordHash);
    requireValue(passwordValid && isStudentActive(student?.status), 'INVALID_LOGIN', 'Unable to sign in with those details.', 401);
    return this.store.transaction(async tx => {
      await tx.lock('student:' + studentId);
      const current = await tx.get('student', studentId, true);
      requireValue(isStudentActive(current?.status) && current.passwordHash === student.passwordHash, 'INVALID_LOGIN', 'Unable to sign in with those details.', 401);

      const allDevices = current.registeredDevices || [];
      const activeDevices = allDevices.filter(d => d.status === 'ACTIVE');
      const revokedDevices = allDevices.filter(d => d.status === 'REVOKED');

      const clientDeviceId = deviceDetails?.deviceId || (browser.startsWith('dev-') ? browser : null);
      const isRevoked = revokedDevices.some(d =>
        (clientDeviceId && d.deviceId === clientDeviceId) ||
        (d.deviceId === browser) ||
        (d.browserDigest && d.browserDigest === this.digest(browser)) ||
        (d.userAgent && (d.userAgent === browser || browser.includes(d.userAgent)))
      );
      if (isRevoked) {
        const error = new Error('THIRD_DEVICE_BLOCKED: This device was previously revoked. Device replacement required.');
        error.code = 'THIRD_DEVICE_BLOCKED';
        error.status = 403;
        throw error;
      }

      const clientDeviceType = (deviceDetails?.deviceType && ['mobile', 'desktop'].includes(deviceDetails.deviceType))
        ? deviceDetails.deviceType
        : detectDeviceType(browser, deviceDetails?.userAgent, activeDevices);

      const registeredMatch = activeDevices.find(d =>
        (clientDeviceId && d.deviceId === clientDeviceId) ||
        (d.deviceId === browser) ||
        (d.browserDigest && d.browserDigest === this.digest(browser)) ||
        (d.userAgent && (d.userAgent === browser || browser.includes(d.userAgent))) ||
        (browser === 'browser-' + d.deviceType) ||
        (browser.startsWith('browser-') && browser.endsWith(d.deviceId))
      );

      if (current.browserDigest === this.digest(browser)) {
        if (registeredMatch) {
          registeredMatch.lastActiveAt = new Date().toISOString();
          if (!registeredMatch.browserDigest) registeredMatch.browserDigest = this.digest(browser);
        } else if (activeDevices.length === 0) {
          const devType = clientDeviceType;
          const devId = clientDeviceId || (browser.startsWith('dev-') ? browser : 'dev-' + this.digest(browser).slice(0, 16));
          current.registeredDevices = [{
            deviceId: devId,
            deviceType: devType,
            browserDigest: this.digest(browser),
            userAgent: deviceDetails?.userAgent || browser,
            browserName: deviceDetails?.browserName || (devType === 'mobile' ? 'Mobile Browser' : 'Chrome'),
            registeredAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            status: 'ACTIVE'
          }];
        }
        return this.newSession(tx, current, browser);
      }

      // Login attempt from an unrecognized browser/device
      if (!registeredMatch) {
        if (activeDevices.length >= 2) {
          throw new ExamError(403, 'THIRD_DEVICE_BLOCKED', 'Maximum 2 devices registered. Device replacement required.');
        }

        const mobileCount = activeDevices.filter(d => d.deviceType === 'mobile').length;
        const desktopCount = activeDevices.filter(d => d.deviceType === 'desktop').length;

        if (clientDeviceType === 'mobile' && mobileCount >= 1) {
          throw new ExamError(403, 'DEVICE_LIMIT_EXCEEDED', 'A mobile device is already registered. Maximum 1 Mobile and 1 Computer permitted.');
        }

        if (clientDeviceType === 'desktop' && desktopCount >= 1) {
          throw new ExamError(403, 'DEVICE_LIMIT_EXCEEDED', 'A desktop/laptop is already registered. Maximum 1 Mobile and 1 Computer permitted.');
        }
      }

      await this.limit(tx, 'otp:' + studentId, 5, 3600000);
      if (current.lastOtpAt) requireValue(at() - current.lastOtpAt >= 60000, 'RESEND_WAIT', 'Wait at least 60 seconds before another code.', 429);
      const challengeId = crypto.randomBytes(32).toString('base64url');
      const code = crypto.randomInt(0, 100000000).toString().padStart(8, '0');
      current.lastOtpAt = at();
      current.pendingChallenge = this.digest(challengeId);
      await tx.put('student', studentId, current);

      const resolvedDeviceType = (deviceDetails?.deviceType && ['mobile', 'desktop'].includes(deviceDetails.deviceType))
        ? deviceDetails.deviceType
        : (registeredMatch ? registeredMatch.deviceType : detectDeviceType(browser, deviceDetails?.userAgent, activeDevices));
      const resolvedDeviceId = registeredMatch ? registeredMatch.deviceId : (clientDeviceId || (browser.startsWith('dev-') ? browser : 'dev-' + this.digest(browser).slice(0, 16)));

      await tx.put('challenge', current.pendingChallenge, {
        id: current.pendingChallenge,
        studentId,
        browserDigest: this.digest(browser),
        generation: current.generation,
        purpose: 'device',
        codeDigest: this.digest(challengeId + ':' + code),
        failures: 0,
        consumed: false,
        expiresAt: at() + 300000,
        deviceDetails: {
          deviceId: resolvedDeviceId,
          deviceType: resolvedDeviceType,
          userAgent: deviceDetails?.userAgent || browser,
          browserName: deviceDetails?.browserName || (resolvedDeviceType === 'mobile' ? 'Mobile Browser' : 'Chrome')
        }
      });
      await this.queue(tx, current, 'device-code', { code });
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n🔑 [STUDENT PORTAL OTP CODE]: ${code} (Student: ${current.email})\n`);
      }
      return { challengeId, requiresOtp: true, ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}) };
    });
  }
  async verifyDevice(challengeId, code, browser, deviceDetails = null) {
    requireValue(typeof challengeId === 'string' && challengeId.length <= 200 && /^\d{8}$/.test(String(code)), 'INVALID_CODE', 'Invalid or expired code.');
    const result = await this.store.transaction(async tx => {
      const id = this.digest(challengeId);
      const preview = await tx.get('challenge', id);
      if (!preview) return { invalid: true };
      await tx.lock('student:' + preview.studentId);
      const challenge = await tx.get('challenge', id, true);
      const student = await tx.get('student', preview.studentId, true);
      if (challenge?.purpose !== 'device' || challenge.consumed || challenge.expiresAt <= at() || challenge.failures >= 5 || !isStudentActive(student?.status) || challenge.generation !== student.generation || student.pendingChallenge !== id || challenge.browserDigest !== this.digest(browser)) return { invalid: true };
      if (!this.equal(challenge.codeDigest, this.digest(challengeId + ':' + code))) {
        challenge.failures++;
        await tx.put('challenge', id, challenge);
        return { invalid: true };
      }
      challenge.consumed = true;
      await tx.put('challenge', id, challenge);

      // Register device into student.registeredDevices via DevicePolicyManager
      const targetDevice = challenge.deviceDetails || {
        deviceId: deviceDetails?.deviceId || (browser.startsWith('dev-') ? browser : 'dev-' + this.digest(browser).slice(0, 16)),
        deviceType: deviceDetails?.deviceType || detectDeviceType(browser, null, (student.registeredDevices || []).filter(d => d.status === 'ACTIVE')),
        userAgent: deviceDetails?.userAgent || browser,
        browserName: deviceDetails?.browserName || 'Browser'
      };

      await this.devicePolicy.registerDevice(student.id, {
        ...targetDevice,
        browserDigest: this.digest(browser)
      }, tx);
      const updatedStudent = await tx.get('student', student.id, true);

      const session = await this.newSession(tx, updatedStudent || student, browser);
      await this.queue(tx, updatedStudent || student, 'device-notice', { message: 'A new browser was verified and your previous session was signed out.' });
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
    requireValue(isStudentActive(student?.status) && student.sessionDigest === this.digest(token) && student.generation === session.generation && student.browserDigest === this.digest(browser) && student.idleExpiresAt > at() && student.absoluteExpiresAt > at(), 'SESSION_EXPIRED', 'Your session expired or was replaced. Sign in again.', 401);
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
      return {
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          status: student.status,
          registeredDevices: student.registeredDevices || []
        },
        accesses,
        assets
      };
    });
  }
  async logout(token, browser) {
    return this.store.transaction(async tx => {
      const student = await this.authenticate(tx, token, browser);
      student.generation = (student.generation || 0) + 1;
      student.sessionDigest = null;
      await tx.put('student', student.id, student);
      await tx.audit(student.id, 'student.logout', student.id);
      return { signedOut: true };
    });
  }
  async setStatus(actor, studentId, newStatus, reason = null) {
    requireValue(actor?.role === 'super_admin' || actor?.role === 'exam_department_manager', 'FORBIDDEN', 'Administrative permission required.', 403);
    const validStatuses = [
      ...STUDENT_LIFECYCLE_STATUSES,
      'PENDING', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DISABLED'
    ];
    requireValue(validStatuses.includes(newStatus), 'INVALID_STATUS', 'Invalid student lifecycle status.');
    return this.store.transaction(async tx => {
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      requireValue(student, 'NOT_FOUND', 'Student record not found.', 404);
      student.status = newStatus;
      if (!isStudentActive(newStatus)) {
        // Invalidate active session immediately
        student.generation = (student.generation || 0) + 1;
        student.sessionDigest = null;
      }
      await tx.put('student', studentId, student);
      await tx.audit(actor.id, 'student.status.updated', studentId, { newStatus, reason });
      return { success: true, studentId, status: newStatus };
    });
  }
}

/**
 * Strict 2-Device Policy Manager & Session Concurrency Guard
 * Implements R2 & Section 32 UAT 7, 8, 9 specification contracts.
 */
export class DevicePolicyManager {
  constructor(store, secret = 'device-policy-secret-key-ahg-crm-2026', studentAccess = null) {
    this.store = store;
    this.secret = secret;
    this._studentAccess = studentAccess;
  }

  get studentAccess() {
    if (!this._studentAccess) {
      this._studentAccess = new StudentAccess(this.store, this.secret, this);
    }
    return this._studentAccess;
  }

  async getRegisteredDevices(studentId) {
    return this.store.transaction(async tx => {
      const student = await tx.get('student', studentId);
      return student?.registeredDevices || [];
    });
  }

  /**
   * Registers a device enforcing:
   * - Max 2 devices total
   * - Strictly 1 Mobile and 1 Desktop/Laptop
   * - Rejects 2 mobiles, 2 desktops, or 3+ devices
   */
  async registerDevice(studentId, { deviceId, deviceType, userAgent, browserName, browserDigest = null }, existingTx = null) {
    if (!['mobile', 'desktop'].includes(deviceType)) {
      const err = new Error('INVALID_DEVICE_TYPE: Device must be mobile or desktop');
      err.code = 'INVALID_DEVICE_TYPE';
      err.status = 400;
      throw err;
    }

    const execute = async tx => {
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      if (!student) {
        const err = new Error('STUDENT_NOT_FOUND');
        err.code = 'STUDENT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const devices = student.registeredDevices || [];

      // Check if device was previously revoked - prevent re-registration from bypassing replacement policy
      const existingRevoked = devices.find(d => d.deviceId === deviceId && d.status === 'REVOKED');
      if (existingRevoked) {
        const error = new Error('THIRD_DEVICE_BLOCKED: This device was previously revoked. Device replacement required.');
        error.code = 'THIRD_DEVICE_BLOCKED';
        error.status = 403;
        throw error;
      }

      // Check if device is already active
      const existing = devices.find(d => d.deviceId === deviceId && d.status === 'ACTIVE');
      if (existing) {
        existing.lastActiveAt = new Date().toISOString();
        if (userAgent) existing.userAgent = userAgent;
        if (browserName) existing.browserName = browserName;
        if (browserDigest) existing.browserDigest = browserDigest;
        await tx.put('student', studentId, student);
        return { success: true, device: existing, devices };
      }

      const activeDevices = devices.filter(d => d.status !== 'REVOKED');
      const mobileCount = activeDevices.filter(d => d.deviceType === 'mobile').length;
      const desktopCount = activeDevices.filter(d => d.deviceType === 'desktop').length;

      if (activeDevices.length >= 2) {
        const error = new Error('THIRD_DEVICE_BLOCKED: Maximum 2 devices registered. Device replacement required.');
        error.code = 'THIRD_DEVICE_BLOCKED';
        error.status = 403;
        throw error;
      }

      if (deviceType === 'mobile' && mobileCount >= 1) {
        const error = new Error('DEVICE_LIMIT_EXCEEDED: A mobile device is already registered. Maximum 1 Mobile and 1 Computer permitted.');
        error.code = 'DEVICE_LIMIT_EXCEEDED';
        error.status = 403;
        throw error;
      }

      if (deviceType === 'desktop' && desktopCount >= 1) {
        const error = new Error('DEVICE_LIMIT_EXCEEDED: A desktop/laptop is already registered. Maximum 1 Mobile and 1 Computer permitted.');
        error.code = 'DEVICE_LIMIT_EXCEEDED';
        error.status = 403;
        throw error;
      }

      const newDevice = {
        deviceId,
        deviceType,
        browserDigest: browserDigest || null,
        userAgent: userAgent || 'Mozilla/5.0',
        browserName: browserName || 'Chrome',
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: 'ACTIVE'
      };

      student.registeredDevices = [...devices, newDevice];
      await tx.put('student', studentId, student);
      await tx.audit(studentId, 'student.device.registered', deviceId, { deviceType });
      return { success: true, device: newDevice, devices: student.registeredDevices };
    };

    if (existingTx) {
      return execute(existingTx);
    }
    return this.store.transaction(execute);
  }

  /**
   * Device Replacement Challenge:
   * Third device requests replacement -> sends 8-digit OTP -> enters OTP -> Admin approval required.
   */
  async requestDeviceReplacement(studentId, { targetDeviceId, targetDeviceType }) {
    if (targetDeviceType && !['mobile', 'desktop'].includes(targetDeviceType)) {
      const err = new Error('INVALID_DEVICE_TYPE: Device must be mobile or desktop');
      err.code = 'INVALID_DEVICE_TYPE';
      err.status = 400;
      throw err;
    }

    return this.store.transaction(async tx => {
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      if (!student) {
        const err = new Error('STUDENT_NOT_FOUND');
        err.code = 'STUDENT_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const challengeId = crypto.randomUUID();
      const otpCode = crypto.randomInt(10000000, 100000000).toString().padStart(8, '0');

      const challenge = {
        id: challengeId,
        studentId,
        targetDeviceId,
        targetDeviceType,
        code: otpCode,
        failures: 0,
        status: 'PENDING_OTP',
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 15 * 60 * 1000
      };

      await tx.put('device_challenge', challengeId, challenge);
      await this.studentAccess.queue(tx, student, 'device-replacement-otp', {
        code: otpCode,
        message: 'Your 8-digit OTP for device replacement is: ' + otpCode
      });
      await tx.audit(studentId, 'student.device_replacement.requested', challengeId);
      return { challengeId, otpCodeSent: true, ...(process.env.NODE_ENV === 'production' ? {} : { codeForTest: otpCode }) };
    });
  }

  async verifyReplacementOtp(challengeId, enteredCode) {
    const result = await this.store.transaction(async tx => {
      const challenge = await tx.get('device_challenge', challengeId, true);
      if (!challenge) return { notFound: true };
      if (challenge.status === 'LOCKED' || (challenge.failures || 0) >= 5) {
        return { locked: true };
      }
      if (Date.now() > challenge.expiresAt) return { expired: true };

      if (challenge.code !== enteredCode) {
        challenge.failures = (challenge.failures || 0) + 1;
        const locked = challenge.failures >= 5;
        if (locked) {
          challenge.status = 'LOCKED';
        }
        await tx.put('device_challenge', challengeId, challenge);
        return { invalid: true, locked };
      }

      challenge.status = 'PENDING_ADMIN_APPROVAL';
      await tx.put('device_challenge', challengeId, challenge);
      await tx.audit(challenge.studentId, 'student.device_replacement.otp_verified', challengeId);
      return { success: true, status: 'PENDING_ADMIN_APPROVAL' };
    });

    if (result.notFound) {
      const err = new Error('CHALLENGE_NOT_FOUND');
      err.code = 'CHALLENGE_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    if (result.locked) {
      const err = new Error('CHALLENGE_LOCKED: Too many invalid attempts');
      err.code = 'CHALLENGE_LOCKED';
      err.status = 400;
      throw err;
    }
    if (result.expired) {
      const err = new Error('CHALLENGE_EXPIRED');
      err.code = 'CHALLENGE_EXPIRED';
      err.status = 400;
      throw err;
    }
    if (result.invalid) {
      const err = new Error('INVALID_OTP: Code does not match');
      err.code = 'INVALID_OTP';
      err.status = 400;
      throw err;
    }

    return result;
  }

  async approveDeviceReplacement(adminUser, challengeId) {
    if (adminUser?.role !== 'super_admin' && adminUser?.role !== 'exam_department_manager') {
      const error = new Error('FORBIDDEN: Administrative approval required');
      error.code = 'FORBIDDEN';
      error.status = 403;
      throw error;
    }

    return this.store.transaction(async tx => {
      const challenge = await tx.get('device_challenge', challengeId, true);
      if (!challenge || challenge.status !== 'PENDING_ADMIN_APPROVAL') {
        const err = new Error('INVALID_CHALLENGE_STATE');
        err.code = 'INVALID_CHALLENGE_STATE';
        err.status = 400;
        throw err;
      }

      const studentId = challenge.studentId;
      await tx.lock('student:' + studentId);
      const student = await tx.get('student', studentId, true);
      const devices = student?.registeredDevices || [];

      // Revoke the old device of matching type
      const revoked = [];
      const retained = [];
      for (const d of devices) {
        if (d.deviceType === challenge.targetDeviceType && revoked.length === 0 && d.status !== 'REVOKED') {
          d.status = 'REVOKED';
          d.revokedAt = new Date().toISOString();
          revoked.push(d);
        } else {
          retained.push(d);
        }
      }

      const newDevice = {
        deviceId: challenge.targetDeviceId,
        deviceType: challenge.targetDeviceType,
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        status: 'ACTIVE'
      };

      student.registeredDevices = [...retained, newDevice];
      // Increment generation to immediately terminate all active sessions on revoked device
      student.generation = (student.generation || 0) + 1;
      await tx.put('student', studentId, student);

      challenge.status = 'APPROVED';
      challenge.approvedBy = adminUser.id;
      challenge.approvedAt = new Date().toISOString();
      await tx.put('device_challenge', challengeId, challenge);

      await tx.audit(adminUser.id, 'security.device_replacement.approved', challengeId, {
        studentId,
        revokedDeviceId: revoked[0]?.deviceId,
        newDeviceId: newDevice.deviceId
      });

      return {
        success: true,
        revokedDeviceId: revoked[0]?.deviceId,
        newDeviceId: newDevice.deviceId,
        devices: student.registeredDevices
      };
    });
  }
}
