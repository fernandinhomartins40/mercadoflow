-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "marketId" TEXT,
    "industryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'BASIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "markets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pdvs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pdvs_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chaveNFe" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "pdvId" TEXT,
    "serie" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dataEmissao" DATETIME NOT NULL,
    "cnpjEmitente" TEXT NOT NULL,
    "cpfCnpjDestinatario" TEXT,
    "valorTotal" REAL NOT NULL,
    "rawXmlHash" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'NFE',
    "xmlVersion" TEXT NOT NULL DEFAULT 'VERSION_400',
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_pdvId_fkey" FOREIGN KEY ("pdvId") REFERENCES "pdvs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "codigoEAN" TEXT NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ncm" TEXT NOT NULL,
    "cfop" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "valorUnitario" REAL NOT NULL,
    "valorTotal" REAL NOT NULL,
    "icms" REAL,
    "pis" REAL,
    "cofins" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ean" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "unit" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sales_analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantitySold" REAL NOT NULL,
    "revenue" REAL NOT NULL,
    "averagePrice" REAL NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_analytics_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sales_analytics_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "market_baskets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "product1Id" TEXT NOT NULL,
    "product2Id" TEXT NOT NULL,
    "support" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "lift" REAL NOT NULL,
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "market_baskets_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "market_baskets_product1Id_fkey" FOREIGN KEY ("product1Id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "market_baskets_product2Id_fkey" FOREIGN KEY ("product2Id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "productId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alerts_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "industries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "industryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetRegions" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "budget" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "campaign_products_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaign_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_markets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    CONSTRAINT "campaign_markets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaign_markets_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "daily_sales_summary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "marketId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantitySold" REAL NOT NULL,
    "revenue" REAL NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "avgPrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "weekly_market_basket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "marketId" TEXT NOT NULL,
    "product1Id" TEXT NOT NULL,
    "product2Id" TEXT NOT NULL,
    "coOccurrenceCount" INTEGER NOT NULL,
    "support" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "lift" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "product_performance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "turnoverRate" REAL,
    "marginPercent" REAL,
    "growthRate" REAL,
    "purchaseFreq" REAL,
    "performanceScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "market_health" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "productDiversity" REAL,
    "stockEfficiency" REAL,
    "revenueGrowth" REAL,
    "customerRetention" REAL,
    "healthScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "markets_cnpj_key" ON "markets"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_chaveNFe_key" ON "invoices"("chaveNFe");

-- CreateIndex
CREATE INDEX "invoices_marketId_dataEmissao_idx" ON "invoices"("marketId", "dataEmissao");

-- CreateIndex
CREATE INDEX "invoices_marketId_createdAt_idx" ON "invoices"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_dataEmissao_idx" ON "invoices"("dataEmissao");

-- CreateIndex
CREATE INDEX "invoices_cnpjEmitente_idx" ON "invoices"("cnpjEmitente");

-- CreateIndex
CREATE UNIQUE INDEX "products_ean_key" ON "products"("ean");

-- CreateIndex
CREATE INDEX "sales_analytics_marketId_date_idx" ON "sales_analytics"("marketId", "date");

-- CreateIndex
CREATE INDEX "sales_analytics_productId_date_idx" ON "sales_analytics"("productId", "date");

-- CreateIndex
CREATE INDEX "sales_analytics_date_idx" ON "sales_analytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "sales_analytics_marketId_productId_date_key" ON "sales_analytics"("marketId", "productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "market_baskets_marketId_product1Id_product2Id_key" ON "market_baskets"("marketId", "product1Id", "product2Id");

-- CreateIndex
CREATE INDEX "alerts_marketId_isRead_priority_idx" ON "alerts"("marketId", "isRead", "priority");

-- CreateIndex
CREATE INDEX "alerts_marketId_type_idx" ON "alerts"("marketId", "type");

-- CreateIndex
CREATE INDEX "alerts_isRead_idx" ON "alerts"("isRead");

-- CreateIndex
CREATE INDEX "alerts_createdAt_idx" ON "alerts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "industries_cnpj_key" ON "industries"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_products_campaignId_productId_key" ON "campaign_products"("campaignId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_markets_campaignId_marketId_key" ON "campaign_markets"("campaignId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE INDEX "daily_sales_summary_marketId_date_idx" ON "daily_sales_summary"("marketId", "date");

-- CreateIndex
CREATE INDEX "daily_sales_summary_productId_date_idx" ON "daily_sales_summary"("productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sales_summary_date_marketId_productId_key" ON "daily_sales_summary"("date", "marketId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_market_basket_weekStart_marketId_product1Id_product2Id_key" ON "weekly_market_basket"("weekStart", "marketId", "product1Id", "product2Id");

-- CreateIndex
CREATE UNIQUE INDEX "product_performance_productId_marketId_month_key" ON "product_performance"("productId", "marketId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "market_health_marketId_month_key" ON "market_health"("marketId", "month");
