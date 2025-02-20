import React from 'react';
import ReactDOM from 'react-dom/client';
import Dock from '../Components/Dock/Dock';
import { VscHome, VscArchive, VscAccount, VscSettingsGear } from 'react-icons/vsc';

import App from './Components/App';
import Nav from './Components/Nav';
import Aurora from '../Backgrounds/Aurora/Aurora';
import Hyperspeed from '../Backgrounds/Hyperspeed/Hyperspeed';
import Particles from '../Backgrounds/Particles/Particles';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Explorer from './Components/Explorer';
import DashBoard from './Components/DashBoard';
import Explore from './Components/Explore';
import Avatar from './Components/Avatar';
import User from './Components/User';
import Chat from './Components/Chat';
import StudyArea from './Components/Study-Area';
import Calendar from './Components/Calendar';
import GlobalStyle from './Components/GlobalStyle';
import DashBoardStyle from './Components/DashBoardStyle';
import AvatarStyle from './Components/AvatarStyle';
import UserStyle from './Components/UserStyle';
import ChatStyle from './Components/ChatStyle';

const items = [
  { icon: <VscHome size={18} />, label: 'Home', onClick: () => window.location.href = 'https://google.es' },
  { icon: <VscArchive size={18} />, label: 'Archive', onClick: () => alert('Archive!') },
  { icon: <VscAccount size={18} />, label: 'Profile', onClick: () => alert('Profile!') },
  { icon: <VscSettingsGear size={18} />, label: 'Settings', onClick: () => alert('Settings!') },
];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalStyle />
    <DashBoardStyle />
    <AvatarStyle />
    <UserStyle />
    <ChatStyle />
    <div className="background">
    <Particles
      particleColors={['#ffffff', '#ffffff']}
      particleCount={200}
      particleSpread={10}
      speed={0.1}
      particleBaseSize={100}
      moveParticlesOnHover={true}
      alphaParticles={true}
      disableRotation={false}
    />
    </div>
    <div className="duck">
    <Dock 
        items={items}
        panelHeight={68}
        baseItemSize={50}
        magnification={70}
    />
    </div>
    <BrowserRouter> 
    <Nav />  {/* Nav MUST come BEFORE Routes */}
    <App>
      <Routes>
      <Route path="/" element={<DashBoard />} />
        <Route path="/Explorer" element={<Explorer />} />
        <Route path="/DashBoard" element={<DashBoard />} />
        <Route path="/Study-Area" element={<StudyArea />} />
        <Route path="/User" element={<User />} />
        <Route path="/Avatar" element={<Avatar />} />
        <Route path="/Chat" element={<Chat />} />
        <Route path="/Calendar" element={<Calendar />} />
        {/* ... other routes */}
        <Route path="*" element={<Navigate to="/DashBoard" replace />} /> {/* Default route */}
      </Routes>
    </App>{/* App component is now inside BrowserRouter, but AFTER Routes */}
    </BrowserRouter>
  </React.StrictMode>
);
