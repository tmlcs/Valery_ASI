/*
	jsrepo 1.36.0
	Installed from https://reactbits.dev/default/
	2-15-2025
*/

import Background from "three/src/renderers/common/Background.js";
import "./GradientText.css";

export default function GradientText({
	children,
	className = "",
	colors = ["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"], // Default colors
	animationSpeed = 8, // Default animation speed in seconds
	showBorder = true, // Default overlay visibility
}) {
	const gradientStyle = {
		backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
		animationDuration: `${animationSpeed}s`,
	};

	return (
		<div className={`animated-gradient-text ${className}`}>
			{showBorder && (
				<div className="gradient-overlay" style={gradientStyle}></div>
			)}
			<div className="text-content" style={gradientStyle}>
				{children}
			</div>
		</div>
	);
}
