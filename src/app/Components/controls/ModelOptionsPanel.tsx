import React from "react";

interface ModelOptionsPanelProps {
  onZoomChange: (value: number) => void;
  zoomLevel?: number;
}

const ModelOptionsPanel: React.FC<ModelOptionsPanelProps> = ({ onZoomChange, zoomLevel = 3000000 }) => {
  // 컨테이너 스타일 - MultiViewController 위에 배치하도록 수정
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "100px", // MultiViewController 위에 배치
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: "8px",
    padding: "15px",
    color: "white",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "300px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
    marginBottom: "15px", // MultiViewController와 간격 추가
  };

  // 라벨 스타일
  const labelStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
  };

  // 슬라이더 컨테이너 스타일
  const sliderContainerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  };

  // 슬라이더 스타일
  const sliderStyle: React.CSSProperties = {
    width: "100%",
  };

  // 현재 줌 값 표시 스타일
  const zoomValueStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#4c7dfc",
    textAlign: "right",
  };

  // 줌 레벨 변경 핸들러
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onZoomChange(value);
  };

  // 줌 값 포맷
  const formatZoomValue = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  return (
    <div style={containerStyle}>
      <div style={sliderContainerStyle}>
        <div style={labelStyle}>
          <span>줌 레벨:</span>
          <span style={zoomValueStyle}>{formatZoomValue(zoomLevel)}</span>
        </div>
        <input type="range" min="10000" max="100000000" step="10000" value={zoomLevel} onChange={handleZoomChange} style={sliderStyle} />
      </div>
    </div>
  );
};

export default ModelOptionsPanel;
