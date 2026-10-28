import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ExamOperations, orderKey } from './src/examOperations.js';
import { StudentAccess } from './src/studentAccess.js';
import { legacyExamAccess, validateHandoff } from './src/examPolicy.js';

// Transactional test double: serializes work and rolls back failures. No live DB.
class TestStore {
  rows = new Map(); queue = Promise.resolve(); events = [];
  async transaction(work) {
    const run = this.queue.then(async () => {
      const rows = structuredClone(this.rows); const events = structuredClone(this.events);
      const tx = {
        lock: async () => {},
        get: async (kind,id) => structuredClone(rows.get(kind + ':' + id) || null),
        list: async (kind,owner) => [...rows.entries()].filter(([key,value]) => key.startsWith(kind + ':') && (!owner || value.ownerId === owner)).map(([,value]) => structuredClone(value)),
        put: async (kind,id,data) => { const key = kind + ':' + id; const result = { ...structuredClone(data), revision: (rows.get(key)?.revision || 0) + 1 }; rows.set(key,result); return result; },
        audit: async (...event) => { events.push(event); },
      };
      const value = await work(tx); this.rows = rows; this.events = events; return value;
    });
    this.queue = run.catch(() => {}); return run;
  }
}
const admin = { id: 'admin', role: 'super_admin' };
const sales = { id: 'sales-a', role: 'coordinator', company: 'CRAS' };
const otherSales = { id: 'sales-b', role: 'coordinator', company: 'CRAS' };
const input = () => ({ orderId: crypto.randomUUID(), studentName:'Test Student', email:'student@example.test', phone:'0000000', country:'Sri Lanka', timeZone:'Asia/Colombo', profession:'Nurse', authority:'Test Authority', examName:'Practice', packageId:'NURSE', packageVersion:'1', currency:'USD', amountMinor:12900, durationDays:90, attemptAllowance:3, startTrigger:'activation', services:['Notes','Mock tests'] });
const fails = (promise,code) => assert.rejects(promise,error => error.code === code);

test('legacy global academic routes deny staff roles and absent identity', () => {
  assert.equal(legacyExamAccess(null),401); assert.equal(legacyExamAccess(sales),403);
  assert.equal(legacyExamAccess({id:'x',role:'marketing_admin'}),403);
  assert.equal(legacyExamAccess(admin),200);
});
test('handoff validates dates, time zones, amounts and services', () => {
  for (const changes of [{durationDays:0},{amountMinor:-1},{timeZone:'Invalid/Zone'},{startTrigger:'fixed',fixedStart:'bad'},{services:[]}]) assert.throws(() => validateHandoff({...input(),...changes}));
});
test('duplicate submission is idempotent and cannot overwrite sold terms', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const data = input();
  await ops.submit(sales,data); const repeat = await ops.submit(sales,data); assert.equal(repeat.duplicate,true);
  assert.equal((await ops.list(sales)).length,1);
  await fails(ops.submit(sales,{...data,durationDays:365}),'AMENDMENT_REQUIRED');
  await fails(ops.submit(otherSales,data),'ORDER_CONFLICT');
});
test('sales cannot set owner, approval, status or read another salesperson records', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store);
  const record = await ops.submit(sales,{...input(),ownerId:'someone',paymentStatus:'VERIFIED',status:'DELIVERED'});
  assert.equal(record.ownerId,sales.id); assert.equal(record.paymentStatus,'PENDING');
  assert.equal((await ops.list(otherSales)).length,0);
  await fails(ops.update(sales,record.id,'verify-payment',{revision:1,reference:'bank-ref'}),'FORBIDDEN');
  await fails(ops.update(otherSales,record.id,'transition',{revision:1,status:'ACCEPTED'}),'NOT_FOUND');
});
test('concurrent acceptance has one winner and rejects stale updates', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const r = await ops.submit(sales,input());
  const results = await Promise.allSettled([ops.update(admin,r.id,'transition',{revision:1,status:'ACCEPTED'}),ops.update({id:'admin2',role:'super_admin'},r.id,'transition',{revision:1,status:'ACCEPTED'})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await ops.list(admin))[0].coordinatorId,admin.id);
});
test('payment and checklist gate preparation and no entitlement is created by submission', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const r = await ops.submit(sales,input());
  let current = await ops.update(admin,r.id,'transition',{revision:1,status:'ACCEPTED'});
  await fails(ops.update(admin,r.id,'transition',{revision:current.revision,status:'PREPARING'}),'PAYMENT_REQUIRED');
  assert.equal([...store.rows.keys()].filter(k=>k.startsWith('entitlement:')).length,0);
});
test('amendment preserves previous sold snapshot', async () => {
  const store = new TestStore(); const ops = new ExamOperations(store); const data = input(); const r = await ops.submit(sales,data);
  await ops.update(sales,r.id,'amend',{revision:1,reason:'Correct duration',changes:{durationDays:60}});
  const previous = [...store.rows.entries()].find(([key])=>key.startsWith('revision:'))[1];
  assert.equal(previous.snapshot.durationDays,90); assert.equal((await ops.list(sales))[0].snapshot.durationDays,60);
});
async function account() {
  const store = new TestStore(); const access = new StudentAccess(store,'test-signing-secret-for-local-test-only'); const id = orderKey('student@example.test');
  const passwordHash = await access.hashPassword('A private test passphrase 87654');
  await store.transaction(tx => tx.put('student',id,{id,name:'Student',email:'student@example.test',status:'ACTIVE',generation:0,passwordHash,browserDigest:access.digest('browser-a')}));
  return {store,access,id};
}
function unseal(access,payload) {
  const decipher = crypto.createDecipheriv('aes-256-gcm',access.key,Buffer.from(payload.iv,'base64')); decipher.setAuthTag(Buffer.from(payload.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext,'base64')),decipher.final()]).toString());
}
test('unknown account and wrong password have the same public error', async () => {
  const {access} = await account();
  await fails(access.login('unknown@example.test','wrong','browser-a'),'INVALID_LOGIN');
  await fails(access.login('student@example.test','wrong','browser-a'),'INVALID_LOGIN');
});
test('new browser password alone does not revoke existing session', async () => {
  const {store,access} = await account(); const old = await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const challenge = await access.login('student@example.test','A private test passphrase 87654','browser-b');
  assert.equal(challenge.requiresOtp,true); assert.equal(challenge.token,undefined);
  await access.portal(old.token,'browser-a');
  await fails(access.verifyDevice(challenge.challengeId,'00000000','browser-b'),'INVALID_CODE');
  await access.portal(old.token,'browser-a');
  assert.equal((await store.transaction(tx=>tx.get('challenge',access.digest(challenge.challengeId)))).failures,1);
});
test('verified switch invalidates old session and rejects reused OTP', async () => {
  const {store,access} = await account(); const old = await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const challenge = await access.login('student@example.test','A private test passphrase 87654','browser-b');
  const mail = [...store.rows.values()].find(x=>x.purpose==='device-code'); const code=unseal(access,mail.payload).code;
  assert.equal(JSON.stringify(mail).includes(code),false);
  const next=await access.verifyDevice(challenge.challengeId,code,'browser-b');
  await fails(access.portal(old.token,'browser-a'),'SESSION_EXPIRED'); await access.portal(next.token,'browser-b');
  await fails(access.verifyDevice(challenge.challengeId,code,'browser-b'),'INVALID_CODE');
});
test('five invalid codes lock the challenge while preserving existing session', async () => {
  const {store,access} = await account(); const old=await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const c=await access.login('student@example.test','A private test passphrase 87654','browser-b');
  const mail=[...store.rows.values()].find(x=>x.purpose==='device-code'); const code=unseal(access,mail.payload).code; const wrong=code==='00000000'?'11111111':'00000000';
  for(let i=0;i<5;i++) await fails(access.verifyDevice(c.challengeId,wrong,'browser-b'),'INVALID_CODE');
  await fails(access.verifyDevice(c.challengeId,code,'browser-b'),'INVALID_CODE'); await access.portal(old.token,'browser-a');
});
test('concurrent verified switches have one winner', async () => {
  const {store,access}=await account(); await access.login('student@example.test','A private test passphrase 87654','browser-a');
  const c=await access.login('student@example.test','A private test passphrase 87654','browser-b');
  const mail=[...store.rows.values()].find(x=>x.purpose==='device-code'); const code=unseal(access,mail.payload).code;
  const results=await Promise.allSettled([access.verifyDevice(c.challengeId,code,'browser-b'),access.verifyDevice(c.challengeId,code,'browser-b')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
});
test('logout retains recognition but ends the active session', async () => {
  const {store,access,id}=await account(); const session=await access.login('student@example.test','A private test passphrase 87654','browser-a'); await access.logout(session.token,'browser-a');
  await fails(access.portal(session.token,'browser-a'),'SESSION_EXPIRED'); assert.equal((await store.transaction(tx=>tx.get('student',id))).browserDigest,access.digest('browser-a'));
});
test('expired or suspended entitlement never appears in portal', async () => {
  const {store,access,id}=await account(); const session=await access.login('student@example.test','A private test passphrase 87654','browser-a');
  await store.transaction(async tx=>{ await tx.put('entitlement','one',{id:'one',ownerId:id,status:'ACTIVE',startsAt:'2020-01-01',endsAt:'2020-02-01'}); await tx.put('entitlement','two',{id:'two',ownerId:id,status:'SUSPENDED',startsAt:'2020-01-01',endsAt:'2099-01-01'}); });
  assert.equal((await access.portal(session.token,'browser-a')).accesses.length,0);
});
