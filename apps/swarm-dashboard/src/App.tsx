import './App.css';
import { AgentMonitor } from './components/agentMonitor';
import { ServerStatus } from './components/serverStatus';
import { LineageTree } from './components/lineageTree';
import { useTheme } from './hooks/useTheme';
import { Sun, Moon, Monitor } from 'lucide-react';

function App() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div className="h-full w-full bg-background p-4 space-y-4 overflow-y-auto relative">
      <button
        onClick={toggleTheme}
        title={`Theme: ${theme} (click to toggle)`}
        className="absolute top-3 right-3 z-50 p-2 rounded-lg bg-muted/80 hover:bg-muted transition-colors"
      >
        {theme === 'system' ? (
          <Monitor className="h-4 w-4" />
        ) : isDark ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>

      <div>
        <ServerStatus />
      </div>
      <div className="flex-1 min-h-0 h-150">
        <AgentMonitor />
      </div>
      <div>
        <LineageTree />
      </div>
    </div>
  );
}

export default App;
