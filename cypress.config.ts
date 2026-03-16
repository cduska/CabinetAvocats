import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: '1hszcb',
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: false,
  },
});
