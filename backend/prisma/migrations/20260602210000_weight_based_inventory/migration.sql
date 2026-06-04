-- Redefine Ingredient for purchase-based, gram-tracked inventory.
-- Existing unit-priced rows are migrated by preserving stock/cost arithmetic:
-- old stockQuantity becomes remaining grams, old pricePerUnit remains the
-- effective price per gram by setting weightPerQuantityGrams to 1.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Ingredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "price" DECIMAL NOT NULL,
    "weightPerQuantityGrams" DECIMAL NOT NULL,
    "stockWeightGrams" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Ingredient" (
    "createdAt",
    "id",
    "name",
    "quantity",
    "price",
    "weightPerQuantityGrams",
    "stockWeightGrams"
)
SELECT
    "createdAt",
    "id",
    "name",
    CASE WHEN "stockQuantity" > 0 THEN "stockQuantity" ELSE 1 END,
    CASE WHEN "stockQuantity" > 0 THEN "pricePerUnit" * "stockQuantity" ELSE "pricePerUnit" END,
    1,
    "stockQuantity"
FROM "Ingredient";

DROP TABLE "Ingredient";
ALTER TABLE "new_Ingredient" RENAME TO "Ingredient";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
