const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);

const BACKEND_PORT = 3001;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Proxy /api/* and /socket.io/* to the backend server on port 3001
      // This lets the app talk to the API through the same host as Metro,
      // so only one port needs to be tunnelled / forwarded.
      if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
        const proxyReq = http.request(
          {
            hostname: 'localhost',
            port: BACKEND_PORT,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: `localhost:${BACKEND_PORT}` },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          },
        );

        proxyReq.on('error', (err) => {
          console.error('[proxy] Backend unreachable:', err.message);
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'Backend server unavailable' }));
        });

        req.pipe(proxyReq, { end: true });
        return;
      }

      // Everything else → Metro bundler
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
