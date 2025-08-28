import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatPanelProps = {
  messages: { type: 'user' | 'gemini'; text: string }[];
  inputText: string;
  isThinking: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onNewTask: () => void;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  inputText,
  isThinking,
  onInputChange,
  onSendMessage,
  onNewTask,
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
      {messages.map((msg, index) => (
        <div
          key={index}
          style={{
            marginBottom: '10px',
            padding: '8px',
            borderRadius: '5px',
            backgroundColor: msg.type === 'user' ? '#d1e7fd' : '#e2e3e5',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
        </div>
      ))}
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
    </div>
  </div>
);
