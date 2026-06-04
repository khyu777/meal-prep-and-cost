// App shell — sidebar layout with React Router navigation
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import IngredientsPage from './ingredients-page';
import MealsPage from './meals-page';
import PlansPage from './plans-page';
import WeekNav from '../components/week-nav';
import { WeekContext, useWeekState } from '../hooks/use-week';
import styles from './app.module.css';


function IconLeaf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function IconUtensils() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBrand() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

const navItems = [
  { to: '/', label: 'Plans', icon: <IconCalendar />, end: true },
  { to: '/ingredients', label: 'Ingredients', icon: <IconLeaf />, end: false },
  { to: '/meals', label: 'Meals', icon: <IconUtensils />, end: false },
];

export default function App() {
  const week = useWeekState();
  return (
    <WeekContext.Provider value={week}>
    <BrowserRouter>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}><IconBrand /></span>
            <span className={styles.brandName}>PantryPlan</span>
          </div>

          <nav className={styles.nav}>
            {navItems.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
                }
              >
                <span className={styles.navIcon}>{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.tagline}>
            <p>Cook with what you have.<br />Spend less.<br />Waste less.</p>
          </div>
        </aside>

        <main className={styles.main}>
          <WeekNav />
          <Routes>
            <Route path="/" element={<PlansPage />} />
            <Route path="/ingredients" element={<IngredientsPage />} />
            <Route path="/meals" element={<MealsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
    </WeekContext.Provider>
  );
}
