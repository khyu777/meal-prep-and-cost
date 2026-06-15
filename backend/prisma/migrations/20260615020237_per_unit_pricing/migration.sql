/*
  Warnings:

  - You are about to drop the column `price` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `stockWeightGrams` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `weightPerQuantityGrams` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `targetGrams` on the `MealIngredient` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ingredient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "pricePerUnit" DECIMAL NOT NULL DEFAULT 0,
    "stockUnits" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Ingredient" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Ingredient";
DROP TABLE "Ingredient";
ALTER TABLE "new_Ingredient" RENAME TO "Ingredient";
CREATE TABLE "new_MealIngredient" (
    "mealId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "targetUnits" DECIMAL NOT NULL DEFAULT 0,

    PRIMARY KEY ("mealId", "ingredientId"),
    CONSTRAINT "MealIngredient_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MealIngredient" ("ingredientId", "mealId", "quantity") SELECT "ingredientId", "mealId", "quantity" FROM "MealIngredient";
DROP TABLE "MealIngredient";
ALTER TABLE "new_MealIngredient" RENAME TO "MealIngredient";
CREATE INDEX "MealIngredient_mealId_idx" ON "MealIngredient"("mealId");
CREATE INDEX "MealIngredient_ingredientId_idx" ON "MealIngredient"("ingredientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
