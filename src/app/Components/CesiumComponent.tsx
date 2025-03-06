"use client";

import * as Cesium from "cesium";
import { Cesium3DTileset, Entity, Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import React from "react";

// 타입 임포트
import { CesiumComponentProps, ModelViewConfig, ModelViewMode, RotationState, ViewerRefs } from "./types/CesiumTypes";

// 유틸리티 함수 임포트
import { cleanUpPrimitives, flyToISS, resetCamera } from "./utils/CesiumUtils";
import { drawISSOrbit } from "./utils/ISSUtils";
import { applyModelView, highlightModel, setWireframeMode, toggleBoundingBox } from "./utils/ModelViewUtils";

// 컨트롤 컴포넌트 임포트
import ModelOptionsPanel from "./controls/ModelOptionsPanel";
import MultiViewController from "./controls/MultiViewController";
import RotationControl from "./controls/RotationControl";

export const CesiumComponent = ({ CesiumJs, positions, issPositions }: CesiumComponentProps) => {
  if (!CesiumJs) return null;

  // 일반 상수 (useState 대신 직접 선언)
  const SHOW_TRAJECTORY = false;

  // 뷰어 관련 참조
  const cesiumViewer = React.useRef<Viewer | null>(null);
  const cesiumContainerRef = React.useRef<HTMLDivElement>(null);
  const addedScenePrimitives = React.useRef<Cesium3DTileset[]>([]);
  const issEntityRef = React.useRef<Entity | null>(null);
  const initialFlyToCompleted = React.useRef<boolean>(false); // ISS로 초기 이동 완료 여부를 추적하는 플래그

  // 상태 관리
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [rotation, setRotation] = React.useState<RotationState>({ yaw: 0, pitch: 0, roll: 0 });
  const [animating, setAnimating] = React.useState(true);
  const [animationSpeed, setAnimationSpeed] = React.useState(10);
  const [currentViewMode, setCurrentViewMode] = React.useState<ModelViewMode>("default");
  const [zoomLevel, setZoomLevel] = React.useState<number>(1000000);
  const [showWireframe, setShowWireframe] = React.useState<boolean>(false);
  const [showBoundingBox, setShowBoundingBox] = React.useState<boolean>(false);
  const [showHighlight, setShowHighlight] = React.useState<boolean>(false);
  const [trackingEnabled, setTrackingEnabled] = React.useState<boolean>(true);

  // 뷰어 참조 객체
  const viewerRefs: ViewerRefs = {
    cesiumViewer,
    cesiumContainerRef,
    addedScenePrimitives,
    issEntityRef,
  };

  const initializeCesiumJs = React.useCallback(async () => {
    if (cesiumViewer.current !== null) {
      // OSM Buildings는 3D 모드에서만 추가
      if (cesiumViewer.current.scene.mode === Cesium.SceneMode.SCENE3D) {
        const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();

        //Clean up potentially already-existing primitives.
        cleanUpPrimitives(viewerRefs);

        //Adding tile and adding to addedScenePrimitives to keep track and delete in-case of a re-render.
        const osmBuildingsTilesetPrimitive = cesiumViewer.current.scene.primitives.add(osmBuildingsTileset);
        addedScenePrimitives.current.push(osmBuildingsTilesetPrimitive);
      }

      //Position camera per Sandcastle demo
      resetCamera(cesiumViewer.current);

      // 모드 변경 이벤트 리스너 추가
      cesiumViewer.current.scene.morphComplete.addEventListener(() => {
        const is3D = cesiumViewer.current?.scene.mode === Cesium.SceneMode.SCENE3D;

        // 2D 모드로 전환시 buildings 제거
        if (!is3D) {
          cleanUpPrimitives(viewerRefs);
        } else {
          // 3D 모드로 전환시 buildings 다시 추가
          Cesium.createOsmBuildingsAsync().then((osmBuildingsTileset) => {
            if (cesiumViewer.current) {
              const osmBuildingsTilesetPrimitive = cesiumViewer.current.scene.primitives.add(osmBuildingsTileset);
              addedScenePrimitives.current.push(osmBuildingsTilesetPrimitive);
            }
          });
        }
      });

      //We'll also add our own data here passed down from props as an example
      positions.forEach((p) => {
        cesiumViewer.current?.entities.add({
          position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
          ellipse: {
            semiMinorAxis: 50000.0,
            semiMajorAxis: 50000.0,
            height: 0,
            material: Cesium.Color.RED.withAlpha(0.5),
            outline: true,
            outlineColor: Cesium.Color.BLACK,
          },
        });
      });

      setIsLoaded(true);
    }
  }, [positions, viewerRefs]);

  // 회전 적용 함수 (위치 유지를 위한 별도 함수)
  const applyRotation = React.useCallback((newRotation: RotationState) => {
    // 현재 시간 저장
    if (cesiumViewer.current) {
      const currentTime = cesiumViewer.current.clock.currentTime;
      const currentPosition = issEntityRef.current?.position?.getValue(currentTime);

      // 회전 상태 업데이트
      setRotation(newRotation);

      // 시간을 유지하여 위치 초기화 방지
      // 약간의 지연을 통해 시간 설정이 안정적으로 적용되도록 함
      setTimeout(() => {
        if (cesiumViewer.current && Cesium.JulianDate.lessThan(currentTime, cesiumViewer.current.clock.stopTime)) {
          // 현재 시간 유지
          cesiumViewer.current.clock.currentTime = currentTime;

          // 회전 후 위치가 변경되지 않도록 강제 렌더링
          cesiumViewer.current.scene.requestRender();
        }
      }, 50); // 지연 시간 증가
    } else {
      setRotation(newRotation);
    }
  }, []);

  // Yaw 컨트롤 핸들러
  const handleYawChange = (delta: number) => {
    applyRotation({
      ...rotation,
      yaw: rotation.yaw + delta,
    });
  };

  // Pitch 컨트롤 핸들러
  const handlePitchChange = (delta: number) => {
    applyRotation({
      ...rotation,
      pitch: rotation.pitch + delta,
    });
  };

  // Roll 컨트롤 핸들러
  const handleRollChange = (delta: number) => {
    applyRotation({
      ...rotation,
      roll: rotation.roll + delta,
    });
  };

  // 회전 초기화 핸들러
  const handleRotationReset = () => {
    setRotation({ yaw: 0, pitch: 0, roll: 0 });
  };

  // 하단 뷰 관련 추가 기능 - 조명 및 렌더링 설정
  const configureViewSettings = React.useCallback((mode: ModelViewMode) => {
    if (!cesiumViewer.current) return;

    // 모든 뷰에 대한 기본 설정
    cesiumViewer.current.scene.globe.enableLighting = true;

    // 하단 뷰에 대한 특별한 설정
    if (mode === "bottom") {
      // 렌더링 품질 향상
      cesiumViewer.current.scene.postProcessStages.fxaa.enabled = true; // 안티앨리어싱 활성화

      // 깊이 테스트 비활성화로 모델이 더 잘 보이게 함
      cesiumViewer.current.scene.globe.depthTestAgainstTerrain = false;

      // 모델을 강조하기 위한 설정
      if (cesiumViewer.current.scene.primitives && issEntityRef.current) {
        // 씬의 다른 요소들의 밝기를 줄임
        cesiumViewer.current.scene.globe.translucency.enabled = true;
        cesiumViewer.current.scene.globe.translucency.frontFaceAlpha = 0.5;
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
            intensity: 3.0, // 더 밝게
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
  }, []);

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
          // ISS 모델의 위치와 방향에 따른 변환 행렬 계산
          const modelMatrix = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromQuaternion(issOrientation), issPosition);

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
              pitchRadians = Cesium.Math.toRadians(60); // 60도로 수정 (더 기울어진 각도)
              // 하단 뷰에서만 더 가까운 줌 레벨 적용 (기본 값의 약 50%)
              currentZoomLevel = zoomLevel * 0.5;
              break;
            case "default":
            default:
              headingRadians = Cesium.Math.toRadians(45);
              pitchRadians = Cesium.Math.toRadians(-30);
              break;
          }

          // 추적 활성화
          setTrackingEnabled(true);

          // ISS 모델에 대한 변환 행렬 생성 및 저장
          const viewMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(issPosition);

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
              // 모델 좌표계 기준 변환 행렬 계산
              const modelMatrix = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromQuaternion(orientation), position);

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
    [zoomLevel, trackingEnabled]
  );

  // 카메라 위치 업데이트 함수 추가
  const updateCameraPosition = React.useCallback(() => {
    if (!cesiumViewer.current || !issEntityRef.current || !trackingEnabled) return;

    // 현재 선택된 뷰 모드에 따라 카메라 위치 다시 계산
    handleViewModeChange(currentViewMode);
  }, [currentViewMode, trackingEnabled, handleViewModeChange]);

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
    [currentViewMode, trackingEnabled, handleViewModeChange]
  );

  React.useEffect(() => {
    if (cesiumViewer.current === null && cesiumContainerRef.current) {
      Cesium.Ion.defaultAccessToken = `${process.env.NEXT_PUBLIC_CESIUM_TOKEN}`;

      cesiumViewer.current = new Cesium.Viewer(cesiumContainerRef.current, {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        baseLayerPicker: false, // 레이어 변경 버튼 제거
        navigationHelpButton: false,
        homeButton: false, // 홈 버튼 제거
        geocoder: false, // 지명 검색 기능 제거
        animation: false,
        timeline: false,
        shadows: false,
        terrainShadows: Cesium.ShadowMode.ENABLED,
        sceneMode: Cesium.SceneMode.SCENE3D, // 초기 모드를 3D로 설정
        sceneModePicker: false, // 2D/3D 변경 버튼 제거
        creditContainer: document.createElement("div"), // 빈 div 요소 사용
        orderIndependentTranslucency: true,
        fullscreenButton: false,
        infoBox: false,
        shouldAnimate: true,
        selectionIndicator: false,
      });

      // 크레딧 표시 완전히 비활성화 (여러 방법 적용)
      if (cesiumViewer.current.cesiumWidget.creditContainer) {
        // 1. 크레딧 컨테이너 스타일 숨김
        (cesiumViewer.current.cesiumWidget.creditContainer as HTMLElement).style.display = "none";

        // 2. 크레딧 컨테이너 요소 제거 시도
        try {
          const creditContainer = cesiumViewer.current.cesiumWidget.creditContainer;
          if (creditContainer.parentNode) {
            creditContainer.parentNode.removeChild(creditContainer);
          }
        } catch (e) {
          console.log("크레딧 컨테이너 제거 중 오류 발생", e);
        }
      }

      // 3. 크레딧 표시 관련 설정 변경 (타입 안전한 방법)
      try {
        // @ts-ignore - Cesium 내부 API에 접근
        if (cesiumViewer.current._creditContainer) {
          // @ts-ignore
          cesiumViewer.current._creditContainer.style.display = "none";
        }

        // @ts-ignore - Cesium 내부 API에 접근
        if (cesiumViewer.current.creditDisplay) {
          // creditDisplay를 파괴하지 않고 속성만 수정
          // @ts-ignore
          if (cesiumViewer.current.creditDisplay.container) {
            // @ts-ignore
            cesiumViewer.current.creditDisplay.container.style.display = "none";
          }
          // @ts-ignore
          if (cesiumViewer.current.creditDisplay._creditContainer) {
            // @ts-ignore
            cesiumViewer.current.creditDisplay._creditContainer.style.display = "none";
          }
          // @ts-ignore
          cesiumViewer.current.creditDisplay._creditsToDisplay = {};
          // @ts-ignore
          cesiumViewer.current.creditDisplay._defaultCredit = undefined;
        }

        // 추가: 크레딧 표시 비활성화 (Cesium 1.83 이상)
        // @ts-ignore
        if (cesiumViewer.current._cesiumWidget && cesiumViewer.current._cesiumWidget.creditDisplay) {
          // @ts-ignore
          cesiumViewer.current._cesiumWidget.creditDisplay.container.style.display = "none";
          // @ts-ignore
          cesiumViewer.current._cesiumWidget.creditDisplay._creditsToDisplay = {};
        }
      } catch (e) {
        console.log("크레딧 표시 비활성화 중 오류 발생", e);
      }

      // 4. CSS로 크레딧 관련 요소 숨김 (더 강력한 선택자 사용)
      const style = document.createElement("style");
      style.innerHTML = `
        .cesium-credit-container, .cesium-credit-expand-link, .cesium-credit-text, 
        .cesium-widget-credits, .cesium-credit-imageContainer, .cesium-credit-lightbox,
        .cesium-credit-lightbox-overlay, .cesium-credit-lightbox-title, .cesium-credit-lightbox-content,
        .cesium-credit-lightbox-description, .cesium-credit-lightbox-close,
        [class*="cesium-credit"], [id*="cesium-credit"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          width: 0 !important;
          pointer-events: none !important;
          position: absolute !important;
          overflow: hidden !important;
          z-index: -9999 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          max-height: 0 !important;
          max-width: 0 !important;
          clip: rect(0, 0, 0, 0) !important;
          clip-path: inset(50%) !important;
        }
        
        /* Cesium ion 로고 및 워터마크 제거 */
        .cesium-viewer-bottom, .cesium-viewer-bottom *, 
        .cesium-viewer-cesiumInspectorContainer, .cesium-viewer-cesium3DTilesInspectorContainer,
        [class*="cesium-viewer-bottom"], [id*="cesium-viewer-bottom"],
        .cesium-widget-credits, .cesium-widget-credits *,
        [class*="cesium-widget-credits"], [id*="cesium-widget-credits"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `;
      document.head.appendChild(style);

      // 5. 하단 컨테이너 직접 제거
      setTimeout(() => {
        try {
          // 모든 가능한 크레딧 관련 요소 선택
          const bottomElements = document.querySelectorAll(".cesium-viewer-bottom");
          bottomElements.forEach((element) => {
            // 요소를 제거하는 대신 스타일만 변경
            (element as HTMLElement).style.display = "none";
            (element as HTMLElement).style.visibility = "hidden";
            (element as HTMLElement).style.opacity = "0";
            (element as HTMLElement).style.height = "0";
            (element as HTMLElement).style.overflow = "hidden";
          });

          // 크레딧 컨테이너 선택
          const creditElements = document.querySelectorAll(".cesium-credit-container, .cesium-widget-credits");
          creditElements.forEach((element) => {
            // 요소를 제거하는 대신 스타일만 변경
            (element as HTMLElement).style.display = "none";
            (element as HTMLElement).style.visibility = "hidden";
            (element as HTMLElement).style.opacity = "0";
            (element as HTMLElement).style.height = "0";
            (element as HTMLElement).style.overflow = "hidden";
          });
        } catch (e) {
          console.log("하단 컨테이너 스타일 변경 중 오류 발생", e);
        }
      }, 500); // 0.5초 후 실행 (DOM이 완전히 로드된 후)

      // 시계 설정 - ISS 움직임을 위한 설정
      cesiumViewer.current.clock.shouldAnimate = true;
      cesiumViewer.current.clock.multiplier = animationSpeed;
      cesiumViewer.current.scene.requestRender();

      // 클록 틱 이벤트 리스너 추가
      cesiumViewer.current.clock.onTick.addEventListener(() => {
        if (animating) {
          cesiumViewer.current?.scene.requestRender();
        }
      });

      // 모델 로드 준비 완료 로그
      console.log("Cesium 초기화 완료, 모델을 표시할 준비가 되었습니다.");

      // 모드 변경 시 카메라 재설정
      cesiumViewer.current.scene.morphComplete.addEventListener(() => {
        resetCamera(cesiumViewer.current);
      });

      cesiumViewer.current.scene.globe.enableLighting = true;
      cesiumViewer.current.scene.globe.shadows = Cesium.ShadowMode.ENABLED;

      cesiumViewer.current.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isLoaded) return;
    initializeCesiumJs();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, isLoaded]);

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
  }, [isLoaded, issPositions, rotation, animationSpeed]);

  // 애니메이션 속도 변경 시 시계 업데이트
  React.useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.multiplier = animationSpeed;
    }
  }, [animationSpeed]);

  // animating 상태 변경 시 시계 설정 업데이트
  React.useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.shouldAnimate = animating;
      cesiumViewer.current.scene.requestRender();
    }
  }, [animating]);

  // 뷰 모드 변경 시 효과
  React.useEffect(() => {
    if (isLoaded && currentViewMode !== "default") {
      // 모드가 변경되면 해당 뷰를 적용
      handleViewModeChange(currentViewMode);
    }
  }, [isLoaded, currentViewMode, handleViewModeChange]);

  // 와이어프레임, 바운딩 박스, 하이라이트 설정 변경 시 효과
  React.useEffect(() => {
    if (isLoaded && issEntityRef.current) {
      // 설정 적용
      setWireframeMode(cesiumViewer.current, showWireframe);
      toggleBoundingBox(cesiumViewer.current, issEntityRef.current.id, showBoundingBox);
      highlightModel(cesiumViewer.current, issEntityRef.current.id, showHighlight);
    }
  }, [isLoaded, showWireframe, showBoundingBox, showHighlight]);

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
  }, [animationSpeed, animating, trackingEnabled, updateCameraPosition]);

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
  }, [trackingEnabled, currentViewMode, handleViewModeChange]);

  return (
    <>
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
