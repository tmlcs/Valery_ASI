/*
	jsrepo 1.36.0
	Installed from https://reactbits.dev/default/
	2-16-2025
*/

import "./StarBorder.css";

const StarBorder = ({
  as: Component = "button",
  className = "",
  color = "white",
  speed = "6s",
  children,
  ...rest
}) => {
  return (
    <Component className={`star-border-container ${className}`} {...rest}>
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      ></div>
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      ></div>
      <div className="inner-content">{children}</div>
    </Component>
  );
};

export default StarBorder;
