import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleChat } from './server/chatHandler';
import { handleToolExecute } from './server/toolHandler';
import { initFirebaseAdmin } from './server/firebaseAdmin';
import {
  handleV1ChatCompletions,
  handleV1Models,
  handleV1Search,
  handleV1Weather,
} from './server/publicApi';
import {
  handleAccountBilling,
  handleAccountKeysCreate,
  handleAccountKeysList,
  handleAccountKeysRevoke,
} from './server/accountApi';

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

const json = express.json({ limit: '2mb' });

/** Кабинет API (Firebase ID token) */
app.get('/api/account/billing', json, (req, res) => {
  void handleAccountBilling(req, res);
});
app.options('/api/account/billing', (req, res) => {
  void handleAccountBilling(req, res);
});
app.get('/api/account/keys', json, (req, res) => {
  void handleAccountKeysList(req, res);
});
app.post('/api/account/keys', json, (req, res) => {
  void handleAccountKeysCreate(req, res);
});
app.options('/api/account/keys', (req, res) => {
  void handleAccountKeysList(req, res);
});
app.delete('/api/account/keys/:keyId', json, (req, res) => {
  void handleAccountKeysRevoke(req, res);
});
app.options('/api/account/keys/:keyId', (req, res) => {
  void handleAccountKeysRevoke(req, res);
});

/** Публичное API (xel_… keys) */
app.get('/v1/models', (req, res) => {
  void handleV1Models(req, res);
});
app.options('/v1/models', (req, res) => {
  void handleV1Models(req, res);
});
app.post('/v1/chat/completions', json, (req, res) => {
  void handleV1ChatCompletions(req, res);
});
app.options('/v1/chat/completions', (req, res) => {
  void handleV1ChatCompletions(req, res);
});
app.post('/v1/search', json, (req, res) => {
  void handleV1Search(req, res);
});
app.options('/v1/search', (req, res) => {
  void handleV1Search(req, res);
});
app.post('/v1/weather', json, (req, res) => {
  void handleV1Weather(req, res);
});
app.options('/v1/weather', (req, res) => {
  void handleV1Weather(req, res);
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
  console.log('Public API: /v1/chat/completions · /v1/search · /v1/weather');
  if (!apiKey) {
    console.warn('AITUNNEL_API_KEY is missing — /api/chat and /v1/chat will fail');
  }
  if (!firebaseOk) {
    console.warn(
      'Firebase Admin missing — logged-in chat / API keys will fail until service account is installed',
    );
  } else {
    console.log('Firebase Admin: ready');
  }
});
