import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'backend/prisma/schema.prisma',
  datasource: {
    // Prisma CLI operations must bypass the Supabase transaction pooler.
    // Fall back to DATABASE_URL or CI stub when DIRECT_URL is omitted.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://ci:ci@localhost:5432/ci_stub',
  },
});

