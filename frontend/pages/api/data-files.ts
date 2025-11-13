import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

type DataFileInfo = {
  name: string;
  size: number;
  lastModified: number;
};

function listDataFiles(): DataFileInfo[] {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  return fs
    .readdirSync(DATA_DIR)
    .filter(entry => entry.toLowerCase().endsWith('.json'))
    .map(entry => {
      const filePath = path.join(DATA_DIR, entry);
      const stats = fs.statSync(filePath);
      return {
        name: entry,
        size: stats.size,
        lastModified: stats.mtimeMs
      };
    })
    .sort((a, b) => b.lastModified - a.lastModified);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    res.status(200).json({ files: listDataFiles() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list data files' });
  }
}
