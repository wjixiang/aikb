import Entity from './Entity';
import Knowledge from './Knowledge';
import { KBStorage } from './storage/storage';

/**
 *
 */
export class aikb {
  constructor(public storage: KBStorage) {}
  entity = Entity;
  knowledge = Knowledge;
}

export class aikbUiAgent {
  constructor(private kb: aikb, public task: string) {

  }

  async start(prompt: string) {

  }
  
  async solve() {

  }
}

abstract class AbstractAgent {
  abstract memory: string[];
  abstract plan: any;
  abstract tool: any;

}