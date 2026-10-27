import { defineConfig } from 'prisma/config';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required for the test Prisma configuration.');

export default defineConfig({
  schema: 'schema.test.prisma',
  datasource: { url },
});
