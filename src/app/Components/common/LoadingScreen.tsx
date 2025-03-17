"use client";

import React from "react";
import styles from "./LoadingScreen.module.css";

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "로딩 중..." }) => {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingContent}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
