import Link from 'next/link';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, action }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        {backHref && (
          <Link href={backHref} className={styles.back}>← Go back</Link>
        )}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.desc}>{description}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
