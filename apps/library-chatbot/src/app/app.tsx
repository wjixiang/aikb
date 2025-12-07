import {Chat} from "ui/components/chat"
import { useChat } from './hooks/useChat';

export function App() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
  } = useChat();

  return (
    <div>
      <Chat
        messages={messages}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isGenerating={isLoading}
        stop={stop}
      />
    </div>
  );
}

export default App;
