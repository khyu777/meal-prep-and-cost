// Week navigation bar — shared prev/next/today controls rendered above all tab content
import { useWeek } from '../hooks/use-week';
import { formatWeekLabel } from '../utils/week';
import styles from './week-nav.module.css';

export default function WeekNav() {
  const { weekOffset, weekStart, weekEnd, prev, next, reset } = useWeek();

  return (
    <div className={styles.bar}>
      <button className={styles.arrowBtn} onClick={prev} aria-label="Previous week">
        ‹
      </button>
      <div className={styles.center}>
        <span className={styles.label}>{formatWeekLabel(weekStart, weekEnd)}</span>
        {weekOffset !== 0 && (
          <button className={styles.todayBtn} onClick={reset}>
            Today
          </button>
        )}
      </div>
      <button className={styles.arrowBtn} onClick={next} aria-label="Next week">
        ›
      </button>
    </div>
  );
}
