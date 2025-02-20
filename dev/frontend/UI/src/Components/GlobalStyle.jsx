import { createGlobalStyle } from 'styled-components'; // If using styled-components

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0; /* Reset default margins */
    font-family: sans-serif; /* Example font */
    /* Other global styles like background color, etc. */
  }

  .background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    /* other global styles */
  }
  
  .duck {
  position: fixed;
    bottom: 0;
    width: 100%;
    z-index: 1;
    }

  #root { /* Target the root div if needed */
    display: flex;
    width: 100%;
    height: 90%;
    overflow: hidden;
    /* other global styles*/
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 90%;
    width: 100%;
    overflow: hidden;
    /* other global styles */
  }

  .title-root {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
    margin: 0.33em;
    /* other global styles */
  }

  .title-root .text-content {
  padding: 0.5rem 5rem;}

  /* other global styles */
  a {
    text-decoration: none;
    color: inherit;
  }

  button {
  cursor: pointer;
  border-color: transparent; /* Reset default border color */
  border: 0;
  fade-color: transparent;
  }

  button:hover {
    transform: scale(0.95);
  }
`;

export default GlobalStyle;