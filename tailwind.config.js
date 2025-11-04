// tailwind.config.js
module.exports = {
  // Use either 'class' (recommended) or 'media'. Here we support class + data-attribute.
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        text: 'var(--text)',
        primary: 'var(--primary)',
        link: 'var(--link)',
      }
    }
  },
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
};
