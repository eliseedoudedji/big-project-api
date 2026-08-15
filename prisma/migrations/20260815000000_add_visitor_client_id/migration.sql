-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_clientId_key" ON "Visitor"("clientId");
