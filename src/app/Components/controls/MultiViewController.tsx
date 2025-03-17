import React from "react";
import { ModelViewMode } from "../types/CesiumTypes";

interface MultiViewControllerProps {
  currentView: ModelViewMode;
  onViewChange: (mode: ModelViewMode) => void;
}

const MultiViewController: React.FC<MultiViewControllerProps> = ({ currentView, onViewChange }) => {
  // 뷰 모드 버튼 스타일 (선택된 버튼과 기본 버튼 스타일)
  const getButtonStyle = (mode: ModelViewMode): React.CSSProperties => ({
    backgroundColor: currentView === mode ? "#4c7dfc" : "#2c3e50",
    color: "white",
    border: "none",
    padding: "10px 15px",
    margin: "5px",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: currentView === mode ? "bold" : "normal",
    transition: "all 0.2s ease",
    boxShadow: currentView === mode ? "0 0 10px rgba(76, 125, 252, 0.7)" : "none",
  });

  // 컨트롤러 컨테이너 스타일
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: "10px",
    borderRadius: "10px",
    maxWidth: "90vw",
  };

  return (
    <div style={containerStyle}>
      <button style={getButtonStyle("default")} onClick={() => onViewChange("default")} title="기본 뷰">
        기본
      </button>
      <button style={getButtonStyle("front")} onClick={() => onViewChange("front")} title="정면 뷰">
        정면
      </button>
      <button style={getButtonStyle("back")} onClick={() => onViewChange("back")} title="후면 뷰">
        후면
      </button>
      <button style={getButtonStyle("top")} onClick={() => onViewChange("top")} title="상단 뷰">
        상단
      </button>
      <button style={getButtonStyle("bottom")} onClick={() => onViewChange("bottom")} title="하단 뷰">
        하단
      </button>
      <button style={getButtonStyle("left")} onClick={() => onViewChange("left")} title="좌측 뷰">
        좌측
      </button>
      <button style={getButtonStyle("right")} onClick={() => onViewChange("right")} title="우측 뷰">
        우측
      </button>
    </div>
  );
};

export default MultiViewController;
