import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ChatInterface from './ChatInterface';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        email: 'test@example.com',
      },
      expires: '1',
    },
    status: 'authenticated',
  }),
}));

// Mock the chatClientService
vi.mock('@/lib/services/ChatClientService', () => ({
  chatClientService: {
    createSession: vi.fn().mockResolvedValue('session-123'),
    clearSession: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    getCurrentSessionId: vi.fn().mockReturnValue('session-123'),
    setCurrentSessionId: vi.fn(),
    ensureSession: vi.fn().mockResolvedValue('session-123'),
  },
}));

describe('ChatInterface', () => {
  const defaultProps = {
    messages: [],
    statusMessages: [],
    currentAiMessage: { content: '', CoT: '' },
    loading: false,
    selectedSource: '',
    hasSelectedQuiz: false,
    onSendMessage: vi.fn(),
    onRegenerateLastMessage: vi.fn(),
    onCancelRequest: vi.fn(),
    onClearChat: vi.fn(),
    onSendQuiz: vi.fn(),
    cotMessages: [],
    speechQueue: [],
    isSpeaking: false,
    showCoT: false,
    quizContentForInput: null,
    onMessagesUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the component correctly', () => {
    render(<ChatInterface {...defaultProps} />);

    // Check if the textarea is rendered
    expect(screen.getByPlaceholderText('向课本提问...')).toBeInTheDocument();

    // Check if the send button is rendered
    const sendButton = document.querySelector(
      'button svg.lucide-send',
    )?.parentElement;
    expect(sendButton).toBeInTheDocument();
  });

  test('allows typing in the textarea', () => {
    render(<ChatInterface {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('向课本提问...');
    fireEvent.change(textarea, { target: { value: 'Hello, world!' } });

    expect(textarea).toHaveValue('Hello, world!');
  });

  test('sends message when send button is clicked', async () => {
    const onSendMessageMock = vi.fn();
    render(
      <ChatInterface {...defaultProps} onSendMessage={onSendMessageMock} />,
    );

    const textarea = screen.getByPlaceholderText('向课本提问...');
    const sendButton = screen
      .getByRole('button')
      .querySelector('svg.lucide-send')?.parentElement as HTMLElement;

    // Type a message
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    // Click send button
    fireEvent.click(sendButton);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(onSendMessageMock).toHaveBeenCalledWith(
        'Test message',
        'vault',
        '',
        '',
        false,
        false,
        'GLM45Flash',
        true,
      );
    });

    // Check if textarea is cleared
    expect(textarea).toHaveValue('');
  });

  test('sends message when Enter key is pressed (non-mobile)', async () => {
    // Mock navigator.userAgent to simulate non-mobile device
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const onSendMessageMock = vi.fn();
    render(
      <ChatInterface {...defaultProps} onSendMessage={onSendMessageMock} />,
    );

    const textarea = screen.getByPlaceholderText('向课本提问...');

    // Type a message
    fireEvent.change(textarea, {
      target: { value: 'Test message with Enter' },
    });

    // Press Enter key
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(onSendMessageMock).toHaveBeenCalledWith(
        'Test message with Enter',
        'vault',
        '',
        '',
        false,
        false,
        'GLM45Flash',
        true,
      );
    });

    // Check if textarea is cleared
    expect(textarea).toHaveValue('');
  });

  test('does not send message when Shift+Enter is pressed', () => {
    const onSendMessageMock = vi.fn();
    render(
      <ChatInterface {...defaultProps} onSendMessage={onSendMessageMock} />,
    );

    const textarea = screen.getByPlaceholderText('向课本提问...');

    // Type a message
    fireEvent.change(textarea, {
      target: { value: 'Test message\nwith new line' },
    });

    // Press Shift+Enter
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      code: 'Enter',
      shiftKey: true,
    });

    // Should not call onSendMessage
    expect(onSendMessageMock).not.toHaveBeenCalled();

    // Textarea should still have the value
    expect(textarea).toHaveValue('Test message\nwith new line');
  });

  test('does not send empty message', () => {
    const onSendMessageMock = vi.fn();
    render(
      <ChatInterface {...defaultProps} onSendMessage={onSendMessageMock} />,
    );

    const sendButton = screen
      .getByRole('button')
      .querySelector('svg.lucide-send')?.parentElement as HTMLElement;

    // Click send button without typing anything
    fireEvent.click(sendButton);

    // Should not call onSendMessage
    expect(onSendMessageMock).not.toHaveBeenCalled();
  });

  test('disables send button when input is empty', () => {
    render(<ChatInterface {...defaultProps} />);

    const sendButton = screen
      .getByRole('button')
      .querySelector('svg.lucide-send')?.parentElement as HTMLElement;

    // Button should be disabled when input is empty
    expect(sendButton).toBeDisabled();
  });

  test('enables send button when input has text', () => {
    render(<ChatInterface {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('向课本提问...');
    const sendButton = screen
      .getByRole('button')
      .querySelector('svg.lucide-send')?.parentElement as HTMLElement;

    // Type a message
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    // Button should be enabled when input has text
    expect(sendButton).not.toBeDisabled();
  });

  test('shows cancel button when loading', () => {
    render(<ChatInterface {...defaultProps} loading={true} />);

    // Cancel button should be visible when loading
    expect(screen.getByRole('button', { name: /取消/i })).toBeInTheDocument();

    // Send button should not be visible when loading
    expect(
      screen.queryByRole('button', { name: /send/i }),
    ).not.toBeInTheDocument();
  });

  test('calls onCancelRequest when cancel button is clicked', () => {
    const onCancelRequestMock = vi.fn();
    render(
      <ChatInterface
        {...defaultProps}
        loading={true}
        onCancelRequest={onCancelRequestMock}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: /取消/i });
    fireEvent.click(cancelButton);

    expect(onCancelRequestMock).toHaveBeenCalled();
  });
});
