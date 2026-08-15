-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "clientId" TEXT,
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
    "lastSeenAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VisitorEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitorEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_ip_key" ON "Visitor"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_clientId_key" ON "Visitor"("clientId");

-- CreateIndex
CREATE INDEX "Visitor_status_idx" ON "Visitor"("status");

-- CreateIndex
CREATE INDEX "Visitor_lastSeenAt_idx" ON "Visitor"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Visitor_banned_idx" ON "Visitor"("banned");

-- CreateIndex
CREATE INDEX "VisitorEvent_visitorId_idx" ON "VisitorEvent"("visitorId");

-- CreateIndex
CREATE INDEX "VisitorEvent_type_idx" ON "VisitorEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
