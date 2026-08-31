
    const setupTailwind = () => {
      if (typeof tailwind !== 'undefined') {
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                navy: { 50: '#F0F4F8', 100: '#D9E2EC', 200: '#BCCCDC', 300: '#9FB3C8', 700: '#334E68', 800: '#102A43', 900: '#0B1D33', 950: '#06101E' },
                emerald: { 50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 500: '#10B981', 600: '#059669', 700: '#047857', 800: '#065F46' },
                gold: { 50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
              },
              fontFamily: {
                sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
              }
            }
          }
        };
      } else {
        setTimeout(setupTailwind, 20); // Retry if not yet loaded
      }
    };
    setupTailwind();
  