import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth';
import { personsRouter } from './routes/persons';
import { relationshipsRouter } from './routes/relationships';
import { treeRouter } from './routes/tree';
import { statsRouter } from './routes/stats';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/persons', personsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/tree', treeRouter);
app.use('/api/stats', statsRouter);

// Serve uploaded files (persistent volume in production, ./uploads locally)
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? path.join(__dirname, '../../uploads'));
app.use('/uploads', express.static(uploadDir));

// Serve built frontend
const publicDir = path.join(__dirname, '../../public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
