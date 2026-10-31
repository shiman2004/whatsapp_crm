import { useCallback, useEffect, useState } from 'react';
import {
  Smartphone,
  Laptop,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  LogOut,
  RefreshCw,
  BookOpen,
  HelpCircle,
  Clock,
  KeyRound
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { StudentPracticeRunner } from './StudentPracticeRunner';

const field = 'w-full rounded-xl border border-[#E0E5E7] bg-[#F0F2F5] p-3 text-[#111B21] dark:border-[#222D34] dark:bg-[#2A3942] dark:text-[#E9EDEF] focus:outline-none focus:border-[#25D366] transition-colors';

type Question = { id: string; code: string; questionText: string; options: Record<string, string> };

type RegisteredDevice = {
  deviceId: string;
  deviceType: 'mobile' | 'desktop';
  userAgent?: string;
  browserName?: string;
  registeredAt?: string;
  lastActiveAt?: string;
  status: 'ACTIVE' | 'REVOKED';
};

function getClientDeviceId(): string {
  const key = 'ahg_student_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'dev-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

function detectDeviceType(): 'mobile' | 'desktop' {
  const ua = navigator.userAgent || '';
  const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
  return isMobile ? 'mobile' : 'desktop';
}

function getBrowserName(): string {
  const ua = navigator.userAgent || '';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/edg/i.test(ua)) return 'Edge';
  return 'Web Browser';
}

export function StudentPortal() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [activation, setActivation] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('activate') || '');
  const [portal, setPortal] = useState<any>(null);
  const [material, setMaterial] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState('');
  const [sessionTerminated, setSessionTerminated] = useState(false);

  // Practice & Assessment States
  const [practiceCourse, setPracticeCourse] = useState('');
  const [practiceMode, setPracticeMode] = useState<'practice' | 'mock'>('practice');
  const [, setQuestions] = useState<Question[]>([]);

  // Device Security & Replacement States
  const [deviceId] = useState<string>(getClientDeviceId);
  const [detectedType] = useState<'mobile' | 'desktop'>(detectDeviceType);
  const [browserName] = useState<string>(getBrowserName);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [replacementEmail, setReplacementEmail] = useState('');
  const [replacementReason, setReplacementReason] = useState('New device replacement');
  const [replacementChallengeId, setReplacementChallengeId] = useState('');
  const [replacementOtp, setReplacementOtp] = useState('');
  const [replacementStatus, setReplacementStatus] = useState<'IDLE' | 'OTP_SENT' | 'PENDING_APPROVAL' | 'APPROVED' | 'LOCKED'>('IDLE');
  const [replacementBusy, setReplacementBusy] = useState(false);

  const request = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    const res = await fetch(API_BASE_URL + '/api/student' + path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (data.code === 'SESSION_EXPIRED' || (data.error && data.error.includes('expired or was replaced'))) {
        setPortal(null);
        setSessionTerminated(true);
        setError('⚠️ Session Terminated: Your session was signed out because your account was logged in from another device. Only 1 concurrent active session is permitted.');
        throw new Error('Your session expired or was replaced. Sign in again.');
      }
      if (data.code === 'THIRD_DEVICE_BLOCKED' || data.code === 'DEVICE_LIMIT_EXCEEDED') {
        setShowReplacementModal(true);
      }
      throw new Error(data.error || 'Request failed.');
    }
    return data.data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await request('/me');
      setPortal(data);
      setSessionTerminated(false);
    } catch {
      setPortal(null);
    }
  }, [request]);

  useEffect(() => {
    void refresh();
    if (activation) window.history.replaceState(null, '', window.location.pathname);
  }, [refresh, activation]);

  // Handle Sign In / Activation / Browser Verification
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setSessionTerminated(false);

    try {
      if (activation) {
        if (password.length < 15) {
          throw new Error('Password must be at least 15 characters according to security policy.');
        }
        await request('/activate', 'POST', { token: activation, password });
        setPassword('');
        setActivation('');
        setNotice('Account successfully activated! Welcome to your learning portal.');
        await refresh();
      } else if (challenge) {
        await request('/verify-device', 'POST', { challengeId: challenge, code });
        setChallenge('');
        setCode('');
        setNotice('Device verified successfully.');
        await refresh();
      } else {
        const result = await request('/login', 'POST', { email, password });
        setPassword('');
        if (result.requiresOtp) {
          setChallenge(result.challengeId);
          if (result.devCode) {
            setCode(result.devCode);
            setNotice(`Verification code sent to your email. (Dev Code: ${result.devCode})`);
          } else {
            setNotice('Verification code sent to your email. Enter the 8-digit code to confirm this device.');
          }
        } else {
          setNotice('');
          await refresh();
          // Attempt automatic device registration if slot permits
          try {
            await request('/devices/register', 'POST', {
              deviceId,
              deviceType: detectedType,
              userAgent: navigator.userAgent,
              browserName
            });
          } catch {
            // Non-fatal if already registered or at capacity
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to sign in.';
      setError(msg);
      if (msg.includes('THIRD_DEVICE_BLOCKED') || msg.includes('DEVICE_LIMIT_EXCEEDED') || msg.includes('Device Limit Reached')) {
        setReplacementEmail(email);
        setShowReplacementModal(true);
      }
    } finally {
      setBusy(false);
    }
  }

  // Device Replacement Workflow: Step 1 (Request OTP)
  async function handleRequestReplacement(event: React.FormEvent) {
    event.preventDefault();
    setReplacementBusy(true);
    setError('');
    try {
      const emailTarget = replacementEmail || email || portal?.student?.email;
      if (!emailTarget) throw new Error('Student email is required for device replacement challenge.');

      const result = await request('/replace-device/request', 'POST', {
        email: emailTarget,
        targetDeviceId: deviceId,
        targetDeviceType: detectedType,
        reason: replacementReason
      });

      setReplacementChallengeId(result.challengeId);
      setReplacementStatus('OTP_SENT');
      setNotice('An 8-digit OTP code was sent to ' + emailTarget + '. Please enter it below to proceed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to request device replacement.');
    } finally {
      setReplacementBusy(false);
    }
  }

  // Device Replacement Workflow: Step 2 (Verify OTP)
  async function handleVerifyReplacementOtp(event: React.FormEvent) {
    event.preventDefault();
    setReplacementBusy(true);
    setError('');
    try {
      const result = await request('/replace-device/verify-otp', 'POST', {
        challengeId: replacementChallengeId,
        code: replacementOtp.trim()
      });

      if (result.status === 'PENDING_ADMIN_APPROVAL') {
        setReplacementStatus('PENDING_APPROVAL');
        setNotice('OTP code verified! Your device replacement request is now queued for Exam Department Administrator approval.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid code.';
      setError(msg);
      if (msg.includes('LOCKED')) {
        setReplacementStatus('LOCKED');
      }
    } finally {
      setReplacementBusy(false);
    }
  }

  // Check Replacement Status
  async function checkReplacementStatus() {
    if (!replacementChallengeId) return;
    setReplacementBusy(true);
    try {
      const result = await request('/replace-device/status?challengeId=' + encodeURIComponent(replacementChallengeId));
      if (result.status === 'APPROVED') {
        setReplacementStatus('APPROVED');
        setNotice('Congratulations! Your device replacement was approved by Administrator. You may now sign in.');
      } else if (result.status === 'LOCKED') {
        setReplacementStatus('LOCKED');
        setError('Challenge is locked due to too many failed attempts.');
      } else {
        setNotice('Current status: ' + result.status + '. Awaiting Exam Department Manager review.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check status.');
    } finally {
      setReplacementBusy(false);
    }
  }

  async function loadPractice(courseId: string, mode: 'practice' | 'mock' = 'practice') {
    setError('');
    setPracticeMode(mode);
    setPracticeCourse(courseId);
    try {
      const data = await request('/assessments?courseId=' + encodeURIComponent(courseId) + '&mode=' + encodeURIComponent(mode));
      setQuestions(data.questions || []);
      if (!(data.questions || []).length) setNotice(mode === 'mock' ? 'No timed mock exam questions are published for this course yet.' : 'No reviewed practice questions are published for this course yet.');
    } catch (e) {
      setQuestions([]);
      setError(e instanceof Error ? e.message : 'Assessment questions are unavailable.');
    }
  }

  const registeredDevices: RegisteredDevice[] = portal?.student?.registeredDevices || [];
  const activeDevices = registeredDevices.filter(d => d.status !== 'REVOKED');
  const hasMobile = activeDevices.some(d => d.deviceType === 'mobile');
  const hasDesktop = activeDevices.some(d => d.deviceType === 'desktop');

  return (
    <main className="h-screen overflow-y-auto overscroll-y-contain bg-[#F5F7F8] text-[#111B21] dark:bg-[#111B21] dark:text-[#E9EDEF] px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-[#E0E5E7] dark:border-[#222D34] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#128C7E]/10 p-2 text-[#128C7E] dark:bg-[#25D366]/10 dark:text-[#25D366]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[#128C7E] dark:text-[#25D366] text-xs font-bold uppercase tracking-wider">Alpha Health Group</p>
              <h1 className="text-2xl font-bold tracking-tight">Student Learning Portal</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#E0E5E7] dark:border-[#222D34] bg-white dark:bg-[#202C33] px-3 py-1 text-xs">
              {detectedType === 'mobile' ? <Smartphone className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" /> : <Laptop className="h-3.5 w-3.5 text-[#128C7E] dark:text-[#25D366]" />}
              <span className="text-[#667781] dark:text-[#8696A0]">Detected:</span>
              <strong>{detectedType === 'mobile' ? 'Mobile Phone' : 'Desktop / Laptop'}</strong>
            </div>
            <a href="/" className="text-xs text-[#667781] dark:text-[#8696A0] hover:underline">Staff workspace</a>
          </div>
        </header>

        {/* Global Feedback Banners */}
        {sessionTerminated && (
          <div role="alert" className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong className="block font-semibold">Active Session Terminated</strong>
              <p className="text-sm">Your account was logged in from another registered device. Alpha Health Group enforces a strict single concurrent session policy across all devices.</p>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-sm">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Security Notice</strong>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {notice && (
          <div role="status" className="rounded-2xl border border-teal-500/40 bg-teal-500/10 p-4 text-teal-800 dark:text-teal-200 flex items-start gap-3 shadow-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
            <div className="flex-1 text-sm font-medium">{notice}</div>
          </div>
        )}

        {/* AUTHENTICATION VIEW */}
        {!portal ? (
          <div className="mx-auto max-w-md space-y-4">
            <form onSubmit={signIn} className="rounded-2xl border border-[#E0E5E7] bg-white p-6 dark:border-[#222D34] dark:bg-[#202C33] shadow-sm space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex rounded-full bg-[#128C7E]/10 p-3 text-[#128C7E] dark:bg-[#25D366]/10 dark:text-[#25D366]">
                  {activation ? <KeyRound className="h-6 w-6" /> : challenge ? <ShieldAlert className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                </div>
                <h2 className="text-xl font-bold">
                  {activation ? 'Activate Your Account' : challenge ? 'Confirm New Browser' : 'Sign in to Portal'}
                </h2>
                <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                  {activation
                    ? 'Set a secure passphrase to activate your assigned examination syllabus.'
                    : challenge
                    ? 'Enter the 8-digit OTP code sent to your registered email.'
                    : 'Personal exam materials keyed strictly to your verified email.'}
                </p>
              </div>

              {!activation && !challenge && (
                <label className="block text-xs font-semibold text-[#667781] dark:text-[#8696A0]">
                  Student Email
                  <input
                    required
                    autoComplete="username"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    className={`mt-1 ${field}`}
                  />
                </label>
              )}

              {!challenge ? (
                <label className="block text-xs font-semibold text-[#667781] dark:text-[#8696A0]">
                  {activation ? 'Create Password (minimum 15 characters)' : 'Password'}
                  <input
                    required
                    minLength={activation ? 15 : undefined}
                    maxLength={256}
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={activation ? 'Minimum 15 characters with non-repetitive characters' : 'Enter your password'}
                    className={`mt-1 ${field}`}
                  />
                  {activation && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={password.length >= 15 ? 'text-teal-600 dark:text-teal-400 font-semibold' : 'text-[#667781] dark:text-[#8696A0]'}>
                        {password.length} / 15 minimum characters
                      </span>
                      {password.length >= 15 && <span className="text-teal-600 dark:text-teal-400">✓ Meets length policy</span>}
                    </div>
                  )}
                </label>
              ) : (
                <label className="block text-xs font-semibold text-[#667781] dark:text-[#8696A0]">
                  8-Digit Email Confirmation Code
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                    className={`mt-1 text-center tracking-widest text-lg font-mono ${field}`}
                  />
                </label>
              )}

              <button
                disabled={busy}
                className="w-full rounded-xl bg-[#128C7E] dark:bg-[#25D366] dark:text-[#111B21] text-white px-4 py-3 font-semibold disabled:opacity-50 hover:bg-[#075E54] dark:hover:bg-[#20bd5a] transition-all shadow-sm"
              >
                {busy ? 'Verifying…' : activation ? 'Activate Account' : challenge ? 'Confirm & Sign In' : 'Sign In'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setReplacementEmail(email);
                    setShowReplacementModal(true);
                  }}
                  className="text-xs text-[#128C7E] dark:text-[#25D366] hover:underline"
                >
                  Using a new or replacement device? Request device switch
                </button>
              </div>

              <div className="rounded-xl bg-[#F0F2F5] dark:bg-[#2A3942] p-3 text-center text-[11px] text-[#667781] dark:text-[#8696A0]">
                Strict security: Only 1 Mobile and 1 Computer permitted. Logging into a second device terminates any other active session.
              </div>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED PORTAL VIEW */
          <div className="space-y-6">
            {/* Student Profile Bar */}
            <section className="rounded-2xl border border-[#E0E5E7] bg-white p-5 dark:border-[#222D34] dark:bg-[#202C33] flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[#128C7E]/10 dark:bg-[#25D366]/10 flex items-center justify-center font-bold text-lg text-[#128C7E] dark:text-[#25D366]">
                  {portal.student.name?.slice(0, 2).toUpperCase() || 'ST'}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{portal.student.name}</h2>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">{portal.student.email} · ID: {portal.student.id.slice(0, 16)}…</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border border-[#E0E5E7] dark:border-[#222D34] px-4 py-2 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942] text-sm font-semibold flex items-center gap-2 transition-colors"
                  onClick={async () => {
                    try {
                      await request('/logout', 'POST', {});
                      setPortal(null);
                      setNotice('Signed out successfully.');
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </section>

            {/* Controlled Device Policy & Active Devices Card */}
            <section className="rounded-2xl border border-[#E0E5E7] bg-white p-5 dark:border-[#222D34] dark:bg-[#202C33] shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#128C7E] dark:text-[#25D366]" />
                  <h3 className="font-bold text-base">Authorized Registered Devices</h3>
                  <span className="rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs px-2.5 py-0.5 font-semibold">
                    Policy: Max 1 Mobile + 1 Computer
                  </span>
                </div>
                <button
                  onClick={() => setShowReplacementModal(true)}
                  className="text-xs font-semibold text-[#128C7E] dark:text-[#25D366] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Replace a Device
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {/* Mobile Device Slot */}
                <div className={`rounded-xl border p-4 ${hasMobile ? 'border-[#E0E5E7] dark:border-[#222D34] bg-[#F5F7F8] dark:bg-[#2A3942]/40' : 'border-dashed border-[#E0E5E7] dark:border-[#222D34]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className={`h-5 w-5 ${hasMobile ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781]'}`} />
                      <strong className="text-sm">Mobile Phone</strong>
                    </div>
                    {hasMobile ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Registered
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">Available Slot</span>
                    )}
                  </div>
                  {hasMobile ? (
                    <div className="mt-2 text-xs text-[#667781] dark:text-[#8696A0] space-y-0.5">
                      {activeDevices.filter(d => d.deviceType === 'mobile').map(d => (
                        <div key={d.deviceId}>
                          <p className="font-medium text-[#111B21] dark:text-[#E9EDEF]">{d.browserName || 'Mobile Safari / Chrome'}</p>
                          <p className="font-mono text-[10px]">ID: {d.deviceId.slice(0, 18)}…</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">● Active</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#667781] dark:text-[#8696A0]">Sign in from your personal mobile phone to register device.</p>
                  )}
                </div>

                {/* Computer Slot */}
                <div className={`rounded-xl border p-4 ${hasDesktop ? 'border-[#E0E5E7] dark:border-[#222D34] bg-[#F5F7F8] dark:bg-[#2A3942]/40' : 'border-dashed border-[#E0E5E7] dark:border-[#222D34]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Laptop className={`h-5 w-5 ${hasDesktop ? 'text-[#128C7E] dark:text-[#25D366]' : 'text-[#667781]'}`} />
                      <strong className="text-sm">Desktop / Laptop</strong>
                    </div>
                    {hasDesktop ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Registered
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#667781] dark:text-[#8696A0]">Available Slot</span>
                    )}
                  </div>
                  {hasDesktop ? (
                    <div className="mt-2 text-xs text-[#667781] dark:text-[#8696A0] space-y-0.5">
                      {activeDevices.filter(d => d.deviceType === 'desktop').map(d => (
                        <div key={d.deviceId}>
                          <p className="font-medium text-[#111B21] dark:text-[#E9EDEF]">{d.browserName || 'Desktop Chrome / Edge / Safari'}</p>
                          <p className="font-mono text-[10px]">ID: {d.deviceId.slice(0, 18)}…</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">● Active</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#667781] dark:text-[#8696A0]">Sign in from your laptop or PC to register your computer.</p>
                  )}
                </div>
              </div>
            </section>

            {/* Purchased Packages & Examinations */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#128C7E] dark:text-[#25D366]" /> My Purchased Courses & Entitlements
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {portal.accesses.map((a: any) => {
                  const displayTitle = a.packageTitle || a.packageId || a.examination || 'Complete Preparation Package';
                  const displayVersion = a.packageVersion || '';
                  const targetCourseId = a.courseId || (a.packageId === 'DHA Registered Nurse' || a.examination === 'DHA Registered Nurse' ? 'course-dha-rn-2026' : (a.courseId || 'course-dha-rn-2026'));
                  const hasMockTest = (a.services || a.allowedServices || []).some((s: unknown) => String(s) === 'mock-tests' || String(s) === 'mock_test');

                  return (
                    <article key={a.id} className="rounded-2xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33] p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base text-[#111B21] dark:text-white">
                          {displayTitle} {displayVersion ? `· ${displayVersion}` : ''}
                        </h3>
                        <span className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-semibold">Active</span>
                      </div>
                      <p className="text-xs text-[#667781] dark:text-[#8696A0] flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Access valid until {new Date(a.endsAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-[#3B4A54] dark:text-[#AEBAC1]">
                        Mock test allowance: <strong className="text-[#111B21] dark:text-white">{a.attemptAllowance || 'Included in bundle'}</strong>
                      </p>
                      {targetCourseId && (
                        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-[#E0E5E7] dark:border-[#222D34]">
                          <button
                            className="rounded-xl bg-[#128C7E] dark:bg-[#25D366] dark:text-[#111B21] text-white px-3.5 py-2 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                            onClick={() => {
                              void loadPractice(targetCourseId, 'practice');
                            }}
                          >
                            Interactive MCQ Practice
                          </button>
                          {hasMockTest && (
                            <button
                              className="rounded-xl border border-[#128C7E] px-3.5 py-2 text-xs font-semibold text-[#128C7E] dark:text-[#25D366] dark:border-[#25D366] hover:bg-[#128C7E]/10 transition-colors cursor-pointer"
                              onClick={() => {
                                void loadPractice(targetCourseId, 'mock');
                              }}
                            >
                              Timed Mock Exam
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {!portal.accesses.length && (
                <div className="rounded-2xl border border-dashed border-[#E0E5E7] bg-white p-6 dark:border-[#222D34] dark:bg-[#202C33] text-center text-[#667781] dark:text-[#8696A0]">
                  No active entitlements prepared yet. If you completed payment, your coordinator is preparing your syllabus.
                </div>
              )}
            </section>

            {/* Practice Runner Modal / View */}
            {practiceCourse && (
              <StudentPracticeRunner
                courseId={practiceCourse}
                mode={practiceMode}
                request={request}
                onClose={() => {
                  setPracticeCourse('');
                  setQuestions([]);
                }}
              />
            )}

            {/* Exam Study Materials with Dynamic Watermark */}
            <section className="rounded-3xl bg-[#ECE5DD] dark:bg-[#202C33] border border-[#E0E5E7] dark:border-[#222D34] p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696A0]">Official Examination Syllabus</p>
                  <h2 className="text-xl font-bold">Protected Study Materials</h2>
                </div>
                <span className="rounded-full bg-white dark:bg-[#2A3942] border border-[#E0E5E7] dark:border-[#222D34] px-3 py-1 text-xs text-[#667781] dark:text-[#8696A0]">
                  {portal.assets.length} items published
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {portal.assets.map((a: any) => (
                  <button
                    key={a.id + ':' + a.entitlementId}
                    className="rounded-2xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#2A3942] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#128C7E] dark:hover:border-[#25D366]"
                    onClick={async () => {
                      try {
                        setMaterial(await request('/materials/' + encodeURIComponent(a.id)));
                        setError('');
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm font-semibold">{a.title}</strong>
                      <span className="text-xs text-[#128C7E] dark:text-[#25D366] font-bold">Open</span>
                    </div>
                    <p className="mt-2 text-xs text-[#667781] dark:text-[#8696A0]">
                      Reviewed Version {a.version} · Dynamic security watermarked
                    </p>
                  </button>
                ))}
              </div>
              {!portal.assets.length && (
                <p className="rounded-2xl border border-dashed border-[#E0E5E7] bg-white/60 dark:border-[#222D34] dark:bg-[#2A3942]/60 p-6 text-xs text-[#667781] dark:text-[#8696A0] text-center">
                  Published study materials will appear here once your Exam Officer assigns them.
                </p>
              )}
            </section>

            {/* Document Reader / Watermark Viewer */}
            {material && (
              <article className="rounded-2xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33] p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                  <h2 className="text-xl font-bold">{material.title}</h2>
                  <button
                    onClick={() => setMaterial(null)}
                    className="text-xs text-[#667781] dark:text-[#8696A0] hover:underline"
                  >
                    Close document
                  </button>
                </div>
                <div className="rounded-lg bg-teal-500/10 p-2.5 text-xs text-teal-800 dark:text-teal-200 font-mono text-center">
                  {material.watermark}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-sm">
                  {material.text}
                </div>
              </article>
            )}

            {/* Support Desk Request */}
            <form
              className="rounded-2xl border border-[#E0E5E7] bg-white dark:border-[#222D34] dark:bg-[#202C33] p-5 space-y-3 shadow-sm"
              onSubmit={async event => {
                event.preventDefault();
                setBusy(true);
                try {
                  const res = await request('/support', 'POST', { message: support });
                  setNotice('Support case submitted successfully (Reference: ' + res.id + '). An exam coordinator will assist you.');
                  setSupport('');
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2 className="font-bold flex items-center gap-2 text-base">
                <HelpCircle className="h-5 w-5 text-[#128C7E] dark:text-[#25D366]" /> Need Assistance?
              </h2>
              <textarea
                required
                minLength={5}
                maxLength={5000}
                className={field}
                value={support}
                onChange={e => setSupport(e.target.value)}
                placeholder="Describe any issues regarding materials, question bank access, or device changes…"
                rows={3}
              />
              <button
                disabled={busy}
                className="rounded-xl bg-[#128C7E] dark:bg-[#25D366] dark:text-[#111B21] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-[#075E54] dark:hover:bg-[#20bd5a] transition-colors"
              >
                Submit Support Request
              </button>
            </form>
          </div>
        )}

        {/* 3RD DEVICE REPLACEMENT MODAL / WORKFLOW */}
        {showReplacementModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-lg rounded-3xl border border-[#E0E5E7] bg-white p-6 dark:border-[#222D34] dark:bg-[#202C33] shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-[#E0E5E7] dark:border-[#222D34] pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-amber-500/10 p-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Device Replacement Request</h3>
                    <p className="text-xs text-[#667781] dark:text-[#8696A0]">2-Device Maximum Limit Reached</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReplacementModal(false)}
                  className="rounded-full p-1 hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942] text-sm text-[#667781]"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-xl bg-[#F5F7F8] dark:bg-[#2A3942]/40 p-4 text-xs space-y-1.5 text-[#667781] dark:text-[#8696A0]">
                <p><strong>Alpha Health Group Security Policy:</strong></p>
                <p>• Maximum 2 registered devices: strictly 1 Mobile Phone AND 1 Desktop/Laptop.</p>
                <p>• Replacing a device requires verifying an 8-digit OTP code sent to your personal email, followed by Exam Department Administrator approval.</p>
                <p>• Approving this replacement will revoke your previous {detectedType === 'mobile' ? 'Mobile Phone' : 'Desktop/Laptop'} and immediately terminate all active sessions on that device.</p>
              </div>

              {replacementStatus === 'IDLE' && (
                <form onSubmit={handleRequestReplacement} className="space-y-4">
                  <label className="block text-xs font-semibold text-[#667781] dark:text-[#8696A0]">
                    Verified Student Email
                    <input
                      required
                      type="email"
                      value={replacementEmail}
                      onChange={e => setReplacementEmail(e.target.value)}
                      placeholder="student@example.com"
                      className={`mt-1 ${field}`}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-[#E0E5E7] dark:border-[#222D34] p-3 bg-white dark:bg-[#2A3942]">
                      <span className="text-[#667781] dark:text-[#8696A0]">New Device Category:</span>
                      <strong className="block mt-1 font-semibold">{detectedType === 'mobile' ? 'Mobile Phone' : 'Desktop / Laptop'}</strong>
                    </div>
                    <div className="rounded-xl border border-[#E0E5E7] dark:border-[#222D34] p-3 bg-white dark:bg-[#2A3942]">
                      <span className="text-[#667781] dark:text-[#8696A0]">Browser:</span>
                      <strong className="block mt-1 font-semibold">{browserName}</strong>
                    </div>
                  </div>

                  <label className="block text-xs font-semibold text-[#667781] dark:text-[#8696A0]">
                    Reason for Replacement
                    <input
                      required
                      type="text"
                      value={replacementReason}
                      onChange={e => setReplacementReason(e.target.value)}
                      placeholder="e.g. Purchased new iPhone 15, Old laptop sold"
                      className={`mt-1 ${field}`}
                    />
                  </label>

                  <button
                    disabled={replacementBusy}
                    className="w-full rounded-xl bg-[#128C7E] dark:bg-[#25D366] dark:text-[#111B21] text-white py-3 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {replacementBusy ? 'Sending 8-Digit OTP…' : 'Send 8-Digit OTP to My Email'}
                  </button>
                </form>
              )}

              {replacementStatus === 'OTP_SENT' && (
                <form onSubmit={handleVerifyReplacementOtp} className="space-y-4">
                  <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 text-xs text-teal-800 dark:text-teal-200">
                    An 8-digit OTP code has been sent to <strong>{replacementEmail}</strong>. Enter the code below:
                  </div>

                  <label className="block text-xs font-semibold text-[#667781] dark:text-[#8696A0]">
                    Enter 8-Digit Code
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      maxLength={8}
                      value={replacementOtp}
                      onChange={e => setReplacementOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="12345678"
                      className={`mt-1 text-center font-mono text-xl tracking-widest ${field}`}
                    />
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReplacementStatus('IDLE')}
                      className="w-1/3 rounded-xl border border-[#E0E5E7] dark:border-[#222D34] py-3 text-sm font-semibold hover:bg-[#F0F2F5] dark:hover:bg-[#2A3942]"
                    >
                      Back
                    </button>
                    <button
                      disabled={replacementBusy || replacementOtp.length !== 8}
                      className="w-2/3 rounded-xl bg-[#128C7E] dark:bg-[#25D366] dark:text-[#111B21] text-white py-3 text-sm font-semibold disabled:opacity-50 hover:opacity-90"
                    >
                      {replacementBusy ? 'Validating…' : 'Verify & Submit Request'}
                    </button>
                  </div>
                </form>
              )}

              {replacementStatus === 'PENDING_APPROVAL' && (
                <div className="space-y-4 text-center py-2">
                  <div className="inline-flex rounded-full bg-amber-500/10 p-3 text-amber-600">
                    <Clock className="h-8 w-8 animate-pulse" />
                  </div>
                  <h4 className="font-bold text-base">Pending Exam Department Admin Approval</h4>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                    Your OTP code was successfully verified. Your request (Challenge ID: <span className="font-mono">{replacementChallengeId.slice(0, 8)}…</span>) is in <strong className="text-amber-600">PENDING_ADMIN_APPROVAL</strong> status.
                  </p>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                    Once Head of Exam or Super Admin approves your replacement in the CRM, your previous {detectedType === 'mobile' ? 'Mobile Phone' : 'Desktop'} will be revoked and this device will gain full access.
                  </p>
                  <button
                    onClick={checkReplacementStatus}
                    disabled={replacementBusy}
                    className="rounded-xl border border-[#128C7E] dark:border-[#25D366] text-[#128C7E] dark:text-[#25D366] px-5 py-2.5 text-xs font-semibold hover:bg-[#128C7E]/10 flex items-center justify-center gap-2 mx-auto"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${replacementBusy ? 'animate-spin' : ''}`} />
                    Check Approval Status
                  </button>
                </div>
              )}

              {replacementStatus === 'APPROVED' && (
                <div className="space-y-4 text-center py-2">
                  <div className="inline-flex rounded-full bg-emerald-500/10 p-3 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-base text-emerald-600">Device Replacement Approved!</h4>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                    Your new device has been successfully authorized and your previous device has been revoked. You can now sign in normally.
                  </p>
                  <button
                    onClick={() => {
                      setShowReplacementModal(false);
                      setReplacementStatus('IDLE');
                    }}
                    className="w-full rounded-xl bg-[#128C7E] dark:bg-[#25D366] dark:text-[#111B21] text-white py-3 text-sm font-semibold"
                  >
                    Continue to Sign In
                  </button>
                </div>
              )}

              {replacementStatus === 'LOCKED' && (
                <div className="space-y-3 text-center py-2">
                  <div className="inline-flex rounded-full bg-red-500/10 p-3 text-red-600">
                    <ShieldAlert className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-base text-rose-600">Challenge Locked</h4>
                  <p className="text-xs text-[#667781] dark:text-[#8696A0]">
                    5 consecutive incorrect OTP codes were entered. For security protection, this device replacement challenge is locked for 1 hour.
                  </p>
                  <button
                    onClick={() => setShowReplacementModal(false)}
                    className="w-full rounded-xl border border-[#E0E5E7] dark:border-[#222D34] py-2.5 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
