import React from 'react';
import StarBorder from '../../Animations/StarBorder/StarBorder';
import SpotlightCard from '../../Components/SpotlightCard/SpotlightCard';
import DecryptedText from '../../TextAnimations/DecryptedText/DecryptedText';
import GradientText from '../../TextAnimations/GradientText/GradientText';
import InfiniteMenu from '../../Components/InfiniteMenu/InfiniteMenu';
import PropTypes from 'prop-types';
import Calendar from './Calendar';

DashboardSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node
};

const items = [
  {
    image: 'https://picsum.photos/300/300?grayscale',
    link: 'https://google.com/',
    title: 'Item 1',
    description: 'This is pretty cool, right?'
  },
  {
    image: 'https://picsum.photos/400/400?grayscale',
    link: 'https://google.com/',
    title: 'Item 2',
    description: 'This is pretty cool, right?'
  },
  {
    image: 'https://picsum.photos/500/500?grayscale',
    link: 'https://google.com/',
    title: 'Item 3',
    description: 'This is pretty cool, right?'
  },
  {
    image: 'https://picsum.photos/600/600?grayscale',
    link: 'https://google.com/',
    title: 'Item 4',
    description: 'This is pretty cool, right?'
  }
];

// Define dashboard sections data structure
const dashboardSections = [
  {
    title: 'Ininite Menu',
    content: (
      <>
        <div className="infinite-menu">
        <InfiniteMenu items={items}/>
        </div>
      </>
    )
  },
  {
    title: 'Valery Info',
    content: (
      <div className="info-container">
        <p>Version: 1.0.0</p>
        <p>Status: Active</p>
        <p>Last Update: {new Date().toLocaleDateString()}</p>
        <a href="https://github.com/tmlcs/Valery_ASI">GitHub</a>
      </div>
    )
  },
  {
    title: 'Valery Avatar',
    content: (
      <>
        <img src="https://www.w3schools.com/w3images/avatar2.png" alt="Avatar" className="avatar" />
        <h3>Valery ASI</h3>
        <p>AI Assistant</p>
      </>
    )
  },
  {
    title: 'User Info',
    content: (
      <div className="info-container">
        <p>Version: 1.0.0</p>
        <p>Status: Active</p>
        <p>Last Update: {new Date().toLocaleDateString()}</p>
        <a href="https://github.com/tmlcs/Valery_ASI">GitHub</a>
      </div>
    )
  },
  {
    title: 'User Avatar',
    content: (
      <>
        <img src="https://www.w3schools.com/w3images/avatar2.png" alt="Avatar" className="avatar" />
        <h3>Valery ASI</h3>
        <p>AI Assistant</p>
      </>
    )
  },
  {
    title: 'Log Book',
    content: (
      <div className="logbook-container">
      </div>
    )
  },
  {
    title: 'Calendario',
    content: (
      <>
        <Calendar />
      </>
    )
  },
  {
    title: 'Account Balance',
    content: (
      <>
        <Calendar />
      </>
    )
  },
  {
    title: 'Curriculum',
    content: (
      <ul className="curriculum-list">
        <li>Machine Learning</li>
        <li>Natural Language Processing</li>
        <li>Data Analysis</li>
      </ul>
    )
  }
  // ...you can add more sections here
];

function DashboardSection({ title, children }) {
  return (
    <SpotlightCard className="custom-spotlight-card dashboard-card" spotlightColor="rgba(0, 229, 255, 0.2)">
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

function DashBoard() {
  return (
    <div className="DashBoard">
      <h1 className='title-root'>
        <GradientText colors={["#40ffaa", "#4079ff", "#40ffaa"]} animationSpeed={3} showBorder={true}>
          <DecryptedText text="DashBoard (Valery_ASI)" {...defaultDecryptedTextProps} />
        </GradientText>
      </h1>
      <div className="dashboard-sections">
        {dashboardSections.map((section, index) => (
          <DashboardSection key={index} title={section.title}>
            {section.content}
          </DashboardSection>
        ))}
        <StarBorder as="button" className="custom-class" color="cyan" speed="5s">
          <h3><DecryptedText text="Click Me!" {...defaultDecryptedTextProps} /></h3>
        </StarBorder>
      </div>
    </div>
  );
}

const defaultDecryptedTextProps = {
  animateOn: "view",
  revealDirection: "start",
  sequential: true,
  speed: 100,
  maxIterations: 20,
  className: "revealed",
  parentClassName: "all-letters",
  encryptedClassName: "encrypted"
};

export default DashBoard;