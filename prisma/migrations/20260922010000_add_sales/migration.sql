-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerCommission" (
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,

    CONSTRAINT "SellerCommission_pkey" PRIMARY KEY ("sellerId","productId")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "soldAt" DATE NOT NULL,
    "customer" TEXT,
    "sellerId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "paidByCard" BOOLEAN NOT NULL DEFAULT false,
    "cardRateBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_soldAt_createdAt_idx" ON "Sale"("soldAt", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_sellerId_soldAt_idx" ON "Sale"("sellerId", "soldAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_saleId_productId_key" ON "SaleItem"("saleId", "productId");

-- AddForeignKey
ALTER TABLE "SellerCommission" ADD CONSTRAINT "SellerCommission_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerCommission" ADD CONSTRAINT "SellerCommission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep monetary inputs valid even when sales are loaded outside the application.
ALTER TABLE "Product" ADD CONSTRAINT "Product_money_check" CHECK ("priceCents" > 0 AND "costCents" >= 0);
ALTER TABLE "SellerCommission" ADD CONSTRAINT "SellerCommission_rate_check" CHECK ("rateBps" BETWEEN 0 AND 10000);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_card_check" CHECK ("cardRateBps" BETWEEN 0 AND 10000 AND ("paidByCard" OR "cardRateBps" = 0));
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_values_check" CHECK ("quantity" > 0 AND "unitPriceCents" >= 0 AND "unitCostCents" >= 0 AND "commissionBps" BETWEEN 0 AND 10000);
