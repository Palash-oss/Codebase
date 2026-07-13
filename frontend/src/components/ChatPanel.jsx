import React, { useState, useEffect, useRef } from 'react';

function ChatPanel({ project, detectedStack, isOpen, setIsOpen }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! Ask me any questions about the codebase architecture, file layers, or dependencies.'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    const question = inputText.trim();
    if (!question) return;

    // Add user message
    setMessages((prev) => [...prev, { sender: 'user', text: question }]);
    setInputText('');
    setIsThinking(true);

    const context = `
      Project: ${project.name}
      Total files: ${project.totalFiles}
      Total lines: ${project.totalLines}
      Detected technologies: ${detectedStack.map(t => t.name).join(', ')}
    `;

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context })
      });
      const data = await response.json();
      setIsThinking(false);
      setMessages((prev) => [...prev, { sender: 'bot', text: data.answer || 'No response.' }]);
    } catch (err) {
      setIsThinking(false);
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Sorry, the chat server returned an error.' }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button className="chat-toggle-btn" id="chat-toggle-btn" onClick={() => setIsOpen(true)}>
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="chat-panel open">
      <div className="chat-header">
        <div className="chat-title">AI assistant</div>
        <button className="btn-close" style={{ fontSize: '14px' }} onClick={() => setIsOpen(false)}>×</button>
      </div>

      <div className="chat-messages" id="chat-messages-box">
        {messages.map((msg, idx) => (
          <div className={`chat-bubble ${msg.sender === 'user' ? 'user' : 'bot'}`} key={idx}>
            {msg.text}
          </div>
        ))}
        {isThinking && (
          <div className="chat-bubble bot" style={{ opacity: 0.6 }}>
            thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <input 
          type="text" 
          className="chat-input" 
          placeholder="Ask about this codebase..." 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="chat-send-btn" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default ChatPanel;
