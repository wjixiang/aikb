// Node.js polyfills for browser APIs

// File API polyfill
if (typeof global.File === 'undefined') {
  (global as any).File = class File {
    constructor(
      public chunks: any[],
      public name: string,
      public options?: any,
    ) {}
  };
}

// Blob API polyfill
if (typeof global.Blob === 'undefined') {
  (global as any).Blob = class Blob {
    constructor(
      public parts: any[],
      public options?: any,
    ) {}
  };
}

// FormData API polyfill
if (typeof global.FormData === 'undefined') {
  (global as any).FormData = class FormData {
    private data: Map<string, any> = new Map();

    append(name: string, value: any, fileName?: string): void {
      this.data.set(name, { value, fileName });
    }

    get(name: string): any {
      return this.data.get(name);
    }

    has(name: string): boolean {
      return this.data.has(name);
    }

    delete(name: string): void {
      this.data.delete(name);
    }

    entries(): IterableIterator<[string, any]> {
      return this.data.entries();
    }
  };
}

// URLSearchParams polyfill
if (typeof global.URLSearchParams === 'undefined') {
  (global as any).URLSearchParams = class URLSearchParams {
    private params: Map<string, string> = new Map();

    constructor(
      init?: string | string[][] | Record<string, string> | URLSearchParams,
    ) {
      if (typeof init === 'string') {
        // Parse query string
        init.split('&').forEach((pair) => {
          const [key, value] = pair.split('=');
          if (key) {
            this.params.set(
              decodeURIComponent(key),
              decodeURIComponent(value || ''),
            );
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

    append(name: string, value: string): void {
      this.params.set(name, value);
    }

    delete(name: string): void {
      this.params.delete(name);
    }

    get(name: string): string | null {
      return this.params.get(name) || null;
    }

    has(name: string): boolean {
      return this.params.has(name);
    }

    set(name: string, value: string): void {
      this.params.set(name, value);
    }

    toString(): string {
      const pairs: string[] = [];
      this.params.forEach((value, key) => {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
      return pairs.join('&');
    }
  };
}
