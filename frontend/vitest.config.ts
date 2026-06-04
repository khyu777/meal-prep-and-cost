// Vitest configuration for frontend component tests
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const frontendDir = __dirname;
const frontendModules = resolve(frontendDir, 'node_modules');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '../../frontend/pages': resolve(frontendDir, 'pages'),
      '../../frontend/hooks': resolve(frontendDir, 'hooks'),
      '../../frontend/utils': resolve(frontendDir, 'utils'),
      '../../frontend/components': resolve(frontendDir, 'components'),
      react: resolve(frontendModules, 'react'),
      'react-dom': resolve(frontendModules, 'react-dom'),
      'react-router-dom': resolve(frontendModules, 'react-router-dom'),
      '@testing-library/react': resolve(frontendModules, '@testing-library/react'),
      '@testing-library/user-event': resolve(frontendModules, '@testing-library/user-event'),
      '@testing-library/jest-dom': resolve(frontendModules, '@testing-library/jest-dom'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(frontendDir, 'vitest.setup.ts')],
    include: ['tests/frontend/**/*.test.{ts,tsx}'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    server: {
      deps: {
        inline: ['@testing-library/jest-dom'],
      },
    },
  },
});
