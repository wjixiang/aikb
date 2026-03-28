import './App.css';
import { AgentMonitor } from './components/agentMonitor';
import { ServerStatus } from './components/serverStatus';
import { LineageTree } from './components/lineageTree';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

function App() {
  return (
    <div className="h-full w-full bg-background p-4 space-y-4 flex flex-col">
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={25}>
            <ServerStatus />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={40}>
            <LineageTree />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={35}>
            <AgentMonitor />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default App;
