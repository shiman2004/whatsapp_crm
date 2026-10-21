-- Widen users.pin so it can hold a scrypt hash ("scrypt:<32 hex>:<128 hex>" = 175 chars),
-- matching users.password. Previously VARCHAR(10), which silently rejected every hashed PIN
-- and forced the create paths to fall back to in-memory-only users.
ALTER TABLE public.users ALTER COLUMN pin TYPE VARCHAR(255);

-- Existing rows hold legacy 4-digit plaintext PINs. They are left untouched on purpose:
-- verifySecret() still accepts plaintext and flags needsRehash, so those users keep logging in
-- and their PIN silently upgrades to a hash on the next successful login.
