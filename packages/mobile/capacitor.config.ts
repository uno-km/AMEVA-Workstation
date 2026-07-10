import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ameva.adc.app',
  appName: 'AMEVA OS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
