import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleChat } from './server/chatHandler';
import { handleToolExecute } from './server/toolHandler';
import { initFirebaseAdmin } from './server/firebaseAdmin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const apiKey = process.env.AITUNNEL_API_KEY || '';
const port = Number(process.env.PORT) || 8088;
const searxngUrl = (process.env.SEARXNG_URL || 'http://127.0.0.1:8888').replace(/\/$/, '');

const firebaseOk = initFirebaseAdmin();

const app = express();

app.post('/api/chat', (req, res) => {
  void handleChat(req, res, apiKey);
});

app.options('/api/chat', (req, res) => {
  void handleChat(req, res, apiKey);
});

app.post('/api/tools', (req, res) => {
  void handleToolExecute(req, res);
});

app.options('/api/tools', (req, res) => {
  void handleToolExecute(req, res);
});

app.get('/version.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distDir, 'version.json'), (err) => {
    if (err) {
      res.status(404).json({ error: 'version.json missing — rebuild frontend' });
    }
  });
});

app.use(express.static(distDir, { index: false, maxAge: '1h' }));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) {
      res.status(500).type('text').send('Build not found. Run npm run build first.');
    }
  });
});

app.listen(port, () => {
  console.log(`Xelity listening on :${port}`);
  console.log(`SearXNG URL: ${searxngUrl}`);
  if (!apiKey) {
    console.warn('AITUNNEL_API_KEY is missing — /api/chat will fail');
  }
  if (!firebaseOk) {
    console.warn(
      'Firebase Admin missing — logged-in chat will return 503 until service account is installed',
    );
  } else {
    console.log('Firebase Admin: ready');
  }
});
