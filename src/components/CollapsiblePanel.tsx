import { useState, ReactNode } from 'react';

interface Props {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsiblePanel({ title, extra, children, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <div style={styles.titleRow}>
          <span style={styles.arrow}>{isOpen ? '▼' : '▲'}</span>
          <span style={styles.title}>{title}</span>
        </div>
        <div style={styles.extra} onClick={e => e.stopPropagation()}>
          {extra}
        </div>
      </div>
      
      <div
        style={{
          ...styles.content,
          maxHeight: isOpen ? '300px' : '0',
          padding: isOpen ? '10px 15px' : '0 15px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#16213e',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 15px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'white',
  },
  arrow: {
    fontSize: '0.8rem',
    transition: 'transform 0.2s',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  extra: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  content: {
    overflow: 'hidden',
    transition: 'all 0.3s ease-out',
    overflowY: 'auto',
  },
};
