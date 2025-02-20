import React from 'react';
import StarBorder from '../../Animations/StarBorder/StarBorder';
import SpotlightCard from '../../Components/SpotlightCard/SpotlightCard';
import DecryptedText from '../../TextAnimations/DecryptedText/DecryptedText';
import GradientText from '../../TextAnimations/GradientText/GradientText';
import PropTypes from 'prop-types';

AvatarSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node
};

// Define Avatar sections data structure
const AvatarSections = [
  {
    title: 'Avatar Info',
    content: (
      <>
      <div className="info-container">
        <p>Version: 1.0.0</p>
        <p>Status: Active</p>
        <p>Last Update: {new Date().toLocaleDateString()}</p>
      </div>
      </>
    )
  },
  {
    title: 'Avatar',
    content: (
      <>
        <img src="https://www.w3schools.com/w3images/avatar2.png" alt="Avatar" className="avatar" />
        <h3>Valery ASI</h3>
        <p>AI Assistant</p>
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

function AvatarSection({ title, children }) {
    return (
      <SpotlightCard className="custom-spotlight-card Avatar-card" spotlightColor="rgba(0, 229, 255, 0.2)">
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

  function Avatar() {
    return (
      <div className="Avatar">
        <h1 className='title-root'>
            <GradientText
            colors={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
            animationSpeed={3}
            showBorder={true}
            className="title-gradient"
            
            >
            <DecryptedText
            text="Avatar (Valery_ASI)"
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
        <div className="Avatar-sections">
                {AvatarSections.map((section, index) => (
                  <AvatarSection key={index} title={section.title}>
                    {section.content}
                  </AvatarSection>
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

export default Avatar;