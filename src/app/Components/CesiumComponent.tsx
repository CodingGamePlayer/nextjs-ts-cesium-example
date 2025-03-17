"use client";

import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useCallback, useEffect, useRef, useState } from "react";

// 타입 임포트
import { CesiumComponentProps, ModelViewConfig, ModelViewMode, RotationState } from "./types/CesiumTypes";

// 유틸리티 함수 임포트
import { flyToISS } from "./utils/CesiumUtils";
import { drawISSOrbit } from "./utils/ISSUtils";
import { applyModelView, highlightModel, setWireframeMode, toggleBoundingBox } from "./utils/ModelViewUtils";

// 컨트롤 컴포넌트 임포트
import ModelOptionsPanel from "./controls/ModelOptionsPanel";
import MultiViewController from "./controls/MultiViewController";
import RotationControl from "./controls/RotationControl";

// Cesium 초기화 훅 임포트
import { useCesium } from "./hooks/useCesium";

// 로딩 화면 컴포넌트 임포트
import LoadingScreen from "./common/LoadingScreen";

// 모델 회전 관련 훅 임포트
import { useRotation } from "./hooks/useRotation";
import { useCameraView } from "./hooks/useCameraView";

export const CesiumComponent = ({ CesiumJs, positions, issPositions }: CesiumComponentProps) => {
  // Cesium 초기화 훅 사용
  const { viewerRefs, isLoaded, initializeCesiumJs } = useCesium();
  const { cesiumViewer, cesiumContainerRef, issEntityRef } = viewerRefs;
  const initialFlyToCompleted = useRef<boolean>(false);

  // 회전 상태 관리를 여기서 함
  const [rotation, setRotation] = useState<RotationState>({ yaw: 0, pitch: 0, roll: 0 });

  // 수정된 회전 관련 훅 사용
  const { handleYawChange, handlePitchChange, handleRollChange, handleRotationReset } = useRotation(cesiumViewer, rotation, setRotation);

  // 상태 관리 (회전 상태 제거)
  const [animating, setAnimating] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [currentViewMode, setCurrentViewMode] = useState<ModelViewMode>("default");
  const [zoomLevel, setZoomLevel] = useState<number>(1000000);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(false);
  const [showHighlight, setShowHighlight] = useState<boolean>(false);
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

  // 기존 useEffect 대체
  useEffect(() => {
    if (isLoaded) return;
    initializeCesiumJs(positions, animationSpeed, animating);
  }, [positions, isLoaded, animationSpeed, animating, initializeCesiumJs]);

  useEffect(() => {
    if (isLoaded && issPositions?.length) {
      const result = drawISSOrbit(cesiumViewer.current, issPositions, rotation, animationSpeed);
      if (result && result.issEntity) {
        issEntityRef.current = result.issEntity;

        // 초기 이동이 아직 완료되지 않은 경우에만 ISS로 카메라 이동
        if (!initialFlyToCompleted.current) {
          setTimeout(() => {
            flyToISS(cesiumViewer.current, true); // 추적 활성화
            initialFlyToCompleted.current = true; // 초기 이동 완료 표시
          }, 1000); // 1초 지연 후 실행하여 엔티티가 완전히 로드되도록 함
        }
      }
    }
  }, [isLoaded, issPositions, rotation, animationSpeed, cesiumViewer, issEntityRef]);

  // 애니메이션 속도 변경 시 시계 업데이트
  useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.multiplier = animationSpeed;
    }
  }, [animationSpeed, cesiumViewer]);

  // animating 상태 변경 시 시계 설정 업데이트
  useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.shouldAnimate = animating;
      cesiumViewer.current.scene.requestRender();
    }
  }, [animating, cesiumViewer]);

  // 뷰 모드 변경 시 효과
  useEffect(() => {
    if (isLoaded && currentViewMode !== "default") {
      // 모드가 변경되면 해당 뷰를 적용
      handleViewModeChange(currentViewMode);
    }
  }, [isLoaded, currentViewMode, handleViewModeChange, cesiumViewer]);

  // 와이어프레임, 바운딩 박스, 하이라이트 설정 변경 시 효과
  useEffect(() => {
    if (isLoaded && issEntityRef.current) {
      // 설정 적용
      setWireframeMode(cesiumViewer.current, showWireframe);
      toggleBoundingBox(cesiumViewer.current, issEntityRef.current.id, showBoundingBox);
      highlightModel(cesiumViewer.current, issEntityRef.current.id, showHighlight);
    }
  }, [isLoaded, showWireframe, showBoundingBox, showHighlight, cesiumViewer, issEntityRef]);

  // Clock 상태 변경 관련 이펙트
  useEffect(() => {
    if (cesiumViewer.current) {
      // 애니메이션 속도 설정
      cesiumViewer.current.clock.multiplier = animationSpeed;

      // 애니메이션 상태 설정
      cesiumViewer.current.clock.shouldAnimate = animating;

      // 카메라 추적이 활성화된 경우 카메라 위치 업데이트
      if (trackingEnabled && issEntityRef.current) {
        updateCameraPosition();
      }

      cesiumViewer.current.scene.requestRender();
    }
  }, [animationSpeed, animating, trackingEnabled, updateCameraPosition, cesiumViewer, issEntityRef]);

  // 추적 모드 변경 감지 및 적용
  useEffect(() => {
    if (cesiumViewer.current && issEntityRef.current) {
      if (trackingEnabled) {
        // 추적 모드 활성화 시 현재 뷰 모드에 맞게 카메라 업데이트
        handleViewModeChange(currentViewMode);
      } else {
        // 추적 모드 비활성화 시 추적 엔티티 해제
        cesiumViewer.current.trackedEntity = undefined;
      }
    }
  }, [trackingEnabled, currentViewMode, handleViewModeChange, cesiumViewer, issEntityRef]);

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

      <ModelOptionsPanel onZoomChange={handleZoomChange} />

      <MultiViewController currentView={currentViewMode} onViewChange={handleViewModeChange} />

      <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />
    </>
  );
};

export default CesiumComponent;
