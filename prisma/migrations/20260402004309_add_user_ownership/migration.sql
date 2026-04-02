-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "images" TEXT,
    "heroImageData" BLOB,
    "heroImageMimeType" TEXT,
    "description" TEXT,
    "priceAmount" DECIMAL,
    "priceCurrency" TEXT,
    "tags" TEXT NOT NULL,
    "material" TEXT,
    "brand" TEXT,
    "listingUrl" TEXT,
    "dateAdded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("brand", "color", "dateAdded", "description", "heroImageData", "heroImageMimeType", "id", "image", "images", "listingUrl", "material", "name", "priceAmount", "priceCurrency", "size", "tags", "type") SELECT "brand", "color", "dateAdded", "description", "heroImageData", "heroImageMimeType", "id", "image", "images", "listingUrl", "material", "name", "priceAmount", "priceCurrency", "size", "tags", "type" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
CREATE TABLE "new_Outfit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "itemIds" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Outfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Outfit" ("createdAt", "description", "id", "itemIds", "name") SELECT "createdAt", "description", "id", "itemIds", "name" FROM "Outfit";
DROP TABLE "Outfit";
ALTER TABLE "new_Outfit" RENAME TO "Outfit";
CREATE INDEX "Outfit_userId_idx" ON "Outfit"("userId");
CREATE TABLE "new_OutfitSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reasoning" TEXT,
    "itemIds" TEXT NOT NULL,
    "itemHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'try',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "OutfitSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OutfitSuggestion" ("createdAt", "description", "id", "itemHash", "itemIds", "name", "reasoning", "status", "updatedAt") SELECT "createdAt", "description", "id", "itemHash", "itemIds", "name", "reasoning", "status", "updatedAt" FROM "OutfitSuggestion";
DROP TABLE "OutfitSuggestion";
ALTER TABLE "new_OutfitSuggestion" RENAME TO "OutfitSuggestion";
CREATE UNIQUE INDEX "OutfitSuggestion_itemHash_key" ON "OutfitSuggestion"("itemHash");
CREATE INDEX "OutfitSuggestion_userId_idx" ON "OutfitSuggestion"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
