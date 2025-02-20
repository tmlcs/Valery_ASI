import { createGlobalStyle } from 'styled-components'; // If using styled-components

const ChatStyle = createGlobalStyle`
 .Chat {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    height: 100%;
    width: 100%;
    /* other global styles */
  }

  .Chat-sections {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    align-items: center;
    width: 100%;
    height: 100%;
    /* other global styles */
  }
  
  .Chat-sections .card-spotlight:nth-child(1) {
    width: 100%;
  }

  .Chat-sections .infinite-menu{
  width: 100%;
  }

  .Chat-sections .card-spotlight:nth-child(2) {
    width: 350px;
    }

  @media (min-width: 1332px) {
    .Chat-sections .card-spotlight:nth-child(1) {
      width: 1024px;
    }
  }
    @media (min-width: 1892px) {
    .Chat-sections .card-spotlight:nth-child(2) {
    width: 500px;
    }
  }
  
  .Chat-sections img {
    width: 150px;
 }
 
 .messages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 500px;
  overflow-y: auto;
  padding: 1rem;
}

.message {
  padding: 1rem;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  align-self: flex-end;
  background: rgba(64, 255, 170, 0.1);
}

.message.ai {
  align-self: flex-start;  
  background: rgba(64, 121, 255, 0.1);
}

.message.error {
  align-self: center;
  background: rgba(255, 64, 64, 0.1);
}

.chat-input {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.chat-input input {
  flex: 1;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border: none;
  color: inherit;
}

`;

export default ChatStyle;