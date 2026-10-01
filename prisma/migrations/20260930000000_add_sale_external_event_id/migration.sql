ALTER TABLE "Sale" ADD COLUMN "externalEventId" TEXT;

CREATE UNIQUE INDEX "Sale_externalEventId_key" ON "Sale"("externalEventId");
