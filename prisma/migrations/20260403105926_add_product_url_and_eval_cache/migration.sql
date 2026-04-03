-- CreateTable
CREATE TABLE "ProductUrl" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT,
    "domain" TEXT,
    "source" TEXT,
    "userId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extra" JSONB,

    CONSTRAINT "ProductUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductUrl_url_key" ON "ProductUrl"("url");

-- CreateIndex
CREATE INDEX "ProductUrl_domain_idx" ON "ProductUrl"("domain");

-- CreateIndex
CREATE INDEX "ProductUrl_userId_idx" ON "ProductUrl"("userId");

-- AlterTable
ALTER TABLE "CandidateEvaluation" ADD COLUMN     "inputHash" TEXT;

-- AddForeignKey
ALTER TABLE "ProductUrl" ADD CONSTRAINT "ProductUrl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
