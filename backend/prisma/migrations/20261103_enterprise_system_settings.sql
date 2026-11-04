-- Alpha Health Group CRM — Enterprise System Settings & Administration Engine
-- Migration: 20261103_enterprise_system_settings.sql
-- Database: Supabase PostgreSQL (Safe, non-destructive, repeatable DDL)
-- Preserves existing legacy public.system_settings (META_VERIFY_TOKEN) intact!

-- 1. Scoped Enterprise System Settings Table with Optimistic Locking
CREATE TABLE IF NOT EXISTS public.enterprise_system_settings (
  id VARCHAR(50) PRIMARY KEY,
  section VARCHAR(50) NOT NULL,
  scope VARCHAR(30) DEFAULT 'global' NOT NULL,
  scope_id VARCHAR(50),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_id VARCHAR(50)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_settings_unique 
  ON public.enterprise_system_settings(section, scope, COALESCE(scope_id, ''));

CREATE INDEX IF NOT EXISTS idx_enterprise_settings_lookup 
  ON public.enterprise_system_settings(section, scope);

-- 2. Dynamic Custom Field Definitions
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id VARCHAR(50) PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  field_key VARCHAR(50) NOT NULL,
  field_type VARCHAR(30) NOT NULL,
  options JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  order_index INT DEFAULT 0,
  company VARCHAR(50) DEFAULT 'ALL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_fields_unique 
  ON public.custom_field_definitions(module, field_key, company);

CREATE INDEX IF NOT EXISTS idx_custom_fields_module 
  ON public.custom_field_definitions(module, order_index ASC);

-- 3. Automation Trigger-Condition-Action Rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  event VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  company VARCHAR(50) DEFAULT 'ALL',
  execution_count INT DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_event 
  ON public.automation_rules(event, is_active);

-- 4. Secure Scoped API Keys (scrypt hashed)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_by_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys(key_prefix);

-- 5. Outbound Webhook Endpoints
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id VARCHAR(50) PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  description TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  failure_count INT DEFAULT 0,
  last_delivery_at TIMESTAMP WITH TIME ZONE,
  last_status_code INT,
  company VARCHAR(50) DEFAULT 'ALL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active 
  ON public.webhook_endpoints(is_active);
