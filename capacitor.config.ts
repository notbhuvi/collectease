import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'in.collectease.app',
  appName: 'CollectEase',
  // In production, point to your Vercel URL:
  //   webDir: 'out'  ← for static export
  // For live-reload from Vercel (recommended for Next.js):
  server: {
    // Replace with your Vercel URL after deployment
    // e.g. url: 'https://collectease.vercel.app'
    // For local dev:
    url: 'http://localhost:3001',
    cleartext: true,
  },
  webDir: 'out',
  ios: {
    scheme: 'CollectEase',
    contentInset: 'automatic',
    backgroundColor: '#f9fafb',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#f9fafb',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#2563eb',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
    },
    StatusBar: {
      style: 'Light',
      backgroundColor: '#2563eb',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
}

export default config
