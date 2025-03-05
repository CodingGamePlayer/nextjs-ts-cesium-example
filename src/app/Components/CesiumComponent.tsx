"use client";

import React from "react";
import * as Cesium from "cesium";
import { Cesium3DTileset, Entity, Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { dateToJulianDate } from "../example_utils/date";

// 타입 임포트
import { CesiumComponentProps, RotationState, ViewerRefs } from "./types/CesiumTypes";

// 유틸리티 함수 임포트
import { resetCamera, cleanUpPrimitives, flyToISS, flyToKorea, flyToSunView } from "./utils/CesiumUtils";
import { drawISSOrbit } from "./utils/ISSUtils";

// 컨트롤 컴포넌트 임포트
import RotationControl from "./controls/RotationControl";
import NavigationButtons from "./controls/NavigationButtons";

export const CesiumComponent = ({ CesiumJs, positions, issPositions }: CesiumComponentProps) => {
  if (!CesiumJs) return null;

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

  React.useEffect(() => {
    if (cesiumViewer.current === null && cesiumContainerRef.current) {
      Cesium.Ion.defaultAccessToken = `${process.env.NEXT_PUBLIC_CESIUM_TOKEN}`;

      cesiumViewer.current = new Cesium.Viewer(cesiumContainerRef.current, {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        baseLayerPicker: true,
        navigationHelpButton: false,
        homeButton: true,
        geocoder: true,
        animation: false,
        timeline: false,
        shadows: true,
        terrainShadows: Cesium.ShadowMode.ENABLED,
        sceneMode: Cesium.SceneMode.SCENE3D, // 초기 모드를 3D로 설정
        sceneModePicker: true, // 모드 변경 버튼 활성화
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

  // 지상국 추가 useEffect
  // React.useEffect(() => {
  //   if (isLoaded) {
  //     addGroundStations(cesiumViewer.current, groundStations);
  //   }
  // }, [isLoaded, groundStations]);

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

  return (
    <>
      <NavigationButtons
        onFlyToISS={() => flyToISS(cesiumViewer.current, false)}
        onFlyToKorea={() => flyToKorea(cesiumViewer.current)}
        onFlyToSunView={() => flyToSunView(cesiumViewer.current)}
      />

      <RotationControl
        rotation={rotation}
        onYawChange={handleYawChange}
        onPitchChange={handlePitchChange}
        onRollChange={handleRollChange}
        onReset={handleRotationReset}
      />

      <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />
    </>
  );
};

export default CesiumComponent;
