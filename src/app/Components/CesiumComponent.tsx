"use client";

import "cesium/Build/Cesium/Widgets/widgets.css";
import { useCallback, useEffect, useState } from "react";

// 타입 임포트
import { CesiumComponentProps, ModelViewMode, RotationState } from "./types/CesiumTypes";

// 유틸리티 함수 임포트
import { drawISSOrbit } from "./utils/ISSUtils";
import { calculateSatelliteOrbit } from "./utils/satellite";

// 컨트롤 컴포넌트 임포트
import ModelOptionsPanel from "./controls/ModelOptionsPanel";
import MultiViewController from "./controls/MultiViewController";
import RotationControl from "./controls/RotationControl";
import AnimationController from "./controls/AnimationController";

// Cesium 초기화 훅 임포트
import { useCesium } from "./hooks/useCesium";

// 로딩 화면 컴포넌트 임포트
import LoadingScreen from "./common/LoadingScreen";

// 모델 회전 관련 훅 임포트
import { useCameraView } from "./hooks/useCameraView";
import { useRotation } from "./hooks/useRotation";

export const CesiumComponent = ({ CesiumJs, positions, issPositions: initialIssPositions, tleLine1, tleLine2 }: CesiumComponentProps) => {
  // Cesium 초기화 훅 사용
  const { viewerRefs, isLoaded, initializeCesiumJs } = useCesium();
  const { cesiumViewer, cesiumContainerRef, issEntityRef } = viewerRefs;

  // 회전 상태 관리를 여기서 함
  const [rotation, setRotation] = useState<RotationState>({ yaw: 0, pitch: 0, roll: 0 });

  // 수정된 회전 관련 훅 사용
  const { handleYawChange, handlePitchChange, handleRollChange } = useRotation(cesiumViewer, rotation, setRotation);

  // 상태 관리 - 변경되는 상태만 useState로 유지
  const [animating, setAnimating] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(10);
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
    setTrackingEnabled,
    rotation
  );

  // ISS 궤도 데이터를 로컬 상태로 관리
  const [issPositions, setIssPositions] = useState<any[]>(initialIssPositions || []);

  // 궤도 갱신 간격 (밀리초) - 1분
  const ORBIT_UPDATE_INTERVAL = 60 * 1000;

  // 궤도 업데이트 함수 - 현재 시간을 기준으로 궤도 갱신
  const updateOrbit = useCallback(() => {
    if (tleLine1 && tleLine2) {
      // 현재 시간을 기준으로 새로운 궤도 계산
      const newPositions = calculateSatelliteOrbit(tleLine1, tleLine2, new Date());
      setIssPositions(newPositions);

      // 이미 모델이 로드되어 있으면 궤도만 갱신
      if (isLoaded && cesiumViewer.current) {
        // 기존 ISS 엔티티 참조 보존
        const currentIssEntity = issEntityRef.current;

        // 새 궤도 그리기
        const result = drawISSOrbit(cesiumViewer.current, newPositions, rotation, animationSpeed);

        if (result && result.issEntity) {
          issEntityRef.current = result.issEntity;

          // 카메라 추적 대상 업데이트
          if (trackingEnabled && cesiumViewer.current) {
            cesiumViewer.current.trackedEntity = issEntityRef.current;

            // 현재 뷰 모드 유지하며 카메라 위치 업데이트
            handleViewModeChange(currentViewMode);
          }
        }
      }
    }
  }, [tleLine1, tleLine2, isLoaded, cesiumViewer, rotation, animationSpeed, trackingEnabled, handleViewModeChange, currentViewMode]);

  // 1분마다 궤도 갱신 타이머 설정
  useEffect(() => {
    // 초기 로드 후 첫 번째 업데이트
    if (isLoaded) {
      updateOrbit();
    }

    // 주기적 업데이트 타이머 설정
    const intervalId = setInterval(() => {
      updateOrbit();
    }, ORBIT_UPDATE_INTERVAL);

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      clearInterval(intervalId);
    };
  }, [isLoaded, updateOrbit]);

  // 기존 useEffect 수정 (초기 로드 시에만 실행)
  useEffect(() => {
    if (isLoaded && issPositions?.length) {
      const result = drawISSOrbit(cesiumViewer.current, issPositions, rotation, animationSpeed);
      if (result && result.issEntity) {
        issEntityRef.current = result.issEntity;

        if (cesiumViewer.current) {
          // 초기 카메라 이동 완료 후 기본 뷰(등각뷰)로 자동 설정
          handleViewModeChange("default");
        }
      }
    }
  }, [isLoaded, rotation, animationSpeed, cesiumViewer, issEntityRef, handleViewModeChange]);

  // 초기 Cesium 초기화
  useEffect(() => {
    if (isLoaded) return;
    initializeCesiumJs(positions, animationSpeed, animating);
  }, [positions, isLoaded, animationSpeed, animating, initializeCesiumJs]);

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

  // 추가할 핸들러 추가
  const handleAnimatingChange = useCallback(
    (value: boolean) => {
      setAnimating(value);
      if (cesiumViewer.current) {
        cesiumViewer.current.clock.shouldAnimate = value;
      }
    },
    [cesiumViewer]
  );

  const handleSpeedChange = useCallback(
    (value: number) => {
      setAnimationSpeed(value);
      if (cesiumViewer.current) {
        cesiumViewer.current.clock.multiplier = value;
      }
    },
    [cesiumViewer]
  );

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

      <AnimationController animating={animating} animationSpeed={animationSpeed} onAnimatingChange={handleAnimatingChange} onSpeedChange={handleSpeedChange} />

      <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />
    </>
  );
};

export default CesiumComponent;
