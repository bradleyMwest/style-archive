-- CreateTable
CREATE TABLE "OutfitSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reasoning" TEXT,
    "itemIds" TEXT NOT NULL,
    "itemHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'try',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OutfitSuggestion_itemHash_key" ON "OutfitSuggestion"("itemHash");
