import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatMessage = { type: 'user' | 'gemini'; text: string; variant?: 'error' | 'suggestion' | 'info' };
type ChatPanelProps = {
  messages: ChatMessage[];
  inputText: string;
  isThinking: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onNewTask: () => void;
  onRetry?: () => void;
  retryAvailable?: boolean;
  onRetryTool?: () => void;
  retryToolAvailable?: boolean;
  onContinue?: () => void;
  continueAvailable?: boolean;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  inputText,
  isThinking,
  onInputChange,
  onSendMessage,
  onNewTask,
  onRetry,
  retryAvailable = false,
  onRetryTool,
  retryToolAvailable = false,
  onContinue,
  continueAvailable = false,
}) => (
  <div
    style={{
      width: '40%',
      minWidth: '400px',
      borderRight: '1px solid #ccc',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f9f9f9',
    }}
  >
    <div
      style={{
        padding: '10px',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <h3>Chat with Gemini</h3>
      <button onClick={onNewTask} style={{ padding: '8px', cursor: 'pointer' }}>
        New Task
      </button>
    </div>
    <div
      style={{
        flexGrow: 1,
        padding: '10px',
        overflowY: 'auto',
        // Add some basic styles for markdown elements
        lineHeight: 1.6,
      }}
    >
      {messages.map((msg, index) => {
        let bg = msg.type === 'user' ? '#d1e7fd' : '#e2e3e5';
        if (msg.variant === 'error') bg = '#ffe5e5';
        else if (msg.variant === 'suggestion') bg = '#fff9e0';
        return (
          <div
            key={index}
            style={{
              marginBottom: '10px',
              padding: '8px',
              borderRadius: '5px',
              backgroundColor: bg,
              border:
                msg.variant === 'error'
                  ? '1px solid #ff4d4f'
                  : msg.variant === 'suggestion'
                    ? '1px solid #f0c040'
                    : '1px solid transparent',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '14px',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
          </div>
        );
      })}
      {isThinking && <div>...</div>}
    </div>
    <div style={{ display: 'flex', padding: '10px', borderTop: '1px solid #ccc' }}>
      <textarea
        value={inputText}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Describe an animation..."
        style={{
          flexGrow: 1,
          marginRight: '10px',
          padding: '8px',
          height: '80px',
          resize: 'vertical',
        }}
        disabled={isThinking}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
          }
        }}
      />
      <button
        onClick={onSendMessage}
        disabled={isThinking}
        style={{ padding: '10px 15px', cursor: 'pointer' }}
      >
        Send
      </button>
      {retryAvailable && (
        <button
          onClick={onRetry}
          disabled={isThinking}
          style={{ padding: '10px 12px', marginLeft: '8px', cursor: 'pointer', background:'#ffcc00' }}
        >
          Retry
        </button>
      )}
      {retryToolAvailable && (
        <button
          onClick={onRetryTool}
          disabled={isThinking}
          style={{ padding: '10px 12px', marginLeft: '8px', cursor: 'pointer', background:'#ffa500' }}
        >
          Retry Tool
        </button>
      )}
      {continueAvailable && (
        <button
          onClick={onContinue}
          disabled={isThinking}
          style={{ padding: '10px 12px', marginLeft: '8px', cursor: 'pointer', background:'#4caf50', color:'#fff' }}
        >
          继续
        </button>
      )}
    </div>
  </div>
);
