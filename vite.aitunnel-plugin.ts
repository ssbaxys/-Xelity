import type { Plugin } from 'vite';
import { handleChat } from './server/chatHandler';

export function aitunnelChatPlugin(apiKey: string): Plugin {
  return {
    name: 'aitunnel-chat-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res, next) => {
        void handleChat(req, res, apiKey).catch(next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/chat', (req, res, next) => {
        void handleChat(req, res, apiKey).catch(next);
      });
    },
  };
}
