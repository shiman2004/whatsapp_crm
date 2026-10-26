BEGIN;

-- Repair leads whose treatment/category references are missing or orphaned.
-- Existing valid selections are preserved. Defaults match the existing backend
-- lead-creation fallbacks:
--   RWC  -> Hair Care / PRP Hair
--   CRAS -> CRAS Courses / Advanced Injectables

UPDATE public.leads AS l
SET "categoryId" = CASE
  WHEN upper(COALESCE(l.company, l.source, 'RWC')) = 'CRAS' THEN 'cat-cras-courses'
  ELSE 'cat-hair-care'
END
WHERE (
  l."categoryId" IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM public.treatment_categories c WHERE c.id = l."categoryId"
  )
)
AND EXISTS (
  SELECT 1
  FROM public.treatment_categories c
  WHERE c.id = CASE
    WHEN upper(COALESCE(l.company, l.source, 'RWC')) = 'CRAS' THEN 'cat-cras-courses'
    ELSE 'cat-hair-care'
  END
);

UPDATE public.leads AS l
SET "treatmentId" = CASE
  WHEN upper(COALESCE(l.company, l.source, 'RWC')) = 'CRAS' THEN 'crs-adi'
  ELSE 'trt-prp-hair'
END
WHERE (
  l."treatmentId" IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM public.treatments t WHERE t.id = l."treatmentId"
  )
)
AND EXISTS (
  SELECT 1
  FROM public.treatments t
  WHERE t.id = CASE
    WHEN upper(COALESCE(l.company, l.source, 'RWC')) = 'CRAS' THEN 'crs-adi'
    ELSE 'trt-prp-hair'
  END
);

-- Ensure repaired treatment/category pairs are consistent.
UPDATE public.leads AS l
SET "categoryId" = t."categoryId"
FROM public.treatments AS t
WHERE l."treatmentId" = t.id
  AND (l."categoryId" IS NULL OR l."categoryId" <> t."categoryId");

COMMIT;
