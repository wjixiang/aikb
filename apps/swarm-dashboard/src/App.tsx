import './App.css'
import { AgentMonitor } from './components/agentMonitor'
import { ServerStatus } from './components/serverStatus'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

function App() {
  return (
    <div className="h-full w-full bg-background p-4 space-y-4 flex">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel>
          <ServerStatus />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel>
          <AgentMonitor />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default App
