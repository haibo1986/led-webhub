-- ProductTag 简化（审计 #26 实施中调整）：slug + nameZh/nameEn → 单一 name。
-- 表为本批次新建尚无数据，drop 重建安全。
-- 先解除依赖表的外键，再重建目标表与其外键。

ALTER TABLE "ProductTagLink" DROP CONSTRAINT "ProductTagLink_tagId_fkey";

DROP TABLE "ProductTag";

CREATE TABLE "ProductTag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductTag_tenantId_idx" ON "ProductTag"("tenantId");

CREATE UNIQUE INDEX "ProductTag_tenantId_name_key" ON "ProductTag"("tenantId", "name");

ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductTagLink" ADD CONSTRAINT "ProductTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ProductTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
