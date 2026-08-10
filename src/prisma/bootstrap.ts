import { PrismaClient } from '@prisma/client';

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "Visitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "acceptLanguage" TEXT,
    "countryCode" TEXT,
    "countryName" TEXT,
    "claimedCountry" TEXT,
    "vpn" BOOLEAN NOT NULL DEFAULT false,
    "vpnReason" TEXT,
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "step" TEXT,
    "keySolved" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "geoRaw" TEXT,
    "fingerprint" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Visitor_ip_key" ON "Visitor"("ip")`,
  `CREATE INDEX IF NOT EXISTS "Visitor_status_idx" ON "Visitor"("status")`,
  `CREATE INDEX IF NOT EXISTS "Visitor_lastSeenAt_idx" ON "Visitor"("lastSeenAt")`,
  `CREATE INDEX IF NOT EXISTS "Visitor_banned_idx" ON "Visitor"("banned")`,
  `CREATE TABLE IF NOT EXISTS "VisitorEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitorEvent_visitorId_fkey"
      FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "VisitorEvent_visitorId_idx" ON "VisitorEvent"("visitorId")`,
  `CREATE INDEX IF NOT EXISTS "VisitorEvent_type_idx" ON "VisitorEvent"("type")`,
  `CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Admin_username_key" ON "Admin"("username")`,
];

/**
 * Crée les tables si elles n'existent pas. Déterministe, idempotent,
 * indispensable pour les bases SQLite éphémères en déploiement serverless.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.$connect();
  try {
    for (const statement of SCHEMA_STATEMENTS) {
      await prisma.$executeRawUnsafe(statement);
    }
  } finally {
    await prisma.$disconnect();
  }
}
