-- Dedicated appointment doctors/consultants, separate from CRM users.
CREATE TABLE IF NOT EXISTS public.doctors (
  id VARCHAR(50) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  branch VARCHAR(100),
  phone VARCHAR(50),
  avatar VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_branch ON public.doctors(branch);
CREATE INDEX IF NOT EXISTS idx_doctors_active ON public.doctors(is_active);
