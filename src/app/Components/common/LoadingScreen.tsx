"use client";

import React from "react";

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "로딩 중..." }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-gray-800 rounded-lg p-8 flex flex-col items-center shadow-xl">
        <div className="w-16 h-16 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-white text-lg font-medium">{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
