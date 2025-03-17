"use client";

import * as Cesium from "cesium";
import { useCallback } from "react";
import { ModelViewConfig, ModelViewMode } from "../types/CesiumTypes";
import { applyModelView } from "../utils/ModelViewUtils";

/**
 * 카메라 뷰 관련 기능을 제공하는 커스텀 훅
 */
export function useCameraView(
  cesiumViewer: React.MutableRefObject<Cesium.Viewer | null>,
  issEntityRef: React.MutableRefObject<Cesium.Entity | null>,
  currentViewMode: ModelViewMode,
  setCurrentViewMode: React.Dispatch<React.SetStateAction<ModelViewMode>>,
  zoomLevel: number,
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>,
  trackingEnabled: boolean,
  setTrackingEnabled: React.Dispatch<React.SetStateAction<boolean>>
) {
  // 뷰 모드별 설정 적용
  const configureViewSettings = useCallback(
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
  const handleViewModeChange = useCallback(
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
              // 하단 뷰 각도 조정
              headingRadians = Cesium.Math.toRadians(0);
              pitchRadians = Cesium.Math.toRadians(90);
              // 하단 뷰에서만 더 가까운 줌 레벨 적용
              currentZoomLevel = zoomLevel * 0.7;
              break;
            // 기본 뷰 (default)를 등각뷰로 사용
            case "default":
            default:
              // 등각뷰 (isometric view) 설정
              headingRadians = Cesium.Math.toRadians(45);
              pitchRadians = Cesium.Math.toRadians(-30);
              break;
          }

          // 추적 활성화
          setTrackingEnabled(true);

          // 카메라 오프셋 계산 - 뷰 모드별 줌 레벨 적용
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
    [zoomLevel, trackingEnabled, issEntityRef, cesiumViewer, configureViewSettings, setCurrentViewMode, setTrackingEnabled]
  );

  // 카메라 위치 업데이트 함수
  const updateCameraPosition = useCallback(() => {
    if (!cesiumViewer.current || !issEntityRef.current || !trackingEnabled) return;

    // 현재 선택된 뷰 모드에 따라 카메라 위치 다시 계산
    handleViewModeChange(currentViewMode);
  }, [currentViewMode, trackingEnabled, handleViewModeChange, cesiumViewer, issEntityRef]);

  // 줌 레벨 변경 핸들러
  const handleZoomChange = useCallback(
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
    [currentViewMode, trackingEnabled, handleViewModeChange, cesiumViewer, issEntityRef, setZoomLevel]
  );

  return {
    configureViewSettings,
    handleViewModeChange,
    updateCameraPosition,
    handleZoomChange,
  };
}
