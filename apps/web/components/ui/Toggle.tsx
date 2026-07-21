import styles from './Toggle.module.css';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}

export function Toggle({ label, checked, onChange, required }: ToggleProps) {
  return (
    <label className={styles.toggle}>
      <span className={styles.label}>
        {label}
        {required && <span className={styles.req}> *</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.track} ${checked ? styles.on : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
