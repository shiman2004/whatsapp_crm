-- Add AHC (Alpha Health Consultancy) to company_lead_serials
INSERT INTO public.company_lead_serials (company, next_value)
VALUES ('AHC', 1)
ON CONFLICT (company) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_company_lead_serial(company_code VARCHAR)
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
$serial$;
