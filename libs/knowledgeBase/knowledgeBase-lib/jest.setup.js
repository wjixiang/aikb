// Fix TextEncoder/TextDecoder issues for Node.js environment
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Fix ReadableStream and other Web API issues
const { Readable } = require('stream');
global.ReadableStream = Readable;

// Fix MessagePort and other Web API issues
global.MessagePort = class MessagePort {
  constructor() {
    this.onmessage = null;
    this.onmessageerror = null;
  }
  postMessage() {}
  start() {}
  close() {}
};

// Fix other Web APIs that might be missing
global.MessageChannel = class MessageChannel {
  constructor() {
    this.port1 = new MessagePort();
    this.port2 = new MessagePort();
  }
};

// Fix setImmediate for Node.js environment
const { setImmediate } = require('timers');
global.setImmediate = setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};