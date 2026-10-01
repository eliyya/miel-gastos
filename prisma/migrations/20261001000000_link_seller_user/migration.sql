ALTER TABLE "Seller" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
