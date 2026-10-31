import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// GitHub Pages publishes only the explicitly labeled sample preview.
// Local Vite proxies the backend while avoiding cross-origin token transmission.
export default defineConfig({
  plugins:[react()],
  base:'./',
  server:{proxy:{'/api':{target:'http://127.0.0.1:3001',changeOrigin:false}}},
});
