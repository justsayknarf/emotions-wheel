import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AdminEmotion } from '../admin/types';
import { serializeEmotions, serializeDescriptions } from '../admin/lib/serialize';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function adminSavePlugin(): Plugin {
  return {
    name: 'admin-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/admin-api/save', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const raw = await readBody(req);
          const payload = JSON.parse(raw) as { emotions: AdminEmotion[] };

          if (!Array.isArray(payload?.emotions)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payload: emotions must be an array' }));
            return;
          }

          const root = server.config.root;
          // The admin editor maintains the hand-authored base framework; the
          // active framework (e.g. the generator-authored radial set) is not
          // edited here. serializeEmotions emits the circumplex-custom module.
          const emotionsPath = path.join(root, 'src/data/frameworks/circumplex-custom.ts');
          const descriptionsPath = path.join(root, 'src/data/descriptions.ts');

          fs.writeFileSync(emotionsPath, serializeEmotions(payload.emotions), 'utf-8');
          fs.writeFileSync(descriptionsPath, serializeDescriptions(payload.emotions), 'utf-8');

          // Notify Vite's HMR graph explicitly — needed because the write comes from
          // within the server process itself, which some watchers miss.
          server.watcher.emit('change', emotionsPath);
          server.watcher.emit('change', descriptionsPath);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      });

      // The admin theme page's "Save to file" button — writes a snapshot of
      // whatever color theme + shader tuning is currently active to a JSON
      // file under docs/handoff/, meant to be read back by Claude in a later
      // session and promoted into config/theme.ts's actual defaults. The
      // shape is owned by the client (AdminThemeSaveButton), not here — this
      // just validates it's a plain object and writes it pretty-printed.
      server.middlewares.use('/admin-api/save-theme', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const raw = await readBody(req);
          const payload: unknown = JSON.parse(raw);

          if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payload: expected a JSON object' }));
            return;
          }

          const root = server.config.root;
          const dir = path.join(root, 'docs/handoff');
          const filePath = path.join(dir, 'theme-settings.json');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, path: 'docs/handoff/theme-settings.json' }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}
