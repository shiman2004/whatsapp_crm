import { getPrisma } from '../src/db.js';

const CRAS_CATEGORY = {
  id: 'cat-cras-courses',
  name: 'CRAS Academic Programs',
  nameEn: 'CRAS Academic Programs',
  nameSi: 'CRAS අධ්‍යයන පාඨමාලා',
  nameTa: 'CRAS கல்வித் திட்டங்கள்',
  active: true,
  iconName: 'GraduationCap',
  description: 'Clinical aesthetic medicine, dermatology, and cosmetology training programs.'
};

const CRAS_COURSES = [
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
  { id: 'crs-cfg', code: 'CFG', categoryId: 'cat-cras-courses', name: 'Cosmetic & Functional Gynecology', nameEn: 'Cosmetic & Functional Gynecology', nameSi: 'Cosmetic & Functional Gynecology', nameTa: 'Cosmetic & Functional Gynecology' },
  { id: 'crs-rgm', code: 'RGM', categoryId: 'cat-cras-courses', name: 'Regenerative Medicine', nameEn: 'Regenerative Medicine', nameSi: 'Regenerative Medicine', nameTa: 'Regenerative Medicine' },
  { id: 'crs-hjt', code: 'HJT', categoryId: 'cat-cras-courses', name: 'Hijama Therapy', nameEn: 'Hijama Therapy', nameSi: 'Hijama Therapy', nameTa: 'Hijama Therapy' },
  { id: 'crs-cit', code: 'CIT', categoryId: 'cat-cras-courses', name: 'Certificate in Trichology', nameEn: 'Certificate in Trichology', nameSi: 'Certificate in Trichology', nameTa: 'Certificate in Trichology' },
  { id: 'crs-cot', code: 'COT', categoryId: 'cat-cras-courses', name: 'Certificate of Clinical Observership in HT', nameEn: 'Certificate of Clinical Observership in HT', nameSi: 'Certificate of Clinical Observership in HT', nameTa: 'Certificate of Clinical Observership in HT' }
];

async function seed() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('❌ Could not get Prisma client. DATABASE_URL might be missing.');
    process.exit(1);
  }

  console.log('🔄 Upserting CRAS Category into Supabase PostgreSQL...');
  await prisma.treatmentCategory.upsert({
    where: { id: CRAS_CATEGORY.id },
    update: CRAS_CATEGORY,
    create: CRAS_CATEGORY
  });
  console.log('✅ CRAS Category upserted successfully.');

  console.log(`🔄 Upserting ${CRAS_COURSES.length} CRAS Courses into Supabase PostgreSQL...`);
  for (const crs of CRAS_COURSES) {
    await prisma.treatment.upsert({
      where: { id: crs.id },
      update: {
        name: crs.name,
        nameEn: crs.nameEn,
        nameSi: crs.nameSi,
        nameTa: crs.nameTa,
        categoryId: crs.categoryId,
        active: true
      },
      create: {
        id: crs.id,
        categoryId: crs.categoryId,
        name: crs.name,
        nameEn: crs.nameEn,
        nameSi: crs.nameSi,
        nameTa: crs.nameTa,
        active: true,
        startingPrice: 0,
        currency: 'LKR',
        durationMinutes: 60
      }
    });
    console.log(`  ✓ Upserted: [${crs.code}] ${crs.name}`);
  }

  console.log('🎉 All 15 CRAS courses seeded to Supabase successfully!');
  await prisma.$disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error seeding courses:', err);
  process.exit(1);
});
