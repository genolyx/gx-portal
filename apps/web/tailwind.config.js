/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'gx-bg':           'var(--bg)',
        'gx-surface':      'var(--bg-surface)',
        'gx-elevated':     'var(--bg-elevated)',
        'gx-border':       'var(--border)',
        'gx-text':         'var(--text-primary)',
        'gx-text-2':       'var(--text-secondary)',
        'gx-muted':        'var(--text-muted)',
        'gx-accent':       'var(--accent)',
        'gx-accent-hover': 'var(--accent-hover)',
        'gx-accent-dim':   'var(--accent-dim)',
        'gx-success':      'var(--success)',
        'gx-warning':      'var(--warning)',
        'gx-danger':       'var(--danger)',
        'gx-info':         'var(--info)',
      },
      borderRadius: {
        gx:      'var(--radius-md)',
        'gx-sm': 'var(--radius-sm)',
        'gx-lg': 'var(--radius-lg)',
      },
      boxShadow: {
        'gx-sm': 'var(--shadow-sm)',
        'gx-md': 'var(--shadow-md)',
      },
      keyframes: {
        'gx-spin': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'gx-spin': 'gx-spin 0.6s linear infinite',
      },
    },
  },
  plugins: [],
};
