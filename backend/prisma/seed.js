import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Royal Wellness Center MySQL Database Seeding...');

  // 1. Treatment Categories
  const categories = [
    {
      id: 'cat-hair-care',
      name: 'Hair Care & Restoration',
      nameEn: 'Hair Care & Restoration',
      nameSi: 'හිසකෙස් ප්‍රතිකාර සහ යථා තත්ත්වයට පත්කිරීම',
      nameTa: 'முடி பராமரிப்பு மற்றும் சீரமைப்பு',
      active: true,
      iconName: 'Sparkles',
      description: 'Advanced PRP, GFC, and FUE hair transplant solutions by certified trichologists.',
    },
    {
      id: 'cat-skin-care',
      name: 'Aesthetic Skin Care',
      nameEn: 'Aesthetic Skin Care',
      nameSi: 'සම රැකවරණ ප්‍රතිකාර',
      nameTa: 'அழகியல் தோல் பராமரிப்பு',
      active: true,
      iconName: 'Smile',
      description: 'Clinical dermatological facials, laser pigmentation correction, and anti-aging therapies.',
    },
    {
      id: 'cat-iv-wellness',
      name: 'IV Drip Therapy & Wellness',
      nameEn: 'IV Drip Therapy & Wellness',
      nameSi: 'IV විටමින් ප්‍රතිකාර',
      nameTa: 'IV டிரிப் மற்றும் ஆரோக்கிய சிகிச்சை',
      active: true,
      iconName: 'Zap',
      description: 'Customized intravenous wellness blends for cellular rejuvenation, immunity, and glow.',
    },
    {
      id: 'cat-weight-management',
      name: 'Weight Management & Body Contouring',
      nameEn: 'Weight Management & Body Contouring',
      nameSi: 'බර පාලනය සහ ශරීර හැඩගැස්වීම',
      nameTa: 'உடல் எடை மேலாண்மை மற்றும் வடிவம்',
      active: true,
      iconName: 'Activity',
      description: 'Non-invasive fat reduction, muscle sculpting, and metabolic nutrition programs.',
    },
    {
      id: 'cat-dental-aesthetics',
      name: 'Dental Aesthetics & Smile Design',
      nameEn: 'Dental Aesthetics & Smile Design',
      nameSi: 'දන්ත සෞන්දර්ය ප්‍රතිකාර',
      nameTa: 'பல் அழகியல் மற்றும் புன்னகை வடிவமைப்பு',
      active: true,
      iconName: 'Sparkles',
      description: 'Laser teeth whitening, composite/porcelain veneers, and invisible aligners.',
    },
    {
      id: 'cat-ayurveda',
      name: 'Ayurvedic Rejuvenation & Panchakarma',
      nameEn: 'Ayurvedic Rejuvenation & Panchakarma',
      nameSi: 'ආයුර්වේද ප්‍රතිකාර සහ පංචකර්ම',
      nameTa: 'ஆயுர்வேத புத்துணர்ச்சி மற்றும் பஞ்சகர்மா',
      active: true,
      iconName: 'Leaf',
      description: 'Authentic royal Ceylon herbal detox, herbal steam bath, and stress relief packages.',
    },
  ];

  for (const cat of categories) {
    await prisma.treatmentCategory.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }
  console.log(`✅ Seeded ${categories.length} treatment categories.`);

  // 2. Treatments Catalog
  const treatments = [
    {
      id: 'trt-hair-prp',
      categoryId: 'cat-hair-care',
      name: 'Advanced Hair PRP / GFC Therapy',
      nameEn: 'Advanced Hair PRP / GFC Therapy',
      nameSi: 'හිසකෙස් සඳහා PRP ප්‍රතිකාරය',
      nameTa: 'மேம்பட்ட முடி PRP சிகிச்சை',
      startingPrice: 25000,
      currency: 'LKR',
      durationMinutes: 45,
      active: true,
      benefits: 'Stimulates dormant follicles, halts shedding, 100% natural autologous plasma',
      description: 'Targeted scalp micro-injections using growth factor concentrate to reverse thinning.',
    },
    {
      id: 'trt-hair-transplant',
      categoryId: 'cat-hair-care',
      name: 'Bio-FUE Micro Hair Transplant',
      nameEn: 'Bio-FUE Micro Hair Transplant',
      nameSi: 'FUE හිසකෙස් බද්ධ කිරීම',
      nameTa: 'Bio-FUE முடி மாற்று அறுவை சிகிச்சை',
      startingPrice: 180000,
      currency: 'LKR',
      durationMinutes: 240,
      active: true,
      benefits: 'Permanent natural hairline, scarless extraction, zero downtime recovery',
      description: 'High-density micro-grafting by senior hair transplant surgeons with lifetime warranty.',
    },
    {
      id: 'trt-hydrafacial',
      categoryId: 'cat-skin-care',
      name: 'Royal Signature HydraFacial MD',
      nameEn: 'Royal Signature HydraFacial MD',
      nameSi: 'හයිඩ්‍රාෆේෂල් ප්‍රතිකාරය',
      nameTa: 'ஹைட்ராஃபேஷியல் சிகிச்சை',
      startingPrice: 18500,
      currency: 'LKR',
      durationMinutes: 60,
      active: true,
      benefits: 'Instant glass skin glow, deep vortex pore cleansing, intense hyaluronic hydration',
      description: '4-step medical facial: Cleanse + Peel + Extract + Hydrate with antioxidant infusion.',
    },
    {
      id: 'trt-iv-glow',
      categoryId: 'cat-iv-wellness',
      name: 'Royal Glutathione & Vitamin C Glow IV',
      nameEn: 'Royal Glutathione & Vitamin C Glow IV',
      nameSi: 'ග්ලුටතයෝන් IV ප්‍රතිකාරය',
      nameTa: 'குளுதாதயோன் & வைட்டமின் C IV சிகிச்சை',
      startingPrice: 16000,
      currency: 'LKR',
      durationMinutes: 45,
      active: true,
      benefits: 'Full body radiance, liver detoxification, powerful antioxidant boost',
      description: 'Medical-grade 2400mg Glutathione combined with High-Dose Ascorbic Acid.',
    },
  ];

  for (const trt of treatments) {
    await prisma.treatment.upsert({
      where: { id: trt.id },
      update: trt,
      create: trt,
    });
  }
  console.log(`✅ Seeded ${treatments.length} treatments.`);

  // 3. Super Admin User
  await prisma.user.upsert({
    where: { email: 'admin@royalwellness.lk' },
    update: {},
    create: {
      id: 'user-admin-1',
      fullName: 'Super Admin',
      email: 'admin@royalwellness.lk',
      role: 'super_admin',
      active: true,
    },
  });
  console.log('✅ Seeded Super Admin user.');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
