import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    // Ignore worktrees (evite duplication des tests deja presents a la racine)
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
});
