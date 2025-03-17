"use client";

import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import React, { useEffect, useRef, useState } from "react";

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

  // 기존 useEffect 대체
  useEffect(() => {
    if (isLoaded) return;
    initializeCesiumJs(positions, animationSpeed, animating);
  }, [positions, isLoaded, animationSpeed, animating, initializeCesiumJs]);

  // 하단 뷰 관련 추가 기능 - 조명 및 렌더링 설정
  const configureViewSettings = React.useCallback(
    (mode: ModelViewMode) => {
      if (!cesiumViewer.current) return;

      // 모든 뷰에 대한 기본 설정
      cesiumViewer.current.scene.globe.enableLighting = true;

      // 하단 뷰에 대한 특별한 설정
      if (mode === "bottom") {
        // 렌더링 품질 향상
        cesiumViewer.current.scene.postProcessStages.fxaa.enabled = true; // 안티앨리어싱 활성화

        if (cesiumViewer.current.scene.primitives && issEntityRef.current) {
          // 씬의 다른 요소들의 밝기를 줄임
          cesiumViewer.current.scene.globe.translucency.enabled = true;
          cesiumViewer.current.scene.globe.translucency.frontFaceAlpha = 0;
        }

        // 다중 조명 설정 (모델을 여러 방향에서 비추도록)
        const time = cesiumViewer.current.clock.currentTime;
        if (issEntityRef.current) {
          const issPosition = issEntityRef.current.position?.getValue(time);

          if (issPosition) {
            // 하단에서 위로 향하는 주 조명
            cesiumViewer.current.scene.light = new Cesium.DirectionalLight({
              direction: Cesium.Cartesian3.normalize(
                new Cesium.Cartesian3(0, 0, 1), // 아래에서 위로
                new Cesium.Cartesian3()
              ),
              intensity: 5.0, // 더 밝게
              color: Cesium.Color.WHITE,
            });

            // 조명 효과 강화를 위한 추가 설정
            cesiumViewer.current.scene.globe.enableLighting = true;
            cesiumViewer.current.scene.shadowMap.enabled = true;
            cesiumViewer.current.scene.shadowMap.softShadows = true;

            // 모델을 더 선명하게 하는 설정
            try {
              // @ts-ignore - 내부 속성 접근
              if (cesiumViewer.current.scene.model && cesiumViewer.current.scene.model.silhouetteSize) {
                // @ts-ignore
                cesiumViewer.current.scene.model.silhouetteSize = 1.0;
                // @ts-ignore
                cesiumViewer.current.scene.model.silhouetteColor = Cesium.Color.WHITE;
              }
            } catch (e) {
              console.log("모델 강조 설정 중 오류", e);
            }
          }
        }
      } else {
        // 다른 뷰에서는 기본 설정으로 복원
        cesiumViewer.current.scene.light = new Cesium.SunLight();
        cesiumViewer.current.scene.globe.depthTestAgainstTerrain = true;
        cesiumViewer.current.scene.globe.translucency.enabled = false;
        cesiumViewer.current.scene.shadowMap.enabled = false;
      }
    },
    [cesiumViewer, issEntityRef]
  );

  // 뷰 모드 변경 핸들러
  const handleViewModeChange = React.useCallback(
    (mode: ModelViewMode) => {
      // 뷰 모드 상태 업데이트
      setCurrentViewMode(mode);

      // 뷰 모드에 따른 특수 설정 적용
      configureViewSettings(mode);

      // 모드에 해당하는 뷰 적용
      const viewConfig: ModelViewConfig = {
        mode,
        zoom: zoomLevel,
      };

      // ISS가 있다면 해당 엔티티에 초점을 맞춥니다
      if (issEntityRef.current && cesiumViewer.current) {
        // 먼저 추적을 중지하여 카메라 설정이 가능하도록 함
        cesiumViewer.current.trackedEntity = undefined;

        // 현재 시간 기준 ISS 위치 획득
        const currentTime = cesiumViewer.current.clock.currentTime;
        const issPosition = issEntityRef.current.position?.getValue(currentTime);
        const issOrientation = issEntityRef.current.orientation?.getValue(currentTime);

        if (issPosition && issOrientation) {
          // 뷰 모드에 따른 오프셋 방향과 각도 설정
          let headingRadians = 0;
          let pitchRadians = 0;
          // 뷰 모드에 따른 줌 레벨 설정 (하단 뷰만 더 가깝게)
          let currentZoomLevel = zoomLevel;

          switch (mode) {
            case "front":
              headingRadians = Cesium.Math.toRadians(270);
              pitchRadians = 0;
              break;
            case "back":
              headingRadians = Cesium.Math.toRadians(90);
              pitchRadians = 0;
              break;
            case "left":
              headingRadians = Cesium.Math.toRadians(180);
              pitchRadians = 0;
              break;
            case "right":
              headingRadians = 0;
              pitchRadians = 0;
              break;
            case "top":
              headingRadians = 0;
              pitchRadians = Cesium.Math.toRadians(-90);
              break;
            case "bottom":
              // 하단 뷰 각도 조정 - 더 낮은 각도로 수정하여 모델이 더 잘 보이게 함
              headingRadians = Cesium.Math.toRadians(0);
              pitchRadians = Cesium.Math.toRadians(90); // 60도로 수정 (더 기울어진 각도)
              // 하단 뷰에서만 더 가까운 줌 레벨 적용 (기본 값의 약 50%)
              currentZoomLevel = zoomLevel * 0.7;
              break;
            case "default":
            default:
              headingRadians = Cesium.Math.toRadians(45);
              pitchRadians = Cesium.Math.toRadians(-30);
              break;
          }

          // 추적 활성화
          setTrackingEnabled(true);

          // 카메라 오프셋 계산 (회전 보정 포함) - 뷰 모드별 줌 레벨 적용
          const cameraOffset = new Cesium.HeadingPitchRange(headingRadians, pitchRadians, currentZoomLevel);

          // 오프셋 적용
          cesiumViewer.current.scene.camera.lookAt(issPosition, cameraOffset);

          // 다시 트래킹 모드로 설정
          cesiumViewer.current.trackedEntity = issEntityRef.current;

          // 지속적인 카메라 조정을 위한 이벤트 리스너
          const cameraTrackingListener = () => {
            if (!trackingEnabled || !cesiumViewer.current || !issEntityRef.current) return;

            const time = cesiumViewer.current.clock.currentTime;
            const position = issEntityRef.current.position?.getValue(time);
            const orientation = issEntityRef.current.orientation?.getValue(time);

            if (position && orientation) {
              // 모델 위치를 기준으로 한 변환 행렬 설정 - 뷰 모드별 줌 레벨 적용
              cesiumViewer.current.scene.camera.lookAt(position, new Cesium.HeadingPitchRange(headingRadians, pitchRadians, currentZoomLevel));
            }
          };

          // 기존 리스너 제거 및 새 리스너 등록
          cesiumViewer.current.scene.preRender.removeEventListener(cameraTrackingListener);
          cesiumViewer.current.scene.preRender.addEventListener(cameraTrackingListener);

          // 즉시 한 번 렌더링 요청하여 카메라 위치 업데이트
          cesiumViewer.current.scene.requestRender();
        }
      } else {
        // ISS가 없으면 일반적인 뷰 적용
        applyModelView(cesiumViewer.current, viewConfig);
      }
    },
    [zoomLevel, trackingEnabled, issEntityRef, cesiumViewer, configureViewSettings]
  );

  // 카메라 위치 업데이트 함수 추가
  const updateCameraPosition = React.useCallback(() => {
    if (!cesiumViewer.current || !issEntityRef.current || !trackingEnabled) return;

    // 현재 선택된 뷰 모드에 따라 카메라 위치 다시 계산
    handleViewModeChange(currentViewMode);
  }, [currentViewMode, trackingEnabled, handleViewModeChange, cesiumViewer, issEntityRef]);

  // 줌 레벨 변경시 카메라 업데이트 추가
  const handleZoomChange = React.useCallback(
    (value: number) => {
      setZoomLevel(value);

      // 추적 모드에서는 즉시 카메라 위치 업데이트
      if (trackingEnabled && issEntityRef.current) {
        setTimeout(() => {
          handleViewModeChange(currentViewMode);
        }, 10);
      } else {
        // 추적 모드가 아닌 경우 기존 방식 사용
        const viewConfig: ModelViewConfig = {
          mode: currentViewMode,
          zoom: value,
        };

        if (issEntityRef.current) {
          applyModelView(cesiumViewer.current, viewConfig, issEntityRef.current.id);
        } else {
          applyModelView(cesiumViewer.current, viewConfig);
        }
      }
    },
    [currentViewMode, trackingEnabled, handleViewModeChange, cesiumViewer, issEntityRef]
  );

  React.useEffect(() => {
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
  React.useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.multiplier = animationSpeed;
    }
  }, [animationSpeed, cesiumViewer]);

  // animating 상태 변경 시 시계 설정 업데이트
  React.useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.shouldAnimate = animating;
      cesiumViewer.current.scene.requestRender();
    }
  }, [animating, cesiumViewer]);

  // 뷰 모드 변경 시 효과
  React.useEffect(() => {
    if (isLoaded && currentViewMode !== "default") {
      // 모드가 변경되면 해당 뷰를 적용
      handleViewModeChange(currentViewMode);
    }
  }, [isLoaded, currentViewMode, handleViewModeChange, cesiumViewer]);

  // 와이어프레임, 바운딩 박스, 하이라이트 설정 변경 시 효과
  React.useEffect(() => {
    if (isLoaded && issEntityRef.current) {
      // 설정 적용
      setWireframeMode(cesiumViewer.current, showWireframe);
      toggleBoundingBox(cesiumViewer.current, issEntityRef.current.id, showBoundingBox);
      highlightModel(cesiumViewer.current, issEntityRef.current.id, showHighlight);
    }
  }, [isLoaded, showWireframe, showBoundingBox, showHighlight, cesiumViewer, issEntityRef]);

  // Clock 상태 변경 관련 이펙트
  React.useEffect(() => {
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
  React.useEffect(() => {
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
