import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { aitunnelChatPlugin } from './vite.aitunnel-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.AITUNNEL_API_KEY || '';

  return {
    plugins: [react(), tailwindcss(), viteSingleFile(), aitunnelChatPlugin(apiKey)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: true,
      port: 8088,
      strictPort: true,
    },
    preview: {
      host: true,
      port: 8088,
      strictPort: true,
    },
  };
});
