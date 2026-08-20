#!/usr/bin/env node
const { execSync } = require('child_process');
const url = process.env.DATABASE_URL || '';
const schema = url.startsWith('file:')
  ? 'prisma/sqlite/schema.prisma'
  : 'prisma/schema.prisma';
console.log(`[prisma-generate] DATABASE_URL type: ${url.startsWith('file:') ? 'SQLite' : 'PostgreSQL'}`);
console.log(`[prisma-generate] Using schema: ${schema}`);
execSync(`npx prisma generate --schema ${schema}`, { stdio: 'inherit' });
