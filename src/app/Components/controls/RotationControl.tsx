import React from "react";
import { RotationState } from "../types/CesiumTypes";
import { rotationControlStyle, rotationRowStyle, rotateButtonStyle } from "../styles/CesiumStyles";

interface RotationControlProps {
  rotation: RotationState;
  onYawChange: (delta: number) => void;
  onPitchChange: (delta: number) => void;
  onRollChange: (delta: number) => void;
  onReset: () => void;
}

const RotationControl: React.FC<RotationControlProps> = ({ rotation, onYawChange, onPitchChange, onRollChange, onReset }) => {
  return (
    <div style={rotationControlStyle}>
      <div style={{ textAlign: "center", marginBottom: "5px", fontWeight: "bold" }}>모델 회전 컨트롤러</div>

      {/* Yaw 컨트롤 */}
      <div style={rotationRowStyle}>
        <span style={{ width: "50px" }}>Yaw:</span>
        <button onClick={() => onYawChange(-5)} style={rotateButtonStyle}>
          -5°
        </button>
        <button onClick={() => onYawChange(-1)} style={rotateButtonStyle}>
          -1°
        </button>
        <span style={{ width: "40px", textAlign: "center" }}>{rotation.yaw}°</span>
        <button onClick={() => onYawChange(1)} style={rotateButtonStyle}>
          +1°
        </button>
        <button onClick={() => onYawChange(5)} style={rotateButtonStyle}>
          +5°
        </button>
      </div>

      {/* Pitch 컨트롤 */}
      <div style={rotationRowStyle}>
        <span style={{ width: "50px" }}>Pitch:</span>
        <button onClick={() => onPitchChange(-5)} style={rotateButtonStyle}>
          -5°
        </button>
        <button onClick={() => onPitchChange(-1)} style={rotateButtonStyle}>
          -1°
        </button>
        <span style={{ width: "40px", textAlign: "center" }}>{rotation.pitch}°</span>
        <button onClick={() => onPitchChange(1)} style={rotateButtonStyle}>
          +1°
        </button>
        <button onClick={() => onPitchChange(5)} style={rotateButtonStyle}>
          +5°
        </button>
      </div>

      {/* Roll 컨트롤 */}
      <div style={rotationRowStyle}>
        <span style={{ width: "50px" }}>Roll:</span>
        <button onClick={() => onRollChange(-5)} style={rotateButtonStyle}>
          -5°
        </button>
        <button onClick={() => onRollChange(-1)} style={rotateButtonStyle}>
          -1°
        </button>
        <span style={{ width: "40px", textAlign: "center" }}>{rotation.roll}°</span>
        <button onClick={() => onRollChange(1)} style={rotateButtonStyle}>
          +1°
        </button>
        <button onClick={() => onRollChange(5)} style={rotateButtonStyle}>
          +5°
        </button>
      </div>

      {/* 회전 초기화 버튼 */}
      <button onClick={onReset} style={{ ...rotateButtonStyle, width: "100%", marginTop: "5px" }}>
        초기화
      </button>
    </div>
  );
};

export default RotationControl;
