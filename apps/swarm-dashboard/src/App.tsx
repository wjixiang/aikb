import './App.css'
import { AgentMonitor } from './components/agentMonitor'
import { ServerStatus } from './components/serverStatus'

function App() {
  return (
    <div className="h-full w-full bg-background p-4 space-y-4 flex">
      <ServerStatus />
      <AgentMonitor />
    </div>
  )
}

export default App
