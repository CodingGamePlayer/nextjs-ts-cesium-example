"use client";

import React from "react";
import type { CesiumType } from "../types/cesium";

interface CesiumWrapperProps {
  children: React.ReactElement<{ CesiumJs: CesiumType }>;
}

export const CesiumWrapper: React.FC<CesiumWrapperProps> = ({ children }) => {
  const [CesiumJs, setCesiumJs] = React.useState<CesiumType | null>(null);

  React.useEffect(() => {
    if (CesiumJs !== null) return;
    import("cesium").then((Cesium) => setCesiumJs(Cesium));
  }, [CesiumJs]);

  if (!CesiumJs) return null;

  return React.cloneElement(children, {
    ...children.props,
    CesiumJs,
  });
};

export default CesiumWrapper;
