import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Prisma CLI operations must bypass the Supabase transaction pooler.
    url: env('DIRECT_URL'),
  },
});
