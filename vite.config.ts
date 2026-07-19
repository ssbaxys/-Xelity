import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { aitunnelChatPlugin } from './vite.aitunnel-plugin';
import { xelityVersionPlugin } from './vite.version-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
) as { xelity?: { client?: string } };
const clientVer = pkg.xelity?.client || '0.0.0';
const buildId = `${clientVer}+${Date.now()}`;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.AITUNNEL_API_KEY || '';
  // singlefile жрёт гигантский heap (особенно с @babel/standalone) — только по явному флагу.
  // Vercel и VPS по умолчанию: обычный multi-file dist.
  const useSingleFile = process.env.XELITY_SINGLEFILE === '1';

  return {
    plugins: [
      react(),
      tailwindcss(),
      xelityVersionPlugin({ buildId, client: clientVer }),
      ...(useSingleFile ? [viteSingleFile()] : []),
      aitunnelChatPlugin(apiKey),
    ],
    build: {
      // меньше пик памяти на слабых VPS
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
    },
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
