import React from "react";
import { animationControlStyle } from "../styles/CesiumStyles";
import { rotateButtonStyle } from "../styles/CesiumStyles";

interface AnimationControlProps {
  animating: boolean;
  animationSpeed: number;
  onAnimatingChange: (animating: boolean) => void;
  onAnimationSpeedChange: (speed: number) => void;
  onReset: () => void;
}

const AnimationControl: React.FC<AnimationControlProps> = ({ animating, animationSpeed, onAnimatingChange, onAnimationSpeedChange, onReset }) => {
  return (
    <div style={animationControlStyle}>
      <div style={{ textAlign: "center", marginBottom: "5px", fontWeight: "bold" }}>ISS 이동 제어</div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={() => onAnimatingChange(!animating)}
          style={{
            ...rotateButtonStyle,
            width: "100px",
            backgroundColor: animating ? "rgba(0, 180, 0, 0.8)" : "rgba(180, 0, 0, 0.8)",
          }}
        >
          {animating ? "정지" : "이동"}
        </button>

        <button onClick={onReset} style={{ ...rotateButtonStyle, width: "100px" }}>
          초기화
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ width: "50px" }}>속도:</span>
        <input type="range" min="1" max="100" value={animationSpeed} onChange={(e) => onAnimationSpeedChange(parseInt(e.target.value))} style={{ flex: 1 }} />
        <span style={{ width: "30px", textAlign: "right" }}>{animationSpeed}x</span>
      </div>
    </div>
  );
};

export default AnimationControl;
