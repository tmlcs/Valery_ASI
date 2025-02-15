import React from 'react';
import { createRoot } from 'react-dom/client';
import SplashCursor from './SplashCursor';

function App() {
  return (
    <div>
      <SplashCursor />
      {/* Add your other React components here */}
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
