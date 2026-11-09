import { ExamOperations } from './examOperations.js';
import { ExamStore } from './examStore.js';
import { getPrisma, waitForSchemaBootstrap } from './db.js';

// Read-only operational checks continue while the backend runs, even when no
// staff browser is open. No emails, WhatsApp messages or database writes.
let state = { status: 'UNKNOWN', checkedAt: null, result: null };
let running = false;
let timer;
export function getExamMonitorStatus() { return structuredClone(state); }
export async function checkExamMonitor() {
  if (running) return;
  running = true;
  try {
    const prisma = getPrisma();
    if (!prisma) {
      state = { status: 'DATABASE_UNAVAILABLE', checkedAt: new Date().toISOString(), result: null };
      return;
    }
    // Await background schema bootstrap so startup checks do not race table creation
    await waitForSchemaBootstrap().catch(() => {});
    const result = await new ExamOperations(new ExamStore(prisma)).health({ id: 'system:exam-monitor', role: 'super_admin' });
    state = { status: 'CHECKED', checkedAt: new Date().toISOString(), result };
  } catch (err) {
    state = { status: 'UNAVAILABLE', checkedAt: new Date().toISOString(), result: null, error: err?.message || 'Storage unavailable' };
  } finally { running = false; }
}
export function startExamMonitor() {
  if (timer) return;
  void checkExamMonitor();
  timer = setInterval(() => void checkExamMonitor(), 60000);
  timer.unref();
}
