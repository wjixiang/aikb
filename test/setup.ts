import { config } from 'dotenv';


config(); // Inject  env variables

console.log(new Date())

// Mock browser globals that @elastic/elasticsearch expects
global.File = class File {
  constructor() {}
  get size() {
    return 0;
  }
  get type() {
    return '';
  }
  get name() {
    return '';
  }
  get lastModified() {
    return 0;
  }
  get webkitRelativePath() {
    return '';
  }
} as any;

// Mock other browser globals that might be needed
global.Blob = class Blob {
  constructor() {}
  get size() {
    return 0;
  }
  get type() {
    return '';
  }
} as any;

global.FormData = class FormData {
  constructor() {}
  append() {}
  delete() {}
  get() {
    return null;
  }
  getAll() {
    return [];
  }
  has() {
    return false;
  }
  set() {}
  entries() {
    return new Map().entries();
  }
  forEach() {}
  keys() {
    return new Map().keys();
  }
  values() {
    return new Map().values();
  }
} as any;

// Mock fetch if needed
global.fetch = vi.fn();

// Mock logger
// const { mockLogger } = vi.hoisted(() => {
//   const mockLogger = {
//     error: vi.fn(console.log),
//     warn: vi.fn(console.log),
//     info: vi.fn(console.log),
//     debug: vi.fn(console.log),
//     verbose: vi.fn(console.log),
//     http: vi.fn(console.log),
//     silly: vi.fn(console.log),
//     log: vi.fn(console.log),
//   };
//   return { mockLogger };
// });

// vi.mock('../../logger', () => ({
//   default: vi.fn(() => mockLogger)
// }));