import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

function resolveDataFile(requestedFile?: string | string[]) {
  const fileName = typeof requestedFile === 'string' && requestedFile.length > 0 ? requestedFile : 'output.json';
  const normalized = path.normalize(fileName).replace(/^([/\\])+/, '');
  const resolvedPath = path.resolve(DATA_DIR, normalized);

  if (!resolvedPath.startsWith(DATA_DIR)) {
    throw new Error('Invalid data file path');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Data file not found: ${fileName}`);
  }

  return { resolvedPath, fileName: normalized };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { resolvedPath, fileName } = resolveDataFile(req.query.file);
    const data = fs.readFileSync(resolvedPath, 'utf8');
    const stats = fs.statSync(resolvedPath);
    const jsonData = JSON.parse(data);

    const meta = {
      version: `${fileName}:${stats.mtimeMs}-${stats.size}`,
      lastModified: stats.mtimeMs,
      size: stats.size,
      file: fileName
    };

    res.status(200).json({
      ...jsonData,
      _meta: meta
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load data file' });
  }
}