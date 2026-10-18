import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// The app uses the tsconfig `@/*` → `./src/*` alias; mirror it explicitly so
// resolution does not depend on vite-tsconfig-paths discovering the tsconfig.
const alias = { '@': path.resolve(rootDir, 'src') };

// DukaanVoice PK books against Pakistani business dates; pin TZ so date
// assertions are deterministic regardless of the machine's timezone.
process.env.TZ = 'Asia/Karachi';

export default defineConfig({
  resolve: { alias },
  plugins: [react()],
  test: {
    env: { TZ: 'Asia/Karachi' },
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', '__tests__/**/*.test.{ts,tsx}'],
    // Vitest runs each test FILE in its own forked process (parallel by default).
    // Tests inside a file run sequentially in declaration order.
    // NB: the 'threads' pool fails to start workers in this environment.
    pool: 'forks',
    fileParallelism: true,
    testTimeout: 10_000,
  },
});
