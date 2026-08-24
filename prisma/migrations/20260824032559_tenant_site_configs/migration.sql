-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "homepageConfig" JSONB,
ADD COLUMN     "navigationConfig" JSONB,
ADD COLUMN     "seoConfig" JSONB;
