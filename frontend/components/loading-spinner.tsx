// Inline loading spinner shown while async requests are in flight
import styles from './loading-spinner.module.css';

export default function LoadingSpinner() {
  return (
    <div className={styles.wrapper} aria-label="Loading">
      <div className={styles.spinner} />
    </div>
  );
}
