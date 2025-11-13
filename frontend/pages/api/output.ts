import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const filePath = path.join(process.cwd(), '..', 'output.json');
      const data = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(data);
      res.status(200).json(jsonData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load output.json' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}