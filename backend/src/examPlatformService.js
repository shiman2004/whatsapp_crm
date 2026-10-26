/**
 * Healthcare Licensing Exam Preparation Platform Service
 * Full-scale course, question bank, practice runner, mock test simulation,
 * study materials, exam guidelines, and weak area analytics engine.
 */

// -----------------------------------------------------------------------------
// IN-MEMORY SEED STORES (with automated DB synchronizer)
// -----------------------------------------------------------------------------

export let MEMORY_COURSES = [
  {
    id: 'course-dha-rn',
    courseCode: 'DHA-RN',
    courseName: 'DHA Registered Nurse Exam Preparation',
    examAuthority: 'DHA',
    profession: 'Registered Nurse',
    country: 'UAE',
    description: 'Comprehensive preparation for Dubai Health Authority (DHA) Registered Nurse licensing examination.',
    thumbnail: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
    status: 'Active',
    accessType: 'Free',
    createdAt: new Date().toISOString()
  },
  {
    id: 'course-doh-pt',
    courseCode: 'DOH-PT',
    courseName: 'DOH Physiotherapist Licensing Preparation',
    examAuthority: 'DOH',
    profession: 'Physiotherapist',
    country: 'UAE',
    description: 'Department of Health Abu Dhabi (DOH/HAAD) Physiotherapy board exam question bank and guidelines.',
    thumbnail: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
    status: 'Active',
    accessType: 'Free',
    createdAt: new Date().toISOString()
  },
  {
    id: 'course-moh-gp',
    courseCode: 'MOH-GP',
    courseName: 'MOH General Practitioner Exam Preparation',
    examAuthority: 'MOH',
    profession: 'General Practitioner',
    country: 'UAE',
    description: 'Ministry of Health UAE primary care and clinical evaluation examination preparation course.',
    thumbnail: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80',
    status: 'Active',
    accessType: 'Free',
    createdAt: new Date().toISOString()
  },
  {
    id: 'course-prometric-pharm',
    courseCode: 'PROM-PHARM',
    courseName: 'Prometric Pharmacist Licensing Preparation',
    examAuthority: 'Prometric',
    profession: 'Pharmacist',
    country: 'Saudi / Gulf',
    description: 'Prometric clinical pharmacology, drug interactions, and therapeutics licensing question bank.',
    thumbnail: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80',
    status: 'Active',
    accessType: 'Free',
    createdAt: new Date().toISOString()
  },
  {
    id: 'course-dha-ot',
    courseCode: 'DHA-OT',
    courseName: 'DHA Occupational Therapist Exam Preparation',
    examAuthority: 'DHA',
    profession: 'Occupational Therapist',
    country: 'UAE',
    description: 'Pediatric, neuro, and rehabilitation occupational therapy licensing exam preparation.',
    thumbnail: 'https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?auto=format&fit=crop&w=600&q=80',
    status: 'Active',
    accessType: 'Free',
    createdAt: new Date().toISOString()
  },
  {
    id: 'course-dha-mlt',
    courseCode: 'DHA-MLT',
    courseName: 'DHA Medical Laboratory Technician Preparation',
    examAuthority: 'DHA',
    profession: 'Medical Laboratory Technician',
    country: 'UAE',
    description: 'Hematology, biochemistry, microbiology, and blood banking laboratory technician examination.',
    thumbnail: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=600&q=80',
    status: 'Active',
    accessType: 'Free',
    createdAt: new Date().toISOString()
  }
];

export let MEMORY_SUBJECTS = [
  { id: 'subj-med-nursing', courseId: 'course-dha-rn', subjectName: 'Medical Nursing', sortOrder: 1, status: 'Active' },
  { id: 'subj-surg-nursing', courseId: 'course-dha-rn', subjectName: 'Surgical Nursing', sortOrder: 2, status: 'Active' },
  { id: 'subj-emerg-nursing', courseId: 'course-dha-rn', subjectName: 'Emergency Nursing', sortOrder: 3, status: 'Active' },
  { id: 'subj-crit-care', courseId: 'course-dha-rn', subjectName: 'Critical Care', sortOrder: 4, status: 'Active' },
  { id: 'subj-maternal', courseId: 'course-dha-rn', subjectName: 'Maternal Health', sortOrder: 5, status: 'Active' },
  { id: 'subj-pediatric', courseId: 'course-dha-rn', subjectName: 'Pediatric Nursing', sortOrder: 6, status: 'Active' },
  { id: 'subj-pharmacology', courseId: 'course-dha-rn', subjectName: 'Pharmacology', sortOrder: 7, status: 'Active' },
  { id: 'subj-infection', courseId: 'course-dha-rn', subjectName: 'Infection Control', sortOrder: 8, status: 'Active' },
  { id: 'subj-patient-safety', courseId: 'course-dha-rn', subjectName: 'Patient Safety & Fundamentals', sortOrder: 9, status: 'Active' },
  { id: 'subj-clinical-proc', courseId: 'course-dha-rn', subjectName: 'Clinical Procedures', sortOrder: 10, status: 'Active' }
];

export let MEMORY_QUESTIONS = [
  {
    id: 'q-dha-rn-00001',
    questionCode: 'DHA-RN-00001',
    courseId: 'course-dha-rn',
    subjectId: 'subj-clinical-proc',
    subject: 'Clinical Procedures',
    topic: 'Blood Transfusion Reaction',
    title: 'Question 1 — Blood Transfusion Reaction',
    questionText: 'Fifteen minutes after starting a blood transfusion, a patient develops chills, shortness of breath, and lower back pain. What should the nurse do FIRST?',
    questionImage: '',
    optionA: 'Slow the transfusion and reassess after 10 minutes',
    optionB: 'Administer an antipyretic and continue the transfusion',
    optionC: 'Stop the transfusion immediately and maintain IV access with normal saline using new tubing',
    optionD: 'Notify the blood bank before stopping the transfusion',
    optionE: 'Increase the IV flow rate to maintain blood pressure',
    correctAnswer: 'C',
    rememberNote1: 'Suspected acute transfusion reaction → STOP the blood transfusion immediately.',
    rememberNote2: 'Maintain IV access with 0.9% normal saline using new tubing.',
    rememberNote3: 'Assess the patient, monitor vital signs, and notify the physician/provider and blood bank according to protocol.',
    detailedExplanation: 'An acute hemolytic or febrile transfusion reaction is an emergency. The priority action is to immediately discontinue the infusion to prevent further exposure to incompatible blood while preserving venous access using fresh IV tubing and 0.9% normal saline.',
    difficulty: 'Medium',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00002',
    questionCode: 'DHA-RN-00002',
    courseId: 'course-dha-rn',
    subjectId: 'subj-pharmacology',
    subject: 'Pharmacology',
    topic: 'Digoxin Toxicity & Hypokalemia',
    title: 'Question 2 — Digoxin Toxicity and Hypokalemia',
    questionText: 'A patient with heart failure is receiving Digoxin 0.25 mg daily and Furosemide 40 mg daily. Which clinical finding should alert the nurse to potential digoxin toxicity?',
    questionImage: '',
    optionA: 'Heart rate of 88 beats/min and mild ankle edema',
    optionB: 'Visual disturbances with yellow-green halos and nausea',
    optionC: 'Serum potassium level of 4.8 mEq/L',
    optionD: 'Increased appetite and weight gain of 1 lb in 3 days',
    optionE: 'Blood pressure of 134/82 mmHg',
    correctAnswer: 'B',
    rememberNote1: 'Classic signs of digoxin toxicity: GI distress (nausea/vomiting/anorexia), bradycardia/dysrhythmias, and visual changes (yellow-green halos/blurred vision).',
    rememberNote2: 'Hypokalemia (low potassium, commonly from loop diuretics like furosemide) significantly increases digoxin binding and potentiates toxicity.',
    rememberNote3: 'Always assess the apical pulse for 1 full minute prior to administration; withhold and notify provider if apical pulse is < 60 bpm in adults.',
    detailedExplanation: 'Digoxin has a narrow therapeutic range (0.8–2.0 ng/mL). Hypokalemia caused by loop diuretics heightens myocardial sensitivity to digoxin, leading to visual disturbances, gastrointestinal upset, and fatal dysrhythmias.',
    difficulty: 'Medium',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00003',
    questionCode: 'DHA-RN-00003',
    courseId: 'course-dha-rn',
    subjectId: 'subj-emerg-nursing',
    subject: 'Emergency Nursing',
    topic: 'Anaphylactic Shock Management',
    title: 'Question 3 — Emergency Management of Anaphylaxis',
    questionText: 'A client with an acute severe allergic reaction develops stridor, facial angioedema, and a systolic blood pressure drop to 80 mmHg. What is the immediate first-line pharmacological treatment?',
    questionImage: '',
    optionA: 'Oral diphenhydramine 50 mg',
    optionB: 'Intravenous hydrocortisone 200 mg',
    optionC: 'Intramuscular Epinephrine (1:1,000) administered into the anterolateral thigh',
    optionD: 'Inhaled albuterol nebulizer monotherapy',
    optionE: 'Subcutaneous Epinephrine (1:10,000) in the deltoid muscle',
    correctAnswer: 'C',
    rememberNote1: 'Intramuscular (IM) Epinephrine 1:1,000 in the mid-anterolateral thigh is the first-line, life-saving drug of choice in anaphylaxis.',
    rememberNote2: 'Do not delay epinephrine administration to give antihistamines or corticosteroids, which are secondary second-line treatments.',
    rememberNote3: 'Place patient in recumbent position with lower extremities elevated, administer high-flow oxygen, and establish large-bore IV access for isotonic fluid resuscitation.',
    detailedExplanation: 'Epinephrine stimulates alpha-1, beta-1, and beta-2 adrenergic receptors, reversing peripheral vasodilation, reducing mucosal edema, and opening bronchial airways. IM injection in the vastus lateralis achieves prompt peak plasma concentrations.',
    difficulty: 'Hard',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00004',
    questionCode: 'DHA-RN-00004',
    courseId: 'course-dha-rn',
    subjectId: 'subj-crit-care',
    subject: 'Critical Care',
    topic: 'Acute Myocardial Infarction',
    title: 'Question 4 — STEMI Initial Nursing Management',
    questionText: 'A 56-year-old patient presents with crushing substernal chest pain radiating to the left arm. 12-lead ECG reveals ST-elevation in leads II, III, and aVF. Which intervention is contraindicated without right-sided ECG confirmation?',
    questionImage: '',
    optionA: 'Supplemental oxygen via nasal cannula for SpO2 < 90%',
    optionB: 'Sublingual Nitroglycerin before assessing right ventricular involvement',
    optionC: 'Chewable Aspirin 325 mg orally',
    optionD: 'Continuous 12-lead cardiac telemetry monitoring',
    optionE: 'Intravenous large-bore saline lock placement',
    correctAnswer: 'B',
    rememberNote1: 'Inferior wall MI (leads II, III, aVF) has a high association with Right Ventricular (RV) infarction.',
    rememberNote2: 'Nitrates and diuretics markedly decrease preload; in RV infarction, this can precipitate profound, refractory hypotension.',
    rememberNote3: 'Always obtain right-sided precordial leads (V3R–V4R) before administering nitrates in inferior STEMI.',
    detailedExplanation: 'Right ventricular infarction is preload-dependent. Venodilators like nitroglycerin abruptly reduce venous return to the right heart, dropping cardiac output precipitously. Isotonic fluid boluses are the priority for RV hypoperfusion.',
    difficulty: 'Hard',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00005',
    questionCode: 'DHA-RN-00005',
    courseId: 'course-dha-rn',
    subjectId: 'subj-med-nursing',
    subject: 'Medical Nursing',
    topic: 'Severe Hypoglycemia Protocol',
    title: 'Question 5 — Acute Hypoglycemia in Diabetic Patient',
    questionText: 'A conscious hospitalized diabetic client exhibits diaphoresis, tremors, confusion, and a blood glucose of 48 mg/dL. According to the "Rule of 15", what is the most appropriate initial nursing action?',
    questionImage: '',
    optionA: 'Administer 1 mg of IM glucagon immediately',
    optionB: 'Give 4 ounces (120 mL) of whole milk with two tablespoons of peanut butter',
    optionC: 'Infuse 500 mL of 0.9% normal saline rapidly',
    optionD: 'Administer 15 grams of fast-acting simple carbohydrates (e.g. 4 oz fruit juice or 3-4 glucose tablets)',
    optionE: 'Administer 10 units of Regular insulin subcutaneously',
    correctAnswer: 'D',
    rememberNote1: 'Rule of 15: Give 15 grams of fast-acting simple carbohydrate, wait 15 minutes, and recheck blood glucose.',
    rememberNote2: 'Avoid foods high in fat (such as chocolate or peanut butter) initially, as fat delays gastric emptying and glucose absorption.',
    rememberNote3: 'If blood glucose remains < 70 mg/dL after 15 minutes, repeat 15 grams of carbohydrate. If unresponsive, give IV 50% Dextrose or IM Glucagon.',
    detailedExplanation: 'The standard of care for conscious hypoglycemia (BG < 70 mg/dL) is 15-20 grams of rapid-acting simple sugar without fat. Fat impedes carbohydrate absorption through the gastric mucosa.',
    difficulty: 'Easy',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00006',
    questionCode: 'DHA-RN-00006',
    courseId: 'course-dha-rn',
    subjectId: 'subj-surg-nursing',
    subject: 'Surgical Nursing',
    topic: 'Post-Operative Pulmonary Embolism',
    title: 'Question 6 — Post-Operative Pulmonary Embolism',
    questionText: 'Three days following total knee arthroplasty, a patient suddenly complains of sharp pleuritic chest pain, tachypnea of 32 breaths/min, and anxiety. What is the immediate priority nursing intervention?',
    questionImage: '',
    optionA: 'Elevate head of bed to High Fowler position and apply supplemental oxygen',
    optionB: 'Administer scheduled oral analgesic and perform calf massage',
    optionC: 'Instruct the patient to ambulate in the hallway to clear atelectasis',
    optionD: 'Place the patient in Trendelenburg position',
    optionE: 'Wait 30 minutes and re-evaluate respiratory rate',
    correctAnswer: 'A',
    rememberNote1: 'Suspected Pulmonary Embolism (PE): Elevate head of bed to optimize diaphragmatic excursion and oxygenation.',
    rememberNote2: 'Apply supplemental oxygen immediately, assess vital signs, and notify the physician stat.',
    rememberNote3: 'NEVER massage lower extremities with suspected Deep Vein Thrombosis (DVT) as it can dislodge the thrombus.',
    detailedExplanation: 'Immediate elevation of the head of the bed improves ventilation-perfusion matching and eases respiratory effort. High-flow oxygen helps counter acute hypoxemia induced by ventilation-perfusion mismatching.',
    difficulty: 'Medium',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00007',
    questionCode: 'DHA-RN-00007',
    courseId: 'course-dha-rn',
    subjectId: 'subj-pediatric',
    subject: 'Pediatric Nursing',
    topic: 'Pediatric Dehydration Assessment',
    title: 'Question 7 — Severe Pediatric Dehydration',
    questionText: 'An 8-month-old infant with severe gastroenteritis presents with sunken fontanels, dry mucous membranes, delayed capillary refill of 4 seconds, and lethargy. What is the priority treatment?',
    questionImage: '',
    optionA: 'Oral rehydration therapy with 100 mL apple juice',
    optionB: 'Intravenous 5% Dextrose in water (D5W) at maintenance rate',
    optionC: 'Immediate IV fluid resuscitation with 20 mL/kg of isotonic crystalloid (Normal Saline or Ringer Lactate)',
    optionD: 'Administration of pediatric antidiarrheal medication',
    optionE: 'Immediate broad-spectrum antibiotic injection',
    correctAnswer: 'C',
    rememberNote1: 'Severe dehydration with signs of shock requires immediate emergent isotonic fluid bolus: 20 mL/kg of Normal Saline or Ringer Lactate over 10–20 minutes.',
    rememberNote2: 'Never use hypotonic solutions (like D5W) for acute emergent volume resuscitation in hypovolemia.',
    rememberNote3: 'Reassess cardiopulmonary status, mental status, and capillary refill after each fluid bolus.',
    detailedExplanation: 'In severe dehydration with impaired perfusion (delayed capillary refill, lethargy), prompt intravascular volume expansion with isotonic crystalloid at 20 mL/kg prevents hypovolemic shock and end-organ damage.',
    difficulty: 'Hard',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00008',
    questionCode: 'DHA-RN-00008',
    courseId: 'course-dha-rn',
    subjectId: 'subj-infection',
    subject: 'Infection Control',
    topic: 'Airborne Precautions for Tuberculosis',
    title: 'Question 8 — Airborne Isolation Protocol',
    questionText: 'A patient is admitted with suspected active pulmonary tuberculosis with productive hemoptysis. Which infection control precaution is mandatory for healthcare workers entering the room?',
    questionImage: '',
    optionA: 'Standard surgical mask and sterile gloves',
    optionB: 'Fit-tested N95 respirator mask or Powered Air-Purifying Respirator (PAPR) and airborne negative-pressure isolation room',
    optionC: 'Droplet precautions with eye goggles within 3 feet only',
    optionD: 'Contact isolation gown and shoe covers only',
    optionE: 'Regular cloth face mask with door left open for ventilation',
    correctAnswer: 'B',
    rememberNote1: 'Active Tuberculosis requires Airborne Precautions: negative-pressure isolation room with 6–12 air exchanges per hour.',
    rememberNote2: 'Healthcare workers must wear a fit-tested N95 particulate respirator or higher before entering.',
    rememberNote3: 'If patient must be transported outside the room, the PATIENT must wear a surgical mask.',
    detailedExplanation: 'Mycobacterium tuberculosis droplet nuclei remain suspended in the air for extended periods. Negative pressure rooms and N95 masks filter out particles down to 0.3 microns, protecting staff from airborne transmission.',
    difficulty: 'Easy',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00009',
    questionCode: 'DHA-RN-00009',
    courseId: 'course-dha-rn',
    subjectId: 'subj-maternal',
    subject: 'Maternal Health',
    topic: 'Magnesium Sulfate Toxicity in Preeclampsia',
    title: 'Question 9 — Magnesium Sulfate Toxicity in Severe Preeclampsia',
    questionText: 'A client with severe preeclampsia is receiving continuous IV Magnesium Sulfate. The nurse notes deep tendon reflexes (DTR) of 0 (absent), respiratory rate of 9 breaths/min, and urine output of 15 mL/hr. What should the nurse do FIRST?',
    questionImage: '',
    optionA: 'Increase the IV infusion rate of Magnesium Sulfate',
    optionB: 'Notify the pediatrician for immediate neonatal assessment',
    optionC: 'Place the patient in right lateral position and recheck DTRs in 1 hour',
    optionD: 'Administer IV hydralazine bolus',
    optionE: 'Discontinue the Magnesium Sulfate infusion immediately and prepare Calcium Gluconate',
    correctAnswer: 'E',
    rememberNote1: 'Signs of Magnesium Toxicity: loss of deep tendon reflexes (first sign), respiratory depression (< 12/min), oliguria (< 30 mL/hr), and cardiac arrest.',
    rememberNote2: 'Priority: Immediately STOP the magnesium infusion.',
    rememberNote3: 'Antidote: Calcium Gluconate (1 gram of 10% solution IV over 3–5 minutes).',
    detailedExplanation: 'Magnesium sulfate is excreted by the kidneys; oliguria causes toxic accumulation leading to neuromuscular blockade and respiratory failure. Immediate cessation and administration of the specific antagonist Calcium Gluconate is life-saving.',
    difficulty: 'Medium',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'q-dha-rn-00010',
    questionCode: 'DHA-RN-00010',
    courseId: 'course-dha-rn',
    subjectId: 'subj-crit-care',
    subject: 'Critical Care',
    topic: 'Glasgow Coma Scale & Neuro Deterioration',
    title: 'Question 10 — Neurological Assessment with Glasgow Coma Scale',
    questionText: 'A traumatic brain injury patient previously had a Glasgow Coma Scale (GCS) score of 13. Two hours later, the GCS drops to 8 with a newly dilated, sluggish right pupil. What is the immediate priority?',
    questionImage: '',
    optionA: 'Recheck the patient neurologically in 2 hours',
    optionB: 'Call emergency medical team / neurosurgeon immediately, secure airway, and prepare for urgent CT/intervention',
    optionC: 'Administer oral sedatives to reduce intracranial pressure',
    optionD: 'Reposition the patient into steep Trendelenburg position',
    optionE: 'Apply warm blankets to treat hypothermia',
    correctAnswer: 'B',
    rememberNote1: 'GCS ≤ 8 indicates severe brain injury ("GCS 8, intubate") requiring immediate airway protection.',
    rememberNote2: 'A sudden drop in GCS score accompanied by an uncal herniation pupil sign (anisocoria) signals impending catastrophic brainstem compression.',
    rememberNote3: 'Maintain head of bed at 30 degrees, head in neutral midline position, and avoid hip flexion to promote cerebral venous drainage.',
    detailedExplanation: 'A drop in GCS of 2 or more points is a neurosurgical emergency. GCS ≤ 8 requires urgent airway securing and rapid intervention to prevent irreversible uncal herniation.',
    difficulty: 'Hard',
    questionType: 'Both',
    status: 'Active',
    createdAt: new Date().toISOString()
  }
];

export let MEMORY_PRACTICE_SESSIONS = {};

export let MEMORY_MOCK_TESTS_PLATFORM = [
  {
    id: 'mock-dha-rn-01',
    courseId: 'course-dha-rn',
    mockTestName: 'DHA Registered Nurse — Official Simulation Mock Exam 01',
    subjectScope: 'Full Syllabus: Medical, Surgical, Emergency, Critical Care, Pharmacology, Maternal, Pediatric',
    durationMinutes: 120,
    totalQuestions: 10,
    passPercentage: 65,
    randomQuestionOrder: true,
    randomAnswerOrder: false,
    allowBackNavigation: true,
    showResults: 'Immediately',
    status: 'Published',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-dha-rn-02',
    courseId: 'course-dha-rn',
    mockTestName: 'DHA Registered Nurse — Clinical Pharmacology & Emergency Care Mock 02',
    subjectScope: 'Focused Exam: High-Alert Medications, Calculations, Toxicology & Resuscitation',
    durationMinutes: 90,
    totalQuestions: 10,
    passPercentage: 70,
    randomQuestionOrder: true,
    randomAnswerOrder: false,
    allowBackNavigation: true,
    showResults: 'Immediately',
    status: 'Published',
    createdAt: new Date().toISOString()
  }
];

export let MEMORY_MOCK_ATTEMPTS_PLATFORM = [];

export let MEMORY_STUDY_MATERIALS_PLATFORM = [
  {
    id: 'mat-blood-transfusion',
    courseId: 'course-dha-rn',
    subjectId: 'subj-clinical-proc',
    topic: 'Transfusion Protocols',
    title: 'Blood Transfusion Safety Guidelines & Reaction Management',
    description: 'Essential clinical guide detailing pre-transfusion checks, reaction identification, and rapid intervention protocols.',
    materialType: 'PDF',
    fileUrl: '/uploads/blood_transfusion_safety.pdf',
    externalUrl: '',
    thumbnail: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=400&q=80',
    allowDownload: true,
    status: 'Active',
    uploadedBy: 'Clinical Education Team',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'mat-pharmacology-calc',
    courseId: 'course-dha-rn',
    subjectId: 'subj-pharmacology',
    topic: 'Dosage & Calculations',
    title: 'High-Alert Medications & Pediatric Dosage Calculations Handbook',
    description: 'Comprehensive formula cheatsheet for IV drip rates, microgram infusions, and pediatric body surface area calculations.',
    materialType: 'PDF',
    fileUrl: '/uploads/pharmacology_dosage_calculations.pdf',
    externalUrl: '',
    thumbnail: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=400&q=80',
    allowDownload: true,
    status: 'Active',
    uploadedBy: 'Clinical Education Team',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'mat-infection-control',
    courseId: 'course-dha-rn',
    subjectId: 'subj-infection',
    topic: 'Isolation & Precautions',
    title: 'Healthcare-Associated Infection Prevention & Airborne Protocols',
    description: 'CDC and UAE Ministry guidelines on standard, droplet, contact, and airborne negative-pressure containment.',
    materialType: 'PDF',
    fileUrl: '/uploads/infection_control_protocols.pdf',
    externalUrl: '',
    thumbnail: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=400&q=80',
    allowDownload: true,
    status: 'Active',
    uploadedBy: 'Clinical Education Team',
    uploadedAt: new Date().toISOString()
  },
  {
    id: 'mat-acls-algorithms',
    courseId: 'course-dha-rn',
    subjectId: 'subj-emerg-nursing',
    topic: 'Cardiac Arrest & Dysrhythmias',
    title: 'Adult Cardiac Life Support (ACLS) Core Algorithm Wallchart',
    description: 'Color-coded emergency workflows for Ventricular Fibrillation, Pulseless VT, Asystole, PEA, and Symptomatic Bradycardia.',
    materialType: 'PDF',
    fileUrl: '/uploads/acls_cardiac_algorithms.pdf',
    externalUrl: '',
    thumbnail: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80',
    allowDownload: true,
    status: 'Active',
    uploadedBy: 'Clinical Education Team',
    uploadedAt: new Date().toISOString()
  }
];

export let MEMORY_GUIDELINES_PLATFORM = [
  {
    id: 'guide-dha-overview',
    courseId: 'course-dha-rn',
    guidelineTitle: 'DHA Registered Nurse Licensing Overview & Eligibility Criteria',
    section: 'Overview & Eligibility',
    content: `### 1. Educational Qualifications
Candidates must possess an accredited Bachelor of Science in Nursing (BSN) or equivalent 3-year Diploma in General Nursing.

### 2. Clinical Experience Requirements
- Minimum 2 years of continuous, verifiable hospital experience following registration.
- Experience must be in acute inpatient care, ICU, medical-surgical, or emergency departments.

### 3. Primary Source Verification (PSV)
- Must be completed via the official DataFlow portal.
- Includes credential verification, employment certificate validation, and home-country nursing council good standing certificate.

### 4. Examination Structure
- Computer-based Prometric testing.
- 150 multiple choice questions over 3 hours.
- Passing threshold: 60%.`,
    officialReferenceUrl: 'https://www.dha.gov.ae/en/HealthRegulation',
    updatedDate: new Date().toISOString(),
    status: 'Active'
  },
  {
    id: 'guide-dha-documents',
    courseId: 'course-dha-rn',
    guidelineTitle: 'Mandatory Document Checklist for DHA Sheryan Portal',
    section: 'Required Documents',
    content: `### Required Document Checklist:
1. **Valid Passport Copy** (Minimum 6 months validity).
2. **Passport Sized Photograph** (White background, recent within 3 months).
3. **Nursing Degree / Diploma Certificate** (Conferred and authenticated).
4. **Official Academic Transcript** (Showing all clinical hours and courses).
5. **Home Country Professional Nursing Registration Certificate / License**.
6. **Certificate of Good Standing (CGS)**: Issued within the last 3 months from the state or national nursing regulatory board.
7. **Experience Certificates**: Signed by Medical Director / HR detailing department, title, and dates of service.
8. **Basic Life Support (BLS)**: Active certification from an AHA-accredited training center.`,
    officialReferenceUrl: 'https://services.dha.gov.ae',
    updatedDate: new Date().toISOString(),
    status: 'Active'
  },
  {
    id: 'guide-dha-exam-day',
    courseId: 'course-dha-rn',
    guidelineTitle: 'Prometric Test Center Instructions & Exam Day Rules',
    section: 'Exam Day Rules',
    content: `### Test Center Arrival & Verification:
- Arrive at the Prometric testing facility at least 45 minutes prior to scheduled appointment.
- Bring two forms of identification: Primary (valid Passport) and Secondary (National ID or Driver's license with matching name).
- Electronic items, watches, notes, and study guides must be placed inside the assigned locker.

### During Examination:
- Scratch paper or laminated whiteboards and dry-erase markers are provided.
- One 10-minute scheduled break is permitted, but the test timer continues running.
- In case of technical difficulty, raise your hand immediately for the proctor.`,
    officialReferenceUrl: 'https://www.prometric.com/dha',
    updatedDate: new Date().toISOString(),
    status: 'Active'
  },
  {
    id: 'guide-dha-faqs',
    courseId: 'course-dha-rn',
    guidelineTitle: 'Frequently Asked Questions (Exam Attempts & Validity)',
    section: 'Frequently Asked Questions',
    content: `### Common Examination Questions:
**Q: How many attempts are allowed for the DHA exam?**
A: Candidates are permitted a maximum of 3 attempts across all UAE health authorities (DHA, MOH, DOH) within a 1-year period.

**Q: How long is the DHA exam result valid?**
A: A passing result is valid for 5 years for eligibility registration.

**Q: Can I transfer my DHA license to Abu Dhabi (DOH) or MOH?**
A: Yes! Through the UAE Unified Healthcare Professional Licensing Framework, DHA eligible/licensed nurses can transfer their credential to DOH or MOH after 6 months of active practice without re-examination.`,
    officialReferenceUrl: 'https://www.dha.gov.ae',
    updatedDate: new Date().toISOString(),
    status: 'Active'
  }
];

// -----------------------------------------------------------------------------
// DATABASE SYNCHRONIZER & PERSISTENCE
// -----------------------------------------------------------------------------

export async function ensurePlatformSeedData(prisma) {
  if (!prisma) return;
  try {
    // 1. Seed Courses
    const courseCountRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_courses;`);
    if (!courseCountRes?.[0]?.count) {
      for (const c of MEMORY_COURSES) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.exam_courses (
            id, course_code, course_name, exam_authority, profession, country,
            description, thumbnail, status, access_type, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Admin', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, c.id, c.courseCode, c.courseName, c.examAuthority, c.profession, c.country, c.description, c.thumbnail, c.status, c.accessType);
      }
    }

    // 2. Seed Subjects
    const subjCountRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_subjects;`);
    if (!subjCountRes?.[0]?.count) {
      for (const s of MEMORY_SUBJECTS) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.exam_subjects (id, course_id, subject_name, sort_order, status, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id) DO NOTHING;
        `, s.id, s.courseId, s.subjectName, s.sortOrder, s.status);
      }
    }

    // 3. Seed Questions
    const qCountRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_mcq_questions;`);
    if (!qCountRes?.[0]?.count) {
      for (const q of MEMORY_QUESTIONS) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.exam_mcq_questions (
            id, question_code, course_id, subject_id, topic, title, question_text,
            category_id, category_name, subject, image_url,
            option_a, option_b, option_c, option_d, option_e, correct_answer,
            remember_note_1, remember_note_2, remember_note_3, detailed_explanation,
            difficulty, question_type, status, is_active, display_order, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            'cat-dha', 'DHA', $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21, $22, TRUE, 1, NOW(), NOW()
          ) ON CONFLICT (id) DO NOTHING;
        `,
          q.id, q.questionCode, q.courseId, q.subjectId, q.topic, q.title, q.questionText,
          q.subject, q.questionImage || '', q.optionA, q.optionB, q.optionC, q.optionD, q.optionE, q.correctAnswer,
          q.rememberNote1, q.rememberNote2, q.rememberNote3, q.detailedExplanation,
          q.difficulty, q.questionType, q.status
        );
      }
    }

    // 4. Seed Study Materials
    const matCountRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_study_materials;`);
    if (!matCountRes?.[0]?.count) {
      for (const m of MEMORY_STUDY_MATERIALS_PLATFORM) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.exam_study_materials (
            id, course_id, subject_id, topic, title, description,
            material_type, file_url, external_url, thumbnail, allow_download, status,
            uploaded_by, uploaded_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, m.id, m.courseId, m.subjectId, m.topic, m.title, m.description, m.materialType, m.fileUrl, m.externalUrl, m.thumbnail, m.allowDownload, m.status, m.uploadedBy);
      }
    }

    // 5. Seed Guidelines
    const guideCountRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM public.exam_guidelines;`);
    if (!guideCountRes?.[0]?.count) {
      for (const g of MEMORY_GUIDELINES_PLATFORM) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO public.exam_guidelines (
            id, course_id, guideline_title, section, content,
            official_reference_url, updated_date, status, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'Admin', 'Admin')
          ON CONFLICT (id) DO NOTHING;
        `, g.id, g.courseId, g.guidelineTitle, g.section, g.content, g.officialReferenceUrl, g.status);
      }
    }
  } catch (err) {
    console.warn('⚠️ [ExamPlatformService] Seed sync warning:', err.message);
  }
}
