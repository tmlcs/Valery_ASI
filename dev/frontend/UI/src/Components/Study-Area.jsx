import React from 'react';
import StarBorder from '../../Animations/StarBorder/StarBorder';
import SpotlightCard from '../../Components/SpotlightCard/SpotlightCard';
import DecryptedText from '../../TextAnimations/DecryptedText/DecryptedText';
import GradientText from '../../TextAnimations/GradientText/GradientText';

function StudyAreaSection({ title, children }) {
    return (
      <SpotlightCard className="custom-spotlight-card StudyArea-card" spotlightColor="rgba(0, 229, 255, 0.2)">
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

  function StudyArea() {
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
            text="Study Area (Valery_ASI)"
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
        <StudyAreaSection title="StudyArea Info">
          {/* Contenido del StudyArea 1 */}
        </StudyAreaSection>
        <StudyAreaSection title="Valery Info">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Curriculum">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Tasks">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Progress">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Valery StudyArea">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Another StudyArea Section">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Another StudyArea Section">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Another StudyArea Section">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>
        <StudyAreaSection title="Another StudyArea Section">
          {/* Contenido del StudyArea 2 */}
        </StudyAreaSection>

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

export default StudyArea;