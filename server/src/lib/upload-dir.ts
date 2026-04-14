import path from 'path';
import fs from 'fs';

export const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(process.cwd(), 'server/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
