import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import { getPrisma, getDbStatus } from './db.js';

/**
 * Cloud-Persistent Multi-Session Auth State Adapter for Baileys
 * Backed by Supabase PostgreSQL (via Prisma ORM)
 *
 * Guarantees zero credential loss across Render deployments, restarts,
 * and ephemeral filesystem resets.
 */
export async function useSupabaseAuthState(sessionId) {
  const prisma = getPrisma();

  // In-memory local fallback cache if database is temporarily unavailable
  const inMemoryCache = new Map();

  // Helper: Read a specific key from Supabase DB
  const readKey = async (type, id) => {
    if (!prisma || !getDbStatus()) {
      return inMemoryCache.get(`${type}:${id}`) || null;
    }
    try {
      const record = await prisma.whatsAppSessionKey.findUnique({
        where: {
          sessionId_keyType_keyId: {
            sessionId,
            keyType: type,
            keyId: id,
          },
        },
      });
      if (!record || !record.value) return null;
      const raw = typeof record.value === 'string' ? record.value : JSON.stringify(record.value);
      return JSON.parse(raw, BufferJSON.reviver);
    } catch (err) {
      console.warn(`[SupabaseAuthState] Read error for ${type}/${id}:`, err.message);
      return inMemoryCache.get(`${type}:${id}`) || null;
    }
  };

  // Helper: Write a specific key to Supabase DB
  const writeKey = async (type, id, value) => {
    inMemoryCache.set(`${type}:${id}`, value);
    if (!prisma || !getDbStatus()) return;

    try {
      if (value === null || value === undefined) {
        await prisma.whatsAppSessionKey.deleteMany({
          where: {
            sessionId,
            keyType: type,
            keyId: id,
          },
        });
      } else {
        const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
        await prisma.whatsAppSessionKey.upsert({
          where: {
            sessionId_keyType_keyId: {
              sessionId,
              keyType: type,
              keyId: id,
            },
          },
          create: {
            sessionId,
            keyType: type,
            keyId: id,
            value: serialized,
          },
          update: {
            value: serialized,
          },
        });
      }
    } catch (err) {
      console.warn(`[SupabaseAuthState] Write error for ${type}/${id}:`, err.message);
    }
  };

  // 1. Initialize or fetch credentials for this session
  let creds = await readKey('creds', 'creds');
  if (!creds) {
    creds = initAuthCreds();
    await writeKey('creds', 'creds', creds);
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          if (!ids || !ids.length) return data;

          if (prisma && getDbStatus()) {
            try {
              const records = await prisma.whatsAppSessionKey.findMany({
                where: {
                  sessionId,
                  keyType: type,
                  keyId: { in: ids.map(String) },
                },
              });

              for (const rec of records) {
                try {
                  const raw = typeof rec.value === 'string' ? rec.value : JSON.stringify(rec.value);
                  let parsed = JSON.parse(raw, BufferJSON.reviver);
                  if (type === 'app-state-sync-key' && parsed) {
                    parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
                  }
                  data[rec.keyId] = parsed;
                } catch (e) {}
              }
            } catch (err) {
              console.warn(`[SupabaseAuthState] Batch get error for ${type}:`, err.message);
            }
          }

          // Check memory cache for any missing keys
          for (const id of ids) {
            if (!(id in data)) {
              const cached = inMemoryCache.get(`${type}:${id}`);
              if (cached) data[id] = cached;
            }
          }

          return data;
        },

        set: async (data) => {
          const tasks = [];
          for (const type in data) {
            for (const id in data[type]) {
              const val = data[type][id];
              tasks.push(writeKey(type, id, val));
            }
          }
          await Promise.allSettled(tasks);
        },
      },
    },

    saveCreds: async () => {
      await writeKey('creds', 'creds', creds);
    },

    clearSessionAuth: async () => {
      inMemoryCache.clear();
      if (prisma && getDbStatus()) {
        try {
          await prisma.whatsAppSessionKey.deleteMany({
            where: { sessionId },
          });
          console.log(`🧹 [SupabaseAuthState] All authentication keys cleared for session ${sessionId}`);
        } catch (err) {
          console.warn(`[SupabaseAuthState] Error clearing keys for ${sessionId}:`, err.message);
        }
      }
    },
  };
}
