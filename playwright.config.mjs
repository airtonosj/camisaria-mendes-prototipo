import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:45000,
 expect:{timeout:10000},retries:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4186',browserName:'chromium',...(process.platform==='win32'?{channel:'msedge'}:{}),trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node tests/helpers/e2e-server.mjs',url:'http://127.0.0.1:4186/api/health',reuseExistingServer:false,timeout:120000},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
});
