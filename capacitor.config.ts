import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.drift.app',
  appName: 'DRIFT',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
  plugins: {
    // Capacitor HTTP plugin usa NSAppTransportSecurity para permitir HTTP en dev
  },
};

export default config;
