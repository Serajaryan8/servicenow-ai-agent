import React, { useState } from 'react';
import axios from 'axios';
import MessageBubble from './MessageBubble';
import './ChatWindow.css';

const ChatWindow = () => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hi! I am your ServiceNow AI Agent. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { sender: 'user', text: input }];
    setMessages(newMessages);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/query`, { question: input });
      const botReply = response.data.answer || "I'm not sure, please rephrase.";
      setMessages([...newMessages, { sender: 'bot', text: botReply }]);
    } catch (err) {
      setMessages([...newMessages, { sender: 'bot', text: 'Error connecting to server.' }]);
    }

    setInput('');
  };

  return (
    <div className="chat-container">
      <div className="chat-window">
        {messages.map((msg, index) => (
          <MessageBubble key={index} sender={msg.sender} text={msg.text} />
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder="Ask about incidents, changes, requests..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default ChatWindow;
