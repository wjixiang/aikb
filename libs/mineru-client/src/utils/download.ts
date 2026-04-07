import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';

import { createLogger } from './logger';

const logger = createLogger({ component: 'download' });

export async function downloadResultZip(
  zipUrl: string,
  downloadDir: string,
  taskId: string,
): Promise<string[]> {
  logger.info({ zipUrl, taskId }, 'Downloading ZIP');

  const zipFileName = `${taskId}.zip`;
  const absoluteZipPath = path.resolve(path.join(downloadDir, zipFileName));

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const downloadResponse = await axios({
    method: 'GET',
    url: zipUrl,
    responseType: 'stream',
  });

  const fileWriter = createWriteStream(absoluteZipPath);
  downloadResponse.data.pipe(fileWriter);

  await new Promise<void>((resolve, reject) => {
    fileWriter.on('finish', () => {
      logger.info({ path: absoluteZipPath }, 'ZIP downloaded');
      resolve();
    });
    fileWriter.on('error', reject);
  });

  return [absoluteZipPath];
}
