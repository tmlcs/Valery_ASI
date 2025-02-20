import React from 'react';
import SplashCursor from '../../Animations/SplashCursor/SplashCursor';


function App(props) {
  return (
    <div className="app">
      {props.children}
      <SplashCursor
        SIM_RESOLUTION={128}
        DYE_RESOLUTION={1440}
        CAPTURE_RESOLUTION={512} 
        DENSITY_DISSIPATION={10}
        VELOCITY_DISSIPATION={3}
        PRESSURE={0.1}
        PRESSURE_ITERATIONS={20}
        CURL={3}
        SPLAT_RADIUS={0.1}
        SPLAT_FORCE={3000}
        SHADING={true}
        COLOR_UPDATE_SPEED={10}
        BACK_COLOR={{ r: 0.5, g: 0, b: 0 }}
        TRANSPARENT={true}
      />
      {}
    </div>
    
  );
}

export default App;
