import { ClinicalError } from './clinicalPolicy.js';

export class ClinicalStore {
  constructor(prisma) { this.prisma = prisma; }
  async transaction(work) {
    if (!this.prisma) throw new ClinicalError(503, 'DATABASE_UNAVAILABLE', 'Clinical records require durable database storage.');
    try { return await this.prisma.$transaction(tx => work(new ClinicalTransaction(tx)), { timeout: 15000 }); }
    catch (error) {
      if (error instanceof ClinicalError) throw error;
      throw new ClinicalError(503, 'CLINICAL_STORAGE_UNAVAILABLE', 'Clinical storage is unavailable or its migration has not been applied.');
    }
  }
}

class ClinicalTransaction {
  constructor(tx) { this.tx = tx; }
  async get(kind, id, lock = false) {
    const rows = await this.tx.$queryRawUnsafe('SELECT data, revision FROM public.clinical_ops_records WHERE kind=$1 AND id=$2' + (lock ? ' FOR UPDATE' : ''), kind, id);
    return rows[0] ? { ...rows[0].data, revision: rows[0].revision } : null;
  }
  async list(kind) {
    const rows = await this.tx.$queryRawUnsafe('SELECT data, revision FROM public.clinical_ops_records WHERE kind=$1 ORDER BY updated_at DESC LIMIT 500', kind);
    return rows.map(row => ({ ...row.data, revision: row.revision }));
  }
  async put(kind, id, data) {
    const { revision, ...payload } = data;
    const rows = await this.tx.$queryRawUnsafe(`INSERT INTO public.clinical_ops_records(kind,id,data) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data, revision=clinical_ops_records.revision+1, updated_at=now() RETURNING revision`, kind, id, JSON.stringify(payload));
    return { ...payload, revision: rows[0].revision };
  }
  async audit(actorId, action, target, details = {}) {
    await this.tx.$executeRawUnsafe('INSERT INTO public.clinical_ops_audit(actor_id,action,target,details) VALUES($1,$2,$3,$4::jsonb)', actorId, action, target, JSON.stringify(details));
  }
}
