import crypto from 'node:crypto';
import { ExamError } from './examPolicy.js';

export class MemoryExamStore {
  rows = new Map();
  events = [];
  queue = Promise.resolve();

  async transaction(work) {
    const run = this.queue.then(async () => {
      const rows = structuredClone(this.rows);
      const events = structuredClone(this.events);
      const tx = {
        lock: async () => {},
        query: async () => [],
        get: async (kind, id) => structuredClone(rows.get(kind + ':' + id) || null),
        list: async (kind, ownerId = null) => {
          return [...rows.entries()]
            .filter(([key, val]) => key.startsWith(kind + ':') && (!ownerId || val.ownerId === ownerId || val.studentId === ownerId))
            .map(([, val]) => structuredClone(val));
        },
        put: async (kind, id, data) => {
          const { revision, ...payload } = data;
          const key = kind + ':' + id;
          const rev = (rows.get(key)?.revision || 0) + 1;
          const result = { ...structuredClone(payload), revision: rev };
          rows.set(key, result);
          return result;
        },
        delete: async (kind, id) => {
          rows.delete(kind + ':' + id);
        },
        audit: async (actorId, action, target, details = {}) => {
          const ev = { id: crypto.randomUUID(), actorId, action, target, details: structuredClone(details), at: new Date().toISOString() };
          events.push(ev);
          return ev;
        }
      };
      const result = await work(tx);
      this.rows = rows;
      this.events = events;
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

let sharedMemoryStore = null;
export function getSharedMemoryExamStore() {
  if (!sharedMemoryStore) sharedMemoryStore = new MemoryExamStore();
  return sharedMemoryStore;
}

export class ExamStore {
  constructor(prisma) { this.prisma = prisma; }
  async transaction(work) {
    if (!this.prisma) {
      if (process.env.EXAM_ALLOW_MEMORY_FIXTURES === 'true' || process.env.NODE_ENV === 'test') {
        return getSharedMemoryExamStore().transaction(work);
      }
      throw new ExamError(503, 'DATABASE_UNAVAILABLE', 'Exam operations require durable database storage.');
    }
    try {
      return await this.prisma.$transaction(tx => work(new ExamTransaction(tx)), { timeout: 15000 });
    } catch (error) {
      if (error instanceof ExamError) throw error;
      console.error('[ExamStore] Transaction failure root cause:', error);
      if (process.env.EXAM_ALLOW_MEMORY_FIXTURES === 'true' || process.env.NODE_ENV === 'test') {
        return getSharedMemoryExamStore().transaction(work);
      }
      // Never expose SQL, connection strings, or database error text to students.
      throw new ExamError(503, 'EXAM_STORAGE_UNAVAILABLE', 'Exam storage is unavailable or its migration has not been applied.');
    }
  }
}

class ExamTransaction {
  constructor(tx) { this.tx = tx; }
  async query(sql, ...values) { return this.tx.$queryRawUnsafe(sql, ...values); }
  async lock(key) {
    await this.tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))::text AS locked', key);
  }
  async get(kind, id, lock = false) {
    const rows = await this.tx.$queryRawUnsafe('SELECT data, revision FROM public.exam_ops_records WHERE kind=$1 AND id=$2' + (lock ? ' FOR UPDATE' : ''), kind, id);
    return rows[0] ? { ...rows[0].data, revision: rows[0].revision } : null;
  }
  async list(kind, ownerId = null) {
    const rows = ownerId
      ? await this.tx.$queryRawUnsafe("SELECT data, revision FROM public.exam_ops_records WHERE kind=$1 AND data->>'ownerId'=$2 ORDER BY updated_at DESC LIMIT 500", kind, ownerId)
      : await this.tx.$queryRawUnsafe('SELECT data, revision FROM public.exam_ops_records WHERE kind=$1 ORDER BY updated_at DESC LIMIT 500', kind);
    return rows.map(row => ({ ...row.data, revision: row.revision }));
  }
  async put(kind, id, data) {
    const { revision, ...payload } = data;
    const rows = await this.tx.$queryRawUnsafe(`INSERT INTO public.exam_ops_records(kind,id,data) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data, revision=exam_ops_records.revision+1, updated_at=now() RETURNING revision`, kind, id, JSON.stringify(payload));
    return { ...payload, revision: rows[0].revision };
  }
  async audit(actorId, action, target, details = {}) {
    await this.tx.$executeRawUnsafe('INSERT INTO public.exam_ops_audit(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)', actorId, action, target, JSON.stringify(details));
  }
}
