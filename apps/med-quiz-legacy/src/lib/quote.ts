import { Reference } from './agents/agent.types';

export default class quote {
  content: string;
  source: string;

  constructor(doc: Reference) {
    this.content = doc.content;
    this.source = doc.title;
  }
}
