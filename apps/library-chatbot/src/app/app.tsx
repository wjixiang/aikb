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
    <div className="w-screen h-screen">
      <Chat
        className="h-full"
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
