-- CreateTable
CREATE TABLE "ProjectCaseAsset" (
    "caseId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'IMAGE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectCaseAsset_pkey" PRIMARY KEY ("caseId","assetId")
);

-- CreateIndex
CREATE INDEX "ProjectCaseAsset_assetId_idx" ON "ProjectCaseAsset"("assetId");

-- AddForeignKey
ALTER TABLE "ProjectCaseAsset" ADD CONSTRAINT "ProjectCaseAsset_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ProjectCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCaseAsset" ADD CONSTRAINT "ProjectCaseAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
