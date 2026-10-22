BEGIN;

-- Backfill only leads that missed serial allocation. Existing serials are preserved.
-- The ordering matches the original company serial migration: oldest lead first,
-- with the id as a deterministic tie-breaker.
LOCK TABLE public.leads IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.company_lead_serials IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO public.company_lead_serials (company, next_value)
VALUES ('RWC', 1), ('CRAS', 1)
ON CONFLICT (company) DO NOTHING;

WITH existing_max AS (
  SELECT
    company_code,
    COALESCE(MAX(serial_index), 0) AS max_serial_index
  FROM (
    SELECT
      CASE WHEN upper(COALESCE(company, source, 'RWC')) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END AS company_code,
      CASE
        WHEN split_part("serialNumber", '-', 1) IN ('RWC', 'CRAS')
          THEN NULLIF(split_part("serialNumber", '-', 2), '')::INTEGER
        ELSE NULL
      END AS serial_index
    FROM public.leads
    WHERE NULLIF("serialNumber", '') IS NOT NULL
  ) numbered_existing
  GROUP BY company_code
), missing AS (
  SELECT
    id,
    CASE WHEN upper(COALESCE(company, source, 'RWC')) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END AS company_code,
    ROW_NUMBER() OVER (
      PARTITION BY CASE WHEN upper(COALESCE(company, source, 'RWC')) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END
      ORDER BY "createdAt" ASC, id ASC
    ) AS missing_index
  FROM public.leads
  WHERE NULLIF("serialNumber", '') IS NULL
), assigned AS (
  SELECT
    missing.id,
    missing.company_code || '-' || LPAD((COALESCE(existing_max.max_serial_index, 0) + missing.missing_index)::TEXT, 4, '0') AS serial_number
  FROM missing
  LEFT JOIN existing_max ON existing_max.company_code = missing.company_code
)
UPDATE public.leads AS leads
SET "serialNumber" = assigned.serial_number
FROM assigned
WHERE leads.id = assigned.id;

-- Keep the allocator ahead of every serial, including the newly backfilled rows.
UPDATE public.company_lead_serials AS sequences
SET next_value = COALESCE((
  SELECT MAX(NULLIF(split_part("serialNumber", '-', 2), '')::INTEGER) + 1
  FROM public.leads
  WHERE upper(COALESCE(company, source, 'RWC')) = sequences.company
), 1);

COMMIT;
