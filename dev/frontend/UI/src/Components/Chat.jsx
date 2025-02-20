import React, { useState } from 'react';
import StarBorder from '../../Animations/StarBorder/StarBorder';
import SpotlightCard from '../../Components/SpotlightCard/SpotlightCard';
import DecryptedText from '../../TextAnimations/DecryptedText/DecryptedText';
import GradientText from '../../TextAnimations/GradientText/GradientText';
import '../styles/Chat.css';

function ChatSection({ title, children }) {
  return (
    <SpotlightCard 
      className="custom-spotlight-card Chat-card" 
      spotlightColor="rgba(0, 229, 255, 0.2)"
    >
      <h1>
        <DecryptedText
          text={title}
          animateOn="view"
          revealDirection="start"
          sequential
          speed={100}
          maxIterations={20}
          className="revealed"
          parentClassName="all-letters"
          encryptedClassName="encrypted"
        />
      </h1>
      {children}
    </SpotlightCard>
  );
}

function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      setMessages([...messages, { text: message, isUser: true }]);
      setMessage('');
      // TODO: Add AI response handling
    }
  };

  return (
    <div className="Chat">
      <h1 className='title-root'>
        <GradientText
          colors={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
          animationSpeed={3}
          showBorder={true}
          className="title-gradient"
        >
          <DecryptedText
            text="Chat (Valery_ASI)"
            animateOn="view"
            revealDirection="start"
            sequential
            speed={70}
            maxIterations={20}
            className="revealed"
            parentClassName="all-letters"
            encryptedClassName="encrypted"
          />
        </GradientText>
      </h1>
      <div className="Chat-sections">
        <ChatSection title="Chat">
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.isUser ? 'user' : 'ai'}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="chat-input">
            <input 
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <StarBorder as="button" type="submit" color="cyan" speed="5s">
              Send
            </StarBorder>
          </form>
        </ChatSection>
      </div>
    </div>
  );
}

export default Chat;
