-- CreateTable
CREATE TABLE "StyleProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selfDescription" TEXT,
    "styleGoals" TEXT,
    "lifestyleNotes" TEXT,
    "fitNotes" TEXT,
    "preferredBrands" TEXT,
    "favoriteColors" TEXT,
    "budgetFocus" TEXT,
    "ageRange" TEXT,
    "location" TEXT,
    "climate" TEXT,
    "aiSummary" TEXT,
    "aiKeywords" TEXT,
    "aiUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StyleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StyleProfile_userId_key" ON "StyleProfile"("userId");

-- AddForeignKey
ALTER TABLE "StyleProfile" ADD CONSTRAINT "StyleProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
