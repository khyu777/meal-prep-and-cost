-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealIngredient" (
    "mealId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "targetGrams" DECIMAL NOT NULL DEFAULT 0,

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
