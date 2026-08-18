-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "uploadedById" TEXT;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
