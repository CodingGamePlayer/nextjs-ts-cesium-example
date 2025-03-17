import React, { useEffect, useRef, useCallback } from "react";

interface ModelOptionsPanelProps {
  onZoomChange: (value: number) => void;
  zoomLevel?: number;
}

const ModelOptionsPanel: React.FC<ModelOptionsPanelProps> = ({ onZoomChange, zoomLevel = 3000000 }) => {
  // 패널 참조 생성
  const panelRef = useRef<HTMLDivElement>(null);

  // 줌 증가/감소 단계 설정
  const zoomStep = 100000; // 기본 스텝
  const fineZoomStep = 10000; // 미세 조정 스텝

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
    width: "340px",
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

  // 버튼 컨테이너 스타일
  const buttonsContainerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "8px",
  };

  // 버튼 스타일
  const buttonStyle: React.CSSProperties = {
    backgroundColor: "#4c7dfc",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: "16px",
    width: "45px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "all 0.2s ease",
  };

  // 설명 텍스트 스타일
  const instructionStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#aaa",
    marginTop: "10px",
    textAlign: "center",
    lineHeight: "1.4",
  };

  // 키보드 키 스타일
  const keyStyle: React.CSSProperties = {
    backgroundColor: "#333",
    border: "1px solid #555",
    borderRadius: "3px",
    padding: "1px 5px",
    margin: "0 2px",
    fontSize: "11px",
  };

  // 줌 증가 감소 함수
  const adjustZoom = useCallback(
    (amount: number) => {
      const newValue = Math.max(10000, Math.min(100000000, zoomLevel + amount));
      onZoomChange(newValue);
    },
    [zoomLevel, onZoomChange]
  );

  // 줌 레벨 변경 핸들러
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onZoomChange(value);
  };

  // 화살표 키 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          adjustZoom(-fineZoomStep); // 줌인 (값 감소)
          break;
        case "ArrowDown":
          e.preventDefault();
          adjustZoom(fineZoomStep); // 줌아웃 (값 증가)
          break;
        case "ArrowRight": // 방향 반전 - 오른쪽이 줌인
          e.preventDefault();
          adjustZoom(-zoomStep); // 줌인 (값 감소)
          break;
        case "ArrowLeft": // 방향 반전 - 왼쪽이 줌아웃
          e.preventDefault();
          adjustZoom(zoomStep); // 줌아웃 (값 증가)
          break;
      }
    };

    // 패널이 활성화되어 있을 때만 이벤트 설정
    if (panelRef.current) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [zoomLevel, onZoomChange, adjustZoom]);

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
    <div style={containerStyle} ref={panelRef} tabIndex={0}>
      <div style={sliderContainerStyle}>
        <div style={labelStyle}>
          <span>줌 레벨:</span>
          <span style={zoomValueStyle}>{formatZoomValue(zoomLevel)}</span>
        </div>
        <input type="range" min="10000" max="100000000" step="10000" value={zoomLevel} onChange={handleZoomChange} style={sliderStyle} />

        <div style={instructionStyle}>
          <div>
            <span style={keyStyle}>→</span> 줌인 &nbsp;|&nbsp;
            <span style={keyStyle}>←</span> 줌아웃 &nbsp;|&nbsp;
            <span style={keyStyle}>↑↓</span> 미세 조절
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelOptionsPanel;
