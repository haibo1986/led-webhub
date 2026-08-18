-- CreateTable
CREATE TABLE "ProjectCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCaseTranslation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectCaseTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "coverImageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPostTranslation" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NewsPostTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectCase_tenantId_status_deletedAt_idx" ON "ProjectCase"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCase_tenantId_slug_key" ON "ProjectCase"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCaseTranslation_caseId_locale_key" ON "ProjectCaseTranslation"("caseId", "locale");

-- CreateIndex
CREATE INDEX "NewsPost_tenantId_status_deletedAt_idx" ON "NewsPost"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_tenantId_slug_key" ON "NewsPost"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPostTranslation_postId_locale_key" ON "NewsPostTranslation"("postId", "locale");

-- AddForeignKey
ALTER TABLE "ProjectCase" ADD CONSTRAINT "ProjectCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCaseTranslation" ADD CONSTRAINT "ProjectCaseTranslation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ProjectCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPost" ADD CONSTRAINT "NewsPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsPostTranslation" ADD CONSTRAINT "NewsPostTranslation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "NewsPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
