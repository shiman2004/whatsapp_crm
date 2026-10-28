import { ExamError } from './examPolicy.js';

export class ExamStore {
  constructor(prisma) { this.prisma = prisma; }
  async transaction(work) {
    if (!this.prisma) throw new ExamError(503, 'DATABASE_UNAVAILABLE', 'Exam operations require durable database storage.');
    try {
      return await this.prisma.$transaction(tx => work(new ExamTransaction(tx)), { timeout: 15000 });
    } catch (error) {
      if (error instanceof ExamError) throw error;
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
