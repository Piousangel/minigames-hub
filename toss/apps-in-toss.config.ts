import { defineConfig } from '@apps-in-toss/web-framework/config'

export default defineConfig({
  appName: 'recoil-puzzle',
  permissions: [],
  navigationBar: { theme: 'dark' },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false,
  },
  webBundleDir: 'dist',
})
