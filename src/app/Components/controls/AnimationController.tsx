import React from "react";

interface AnimationControllerProps {
  animating: boolean;
  animationSpeed: number;
  onAnimatingChange: (value: boolean) => void;
  onSpeedChange: (value: number) => void;
}

const AnimationController: React.FC<AnimationControllerProps> = ({ animating, animationSpeed, onAnimatingChange, onSpeedChange }) => {
  // 컨테이너 스타일
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: "20px",
    right: "20px",
    zIndex: 1000,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: "8px",
    padding: "15px",
    color: "white",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "250px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
  };

  // 라벨 스타일
  const labelStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
  };

  // 컨트롤 스타일
  const controlStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  };

  // 슬라이더 스타일
  const sliderStyle: React.CSSProperties = {
    width: "100%",
  };

  // 토글 스타일
  const toggleContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  // 토글 버튼 스타일
  const toggleStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    width: "50px",
    height: "24px",
  };

  // 토글 입력 스타일
  const toggleInputStyle: React.CSSProperties = {
    opacity: 0,
    width: 0,
    height: 0,
  };

  // 슬라이더 토글 스타일
  const sliderToggleStyle: React.CSSProperties = {
    position: "absolute",
    cursor: "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: animating ? "#4c7dfc" : "#ccc",
    borderRadius: "24px",
    transition: "0.4s",
  };

  // 슬라이더 토글 노브 스타일
  const sliderToggleBeforeStyle: React.CSSProperties = {
    position: "absolute",
    content: "",
    height: "16px",
    width: "16px",
    left: animating ? "30px" : "4px",
    bottom: "4px",
    backgroundColor: "white",
    borderRadius: "50%",
    transition: "0.4s",
  };

  // 속도 값 스타일
  const speedValueStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#4c7dfc",
    textAlign: "right",
  };

  return (
    <div style={containerStyle}>
      <div style={controlStyle}>
        <div style={toggleContainerStyle}>
          <span>애니메이션</span>
          <label style={toggleStyle}>
            <input type="checkbox" style={toggleInputStyle} checked={animating} onChange={(e) => onAnimatingChange(e.target.checked)} />
            <span style={sliderToggleStyle}>
              <span style={sliderToggleBeforeStyle}></span>
            </span>
          </label>
        </div>
      </div>

      <div style={controlStyle}>
        <div style={labelStyle}>
          <span>속도 조절:</span>
          <span style={speedValueStyle}>x{animationSpeed}</span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          value={animationSpeed}
          onChange={(e) => onSpeedChange(parseInt(e.target.value))}
          disabled={!animating}
          style={sliderStyle}
        />
      </div>
    </div>
  );
};

export default AnimationController;
