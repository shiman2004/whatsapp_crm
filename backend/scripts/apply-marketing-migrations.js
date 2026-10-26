import { getPrisma } from '../src/db.js';

async function applyMigrations() {
  const prisma = getPrisma();
  console.log('Connecting to database to apply marketing migrations...');

  try {
    // 1. Marketing contact serials table & function
    console.log('Creating marketing_contact_serials table & allocator...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.marketing_contact_serials (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), 
        next_value BIGINT NOT NULL DEFAULT 1
      );
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO public.marketing_contact_serials (id, next_value) 
      VALUES (1, 1) 
      ON CONFLICT (id) DO NOTHING;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.next_marketing_contact_serial() RETURNS VARCHAR LANGUAGE plpgsql AS $$
      DECLARE allocated_value BIGINT;
      BEGIN
        UPDATE public.marketing_contact_serials SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value - 1 INTO allocated_value;
        RETURN 'MKT-' || LPAD(allocated_value::TEXT, 8, '0');
      END;
      $$;
    `);

    // 2. Types
    console.log('Creating MarketingContactStatus and MarketingConversionStatus enums...');
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN 
        CREATE TYPE "MarketingContactStatus" AS ENUM ('new','assigned','follow_up_pending','contacted','interested','not_interested','no_response','converted','do_not_contact'); 
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN 
        CREATE TYPE "MarketingConversionStatus" AS ENUM ('pending','approved','linked_existing','rejected'); 
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // 3. Marketing Contacts additive columns
    console.log('Adding columns to marketing_contacts...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS lifecycle_status "MarketingContactStatus" NOT NULL DEFAULT 'new';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS converted_lead_id VARCHAR(50);
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS qualification_note TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS marketing_contacts_lifecycle_idx ON public.marketing_contacts(company, lifecycle_status, converted_lead_id);
    `);

    // 4. Marketing Contact Activities table
    console.log('Creating marketing_contact_activities table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.marketing_contact_activities (
        id VARCHAR(36) PRIMARY KEY, 
        contact_id VARCHAR(36) NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
        actor_id VARCHAR(36) NOT NULL REFERENCES public.users(id), 
        type VARCHAR(60) NOT NULL, 
        note TEXT, 
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS marketing_contact_activities_idx ON public.marketing_contact_activities(contact_id, created_at);
    `);

    // 5. Marketing Lead Conversions table
    console.log('Creating marketing_lead_conversions table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.marketing_lead_conversions (
        id VARCHAR(36) PRIMARY KEY, 
        contact_id VARCHAR(36) NOT NULL UNIQUE REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
        lead_id VARCHAR(50), 
        company VARCHAR(50) NOT NULL, 
        status "MarketingConversionStatus" NOT NULL DEFAULT 'pending',
        requested_by_id VARCHAR(36) NOT NULL REFERENCES public.users(id), 
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by_id VARCHAR(36) REFERENCES public.users(id), 
        reviewed_at TIMESTAMPTZ, 
        rejection_reason TEXT,
        duplicate_lead_id VARCHAR(50), 
        officer_note TEXT, 
        consent_evidence TEXT, 
        source_batch_id VARCHAR(36), 
        campaign_id VARCHAR(36),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS marketing_lead_conversions_review_idx ON public.marketing_lead_conversions(company, status, requested_at);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS marketing_lead_conversions_lead_idx ON public.marketing_lead_conversions(lead_id);
    `);

    // 6. Consent governance (additive)
    console.log('Applying consent governance changes...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(50);`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_reference VARCHAR(255);`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS marketing_consent_events_contact_occurred_idx ON public.marketing_consent_events(contact_id, recorded_at);`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS marketing_consent_events_company_occurred_idx ON public.marketing_consent_events(company_id, recorded_at);`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS marketing_consent_events_decision_occurred_idx ON public.marketing_consent_events(status, recorded_at);`);
      await prisma.$executeRawUnsafe(`UPDATE public.marketing_consent_events e SET company_id = c.company FROM public.marketing_contacts c WHERE e.contact_id = c.id AND e.company_id IS NULL;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS marketing_contact_id VARCHAR(36);`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS leads_marketing_contact_id_key ON public.leads(marketing_contact_id);`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS leads_marketing_contact_id_idx ON public.leads(marketing_contact_id);`);
    } catch (e) {
      console.log('Consent governance partial apply:', e?.message);
    }

    console.log('Testing serial generator now...');
    const serial = await prisma.$queryRawUnsafe('SELECT public.next_marketing_contact_serial() AS serial');
    console.log('SUCCESS! Serial generated:', serial[0]?.serial);

    console.log('All marketing schema migrations applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigrations();

