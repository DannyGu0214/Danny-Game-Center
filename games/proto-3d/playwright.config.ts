import { defineConfig } from '@playwright/test';

// 브라우저는 내려받지 않고 이 컴퓨터에 설치된 Chrome을 써요(channel: 'chrome').
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://127.0.0.1:4183/', channel: 'chrome' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4183/',
    reuseExistingServer: false,
  },
});
