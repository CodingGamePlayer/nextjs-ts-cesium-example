"use client";

import "cesium/Build/Cesium/Widgets/widgets.css";
import { useCallback, useEffect, useState } from "react";

// 타입 임포트
import { CesiumComponentProps, ModelViewMode, RotationState } from "./types/CesiumTypes";

// 유틸리티 함수 임포트
import { drawISSOrbit } from "./utils/ISSUtils";

// 컨트롤 컴포넌트 임포트
import ModelOptionsPanel from "./controls/ModelOptionsPanel";
import MultiViewController from "./controls/MultiViewController";
import RotationControl from "./controls/RotationControl";

// Cesium 초기화 훅 임포트
import { useCesium } from "./hooks/useCesium";

// 로딩 화면 컴포넌트 임포트
import LoadingScreen from "./common/LoadingScreen";

// 모델 회전 관련 훅 임포트
import { useCameraView } from "./hooks/useCameraView";
import { useRotation } from "./hooks/useRotation";

export const CesiumComponent = ({ CesiumJs, positions, issPositions }: CesiumComponentProps) => {
  // Cesium 초기화 훅 사용
  const { viewerRefs, isLoaded, initializeCesiumJs } = useCesium();
  const { cesiumViewer, cesiumContainerRef, issEntityRef } = viewerRefs;

  // 회전 상태 관리를 여기서 함
  const [rotation, setRotation] = useState<RotationState>({ yaw: 0, pitch: 0, roll: 0 });

  // 수정된 회전 관련 훅 사용
  const { handleYawChange, handlePitchChange, handleRollChange } = useRotation(cesiumViewer, rotation, setRotation);

  // 상태 관리 - 변경되는 상태만 useState로 유지
  const [animating, setAnimating] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [currentViewMode, setCurrentViewMode] = useState<ModelViewMode>("default");
  const [zoomLevel, setZoomLevel] = useState<number>(3000000);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(true);

  // 카메라 뷰 관련 훅 사용
  const { handleViewModeChange, updateCameraPosition, handleZoomChange } = useCameraView(
    cesiumViewer,
    issEntityRef,
    currentViewMode,
    setCurrentViewMode,
    zoomLevel,
    setZoomLevel,
    trackingEnabled,
    setTrackingEnabled
  );

  // 초기 Cesium 초기화
  useEffect(() => {
    if (isLoaded) return;
    initializeCesiumJs(positions, animationSpeed, animating);
  }, [positions, isLoaded, animationSpeed, animating, initializeCesiumJs]);

  // ISS 궤도 및 모델 그리기, 카메라이동
  useEffect(() => {
    if (isLoaded && issPositions?.length) {
      const result = drawISSOrbit(cesiumViewer.current, issPositions, rotation, animationSpeed);
      if (result && result.issEntity) {
        issEntityRef.current = result.issEntity;

        if (cesiumViewer.current) {
          // 타입 안전성 보장 - null 체크 추가
          // 초기 카메라 이동 완료 후 기본 뷰(등각뷰)로 자동 설정
          handleViewModeChange("default");
        }
      }
    }
  }, [isLoaded, issPositions, rotation, animationSpeed, cesiumViewer, issEntityRef, trackingEnabled, zoomLevel, handleViewModeChange]);

  // 뷰 모드 변경 시 효과
  useEffect(() => {
    if (isLoaded && currentViewMode !== "default") {
      // 모드가 변경되면 해당 뷰를 적용
      handleViewModeChange(currentViewMode);
    }
  }, [isLoaded, currentViewMode, handleViewModeChange, cesiumViewer]);

  // Clock 상태 변경 관련 이펙트
  useEffect(() => {
    if (cesiumViewer.current) {
      // 카메라 추적이 활성화된 경우 카메라 위치 업데이트
      if (trackingEnabled && issEntityRef.current) {
        updateCameraPosition();
      }

      cesiumViewer.current.scene.requestRender();
    }
  }, [animationSpeed, animating, trackingEnabled, updateCameraPosition, cesiumViewer, issEntityRef]);

  // 회전 초기화 함수 수정
  const handleRotationReset = useCallback(() => {
    // 회전 상태 초기화
    setRotation({ yaw: 0, pitch: 0, roll: 0 });
  }, []);

  // 이제 조건부 반환 수행
  if (!CesiumJs) return null;

  return (
    <>
      {!isLoaded && <LoadingScreen message="Cesium 3D 지구를 불러오는 중입니다..." />}

      <RotationControl
        rotation={rotation}
        onYawChange={handleYawChange}
        onPitchChange={handlePitchChange}
        onRollChange={handleRollChange}
        onReset={handleRotationReset}
      />

      <ModelOptionsPanel onZoomChange={handleZoomChange} zoomLevel={zoomLevel} />

      <MultiViewController currentView={currentViewMode} onViewChange={handleViewModeChange} />

      <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />
    </>
  );
};

export default CesiumComponent;
