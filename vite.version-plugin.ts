import type { Plugin } from 'vite';

export function xelityVersionPlugin(opts: {
  buildId: string;
  client: string;
}): Plugin {
  const payload = () =>
    JSON.stringify({
      buildId: opts.buildId,
      client: opts.client,
      builtAt: Date.now(),
    });

  return {
    name: 'xelity-version',
    config() {
      return {
        define: {
          __XELITY_BUILD_ID__: JSON.stringify(opts.buildId),
          __XELITY_CLIENT__: JSON.stringify(opts.client),
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/version.json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(payload());
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: payload(),
      });
    },
  };
}
