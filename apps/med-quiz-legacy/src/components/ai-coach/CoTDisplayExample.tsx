"use client";

import React from "react";
import { useChatRuntime } from "./ChatRuntime";
import { CoTDisplay } from "./CoTDisplay";

/**
 * Example component showing how to use the new CoT and speech streaming features
 */
export const ChatWithCoTExample: React.FC = () => {
  const {
    messages,
    currentAiMessage,
    loading,
    cotMessages,
    speechQueue,
    isSpeaking,
    sendMessage,
  } = useChatRuntime("agent");

  const [input, setInput] = React.useState("");

  const handleSend = async () => {
    if (input.trim()) {
      await sendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-4 ${msg.sender === "user" ? "text-right" : "text-left"}`}
            >
              <div
                className={`inline-block p-3 rounded-lg max-w-xs ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {currentAiMessage.content && (
            <div className="text-left">
              <div className="inline-block p-3 rounded-lg max-w-xs bg-gray-200 text-gray-800">
                {currentAiMessage.content}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入你的问题..."
            className="w-full p-2 border rounded"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {loading ? "处理中..." : "发送"}
          </button>
        </div>
      </div>

      {/* CoT and Speech Display Sidebar */}
      <div className="w-80 border-l p-4 bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">实时状态</h2>
        <CoTDisplay
          cotMessages={cotMessages}
          speechQueue={speechQueue}
          isSpeaking={isSpeaking}
        />
      </div>
    </div>
  );
};
