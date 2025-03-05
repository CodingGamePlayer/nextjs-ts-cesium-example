import React from "react";

// 버튼 컨테이너 스타일
export const buttonContainerStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  right: "20px",
  transform: "translateY(-50%)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  zIndex: 1000,
};

// 회전 컨트롤 스타일
export const rotationControlStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "20px",
  right: "20px",
  transform: "none",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  zIndex: 1000,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  padding: "10px",
  borderRadius: "8px",
  color: "white",
  width: "360px",
};

// 회전 버튼 행 스타일
export const rotationRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

// 공통 버튼 스타일
export const buttonStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  padding: "0",
  backgroundColor: "rgba(48, 48, 48, 0.8)",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// 회전 버튼 스타일
export const rotateButtonStyle: React.CSSProperties = {
  width: "40px",
  height: "30px",
  padding: "0",
  backgroundColor: "rgba(48, 48, 48, 0.8)",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
};

// 애니메이션 제어 스타일
export const animationControlStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "20px",
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  zIndex: 1000,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  padding: "10px",
  borderRadius: "8px",
  color: "white",
  width: "300px",
};
