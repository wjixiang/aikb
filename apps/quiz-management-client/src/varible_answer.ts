import { read, readFileSync } from 'fs';
import path from 'path';
export const answer = readFileSync('./src/quiz_data/answer.md').toString();
