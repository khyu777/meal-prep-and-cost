-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealPlanItem" (
    "planId" INTEGER NOT NULL,
    "mealId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "snapshotCostPerServing" DECIMAL NOT NULL DEFAULT 0,

    PRIMARY KEY ("planId", "mealId", "dayOfWeek"),
    CONSTRAINT "MealPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealPlanItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MealPlanItem" ("dayOfWeek", "mealId", "planId", "servings") SELECT "dayOfWeek", "mealId", "planId", "servings" FROM "MealPlanItem";
DROP TABLE "MealPlanItem";
ALTER TABLE "new_MealPlanItem" RENAME TO "MealPlanItem";
CREATE INDEX "MealPlanItem_planId_idx" ON "MealPlanItem"("planId");
CREATE INDEX "MealPlanItem_mealId_idx" ON "MealPlanItem"("mealId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
