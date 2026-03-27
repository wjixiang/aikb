import { ReactiveToolComponent, tdiv } from 'agent-lib/components';
import type { TUIElement } from 'agent-lib/components/ui';

export class FileSystemComponent extends ReactiveToolComponent {
  componentPrompt: string = '';

  protected override toolDefs() {
    return {};
  }

  renderImply: () => Promise<TUIElement[]> = async () => {
    return [new tdiv({})];
  };
}
