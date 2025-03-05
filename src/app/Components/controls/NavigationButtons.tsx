import React from "react";
import { buttonContainerStyle, buttonStyle } from "../styles/CesiumStyles";

interface NavigationButtonsProps {
  onFlyToISS: () => void;
  onFlyToKorea: () => void;
  onFlyToSunView: () => void;
}

const NavigationButtons: React.FC<NavigationButtonsProps> = ({ onFlyToISS, onFlyToKorea, onFlyToSunView }) => {
  return (
    <div style={buttonContainerStyle}>
      <button onClick={onFlyToISS} style={buttonStyle} title="Go to ISS">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2L9 4V7L6 9L3 9.5V12L6 14L9 16L12 19L15 16L18 14L21 12V9.5L18 9L15 7V4L12 2Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2" stroke="white" strokeWidth="1.5" />
        </svg>
      </button>
      <button onClick={onFlyToKorea} style={buttonStyle} title="Go to Korea">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
            stroke="white"
            strokeWidth="1.5"
          />
          <path d="M2 12H22" stroke="white" strokeWidth="1.5" />
          <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22" stroke="white" strokeWidth="1.5" />
        </svg>
      </button>
      <button onClick={onFlyToSunView} style={buttonStyle} title="Sun View">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5" />
          <path
            d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
};

export default NavigationButtons;
