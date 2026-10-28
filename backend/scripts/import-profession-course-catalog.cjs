require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

const professions = [
  'General Practitioner', 'Family Physician', 'Internal Medicine Physician', 'Pediatrician', 'Geriatrician',
  'Cardiologist', 'Neurologist', 'Dermatologist', 'Psychiatrist', 'Oncologist', 'Endocrinologist',
  'Gastroenterologist', 'Nephrologist', 'Pulmonologist', 'Rheumatologist', 'Infectious Disease Specialist',
  'Emergency Medicine Physician', 'Anesthesiologist', 'Radiologist', 'Pathologist', 'General Surgeon',
  'Orthopedic Surgeon', 'Neurosurgeon', 'Cardiothoracic Surgeon', 'Plastic Surgeon', 'Urologist',
  'Obstetrician and Gynecologist', 'Ophthalmologist', 'Otolaryngologist', 'Rehabilitation Physician',
  'Palliative Care Physician', 'Occupational Medicine Physician', 'Public Health Physician', 'Dentist',
  'Orthodontist', 'Periodontist', 'Endodontist', 'Prosthodontist', 'Pediatric Dentist',
  'Oral and Maxillofacial Surgeon', 'Dental Hygienist', 'Dental Therapist', 'Dental Technician',
  'Registered Nurse', 'Nurse Practitioner', 'Clinical Nurse Specialist', 'Community Health Nurse',
  'Mental Health Nurse', 'Pediatric Nurse', 'Emergency Nurse', 'Critical Care Nurse', 'Oncology Nurse',
  'Midwife', 'Pharmacist', 'Clinical Pharmacist', 'Pharmacy Technician', 'Physiotherapist',
  'Occupational Therapist', 'Speech and Language Therapist', 'Audiologist', 'Optometrist', 'Optician',
  'Orthoptist', 'Dietitian', 'Nutritionist', 'Clinical Psychologist', 'Counseling Psychologist',
  'Medical Social Worker', 'Respiratory Therapist', 'Podiatrist', 'Prosthetist', 'Orthotist',
  'Medical Laboratory Scientist', 'Medical Laboratory Technologist', 'Medical Laboratory Technician',
  'Diagnostic Radiographer', 'Radiation Therapist', 'Sonographer', 'Nuclear Medicine Technologist',
  'Cardiac Physiologist', 'Neurophysiology Technologist', 'Perfusionist', 'Anesthesia Technologist',
  'Surgical Technologist', 'Paramedic', 'Emergency Medical Technician', 'Public Health Inspector',
  'Environmental Health Officer', 'Health Educator', 'Community Health Worker'
];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function thumbnail(profession) {
  const text = profession.toLowerCase();
  if (/dent|orthodont|periodont|endodont|prosthodont|oral and maxillofacial/.test(text)) return '/course-images/dental-v1.png';
  if (/nurs|midwi/.test(text)) return '/course-images/nursing-v1.png';
  if (/pharma/.test(text)) return '/course-images/pharmacy-v1.png';
  if (/occupational therapist/.test(text)) return '/course-images/occupational-therapy-v1.png';
  if (/laborator|technologist|technician|radiographer|radiation therapist|sonographer|nuclear medicine|physiologist|perfusionist|anesthesia technologist|surgical technologist/.test(text)) return '/course-images/laboratory-v1.png';
  if (/physio|rehab|therapist|audiologist|optometrist|optician|orthoptist|dietitian|nutritionist|psychologist|social worker|podiatrist|prosthetist|orthotist/.test(text)) return '/course-images/rehabilitation-v1.png';
  return text === 'general practitioner' ? '/course-images/general-practitioner-background-v1.png' : '/course-images/medical-v1.png';
}

(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < professions.length; index += 1) {
      const profession = professions[index];
      const id = `profession-${slug(profession)}`;
      const code = `PROF-${String(index + 1).padStart(3, '0')}`;
      await client.query(`
        INSERT INTO public.exam_courses (
          id, course_code, course_name, exam_authority, profession, country,
          description, thumbnail, status, access_type, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft', 'Assigned Students Only', 'profession-catalog-import', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          course_code = EXCLUDED.course_code,
          course_name = EXCLUDED.course_name,
          exam_authority = EXCLUDED.exam_authority,
          profession = EXCLUDED.profession,
          country = EXCLUDED.country,
          description = EXCLUDED.description,
          thumbnail = EXCLUDED.thumbnail,
          status = 'Draft',
          access_type = 'Assigned Students Only',
          updated_at = NOW()
      `, [
        id,
        code,
        `${profession} Licensing Exam Preparation`,
        'Healthcare Licensing Authority',
        profession,
        'Worldwide',
        `Draft catalogue entry for ${profession}. Confirm the licensing authority, syllabus, exam blueprint, and reviewed question bank before activation.`,
        thumbnail(profession)
      ]);
    }
    await client.query('COMMIT');
    const verify = await client.query(`
      SELECT COUNT(*)::int AS count,
             COUNT(*) FILTER (WHERE status = 'Draft')::int AS draft_count,
             COUNT(*) FILTER (WHERE thumbnail IS NOT NULL AND thumbnail <> '')::int AS illustrated_count
      FROM public.exam_courses
      WHERE created_by = 'profession-catalog-import'
    `);
    console.log(JSON.stringify({ imported: professions.length, verification: verify.rows[0] }));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('CATALOG_IMPORT_FAILED', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
