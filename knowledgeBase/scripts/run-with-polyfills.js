#!/usr/bin/env node

// Node.js polyfills for browser APIs
// 在任何模块加载之前设置polyfills

// File API polyfill
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(chunks, name, options) {
      this.chunks = chunks;
      this.name = name;
      this.options = options;
    }
  };
}

// Blob API polyfill
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  };
}

// FormData API polyfill
if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this.data = new Map();
    }

    append(name, value, fileName) {
      this.data.set(name, { value, fileName });
    }

    get(name) {
      return this.data.get(name);
    }

    has(name) {
      return this.data.has(name);
    }

    delete(name) {
      this.data.delete(name);
    }

    entries() {
      return this.data.entries();
    }
  };
}

// URLSearchParams polyfill
if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = class URLSearchParams {
    constructor(init) {
      this.params = new Map();
      
      if (typeof init === 'string') {
        // Parse query string
        init.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key) {
            this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
          }
        });
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => {
          this.params.set(key, value);
        });
      } else if (init && typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => {
          this.params.set(key, value);
        });
      }
    }

    append(name, value) {
      this.params.set(name, value);
    }

    delete(name) {
      this.params.delete(name);
    }

    get(name) {
      return this.params.get(name) || null;
    }

    has(name) {
      return this.params.has(name);
    }

    set(name, value) {
      this.params.set(name, value);
    }

    toString() {
      const pairs = [];
      this.params.forEach((value, key) => {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
      return pairs.join('&');
    }
  };
}

// 运行原始脚本
const { spawn } = require('child_process');
const path = require('path');

// 获取命令行参数
const args = process.argv.slice(2);
const scriptName = args[0];
const scriptArgs = args.slice(1);

if (!scriptName) {
  console.error('请指定要运行的脚本名称');
  process.exit(1);
}

// 构建脚本路径
const scriptPath = path.join(__dirname, scriptName);

// 使用tsx运行脚本
const child = spawn('npx', ['tsx', scriptPath, ...scriptArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // 确保polyfills在子进程中可用
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} -r ${path.join(__dirname, 'run-with-polyfills.js')}`
  }
});

child.on('exit', (code) => {
  process.exit(code);
});