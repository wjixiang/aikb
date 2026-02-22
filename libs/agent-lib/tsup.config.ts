// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // 类型检查选项
  // tsup 默认不会进行类型检查，只是转换代码
  treeshake: true,
  esbuildOptions(options) {
    options.external = ['@prisma/client-runtime-utils']
  },
})
