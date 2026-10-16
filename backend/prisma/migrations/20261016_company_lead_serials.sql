CREATE TABLE IF NOT EXISTS public.company_lead_serials (
  company VARCHAR(10) PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);

INSERT INTO public.company_lead_serials (company, next_value)
VALUES ('RWC', 1), ('CRAS', 1)
ON CONFLICT (company) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_company_lead_serial(company_code VARCHAR)
RETURNS VARCHAR LANGUAGE plpgsql AS $$
DECLARE
  normalized_company VARCHAR(10) := CASE WHEN upper(company_code) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END;
  allocated_value INTEGER;
BEGIN
  INSERT INTO public.company_lead_serials (company, next_value)
  VALUES (normalized_company, 1)
  ON CONFLICT (company) DO NOTHING;
  UPDATE public.company_lead_serials
  SET next_value = next_value + 1
  WHERE company = normalized_company
  RETURNING next_value - 1 INTO allocated_value;
  RETURN normalized_company || '-' || lpad(allocated_value::text, 4, '0');
END;
$$;

WITH numbered AS (
  SELECT id,
    CASE WHEN upper(COALESCE(company, source, 'RWC')) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END AS company_code,
    row_number() OVER (
      PARTITION BY CASE WHEN upper(COALESCE(company, source, 'RWC')) = 'CRAS' THEN 'CRAS' ELSE 'RWC' END
      ORDER BY "createdAt" ASC, id ASC
    ) AS serial_index
  FROM public.leads
)
UPDATE public.leads AS leads
SET "serialNumber" = numbered.company_code || '-' || lpad(numbered.serial_index::text, 4, '0')
FROM numbered
WHERE leads.id = numbered.id;

UPDATE public.company_lead_serials AS sequences
SET next_value = COALESCE((
  SELECT max(CAST(split_part("serialNumber", '-', 2) AS INTEGER)) + 1
  FROM public.leads
  WHERE upper(COALESCE(company, source, 'RWC')) = sequences.company
), 1);

CREATE UNIQUE INDEX IF NOT EXISTS leads_serial_number_unique
  ON public.leads ("serialNumber")
  WHERE "serialNumber" IS NOT NULL;
