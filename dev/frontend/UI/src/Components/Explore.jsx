import React from 'react';
import StarBorder from '../../Animations/StarBorder/StarBorder';
import SpotlightCard from '../../Components/SpotlightCard/SpotlightCard';
import DecryptedText from '../../TextAnimations/DecryptedText/DecryptedText';
import GradientText from '../../TextAnimations/GradientText/GradientText';

function ExploreSection({ title, children }) {
    return (
      <SpotlightCard className="custom-spotlight-card Explore-card" spotlightColor="rgba(0, 229, 255, 0.2)">
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

  function Explore() {
    return (
      <div className="Study-Area">
        <h1 className='title-root'>
            <GradientText
            colors={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
            animationSpeed={3}
            showBorder={true}
            className="title-gradient"
            
            >
            <DecryptedText
            text="Explore (Valery_ASI)"
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
        <div className="Study-Area-sections">
        <ExploreSection title="Explore Info">
          {/* Contenido del Explore 1 */}
        </ExploreSection>
        <ExploreSection title="Valery Info">
          {/* Contenido del Explore 2 */}
        </ExploreSection>
        <ExploreSection title="Curriculum">
          {/* Contenido del Explore 2 */}
        </ExploreSection>

        <StarBorder
        as="button"
        className="custom-class"
        color="cyan"
        speed="5s"
        >
        
        <h3><DecryptedText
            text= "Click Me!"
            animateOn="view"
            revealDirection="start"
            sequential
            speed={100}
            maxIterations={20}
            className="revealed"
            parentClassName="all-letters"
            encryptedClassName="encrypted"
          /></h3>
        </StarBorder>
        </div>
      </div>
    );
  }

export default Explore;