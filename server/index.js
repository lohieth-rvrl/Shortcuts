import 'dotenv/config';
import express from 'express';
import { MongoClient } from 'mongodb';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'shortcuts';
const port = Number(process.env.PORT || 3001);
const STICKY_NOTE_TTL = 24 * 60 * 60 * 1000;

function keepActiveStickyNotes(notes) {
  const now = Date.now();
  return (Array.isArray(notes) ? notes : []).map((note) => {
    const parsedCreatedAt = Date.parse(note.createdAt);
    const createdAt = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : now;
    const parsedExpiresAt = Date.parse(note.expiresAt);
    const expiresAt = Number.isFinite(parsedExpiresAt) ? parsedExpiresAt : createdAt + STICKY_NOTE_TTL;
    return {
      ...note,
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }).filter(note => Date.parse(note.expiresAt) > now);
}

async function startServer() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing. Copy .env.example to .env and configure your MongoDB connection.');
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  const database = client.db(databaseName);
  const workspaces = database.collection('workspaces');
  const noteDocuments = database.collection('notes');
  await noteDocuments.createIndex({ workspaceId: 1, order: 1 });
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/state', async (request, response, next) => {
    try {
      const [workspace, storedNotes] = await Promise.all([
        workspaces.findOne({ _id: 'default' }, { projection: { _id: 0 } }),
        noteDocuments.find({ workspaceId: 'default' }).sort({ order: 1 }).toArray(),
      ]);
      const notes = storedNotes.map(({ _id, workspaceId, order, ...note }) => note);
      const rawStickyNotes = workspace?.stickyNotes || [];
      const stickyNotes = keepActiveStickyNotes(rawStickyNotes);
      if (workspace && JSON.stringify(rawStickyNotes) !== JSON.stringify(stickyNotes)) {
        await workspaces.updateOne({ _id: 'default' }, { $set: { stickyNotes } });
      }
      const state = workspace ? { ...workspace, notes: notes.length ? notes : workspace.notes || [], stickyNotes } : null;
      response.json({ state, isNew: !workspace });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/state', async (request, response, next) => {
    try {
      const { categories, pinned, settings, notepad, stickyNotes, notes = [], activeNoteId = null } = request.body || {};
      if (
        !Array.isArray(categories) ||
        !Array.isArray(pinned) ||
        !settings || typeof settings !== 'object' || Array.isArray(settings) ||
        typeof notepad !== 'string' ||
        !Array.isArray(stickyNotes) ||
        !Array.isArray(notes) ||
        !notes.every(note => note && typeof note.id === 'string' && typeof note.title === 'string' && typeof note.content === 'string') ||
        (activeNoteId !== null && typeof activeNoteId !== 'string')
      ) {
        response.status(400).json({ error: 'Invalid workspace state.' });
        return;
      }

      await workspaces.replaceOne(
        { _id: 'default' },
        { _id: 'default', categories, pinned, settings, notepad, activeNoteId, stickyNotes: keepActiveStickyNotes(stickyNotes) },
        { upsert: true },
      );

      if (notes.length) {
        await noteDocuments.bulkWrite(notes.map((note, order) => ({
          updateOne: {
            filter: { workspaceId: 'default', id: note.id },
            update: { $set: { ...note, workspaceId: 'default', order } },
            upsert: true,
          },
        })));
      }
      await noteDocuments.deleteMany({ workspaceId: 'default', id: { $nin: notes.map(note => note.id) } });
      response.json({ saved: true });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (request, response) => {
    response.status(404).json({ error: 'API route not found.' });
  });

  app.use(express.static(path.join(rootDir, 'dist')));
  app.use((request, response, next) => {
    if (request.method !== 'GET') return next();
    response.sendFile(path.join(rootDir, 'dist', 'index.html'), (error) => {
      if (error) next(error);
    });
  });

  app.use((error, request, response, next) => {
    console.error(error);
    if (response.headersSent) return next(error);
    response.status(500).json({ error: 'The server could not complete the request.' });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Shortcuts API listening on port ${port} (${databaseName}).`);
  });
}

startServer().catch((error) => {
  console.error(error.message);
  process.exit(1);
});