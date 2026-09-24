import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', workers: 1,
  use: { baseURL:'http://127.0.0.1:8765', browserName:'chromium', launchOptions:process.platform === 'darwin' ? {executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'} : {}, viewport:{width:1440,height:1100} },
  webServer:{command:'python3 -m http.server 8765 --bind 127.0.0.1 --directory docs',url:'http://127.0.0.1:8765',reuseExistingServer:true},
});
