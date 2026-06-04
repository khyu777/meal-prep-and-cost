// Displays an API or validation error string to the user
import styles from './error-message.module.css';

interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className={styles.error} role="alert">
      {message}
    </div>
  );
}
