/**
 * Database schema bootstrap.
 *
 * These statements previously ran inline on every `checkDbConnection()` call with
 * `.catch(() => null)`, which silently hid provisioning failures and re-issued the
 * same DDL on every health check. They are kept here (rather than only in Prisma
 * migrations) because production databases were originally created without
 * `prisma migrate`, so the delta must be applied idempotently at least once.
 *
 * They run once per process. Failures are collected and reported instead of being
 * swallowed, so a missing table cannot masquerade as a healthy database.
 *
 * When the reviewed migrations in `prisma/migrations/` are confirmed applied on
 * every environment, this module can be deleted and the app can rely on
 * `prisma migrate deploy` alone.
 */

const STATEMENTS = [
  // --- departmental staff roles ----------------------------------------------
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'sales_coordinator';`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'exam_department_manager';`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'exam_coordinator';`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'exam_providing_officer';`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'clinical_nurse';`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'clinical_doctor';`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'report_analyst';`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'finance_officer';`,

  // --- lead workflow forwarding stages ---------------------------------------
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'forwarded_to_exam_department';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'forwarded_to_processing_department';`,

  // --- leads table shape -------------------------------------------------------
  `ALTER TABLE "leads" ALTER COLUMN "categoryId" DROP NOT NULL;`,
  `ALTER TABLE "leads" ALTER COLUMN "treatmentId" DROP NOT NULL;`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "serialNumber" VARCHAR(50);`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) DEFAULT 'RWC';`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "company" VARCHAR(50) DEFAULT 'RWC';`,

  // --- company-scoped lead serial allocator (atomic, single statement) ---------
  `CREATE TABLE IF NOT EXISTS public.company_lead_serials (
     company VARCHAR(10) PRIMARY KEY,
     next_value INTEGER NOT NULL DEFAULT 1
   );`,
  `INSERT INTO public.company_lead_serials (company, next_value)
   VALUES ('RWC', 1), ('CRAS', 1), ('AHC', 1)
   ON CONFLICT (company) DO NOTHING;`,
  `CREATE OR REPLACE FUNCTION public.next_company_lead_serial(company_code VARCHAR)
   RETURNS VARCHAR LANGUAGE plpgsql AS $serial$
   DECLARE
     normalized_company VARCHAR(10) := CASE 
       WHEN upper(company_code) = 'CRAS' THEN 'CRAS' 
       WHEN upper(company_code) = 'AHC' THEN 'AHC' 
       ELSE 'RWC' 
     END;
     allocated_value INTEGER;
     candidate_serial VARCHAR(50);
     serial_exists BOOLEAN;
   BEGIN
     INSERT INTO public.company_lead_serials (company, next_value) VALUES (normalized_company, 1) ON CONFLICT (company) DO NOTHING;
     LOOP
       UPDATE public.company_lead_serials
       SET next_value = next_value + 1
       WHERE company = normalized_company
       RETURNING next_value - 1 INTO allocated_value;

       candidate_serial := normalized_company || '-' || lpad(allocated_value::text, 4, '0');

       SELECT EXISTS(
         SELECT 1 FROM public.leads WHERE "serialNumber" = candidate_serial
       ) INTO serial_exists;

       IF NOT serial_exists THEN
         RETURN candidate_serial;
       END IF;
     END LOOP;
   END;
   $serial$;`,

  // --- persistent media storage ------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.media_files (
     id VARCHAR(255) PRIMARY KEY,
     file_name VARCHAR(255) UNIQUE NOT NULL,
     mime_type VARCHAR(100) NOT NULL,
     data BYTEA NOT NULL,
     size INT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_media_files_name ON public.media_files(file_name);`,

  // --- shared login throttling -------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
     rate_key VARCHAR(512) PRIMARY KEY,
     attempt_count INTEGER NOT NULL DEFAULT 0,
     first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
     locked_until TIMESTAMP WITH TIME ZONE,
     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry ON public.auth_rate_limits(locked_until, updated_at);`,

  // --- security audit trail ----------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.security_audit_events (
     id VARCHAR(50) PRIMARY KEY,
     correlation_id VARCHAR(100) NOT NULL,
     actor_id VARCHAR(100),
     action VARCHAR(100) NOT NULL,
     resource VARCHAR(255) NOT NULL,
     outcome VARCHAR(40) NOT NULL,
     metadata TEXT,
     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_security_audit_created ON public.security_audit_events(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON public.security_audit_events(actor_id, created_at DESC);`,

  // --- patient assessment and report workflow -------------------------------
  `CREATE TABLE IF NOT EXISTS public.clinical_ops_records (
     kind VARCHAR(80) NOT NULL,
     id VARCHAR(100) NOT NULL,
     data JSONB NOT NULL,
     revision INTEGER NOT NULL DEFAULT 1,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY(kind, id)
   );`,
  `CREATE INDEX IF NOT EXISTS idx_clinical_ops_kind_updated ON public.clinical_ops_records(kind, updated_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_clinical_ops_status ON public.clinical_ops_records(kind, (data->>'status'));`,
  `CREATE INDEX IF NOT EXISTS idx_clinical_ops_doctor ON public.clinical_ops_records(kind, (data->>'assignedDoctorId'));`,
  `CREATE TABLE IF NOT EXISTS public.clinical_ops_audit (
     id BIGSERIAL PRIMARY KEY,
     actor_id VARCHAR(100),
     action VARCHAR(120) NOT NULL,
     target VARCHAR(120) NOT NULL,
     details JSONB NOT NULL DEFAULT '{}'::jsonb,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_clinical_ops_audit_created ON public.clinical_ops_audit(created_at DESC);`,

  // --- staff broadcasts --------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.team_broadcasts (
     id VARCHAR(50) PRIMARY KEY,
     sender_id VARCHAR(36) NOT NULL,
     sender_name VARCHAR(255) NOT NULL,
     sender_role VARCHAR(50) NOT NULL,
     company VARCHAR(50) DEFAULT 'ALL',
     title VARCHAR(255),
     content TEXT NOT NULL,
     media_type VARCHAR(50),
     media_url TEXT,
     file_name VARCHAR(255),
     file_size INT,
     is_pinned BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.team_broadcasts(created_at DESC);`,

  // --- quick responses (non-meta client message templates) --------------------
  `CREATE TABLE IF NOT EXISTS public.quick_responses (
     id VARCHAR(50) PRIMARY KEY,
     title VARCHAR(255) NOT NULL,
     content TEXT NOT NULL,
     category VARCHAR(100) DEFAULT 'General',
     language VARCHAR(20) DEFAULT 'en',
     shortcut VARCHAR(50),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_quick_responses_created ON public.quick_responses(created_at DESC);`,
  `INSERT INTO public.quick_responses (id, title, content, category, language, shortcut)
   VALUES 
   ('qr-welcome-lang', '🌸 Welcome to Royal Wellness Center (Language Selection)', '🌸 Welcome to Royal Wellness Center!\n\nThank you for contacting us 😊\nWe are happy to assist you with treatment details, pricing, and appointment information.\n\n🌐 Please select your preferred language to continue:\n1️⃣ සිංහල – Sinhala\n2️⃣ தமிழ் – Tamil\n\n👉 Kindly reply with 1 or 2 to continue in your preferred language.\n\nThank you!\nRoyal Wellness Center\nPart of Alpha Health Group', 'Welcome & Greeting', 'multi', 'welcome'),
   ('qr-gfc-tamil', '💉 Advanced GFC Hair Therapy (Tamil – Scalp Checking)', 'வணக்கம்! 😊🌸\n\n**Royal Wellness Center** ஐத் தொடர்புகொண்டமைக்கு நன்றி!\n\n💉 **Advanced GFC Hair Therapy (Growth Factor Concentrate)**\n\nGFC என்பது உங்கள் சொந்த இரத்தத்திலிருந்து பெறப்படும் வளர்ச்சிக் காரணிகளை (Growth Factors) பயன்படுத்தி மேற்கொள்ளப்படும் நவீன தலைமுடி சிகிச்சை முறையாகும்.\n\n🌿 **GFC சிகிச்சையின் முக்கிய நோக்கங்கள்:**\n✅ முடி உதிர்வைக் குறைக்க உதவுதல்\n✅ மெலிந்த முடிகளின் வளர்ச்சியை மேம்படுத்த உதவுதல்\n✅ முடியின் அடர்த்தியை அதிகரிக்க உதவுதல்\n✅ பலவீனமான முடி வேர்களின் செயல்பாட்டை மேம்படுத்த உதவுதல்\n\nசிகிச்சையின் பலன்கள் ஒவ்வொருவருக்கும் மாறுபடலாம். உங்கள் தலைமுடியின் நிலையைப் பொறுத்து மருத்துவர் பொருத்தமான சிகிச்சையைப் பரிந்துரைப்பார்.\n\n🔬 **இலவச தலைமுடி மற்றும் தலைச்சருமப் பரிசோதனை (Scalp Checking)**\n\n📍 **நீங்கள் எந்தப் பகுதியைச் சேர்ந்தவர்?**\n1️⃣ மருதமுனை / கல்முனை\n2️⃣ கொழும்பு\n\nஉங்களுக்கு அருகிலுள்ள எமது கிளையில் மருத்துவர் ஆலோசனைக்கான நேரத்தை முன்பதிவு செய்து தர முடியும். 😊\n\n**நன்றி!**\nRoyal Wellness Center\n*Part of Alpha Health Group*', 'Hair Treatments', 'ta', 'gfc-ta')
   ON CONFLICT (id) DO NOTHING;`,

  // --- whatsapp pre-approved templates (meta graph api) -----------------------
  `CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
     id VARCHAR(100) PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     category VARCHAR(50) DEFAULT 'UTILITY',
     content TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS wa_template_name VARCHAR(255);`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS body TEXT;`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS content TEXT;`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS variables TEXT DEFAULT '[]';`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS meta_id VARCHAR(100);`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS rejected_reason TEXT;`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
  `ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
  `CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_wa_name ON public.whatsapp_templates(wa_template_name);`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-rwc-en', '🌿 Royal Wellness Center (English - Meta Approved)', 'rwc_welcome_greeting', 'UTILITY', 'en'::"LanguageCode", 'Hello {{1}}, thank you for reaching out to Royal Wellness Center. We are delighted to assist you with our medical and aesthetic treatments. How may our team assist you today?', 'Hello {{1}}, thank you for reaching out to Royal Wellness Center. We are delighted to assist you with our medical and aesthetic treatments. How may our team assist you today?', '["Valued Client"]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-rwc-en');`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-cras-en', '🎓 College of Royal Aesthetic - CRAS (English - Meta Approved)', 'cras_welcome_greeting', 'UTILITY', 'en'::"LanguageCode", 'Hello {{1}}, thank you for reaching out to the College of Royal Aesthetic of Sri Lanka CRAS. We are delighted to assist you with our diploma programs and aesthetic training courses. How may our team assist you today?', 'Hello {{1}}, thank you for reaching out to the College of Royal Aesthetic of Sri Lanka CRAS. We are delighted to assist you with our diploma programs and aesthetic training courses. How may our team assist you today?', '["Dr. Perera"]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-cras-en');`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-rwc-si', '🌿 Royal Wellness Center (Sinhala – Meta Approved)', 'rwc_welcome_greeting_si', 'MARKETING', 'si'::"LanguageCode", 'ආයුබෝවන් {{1}}, Royal Wellness Center වෙත සම්බන්ධ වීම පිළිබඳව ඔබට ස්තූතියි. අපගේ වෛද්‍ය සහ රූපලාවන්‍ය ප්‍රතිකාර පිළිබඳව ඔබට සහාය වීමට අපි සතුටු වන්නෙමු. අද දින අප කණ්ඩායමෙන් ඔබට අවශ්‍ය සහාය කුමක්ද?', 'ආයුබෝවන් {{1}}, Royal Wellness Center වෙත සම්බන්ධ වීම පිළිබඳව ඔබට ස්තූතියි. අපගේ වෛද්‍ය සහ රූපලාවන්‍ය ප්‍රතිකාර පිළිබඳව ඔබට සහාය වීමට අපි සතුටු වන්නෙමු. අද දින අප කණ්ඩායමෙන් ඔබට අවශ්‍ය සහාය කුමක්ද?', '["Valued Client"]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-rwc-si');`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-rwc-ta', '🌿 Royal Wellness Center (Tamil – Meta Approved)', 'rwc_welcome_greeting_ta', 'MARKETING', 'ta'::"LanguageCode", 'வணக்கம் {{1}}, Royal Wellness Center ஐ தொடர்பு கொண்டதற்கு நன்றி. எங்களது மருத்துவ மற்றும் அழகு சிகிச்சை சேவைகளில் உங்களுக்கு உதவ நாங்கள் மகிழ்ச்சியடைகிறோம். இன்று எங்கள் குழுவிடமிருந்து உங்களுக்கு என்ன உதவி தேவை?', 'வணக்கம் {{1}}, Royal Wellness Center ஐ தொடர்பு கொண்டதற்கு நன்றி. எங்களது மருத்துவ மற்றும் அழகு சிகிச்சை சேவைகளில் உங்களுக்கு உதவ நாங்கள் மகிழ்ச்சியடைகிறோம். இன்று எங்கள் குழுவிடமிருந்து உங்களுக்கு என்ன உதவி தேவை?', '["Valued Client"]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-rwc-ta');`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-rwc-followup-si', '🌿 RWC Treatment Discussion Follow-Up (Sinhala – Meta Approved)', 'rwc_followup_discussion_si', 'MARKETING', 'si'::"LanguageCode", 'Royal Wellness Center වෙතින් සුහද සුබ පැතුම්! \n\nඔබගේ ප්රතිකාරය සම්බන්ධයෙන් අප මීට පෙර කළ සාකච්ඡාව පිළිබඳව නැවත ඔබව සම්බන්ධ කරගනිමු.\n\nදැන් ඔබ සමඟ කතා කිරීමට පහසුද? නැතහොත් ඔබව සම්බන්ධ කරගැනීමට වඩාත් සුදුසු වෙනත් වේලාවක් තිබේද?\n\nස්තුතියි!', 'Royal Wellness Center වෙතින් සුහද සුබ පැතුම්! \n\nඔබගේ ප්රතිකාරය සම්බන්ධයෙන් අප මීට පෙර කළ සාකච්ඡාව පිළිබඳව නැවත ඔබව සම්බන්ධ කරගනිමු.\n\nදැන් ඔබ සමඟ කතා කිරීමට පහසුද? නැතහොත් ඔබව සම්බන්ධ කරගැනීමට වඩාත් සුදුසු වෙනත් වේලාවක් තිබේද?\n\nස්තුතියි!', '[]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-rwc-followup-si');`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-cras-course-followup-en', '🎓 CRAS Course Discussion Follow-Up (English – Meta Approved)', 'cras_course_followup_en', 'MARKETING', 'en'::"LanguageCode", 'Greetings from College of Royal Aesthetic Studies! 🎓\n\nWe are following up on our previous discussion regarding your course inquiry.\nWould this be a convenient time to speak, or is there a better time to contact you?\n\nThank you!', 'Greetings from College of Royal Aesthetic Studies! 🎓\n\nWe are following up on our previous discussion regarding your course inquiry.\nWould this be a convenient time to speak, or is there a better time to contact you?\n\nThank you!', '[]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-cras-course-followup-en');`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-rwc-followup-ta', '🌿 RWC Treatment Discussion Follow-Up (Tamil – Meta Approved)', 'rwc_followup_discussion_ta', 'MARKETING', 'ta'::"LanguageCode", 'Royal Wellness Center-இலிருந்து அன்பான வணக்கங்கள்! \n\nஉங்களின் சிகிச்சை தொடர்பான எமது முந்தைய உரையாடலைத் தொடர்ந்து உங்களைத் தொடர்புகொள்கிறோம்.\n\nஇப்போது உங்களுடன் பேசுவதற்கு வசதியாக இருக்கிறதா? அல்லது வேறு ஏதேனும் நேரத்தில் உங்களைத் தொடர்புகொள்ளலாமா?\n\nநன்றி!', 'Royal Wellness Center-இலிருந்து அன்பான வணக்கங்கள்! \n\nஉங்களின் சிகிச்சை தொடர்பான எமது முந்தைய உரையாடலைத் தொடர்ந்து உங்களைத் தொடர்புகொள்கிறோம்.\n\nஇப்போது உங்களுடன் பேசுவதற்கு வசதியாக இருக்கிறதா? அல்லது வேறு ஏதேனும் நேரத்தில் உங்களைத் தொடர்புகொள்ளலாமா?\n\nநன்றி!', '[]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-rwc-followup-ta');`,
  `INSERT INTO public.whatsapp_templates (id, name, wa_template_name, category, language, body, content, variables, status)
   SELECT
     'tpl-rwc-followup-en', '🌿 RWC Treatment Discussion Follow-Up (English – Meta Approved)', 'rwc_followup_discussion_en', 'MARKETING', 'en'::"LanguageCode", 'Greetings from Royal Wellness Center! \n\nWe are following up on our previous discussion regarding your treatment.\nWould this be a convenient time to speak, or is there a better time to contact you?\n\nThank you!', 'Greetings from Royal Wellness Center! \n\nWe are following up on our previous discussion regarding your treatment.\nWould this be a convenient time to speak, or is there a better time to contact you?\n\nThank you!', '[]', 'APPROVED'::"TemplateStatus"
   WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE id = 'tpl-rwc-followup-en');`,

  // --- permanent sender audit trail -------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.message_audits (
     id VARCHAR(50) PRIMARY KEY,
     message_id VARCHAR(100) UNIQUE NOT NULL,
     lead_id VARCHAR(50) NOT NULL,
     customer_id VARCHAR(50),
     company VARCHAR(50),
     whatsapp_number VARCHAR(50),
     sender_id VARCHAR(36),
     sender_name VARCHAR(255) NOT NULL,
     sender_role VARCHAR(50) NOT NULL,
     message_source VARCHAR(50) DEFAULT 'CRM User',
     delivery_status VARCHAR(50) DEFAULT 'sent',
     sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_message_audits_lead ON public.message_audits(lead_id);`,
  `CREATE INDEX IF NOT EXISTS idx_message_audits_sender ON public.message_audits(sender_id);`,
  `CREATE INDEX IF NOT EXISTS idx_message_audits_sent ON public.message_audits(sent_at DESC);`,

  // --- messages sender audit columns ------------------------------------------
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderName" VARCHAR(255);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderRole" VARCHAR(50);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "messageSource" VARCHAR(50) DEFAULT 'CRM User';`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sender_role VARCHAR(50);`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS message_source VARCHAR(50) DEFAULT 'CRM User';`,
  `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,

  // --- UserRole enum values ----------------------------------------------------
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'leads_officer';`,

  // --- LeadStage enum values ---------------------------------------------------
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'new';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'assigned';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'contacted';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'potential';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'under_discussion';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_relevant';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'not_eligible';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'converted';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'lost';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'interested';`,
  `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'follow_up';`,

  // --- global settings ---------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.system_settings (
     key VARCHAR(100) PRIMARY KEY,
     value TEXT NOT NULL,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `INSERT INTO public.system_settings (key, value, updated_at)
   VALUES ('META_VERIFY_TOKEN', 'royal_wellness_token_2026', NOW())
   ON CONFLICT (key) DO NOTHING;`,

  // --- treatments columns ------------------------------------------------------
  `ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);`,
  `ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "company" VARCHAR(50) DEFAULT 'RWC';`,
  `ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT TRUE;`,
  `CREATE INDEX IF NOT EXISTS idx_treatments_company ON "treatments"("company");`,
  `CREATE INDEX IF NOT EXISTS idx_treatments_code ON "treatments"("code");`,

  // --- dynamic lead stages -----------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.lead_stages (
     id VARCHAR(50) PRIMARY KEY,
     key VARCHAR(50) UNIQUE NOT NULL,
     label VARCHAR(100) NOT NULL,
     description TEXT,
     color VARCHAR(50) DEFAULT 'teal',
     order_index INT DEFAULT 0,
     is_active BOOLEAN DEFAULT TRUE,
     is_system BOOLEAN DEFAULT FALSE,
     company VARCHAR(50) DEFAULT 'ALL',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_lead_stages_order ON public.lead_stages(order_index ASC);`,
  `CREATE INDEX IF NOT EXISTS idx_lead_stages_active ON public.lead_stages(is_active);`,
  // --- dynamic chat assign labels ----------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.chat_labels (
     id VARCHAR(50) PRIMARY KEY,
     key VARCHAR(50) UNIQUE NOT NULL,
     name VARCHAR(100) NOT NULL,
     color VARCHAR(50) NOT NULL DEFAULT '#f59e0b',
     dot_color VARCHAR(50) DEFAULT 'bg-amber-400',
     bg_color VARCHAR(100) DEFAULT 'bg-amber-500/20 text-amber-300 border-amber-500/30',
     description TEXT,
     company VARCHAR(50) DEFAULT 'ALL',
     allowed_roles VARCHAR(255) DEFAULT 'ALL',
     is_active BOOLEAN DEFAULT TRUE,
     is_system BOOLEAN DEFAULT FALSE,
     order_index INT DEFAULT 0,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_chat_labels_order ON public.chat_labels(order_index ASC);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_labels_active ON public.chat_labels(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_labels_company ON public.chat_labels(company);`,
  `CREATE TABLE IF NOT EXISTS public.lead_label_assignments (
     id VARCHAR(50) PRIMARY KEY,
     lead_id VARCHAR(50) NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
     label_id VARCHAR(50) NOT NULL,
     assigned_by VARCHAR(50),
     assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     CONSTRAINT uq_lead_label_assignment UNIQUE (lead_id, label_id)
   );`,
  `CREATE INDEX IF NOT EXISTS idx_lead_label_lead ON public.lead_label_assignments(lead_id);`,
  `CREATE INDEX IF NOT EXISTS idx_lead_label_label ON public.lead_label_assignments(label_id);`,

  // --- appointment scheduling --------------------------------------------------
  `CREATE TABLE IF NOT EXISTS public.branches (
     id VARCHAR(50) PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     code VARCHAR(50) UNIQUE NOT NULL,
     address TEXT,
     phone VARCHAR(50),
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  // --- company & branch management delta --------------------------------------
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS company VARCHAR(50) DEFAULT 'RWC';`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS city VARCHAR(120);`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS district VARCHAR(120);`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS province VARCHAR(120);`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS postal_code VARCHAR(30);`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email VARCHAR(255);`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_id VARCHAR(36);`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255);`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS business_hours JSONB;`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS holiday_calendar JSONB;`,
  `ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;`,
  `UPDATE public.branches SET company = 'RWC' WHERE company IS NULL OR BTRIM(company) = '';`,
  `UPDATE public.branches SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
     WHERE status IS NULL OR BTRIM(status) = '';`,
  `ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_code_key;`,
  `DROP INDEX IF EXISTS public.branches_code_key;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS branches_company_code_key ON public.branches(company, code);`,
  `CREATE INDEX IF NOT EXISTS branches_company_status_idx ON public.branches(company, status);`,
  `INSERT INTO public.enterprise_system_settings (id, section, scope, scope_id, payload, version, created_at, updated_at)
   SELECT 'settings-company-' || c.code, 'company', 'company', c.code,
     jsonb_build_object('code', c.code, 'displayName', c.name, 'legalName', '', 'registrationNumber', '',
       'email', '', 'phone', '', 'address', '', 'country', '', 'logoUrl', '', 'description', '', 'status', 'active'),
     1, NOW(), NOW()
   FROM (VALUES ('RWC', 'Royal Wellness Center'), ('CRAS', 'College of Royal Aesthetic of Sri Lanka'), ('AHC', 'Alpha Health Consultancy')) AS c(code, name)
   WHERE NOT EXISTS (SELECT 1 FROM public.enterprise_system_settings s
     WHERE s.section = 'company' AND s.scope = 'company' AND s.scope_id = c.code);`,
  `INSERT INTO public.enterprise_system_settings (id, section, scope, scope_id, payload, version, created_at, updated_at)
   SELECT 'settings-company-localization-' || c.code, 'company_localization', 'company', c.code,
     jsonb_build_object('currency', 'LKR', 'timezone', 'Asia/Colombo', 'dateFormat', 'DD/MM/YYYY',
       'timeFormat', '24h', 'language', 'en', 'fiscalYearStart', '01-01',
       'workingWeek', jsonb_build_array(1, 2, 3, 4, 5), 'holidayCalendarRef', 'LK'),
     1, NOW(), NOW()
   FROM (VALUES ('RWC'), ('CRAS'), ('AHC')) AS c(code)
   WHERE NOT EXISTS (SELECT 1 FROM public.enterprise_system_settings s
     WHERE s.section = 'company_localization' AND s.scope = 'company' AND s.scope_id = c.code);`,
  `CREATE TABLE IF NOT EXISTS public.rooms (
     id VARCHAR(50) PRIMARY KEY,
     branch_id VARCHAR(50) NOT NULL,
     name VARCHAR(255) NOT NULL,
     room_number VARCHAR(50) NOT NULL,
     description TEXT,
     color VARCHAR(50) DEFAULT '#0d9488',
     operating_start VARCHAR(10) DEFAULT '08:00',
     operating_end VARCHAR(10) DEFAULT '20:00',
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_branch ON public.rooms(branch_id);`,
  `CREATE TABLE IF NOT EXISTS public.doctors (
     id VARCHAR(50) PRIMARY KEY,
     full_name VARCHAR(255) NOT NULL,
     title VARCHAR(255),
     branch VARCHAR(100),
     phone VARCHAR(50),
     avatar VARCHAR(500),
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_doctors_branch ON public.doctors(branch);`,
  `CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors(is_active);`,
  `CREATE TABLE IF NOT EXISTS public.room_treatments (
     room_id VARCHAR(50) NOT NULL,
     treatment_id VARCHAR(50) NOT NULL,
     PRIMARY KEY (room_id, treatment_id)
   );`,
  `CREATE TABLE IF NOT EXISTS public.appointments (
     id VARCHAR(50) PRIMARY KEY,
     branch_id VARCHAR(50) NOT NULL,
     room_id VARCHAR(50) NOT NULL,
     patient_id VARCHAR(50) NOT NULL,
     doctor_id VARCHAR(50) NOT NULL,
     treatment_id VARCHAR(50) NOT NULL,
     start_time TIMESTAMP WITH TIME ZONE NOT NULL,
     end_time TIMESTAMP WITH TIME ZONE NOT NULL,
     status VARCHAR(50) DEFAULT 'confirmed',
     notes TEXT,
     created_by_id VARCHAR(50),
     updated_by_id VARCHAR(50),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     cancelled_at TIMESTAMP WITH TIME ZONE,
     cancellation_reason TEXT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_branch_time ON public.appointments(branch_id, start_time);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_room_time ON public.appointments(room_id, start_time, end_time);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time ON public.appointments(doctor_id, start_time, end_time);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);`,
  `CREATE TABLE IF NOT EXISTS public.appointment_status_history (
     id VARCHAR(50) PRIMARY KEY,
     appointment_id VARCHAR(50) NOT NULL,
     previous_status VARCHAR(50),
     new_status VARCHAR(50) NOT NULL,
     changed_by_id VARCHAR(50),
     changed_by_name VARCHAR(255),
     reason TEXT,
     changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_appt_hist_appointment ON public.appointment_status_history(appointment_id);`,
  `CREATE TABLE IF NOT EXISTS public.availability_blocks (
     id VARCHAR(50) PRIMARY KEY,
     branch_id VARCHAR(50) NOT NULL,
     room_id VARCHAR(50),
     doctor_id VARCHAR(50),
     start_time TIMESTAMP WITH TIME ZONE NOT NULL,
     end_time TIMESTAMP WITH TIME ZONE NOT NULL,
     reason VARCHAR(255) NOT NULL,
     created_by_id VARCHAR(50),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_avail_blocks_branch ON public.availability_blocks(branch_id, start_time, end_time);`,

  // --- marketing module foundations & serials ----------------------------------
  `CREATE TABLE IF NOT EXISTS public.marketing_contact_serials (
     id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), 
     next_value BIGINT NOT NULL DEFAULT 1
   );`,
  `INSERT INTO public.marketing_contact_serials (id, next_value) 
   VALUES (1, 1) 
   ON CONFLICT (id) DO NOTHING;`,

  // --- exam academic content workflow ----------------------------------------
  `ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';`,
  `ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);`,
  `ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS review_comments TEXT;`,
  `ALTER TABLE public.exam_courses ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;`,

  `ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);`,
  `ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);`,
  `ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS review_comments TEXT;`,
  `ALTER TABLE public.exam_study_materials ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;`,

  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS review_comments TEXT;`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS course_id VARCHAR(100);`,
  `ALTER TABLE public.exam_mcq_questions ADD COLUMN IF NOT EXISTS subject_id VARCHAR(100);`,

  `ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';`,
  `ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);`,
  `ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100);`,
  `ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS review_comments TEXT;`,
  `ALTER TABLE public.exam_mock_tests ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;`,

  `CREATE TABLE IF NOT EXISTS public.exam_academic_audit (
     id VARCHAR(100) PRIMARY KEY,
     entity_type VARCHAR(50) NOT NULL,
     entity_id VARCHAR(100) NOT NULL,
     action VARCHAR(50) NOT NULL,
     from_status VARCHAR(50),
     to_status VARCHAR(50),
     actor_id VARCHAR(100) NOT NULL,
     actor_name VARCHAR(150),
     actor_role VARCHAR(50),
     comments TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS idx_exam_academic_audit_entity ON public.exam_academic_audit(entity_type, entity_id);`
,
  `CREATE OR REPLACE FUNCTION public.next_marketing_contact_serial() RETURNS VARCHAR LANGUAGE plpgsql AS $mkt$
   DECLARE allocated_value BIGINT;
   BEGIN
     UPDATE public.marketing_contact_serials SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value - 1 INTO allocated_value;
     RETURN 'MKT-' || LPAD(allocated_value::TEXT, 8, '0');
   END;
   $mkt$;`,

  // --- marketing contacts additive columns -------------------------------------
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS last_reassigned_at TIMESTAMPTZ;`,
  `ALTER TABLE public.marketing_assignment_history ADD COLUMN IF NOT EXISTS event_type VARCHAR(30) NOT NULL DEFAULT 'assigned';`,
  `CREATE INDEX IF NOT EXISTS marketing_contacts_last_reassigned_at_idx ON public.marketing_contacts(last_reassigned_at);`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(50) NOT NULL DEFAULT 'new';`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS converted_lead_id VARCHAR(50);`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS qualification_note TEXT;`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN NOT NULL DEFAULT FALSE;`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS suppression_reason VARCHAR(255);`,
  `ALTER TABLE public.marketing_contacts ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMPTZ;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS marketing_access BOOLEAN NOT NULL DEFAULT FALSE;`,
  `UPDATE public.users SET marketing_access = TRUE
     WHERE active = TRUE AND role IN ('coordinator', 'marketing_officer', 'leads_officer') AND marketing_access = FALSE;`,

  // --- marketing consent events additive columns & indexes --------------------
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(50);`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS evidence_reference VARCHAR(255);`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`,
  `ALTER TABLE public.marketing_consent_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);`,
  `CREATE INDEX IF NOT EXISTS marketing_consent_events_contact_occurred_idx ON public.marketing_consent_events(contact_id, recorded_at);`,
  `CREATE INDEX IF NOT EXISTS marketing_consent_events_company_occurred_idx ON public.marketing_consent_events(company_id, recorded_at);`,

  // --- marketing suppression & activities --------------------------------------
  `CREATE TABLE IF NOT EXISTS public.marketing_suppressions (
     id VARCHAR(36) PRIMARY KEY,
     contact_id VARCHAR(36) UNIQUE NOT NULL,
     reason VARCHAR(255) NOT NULL,
     recorded_by_id VARCHAR(36) NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE TABLE IF NOT EXISTS public.marketing_contact_activities (
     id VARCHAR(36) PRIMARY KEY, 
     contact_id VARCHAR(36) NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
     actor_id VARCHAR(36) NOT NULL REFERENCES public.users(id), 
     type VARCHAR(60) NOT NULL, 
     note TEXT, 
     metadata JSONB,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS marketing_contact_activities_idx ON public.marketing_contact_activities(contact_id, created_at);`,

  // --- leads marketing linkage -------------------------------------------------
  `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS marketing_contact_id VARCHAR(36);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS leads_marketing_contact_id_key ON public.leads(marketing_contact_id);`,

  // --- security role/user permission profiles ----------------------------------
  `CREATE TABLE IF NOT EXISTS public.security_permission_profiles (
     subject_type VARCHAR(10) NOT NULL,
     subject_id VARCHAR(100) NOT NULL,
     overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
     scope VARCHAR(20),
     revision INTEGER NOT NULL DEFAULT 1,
     updated_by VARCHAR(100),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (subject_type, subject_id)
   );`,
  `CREATE INDEX IF NOT EXISTS idx_security_profiles_subject ON public.security_permission_profiles(subject_type, updated_at DESC);`,

  // --- user management & session security (additive only) ----------------------
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id VARCHAR(36);`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS manager_id VARCHAR(36);`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;`,
  `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_key ON public.users(employee_id) WHERE employee_id IS NOT NULL;`,
  `CREATE TABLE IF NOT EXISTS public.departments (
     id VARCHAR(36) PRIMARY KEY,
     name VARCHAR(120) NOT NULL,
     company VARCHAR(50),
     branch VARCHAR(100),
     description TEXT,
     active BOOLEAN NOT NULL DEFAULT TRUE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS departments_company_idx ON public.departments(company, branch);`,
  `INSERT INTO public.departments (id, name, company, branch, description, active)
   VALUES
     ('dept-admin', 'Administration', NULL, NULL, 'Executive, governance, and administration', TRUE),
     ('dept-operations', 'Operations', NULL, NULL, 'General operations and coordination', TRUE),
     ('dept-crm', 'CRM / Patient Care', NULL, NULL, 'Customer relationship, patient coordination and inquiries', TRUE),
     ('dept-clinical', 'Clinical & Medical', NULL, NULL, 'Medical practitioners, nursing, and clinical staff', TRUE),
     ('dept-exam', 'Exam Department', NULL, NULL, 'Academic evaluations, exam proctoring, and student certifications', TRUE),
     ('dept-finance', 'Finance & Billing', NULL, NULL, 'Accounting, invoicing, and financial auditing', TRUE),
     ('dept-marketing', 'Public Contact Marketing', NULL, NULL, 'Marketing outreach, campaigns, and audience engagement', TRUE)
   ON CONFLICT (id) DO NOTHING;`,
  `CREATE TABLE IF NOT EXISTS public.teams (
     id VARCHAR(36) PRIMARY KEY,
     department_id VARCHAR(36),
     name VARCHAR(120) NOT NULL,
     company VARCHAR(50),
     branch VARCHAR(100),
     lead_user_id VARCHAR(36),
     active BOOLEAN NOT NULL DEFAULT TRUE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS teams_department_idx ON public.teams(department_id);`,
  `CREATE TABLE IF NOT EXISTS public.team_members (
     team_id VARCHAR(36) NOT NULL,
     user_id VARCHAR(36) NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (team_id, user_id)
   );`,
  `CREATE TABLE IF NOT EXISTS public.user_invitations (
     id VARCHAR(36) PRIMARY KEY,
     email VARCHAR(255) NOT NULL,
     full_name VARCHAR(255) NOT NULL,
     role VARCHAR(50) NOT NULL,
     company VARCHAR(50),
     branch VARCHAR(100),
     department_id VARCHAR(36),
     token_hash VARCHAR(128) NOT NULL UNIQUE,
     invited_by VARCHAR(36),
     expires_at TIMESTAMPTZ NOT NULL,
     accepted_at TIMESTAMPTZ,
     revoked_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );`,
  `CREATE INDEX IF NOT EXISTS user_invitations_email_idx ON public.user_invitations(LOWER(email));`,
  `CREATE INDEX IF NOT EXISTS user_invitations_pending_idx ON public.user_invitations(expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;`,
  `CREATE TABLE IF NOT EXISTS public.user_sessions (
     id VARCHAR(36) PRIMARY KEY,
     user_id VARCHAR(36) NOT NULL,
     token_version INTEGER NOT NULL DEFAULT 0,
     ip VARCHAR(100),
     user_agent VARCHAR(500),
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     revoked_at TIMESTAMPTZ,
     revoked_by VARCHAR(36),
     revoke_reason VARCHAR(255)
   );`,
  `CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions(user_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS user_sessions_active_idx ON public.user_sessions(user_id) WHERE revoked_at IS NULL;`,
  `CREATE INDEX IF NOT EXISTS security_audit_events_created_idx ON public.security_audit_events(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS security_audit_events_action_idx ON public.security_audit_events(action, created_at DESC);`,
  // Append-only: the trail is INSERT-only at the API and the database refuses rewrites.
  `CREATE OR REPLACE FUNCTION public.security_audit_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN RAISE EXCEPTION 'security_audit_events is append-only'; END;
   $$;`,
  `DROP TRIGGER IF EXISTS security_audit_events_no_rewrite ON public.security_audit_events;`,
  `CREATE TRIGGER security_audit_events_no_rewrite BEFORE UPDATE OR DELETE ON public.security_audit_events
     FOR EACH ROW EXECUTE FUNCTION public.security_audit_events_immutable();`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_department_id_fkey') THEN
       ALTER TABLE public.users ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_manager_id_fkey') THEN
       ALTER TABLE public.users ADD CONSTRAINT users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_department_id_fkey') THEN
       ALTER TABLE public.teams ADD CONSTRAINT teams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_lead_user_id_fkey') THEN
       ALTER TABLE public.teams ADD CONSTRAINT teams_lead_user_id_fkey FOREIGN KEY (lead_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_id_fkey') THEN
       ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_fkey') THEN
       ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_department_id_fkey') THEN
       ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_invited_by_fkey') THEN
       ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_fkey') THEN
       ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
     END IF;
   END $$;`
];

const SEED_STATEMENTS = [
  // `updated_at` is NOT NULL without a default on a freshly provisioned database
  // (Prisma's @updatedAt only applies to writes made through the Prisma client).
  `INSERT INTO public.lead_stages (id, key, label, description, color, order_index, is_active, is_system, company, updated_at)
   VALUES
     ('stage-new', 'new', 'New Inquiry', 'Fresh uncontacted inbound lead', 'rose', 0, TRUE, TRUE, 'ALL', NOW()),
     ('stage-assigned', 'assigned', 'Assigned', 'Lead assigned to coordinator or education counsellor', 'amber', 1, TRUE, FALSE, 'ALL', NOW()),
     ('stage-contacted', 'contacted', 'Contacted', 'Initial outreach made via WhatsApp or call', 'emerald', 2, TRUE, FALSE, 'ALL', NOW()),
     ('stage-potential', 'potential', 'Qualified prospect showing active interest', 'Lead showing active interest in a treatment or course', 'purple', 3, TRUE, FALSE, 'ALL', NOW()),
     ('stage-under-discussion', 'under_discussion', 'Under Discussion', 'Ongoing treatment / course consultation & quotation', 'sky', 4, TRUE, FALSE, 'ALL', NOW()),
     ('stage-not-relevant', 'not_relevant', 'Not Relevant Inquiry', 'Wrong inquiry or service not offered', 'slate', 5, TRUE, FALSE, 'ALL', NOW()),
     ('stage-not-eligible', 'not_eligible', 'Not Eligible', 'Client medically or academically ineligible', 'zinc', 6, TRUE, FALSE, 'ALL', NOW()),
     ('stage-converted', 'converted', 'Converted (Closed Won)', 'Patient booked appointment or student enrolled', 'teal', 7, TRUE, TRUE, 'ALL', NOW()),
     ('stage-lost', 'lost', 'Lost', 'Lead discontinued, unresponsive, or declined', 'red', 8, TRUE, TRUE, 'ALL', NOW())
   ON CONFLICT (key) DO NOTHING;`,
  `INSERT INTO public.branches (id, company, name, code, address, phone, is_active, created_at, updated_at)
   VALUES
     ('branch-colombo', 'RWC', 'Colombo (Head Office)', 'COLOMBO', 'Colombo, Sri Lanka', '+94 70 639 3353', TRUE, NOW(), NOW()),
     ('branch-maruthamunai', 'RWC', 'Maruthamunai Branch', 'MARUTHAMUNAI', 'Maruthamunai, Sri Lanka', '+94 70 637 3353', TRUE, NOW(), NOW())
   ON CONFLICT (id) DO NOTHING;`,
  `INSERT INTO public.rooms (id, branch_id, name, room_number, description, color, operating_start, operating_end, is_active, created_at, updated_at)
   VALUES
     ('room-col-1', 'branch-colombo', 'Consultation Suite 1', 'R-101', 'General aesthetic consultation & triage', '#0d9488', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-col-2', 'branch-colombo', 'Laser & Skin Therapy Suite', 'R-102', 'Laser facial, carbon peel & anti-aging', '#6366f1', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-col-3', 'branch-colombo', 'IV Wellness & Infusion Lounge', 'R-103', 'Glutathione IV drips & cellular hydration', '#ec4899', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-col-4', 'branch-colombo', 'Hair Restoration Clinic', 'R-104', 'PRP therapy & scalp mesotherapy', '#f59e0b', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-mar-1', 'branch-maruthamunai', 'Consultation Room A', 'M-201', 'Primary clinical assessment', '#0d9488', '08:00', '20:00', TRUE, NOW(), NOW()),
     ('room-mar-2', 'branch-maruthamunai', 'Aesthetic & IV Suite B', 'M-202', 'Clinical procedures & IV drips', '#6366f1', '08:00', '20:00', TRUE, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;`
];

const FORWARDING_STAGE_STATEMENTS = [
  `INSERT INTO public.lead_stages (id, key, label, description, color, order_index, is_active, is_system, company, updated_at)
   VALUES
     ('stage-forwarded-exam', 'forwarded_to_exam_department', 'Forwarded to Exam Department', 'Lead handed over to the healthcare exam preparation team.', 'cyan', 5, TRUE, FALSE, 'ALL', NOW()),
     ('stage-forwarded-processing', 'forwarded_to_processing_department', 'Forwarded to Processing Department', 'Lead handed over to the document and application processing team.', 'orange', 6, TRUE, FALSE, 'ALL', NOW())
   ON CONFLICT (key) DO UPDATE SET
     label = EXCLUDED.label,
     description = EXCLUDED.description,
     color = EXCLUDED.color,
     is_active = TRUE,
     updated_at = NOW();`
];

async function runAll(prisma, statements, failures) {
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (error) {
      failures.push({ sql: sql.trim().split('\n')[0].slice(0, 90), message: error.message });
    }
  }
}

/**
 * Applies the idempotent schema delta once per process.
 * @returns {Promise<{ok: boolean, failures: Array<{sql: string, message: string}>}>}
 */
export async function ensureSchema(prisma) {
  const failures = [];
  await runAll(prisma, STATEMENTS, failures);

  const seeded = await prisma
    .$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM public.lead_stages;`)
    .catch(() => null);
  if (seeded && seeded[0] && seeded[0].count === 0) {
    await runAll(prisma, SEED_STATEMENTS, failures);
  }
  await runAll(prisma, FORWARDING_STAGE_STATEMENTS, failures);
  const labelSeedStatements = [
    `INSERT INTO public.chat_labels (id, key, name, color, dot_color, bg_color, description, company, allowed_roles, is_active, is_system, order_index, created_at, updated_at)
     VALUES
       ('vip', 'vip', 'VIP Patient', '#f59e0b', 'bg-amber-400', 'bg-amber-500/20 text-amber-300 border-amber-500/30', 'High-priority VIP customer requiring dedicated attention', 'ALL', 'ALL', TRUE, TRUE, 0, NOW(), NOW()),
       ('hot', 'hot', 'Hot Lead', '#f43f5e', 'bg-rose-400', 'bg-rose-500/20 text-rose-300 border-rose-500/30', 'Urgent prospective patient or student ready to convert', 'ALL', 'ALL', TRUE, TRUE, 1, NOW(), NOW()),
       ('booked', 'booked', 'Consultation Booked', '#10b981', 'bg-emerald-400', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', 'Clinical consultation or course admission confirmed', 'ALL', 'ALL', TRUE, TRUE, 2, NOW(), NOW()),
       ('followup', 'followup', 'Follow-up Needed', '#0ea5e9', 'bg-sky-400', 'bg-sky-500/20 text-sky-300 border-sky-500/30', 'Pending client reply or scheduled follow-up outreach', 'ALL', 'ALL', TRUE, TRUE, 3, NOW(), NOW()),
       ('prescription', 'prescription', 'Prescription Sent', '#8b5cf6', 'bg-purple-400', 'bg-purple-500/20 text-purple-300 border-purple-500/30', 'Medical prescription or academic syllabus forwarded', 'ALL', 'ALL', TRUE, TRUE, 4, NOW(), NOW())
     ON CONFLICT (key) DO UPDATE SET
       name = EXCLUDED.name,
       is_system = EXCLUDED.is_system;`
  ];
  await runAll(prisma, labelSeedStatements, failures);
  // Enterprise RBAC models and backfill
  try {
    const fsMod = await import('node:fs');
    const pathMod = await import('node:path');
    const rbacSqlPath = pathMod.resolve(process.cwd(), 'backend/prisma/migrations/20261102_enterprise_rbac_models.sql');
    const altRbacSqlPath = pathMod.resolve(process.cwd(), 'prisma/migrations/20261102_enterprise_rbac_models.sql');
    const targetPath = fsMod.existsSync(rbacSqlPath) ? rbacSqlPath : (fsMod.existsSync(altRbacSqlPath) ? altRbacSqlPath : null);
    if (targetPath) {
      const sqlContent = fsMod.readFileSync(targetPath, 'utf8');
      const noComments = sqlContent.replace(/--.*$/gm, '');
      const rbacStatements = noComments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      await runAll(prisma, rbacStatements, failures);
    }
  } catch (err) {
    console.warn('⚠️ [Schema Bootstrap] Error loading enterprise RBAC migration:', err.message);
  }


  if (failures.length > 0) {
    console.warn(`⚠️ [Schema] ${failures.length} bootstrap statement(s) did not apply:`);
    for (const failure of failures) {
      console.warn(`   - ${failure.sql} → ${failure.message}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
