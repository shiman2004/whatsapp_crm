/**
 * catalogRoutes.js — Treatment Categories, Clinical Treatments, Academic Courses & Lead Stages
 * Extracted cleanly from legacyServer.js under the Strangler Fig migration pattern.
 */
import { getPrisma, getDbStatus } from './db.js';

export const CLINIC_TREATMENTS = [
  { id: 'trt-htp', code: 'HTP', categoryId: 'cat-hair-care', name: 'Hair Transplantation', nameEn: 'Hair Transplantation', nameSi: 'හිසකෙස් බද්ධ කිරීම', nameTa: 'முடி மாற்று அறுவை சிகிச்சை' },
  { id: 'trt-prp', code: 'PRP', categoryId: 'cat-hair-care', name: 'PRP', nameEn: 'PRP (Platelet Rich Plasma)', nameSi: 'PRP ප්‍රතිකාරය', nameTa: 'PRP சிகிச்சை' },
  { id: 'trt-gfc', code: 'GFC', categoryId: 'cat-hair-care', name: 'GFC', nameEn: 'GFC (Growth Factor Concentrate)', nameSi: 'GFC ප්‍රතිකාරය', nameTa: 'GFC சிகிச்சை' },
  { id: 'trt-hdf', code: 'HDF', categoryId: 'cat-skin-care', name: 'Hydra Facial', nameEn: 'Hydra Facial', nameSi: 'හයිඩ්‍රා ෆේෂල්', nameTa: 'ஹைட்ரா ஃபேஷியல்' },
  { id: 'trt-hij', code: 'HIJ', categoryId: 'cat-ayurveda', name: 'Hijama', nameEn: 'Hijama / Cupping Therapy', nameSi: 'හිජාමා ප්‍රතිකාරය', nameTa: 'ஹிஜாமா சிகிச்சை' },
  { id: 'trt-pmt', code: 'PMT', categoryId: 'cat-iv-wellness', name: 'Pain Management', nameEn: 'Pain Management', nameSi: 'වේදනා කළමනාකරණය', nameTa: 'வலி மேலாண்மை சிகிச்சை' },
  { id: 'trt-let', code: 'LET', categoryId: 'cat-ayurveda', name: 'Leech Treatment', nameEn: 'Leech Treatment', nameSi: 'කූඩැල්ලන් ප්‍රතිකාරය', nameTa: 'அட்டை சிகிச்சை' },
  { id: 'trt-chp', code: 'CHP', categoryId: 'cat-skin-care', name: 'Chemical Peel', nameEn: 'Chemical Peel', nameSi: 'කෙමිකල් පීල්', nameTa: 'கெமிக்கல் பீல்' },
  { id: 'trt-cbl', code: 'CBL', categoryId: 'cat-skin-care', name: 'Carbon Laser', nameEn: 'Carbon Laser', nameSi: 'කාබන් ලේසර්', nameTa: 'கார்பன் லேசர்' },
  { id: 'trt-mcn', code: 'MCN', categoryId: 'cat-skin-care', name: 'Microneedling', nameEn: 'Microneedling', nameSi: 'මයික්‍රොනීඩ්ලින්', nameTa: 'மைக்ரோநீட்லிங்' },
  { id: 'trt-skb', code: 'SKB', categoryId: 'cat-skin-care', name: 'Skin Boosters', nameEn: 'Skin Boosters', nameSi: 'සම දීප්තිමත් කිරීමේ බූස්ටර්', nameTa: 'ஸ்கின் பூஸ்டர்ஸ்' },
  { id: 'trt-chr', code: 'CHR', categoryId: 'cat-skin-care', name: 'CO2 Hair Removal', nameEn: 'CO2 Hair Removal', nameSi: 'CO2 අනවශ්‍ය රෝම ඉවත් කිරීම', nameTa: 'CO2 முடி அகற்றுதல்' },
  { id: 'trt-btx', code: 'BTX', categoryId: 'cat-skin-care', name: 'Botox (Per Unit)', nameEn: 'Botox (Per Unit)', nameSi: 'බොටොක්ස් (ඒකකයකට)', nameTa: 'போடாக்ஸ் (ஒரு யூனிட்)' },
  { id: 'trt-flr', code: 'FLR', categoryId: 'cat-skin-care', name: 'Filler (1ml)', nameEn: 'Filler (1ml)', nameSi: 'ෆිලර් (1ml)', nameTa: 'ஃபில்லர் (1ml)' },
  { id: 'trt-ivg', code: 'IVG', categoryId: 'cat-iv-wellness', name: 'IV Glutathione (Per Session)', nameEn: 'IV Glutathione (Per Session)', nameSi: 'IV ග්ලූටතයෝන්', nameTa: 'IV குளுதாதயோன்' },
  { id: 'trt-exm', code: 'EXM', categoryId: 'cat-hair-care', name: 'Exosome Therapy', nameEn: 'Exosome Hair Rejuvenation', nameSi: 'එක්සොසෝම් ප්‍රතිකාරය', nameTa: 'எக்சோசோம் சிகிச்சை' },
  { id: 'trt-llt', code: 'LLT', categoryId: 'cat-hair-care', name: 'Low-Level Laser (LLLT)', nameEn: 'Low-Level Laser (LLLT)', nameSi: 'ලේසර් ප්‍රතිකාරය (LLLT)', nameTa: 'லேசர் சிகிச்சை (LLLT)' },
  { id: 'trt-smp', code: 'SMP', categoryId: 'cat-hair-care', name: 'Scalp Micropigmentation', nameEn: 'Scalp Micropigmentation', nameSi: 'හිස්කබල මයික්‍රොපිග්මන්ටේෂන්', nameTa: 'தலை உச்சந்தலை மைக்ரோபிக்மென்டேஷன்' },
  { id: 'trt-msh', code: 'MSH', categoryId: 'cat-hair-care', name: 'Mesotherapy Hair', nameEn: 'Mesotherapy Hair', nameSi: 'හිසකෙස් මෙසොතෙරපි', nameTa: 'முடி மெசோதெரபி' },
  { id: 'trt-dox', code: 'DOX', categoryId: 'cat-iv-wellness', name: 'Detox & Immune Boost IV', nameEn: 'Detox & Immune Boost IV', nameSi: 'ඩිටොක්ස් සහ ප්‍රතිශක්තිකරණ IV', nameTa: 'டிடாக்ஸ் மற்றும் நோய் எதிர்ப்பு சக்தி IV' },
  { id: 'trt-nad', code: 'NAD', categoryId: 'cat-iv-wellness', name: 'NAD+ Anti-Aging IV', nameEn: 'NAD+ Anti-Aging IV', nameSi: 'NAD+ වයස්ගතවීම වැලැක්වීමේ IV', nameTa: 'NAD+ முதுமை எதிர்ப்பு IV' },
  { id: 'trt-hyt', code: 'HYT', categoryId: 'cat-iv-wellness', name: 'Hydration & Electrolyte IV', nameEn: 'Hydration & Electrolyte IV', nameSi: 'ජලසම්පාදන සහ ඉලෙක්ට්‍රෝලයිට් IV', nameTa: 'நீரேற்றம் மற்றும் எலக்ட்ரோலைட் IV' },
  { id: 'trt-col', code: 'COL', categoryId: 'cat-iv-wellness', name: 'Collagen & Glow Infusion', nameEn: 'Collagen & Glow Infusion', nameSi: 'කොලජන් සහ පැහැපත් බවේ IV', nameTa: 'கொலாஜன் மற்றும் பொலிவு IV' },
  { id: 'trt-mnc', code: 'MNC', categoryId: 'cat-skin-care', name: 'Medical Clean-up', nameEn: 'Medical Clean-up', nameSi: 'වෛද්‍යමය පිරිසිදු කිරීම', nameTa: 'மருத்துவ கிளீன்-அப்' },
  { id: 'trt-rfm', code: 'RFM', categoryId: 'cat-skin-care', name: 'RF Microneedling', nameEn: 'RF Microneedling', nameSi: 'RF මයික්‍රොනීඩ්ලින්', nameTa: 'RF மைக்ரோநீட்லிங்' },
  { id: 'trt-qsw', code: 'QSW', categoryId: 'cat-skin-care', name: 'Q-Switch Laser Toning', nameEn: 'Q-Switch Laser Toning', nameSi: 'Q-Switch ලේසර් ටෝනිං', nameTa: 'Q-ஸ்விட்ச் லேசர் டோனிங்' },
  { id: 'trt-der', code: 'DER', categoryId: 'cat-skin-care', name: 'Dermaplaning & Oxygen Facial', nameEn: 'Dermaplaning & Oxygen Facial', nameSi: 'ඩර්මාප්ලේනිං ෆේෂල්', nameTa: 'டெர்மாபிளேனிங் ஃபேஷியல்' },
  { id: 'trt-lip', code: 'LIP', categoryId: 'cat-skin-care', name: 'Lip Pigmentation Laser', nameEn: 'Lip Pigmentation Laser', nameSi: 'තොල් කළු පැහැය ඉවත් කිරීමේ ලේසර්', nameTa: 'உதடு நிறமிழப்பு லேசர்' },
  { id: 'trt-drt', code: 'DRT', categoryId: 'cat-ayurveda', name: 'Dry Cupping', nameEn: 'Dry Cupping', nameSi: 'වියළි කපිං', nameTa: 'உலர் கப்பிங்' },
  { id: 'trt-fsc', code: 'FSC', categoryId: 'cat-ayurveda', name: 'Fire / Flash Cupping', nameEn: 'Fire / Flash Cupping', nameSi: 'ෆයර් කපිං', nameTa: 'நெருப்பு கப்பிங்' },
  { id: 'trt-hjc', code: 'HJC', categoryId: 'cat-ayurveda', name: 'Head Hijama (Without Shaving)', nameEn: 'Head Hijama (Without Shaving)', nameSi: 'හිස හිජාමා (කොණ්ඩය නොකපා)', nameTa: 'தலை ஹிஜாமா (முடியை மழிக்காமல்)' },
  { id: 'trt-fcl', code: 'FCL', categoryId: 'cat-ayurveda', name: 'Facial Cupping', nameEn: 'Facial Cupping', nameSi: 'මුහුණේ කපිං', nameTa: 'முக கப்பிங்' },
  { id: 'trt-bkh', code: 'BKH', categoryId: 'cat-ayurveda', name: 'Full Back Hijama (Sunnah Points)', nameEn: 'Full Back Hijama (Sunnah Points)', nameSi: 'පිටුපස සම්පූර්ණ හිජාමා', nameTa: 'முதுகு முழு ஹிஜாமா' },
  { id: 'trt-jnt', code: 'JNT', categoryId: 'cat-ayurveda', name: 'Joint Pain Hijama Therapy', nameEn: 'Joint Pain Hijama Therapy', nameSi: 'සන්ධි වේදනා හිජාමා', nameTa: 'மூட்டு வலி ஹிஜாமா' },
  { id: 'trt-sin', code: 'SIN', categoryId: 'cat-ayurveda', name: 'Sinus Relief Hijama', nameEn: 'Sinus Relief Hijama', nameSi: 'සයිනස් හිජාමා', nameTa: 'சைனஸ் நிவாரண ஹிஜாமா' },
  { id: 'trt-gny', code: 'GNY', categoryId: 'cat-hair-care', name: 'Gynae Inverted Nipple Correction', nameEn: 'Gynae Inverted Nipple Correction', nameSi: 'නින්පල් නිවැරදි කිරීම', nameTa: 'முலைக்காம்பு சீரமைப்பு' },
  { id: 'trt-lip-surg', code: 'LIP-S', categoryId: 'cat-skin-care', name: 'Lipoma / Sebaceous Cyst Removal', nameEn: 'Lipoma / Cyst Removal', nameSi: 'සිස්ට් ඉවත් කිරීම', nameTa: 'கொழுப்பு கட்டி நீக்கம்' },
  { id: 'trt-kel', code: 'KEL', categoryId: 'cat-skin-care', name: 'Keloid & Scar Revision', nameEn: 'Keloid & Scar Revision', nameSi: 'කැලැල් ඉවත් කිරීම', nameTa: 'தழும்பு திருத்தம்' },
  { id: 'trt-brd', code: 'BRD', categoryId: 'cat-hair-care', name: 'Beard & Eyebrow Transplantation', nameEn: 'Beard & Eyebrow Transplantation', nameSi: 'රැවුල සහ ඇහිබැම බද්ධ කිරීම', nameTa: 'தாடி மற்றும் புருவம் மாற்று அறுவை சிகிச்சை' }
];

export const CRAS_COURSES = [
  { id: 'crs-adi', code: 'ADI', categoryId: 'cat-cras-courses', name: 'Advanced Injectables', nameEn: 'Advanced Injectables', nameSi: 'Advanced Injectables', nameTa: 'Advanced Injectables' },
  { id: 'crs-fac', code: 'FAC', categoryId: 'cat-cras-courses', name: 'Facial Injectables', nameEn: 'Facial Injectables', nameSi: 'Facial Injectables', nameTa: 'Facial Injectables' },
  { id: 'crs-lac', code: 'LAC', categoryId: 'cat-cras-courses', name: 'Laser & Aesthetic Cosmetology', nameEn: 'Laser & Aesthetic Cosmetology', nameSi: 'Laser & Aesthetic Cosmetology', nameTa: 'Laser & Aesthetic Cosmetology' },
  { id: 'crs-aco', code: 'ACO', categoryId: 'cat-cras-courses', name: 'Aesthetic Cosmetology', nameEn: 'Aesthetic Cosmetology', nameSi: 'Aesthetic Cosmetology', nameTa: 'Aesthetic Cosmetology' },
  { id: 'crs-htr', code: 'HTR', categoryId: 'cat-cras-courses', name: 'Hair Transplantation & Restoration', nameEn: 'Hair Transplantation & Restoration', nameSi: 'Hair Transplantation & Restoration', nameTa: 'Hair Transplantation & Restoration' },
  { id: 'crs-htt', code: 'HTT', categoryId: 'cat-cras-courses', name: 'Hair Transplant Technician', nameEn: 'Hair Transplant Technician', nameSi: 'Hair Transplant Technician', nameTa: 'Hair Transplant Technician' },
  { id: 'crs-lbc', code: 'LBC', categoryId: 'cat-cras-courses', name: 'Liposuction & Body Contouring', nameEn: 'Liposuction & Body Contouring', nameSi: 'Liposuction & Body Contouring', nameTa: 'Liposuction & Body Contouring' },
  { id: 'crs-mpm', code: 'MPM', categoryId: 'cat-cras-courses', name: 'Micropigmentation & Permanent Makeup', nameEn: 'Micropigmentation & Permanent Makeup', nameSi: 'Micropigmentation & Permanent Makeup', nameTa: 'Micropigmentation & Permanent Makeup' },
  { id: 'crs-lhr', code: 'LHR', categoryId: 'cat-cras-courses', name: 'Laser & Light-Based Hair Removal', nameEn: 'Laser & Light-Based Hair Removal', nameSi: 'Laser & Light-Based Hair Removal', nameTa: 'Laser & Light-Based Hair Removal' },
  { id: 'crs-alp', code: 'ALP', categoryId: 'cat-cras-courses', name: 'Aesthetic Laser and Light-Based Procedures', nameEn: 'Aesthetic Laser and Light-Based Procedures', nameSi: 'Aesthetic Laser and Light-Based Procedures', nameTa: 'Aesthetic Laser and Light-Based Procedures' },
  { id: 'crs-pmu', code: 'PMU', categoryId: 'cat-cras-courses', name: 'Permanent Makeup (PMU)', nameEn: 'Permanent Makeup (PMU)', nameSi: 'Permanent Makeup (PMU)', nameTa: 'Permanent Makeup (PMU)' },
  { id: 'crs-mbc', code: 'MBC', categoryId: 'cat-cras-courses', name: 'Master in Body Contouring & Liposuction', nameEn: 'Master in Body Contouring & Liposuction', nameSi: 'Master in Body Contouring & Liposuction', nameTa: 'Master in Body Contouring & Liposuction' },
  { id: 'crs-fma', code: 'FMA', categoryId: 'cat-cras-courses', name: 'Fellowship in Medical Aesthetics', nameEn: 'Fellowship in Medical Aesthetics', nameSi: 'Fellowship in Medical Aesthetics', nameTa: 'Fellowship in Medical Aesthetics' },
  { id: 'crs-cac', code: 'CAC', categoryId: 'cat-cras-courses', name: 'Certificate in Clinical Cosmetology', nameEn: 'Certificate in Clinical Cosmetology', nameSi: 'Certificate in Clinical Cosmetology', nameTa: 'Certificate in Clinical Cosmetology' },
  { id: 'crs-dcc', code: 'DCC', categoryId: 'cat-cras-courses', name: 'Diploma in Clinical Cosmetology', nameEn: 'Diploma in Clinical Cosmetology', nameSi: 'Diploma in Clinical Cosmetology', nameTa: 'Diploma in Clinical Cosmetology' },
  { id: 'crs-pgd', code: 'PGD', categoryId: 'cat-cras-courses', name: 'Postgraduate Diploma in Clinical Cosmetology', nameEn: 'Postgraduate Diploma in Clinical Cosmetology', nameSi: 'Postgraduate Diploma in Clinical Cosmetology', nameTa: 'Postgraduate Diploma in Clinical Cosmetology' }
];

export const DEFAULT_LEAD_STAGES = [
  { id: 'stage-new', key: 'new', label: 'New Inquiry', description: 'Fresh uncontacted inbound lead', color: '#f43f5e', orderIndex: 0, isActive: true, isSystem: true, company: 'ALL' },
  { id: 'stage-assigned', key: 'assigned', label: 'Assigned', description: 'Lead assigned to coordinator or education counsellor', color: '#f59e0b', orderIndex: 1, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-contacted', key: 'contacted', label: 'Contacted', description: 'Initial outreach made via WhatsApp or call', color: '#10b981', orderIndex: 2, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-potential', key: 'potential', label: 'Potential', description: 'Qualified prospect showing active interest', color: '#8b5cf6', orderIndex: 3, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-under-discussion', key: 'under_discussion', label: 'Under Discussion', description: 'Ongoing treatment / course consultation & quotation', color: '#0ea5e9', orderIndex: 4, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-forwarded-exam', key: 'forwarded_to_exam_department', label: 'Forwarded to Exam Department', description: 'Lead handed over to the healthcare exam preparation team.', color: '#06b6d4', orderIndex: 5, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-forwarded-processing', key: 'forwarded_to_processing_department', label: 'Forwarded to Processing Department', description: 'Lead handed over to the document and application processing team.', color: '#f97316', orderIndex: 6, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-not-relevant', key: 'not_relevant', label: 'Not Relevant Inquiry', description: 'Wrong inquiry or service not offered', color: '#64748b', orderIndex: 7, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-not-eligible', key: 'not_eligible', label: 'Not Eligible', description: 'Client medically or academically ineligible', color: '#71717a', orderIndex: 8, isActive: true, isSystem: false, company: 'ALL' },
  { id: 'stage-converted', key: 'converted', label: 'Converted (Closed Won)', description: 'Patient booked appointment or student enrolled', color: '#0d9488', orderIndex: 9, isActive: true, isSystem: true, company: 'ALL' },
  { id: 'stage-lost', key: 'lost', label: 'Lost', description: 'Lead discontinued, unresponsive, or declined', color: '#ef4444', orderIndex: 10, isActive: true, isSystem: true, company: 'ALL' }
];

function checkSuperAdmin(authUser, res) {
  if (!authUser || authUser.role !== 'super_admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      errorCode: 'FORBIDDEN_SUPER_ADMIN_REQUIRED',
      error: 'Forbidden: Super Admin privileges required.'
    }));
    return false;
  }
  return true;
}

/**
 * Handle Treatment Categories, Stages, Courses, and Treatments
 */
export async function handleCatalogRoutes(req, res, pathname, authUser) {
  // 1. GET /api/categories
  if (req.method === 'GET' && pathname === '/api/categories') {
    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const categories = await prisma.treatmentCategory.findMany({ where: { active: true } });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(categories));
        return true;
      } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return true;
  }

  // 2. GET /api/stages & GET /api/admin/stages
  if (req.method === 'GET' && (pathname === '/api/stages' || pathname === '/api/admin/stages')) {
    const prisma = getPrisma();
    const urlObj = new URL(req.url || '/', 'http://localhost');
    const queryCompany = String(urlObj.searchParams.get('company') || '').trim().toUpperCase();
    const filterByCompany = (list) => {
      if (!queryCompany || queryCompany === 'ALL') return list;
      return list.filter((s) => {
        const sc = String(s.company || 'ALL').trim().toUpperCase();
        return !sc || sc === 'ALL' || sc === queryCompany;
      });
    };
    if (prisma && getDbStatus()) {
      try {
        const stages = await prisma.leadStageConfig.findMany({
          orderBy: { orderIndex: 'asc' }
        });
        if (stages && stages.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, stages: filterByCompany(stages) }));
          return true;
        }
      } catch (e) {
        try {
          const rawStages = await prisma.$queryRawUnsafe(`
            SELECT id, key, label, description, color, order_index as "orderIndex", 
                   is_active as "isActive", is_system as "isSystem", company,
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM public.lead_stages
            ORDER BY order_index ASC;
          `);
          if (Array.isArray(rawStages) && rawStages.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stages: filterByCompany(rawStages) }));
            return true;
          }
        } catch (rawErr) {}
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stages: filterByCompany(DEFAULT_LEAD_STAGES) }));
    return true;
  }

  // 3. GET /api/courses & GET /api/admin/courses
  if (req.method === 'GET' && (pathname === '/api/courses' || pathname === '/api/admin/courses')) {
    const isSuperAdminReq = pathname === '/api/admin/courses';
    if (isSuperAdminReq && !checkSuperAdmin(authUser, res)) return true;

    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const whereClause = {
          OR: [
            { company: 'CRAS' },
            { categoryId: 'cat-cras-courses' },
            { id: { startsWith: 'crs-' } }
          ],
          ...(isSuperAdminReq ? {} : { active: true })
        };
        const courses = await prisma.treatment.findMany({
          where: whereClause,
          orderBy: { name: 'asc' }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, courses }));
        return true;
      } catch (e) {}
    }

    const filtered = CRAS_COURSES.map(c => ({
      ...c,
      company: 'CRAS',
      active: true,
      durationMinutes: 60,
      startingPrice: 0
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, courses: filtered }));
    return true;
  }

  // 4. GET /api/treatments & GET /api/admin/treatments
  if (req.method === 'GET' && (pathname === '/api/treatments' || pathname === '/api/admin/treatments')) {
    const isAdminView = pathname === '/api/admin/treatments';
    if (isAdminView && !checkSuperAdmin(authUser, res)) return true;

    const prisma = getPrisma();
    if (prisma && getDbStatus()) {
      try {
        const whereClause = isAdminView
          ? { OR: [{ company: 'RWC' }, { company: null }] }
          : { active: true };

        const treatments = await prisma.treatment.findMany({
          where: whereClause,
          orderBy: { name: 'asc' }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(treatments));
        return true;
      } catch (e) {}
    }

    const fallbackList = CLINIC_TREATMENTS.map(t => ({
      ...t,
      company: 'RWC',
      active: true,
      durationMinutes: 45,
      startingPrice: 0
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fallbackList));
    return true;
  }

  return false;
}
