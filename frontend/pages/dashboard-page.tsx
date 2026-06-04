// Dashboard — summary view showing stats, recent meals, and ingredient overview
import { useIngredients } from '../hooks/use-ingredients';
import { useMeals } from '../hooks/use-meals';
import { usePlans } from '../hooks/use-plans';
import { useWeek } from '../hooks/use-week';
import { planOverlapsWeek } from '../utils/week';
import { formatCurrency } from '../utils/format-currency';
import { formatGrams } from '../utils/format-grams';
import LoadingSpinner from '../components/loading-spinner';
import styles from './dashboard-page.module.css';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statIcon}>{icon}</span>
      <div>
        <p className={styles.statLabel}>{label}</p>
        <p className={styles.statValue}>{value}</p>
        {sub && <p className={styles.statSub}>{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { items: ingredients, loading: loadingIng } = useIngredients();
  const { items: meals, loading: loadingMeals } = useMeals();
  const { items: allPlans, loading: loadingPlans } = usePlans();
  const { weekStart, weekEnd } = useWeek();

  const loading = loadingIng || loadingMeals || loadingPlans;
  if (loading) return <LoadingSpinner />;

  const weekPlans = allPlans.filter((p) => planOverlapsWeek(p.startDate, p.endDate, weekStart, weekEnd));
  const weekMealIds = new Set(weekPlans.flatMap((p) => p.items.map((item) => item.mealId)));
  const weekMeals = meals.filter((m) => weekMealIds.has(m.id));
  const weekIngredientIds = new Set(weekMeals.flatMap((m) => m.ingredients.map((i) => i.ingredientId)));
  const weekIngredients = ingredients.filter((i) => weekIngredientIds.has(i.id));
  const weekCost = weekPlans.reduce((s, p) => s + p.cost, 0);
  const sortedIngredients = [...weekIngredients].sort((a, b) => b.price - a.price);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.greeting}>{greeting()}, David</h1>
          <p className={styles.subtitle}>Here's what's on your plate this week.</p>
        </div>
      </header>

      {/* Stat cards */}
      <div className={styles.statsRow}>
        <StatCard
          icon="📅"
          label="Plans This Week"
          value={String(weekPlans.length)}
          sub={weekPlans.length === 1 ? '1 active plan' : `${weekPlans.length} active plans`}
        />
        <StatCard
          icon="🍽"
          label="Meals Scheduled"
          value={String(weekMeals.length)}
          sub="unique meals this week"
        />
        <StatCard
          icon="💰"
          label="Estimated Cost"
          value={formatCurrency(weekCost)}
          sub="for this week's plans"
        />
      </div>

      <div className={styles.panels}>
        {/* Meals this week */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Meals This Week</h2>
          </div>
          {weekMeals.length === 0 ? (
            <p className={styles.empty}>No meals planned this week — create a plan in the Plans tab.</p>
          ) : (
            <div className={styles.weekMealGrid}>
              {weekMeals.map((meal) => (
                <div key={meal.id} className={styles.weekMealCard}>
                  <span className={styles.weekMealName}>{meal.name}</span>
                  <div className={styles.weekMealFooter}>
                    <span className={styles.weekMealServings}>{meal.servings} srv</span>
                    <span className={styles.weekMealCost}>{formatCurrency(meal.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ingredients needed this week */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Ingredients Needed</h2>
          </div>
          {sortedIngredients.length === 0 ? (
            <p className={styles.empty}>No ingredients needed — plan some meals for this week.</p>
          ) : (
            <ul className={styles.ingredientList}>
              {sortedIngredients.slice(0, 8).map((ing) => (
                <li key={ing.id} className={styles.ingredientItem}>
                  <div className={styles.ingredientDot} />
                  <span className={styles.ingredientName}>{ing.name}</span>
                  <span className={styles.ingredientStock}>{formatGrams(ing.stockWeightGrams)} left</span>
                  <span className={styles.ingredientPrice}>{formatCurrency(ing.price)}</span>
                </li>
              ))}
            </ul>
          )}
          {sortedIngredients.length > 8 && (
            <p className={styles.moreNote}>+{sortedIngredients.length - 8} more in Ingredients</p>
          )}
        </section>
      </div>
    </div>
  );
}
