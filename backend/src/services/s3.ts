import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const uploadFile = async (
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> => {
  const extension = path.extname(originalName);
  const fileName = `${uuidv4()}${extension}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  // Write file to local uploads directory
  await fs.promises.writeFile(filePath, fileBuffer);

  // Return a relative URL path (resolved dynamically by the controller)
  return `/uploads/${fileName}`;
};
