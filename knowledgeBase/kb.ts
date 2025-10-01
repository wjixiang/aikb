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
