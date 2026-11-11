/**
 * Meta Click-to-WhatsApp Ads Attribution Helper
 * Extracts `message.referral` metadata from inbound Meta WhatsApp Cloud API webhooks
 * and records a deduplicated attribution note on the associated lead.
 */

export function extractClickToWhatsAppReferral(message) {
  const ref = message?.referral;
  if (!ref || typeof ref !== 'object') return null;

  const hasFields = Boolean(
    ref.source_id ||
    ref.source_url ||
    ref.headline ||
    ref.body ||
    ref.ctwa_clid ||
    ref.source_type
  );
  if (!hasFields) return null;

  return {
    sourceType: ref.source_type || 'ad',
    sourceId: ref.source_id || null,
    sourceUrl: ref.source_url || null,
    headline: ref.headline || null,
    body: ref.body || null,
    ctwaClid: ref.ctwa_clid || null,
    mediaType: ref.media_type || null,
  };
}

async function resolveAttributionAuthor(prisma) {
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'super_admin', active: true },
    select: { id: true, fullName: true },
  }).catch(() => null);
  if (superAdmin) return superAdmin;

  return prisma.user.findFirst({
    where: { active: true },
    select: { id: true, fullName: true },
  }).catch(() => null);
}

export async function recordMetaAdReferralNote({ prisma, leadId, referral }) {
  if (!prisma || !leadId || !referral) return null;

  const author = await resolveAttributionAuthor(prisma);
  if (!author) return null;

  const lines = [
    '[Meta Click-to-WhatsApp Ad Referral]',
    referral.headline ? `Ad Headline: ${referral.headline}` : null,
    referral.sourceId ? `Ad / Source ID: ${referral.sourceId}` : null,
    referral.sourceUrl ? `Ad URL: ${referral.sourceUrl}` : null,
    referral.ctwaClid ? `CTWA Click ID: ${referral.ctwaClid}` : null,
    referral.body ? `Ad Copy: ${String(referral.body).slice(0, 240)}` : null,
  ].filter(Boolean);

  const noteText = lines.join('\n');

  // Prevent duplicate attribution notes on Meta webhook retries
  const dedupeMarker = referral.ctwaClid || referral.sourceId || referral.sourceUrl || noteText;
  const existing = await prisma.leadNote.findFirst({
    where: { leadId, note: { contains: String(dedupeMarker) } },
  }).catch(() => null);
  if (existing) return existing;

  return prisma.leadNote.create({
    data: {
      leadId,
      authorId: author.id,
      authorName: 'Meta Ads Attribution',
      note: noteText,
    },
  }).catch(() => null);
}
