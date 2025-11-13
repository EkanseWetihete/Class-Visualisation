import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const filePath = path.join(process.cwd(), '..', 'output.json');
      const data = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      const jsonData = JSON.parse(data);

      const meta = {
        version: `${stats.mtimeMs}-${stats.size}`,
        lastModified: stats.mtimeMs,
        size: stats.size
      };

      res.status(200).json({
        ...jsonData,
        _meta: meta
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load output.json' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}