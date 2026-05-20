module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    container: { center: true, padding: '2rem' },
    fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui'] },
    spacing: {
      0: '0px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      7: '28px',
      8: '32px',
      9: '36px',
      10: '40px',
      12: '48px',
      16: '64px',
      20: '80px',
      24: '96px',
      28: '112px',
      32: '128px'
    },
    fontSize: {
      xs: ['12px', { lineHeight: '18px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['16px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['30px', { lineHeight: '36px' }],
      '4xl': ['36px', { lineHeight: '40px' }]
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800
    },
    borderRadius: {
      sm: '6px',
      md: '10px',
      lg: '16px',
      xl: '20px',
      full: '9999px'
    },
    gap: {
      0: '0px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      8: '32px',
      10: '40px',
      12: '48px',
      16: '64px'
    },
    padding: {
      0: '0px',
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      8: '32px',
      10: '40px',
      12: '48px'
    },
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surface2: 'var(--color-surface2)',
        surface3: 'var(--color-surface3)',
        accent: 'var(--color-accent)',
        accent2: 'var(--color-accent2)',
        text: 'var(--color-text)',
        text2: 'var(--color-text2)',
        text3: 'var(--color-text3)',
        green: 'var(--color-green)',
        amber: 'var(--color-amber)',
        rose: 'var(--color-rose)',
        border: 'var(--color-border)',
        border2: 'var(--color-border2)'
      },
      boxShadow: {
        sm: 'var(--elevation-1)',
        md: 'var(--elevation-2)',
        lg: 'var(--elevation-3)'
      },
      ringColor: {
        DEFAULT: 'var(--color-accent)'
      }
    }
  },
  plugins: []
};
