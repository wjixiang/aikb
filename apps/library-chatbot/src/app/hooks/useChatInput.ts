import { useState, useCallback } from 'react';

export interface UseChatInputOptions {
  initialValue?: string;
}

export interface UseChatInputReturn {
  input: string;
  setInput: (input: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  clearInput: () => void;
  hasValidInput: boolean;
}

export function useChatInput({
  initialValue = '',
}: UseChatInputOptions = {}): UseChatInputReturn {
  const [input, setInputState] = useState(initialValue);

  const setInput = useCallback((newInput: string) => {
    setInputState(newInput);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [setInput],
  );

  const clearInput = useCallback(() => {
    setInput('');
  }, [setInput]);

  const hasValidInput = Boolean(input.trim());

  return {
    input,
    setInput,
    handleInputChange,
    clearInput,
    hasValidInput,
  };
}
