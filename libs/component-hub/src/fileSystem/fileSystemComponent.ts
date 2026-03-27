import { ToolComponent, tdiv } from 'agent-lib/components';
import type { TUIElement } from 'agent-lib/components/ui';

export class FileSystemComponent extends ToolComponent {
  componentPrompt: string = '';

  protected toolDefs() {
    return {};
  }

  renderImply: () => Promise<TUIElement[]> = async () => {
    return [new tdiv({})];
  };
}
