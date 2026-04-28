import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth';
import { personsRouter } from './routes/persons';
import { relationshipsRouter } from './routes/relationships';
import { treeRouter } from './routes/tree';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/persons', personsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/tree', treeRouter);

// Serve built frontend in production
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
