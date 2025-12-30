// npx vitest run shared/__tests__/modes.spec.ts

import type { ModeConfig, PromptComponent } from '../types';

import { getModeBySlug } from '../modes';

describe('modes', () => {
  it(getModeBySlug, () => {
    const mode = getModeBySlug('ask')
    console.log(mode)
  })
})