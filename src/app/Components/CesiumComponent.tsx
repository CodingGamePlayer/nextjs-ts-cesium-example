"use client";

import React from "react";
import type { CesiumType } from "../types/cesium";
import { Cesium3DTileset, type Entity, type Viewer } from "cesium";
import type { Position } from "../types/position";
//NOTE: It is important to assign types using "import type", not "import"
import { dateToJulianDate } from "../example_utils/date";
//NOTE: This is required to get the stylings for default Cesium UI and controls
import "cesium/Build/Cesium/Widgets/widgets.css";

export const CesiumComponent: React.FunctionComponent<{
  CesiumJs: CesiumType;
  positions: Position[];
}> = ({ CesiumJs, positions }) => {
  const cesiumViewer = React.useRef<Viewer | null>(null);
  const cesiumContainerRef = React.useRef<HTMLDivElement>(null);
  const addedScenePrimitives = React.useRef<Cesium3DTileset[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const resetCamera = React.useCallback(async () => {
    if (cesiumViewer.current !== null) {
      const is3D = cesiumViewer.current.scene.mode === CesiumJs.SceneMode.SCENE3D;

      if (is3D) {
        // 3D 모드: 지구본이 화면 중앙에 오도록 설정
        cesiumViewer.current.scene.camera.setView({
          destination: CesiumJs.Cartesian3.fromDegrees(128, 36, 25000000), // 한반도 쪽에서 지구를 바라보기
          orientation: {
            heading: CesiumJs.Math.toRadians(0),
            pitch: CesiumJs.Math.toRadians(-90), // 완전히 수직으로 내려다보기
            roll: 0,
          },
        });

        // 3D 모드의 카메라 제한
        cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 5000000; // 최소 줌 거리 증가
        cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
      } else {
        // 2D 모드: 전세계가 보이도록 설정
        cesiumViewer.current.scene.camera.setView({
          destination: CesiumJs.Cartesian3.fromDegrees(0, 0, 40000000), // 적도 0도, 경도 0도 위치
          orientation: {
            heading: CesiumJs.Math.toRadians(0),
            pitch: CesiumJs.Math.toRadians(0),
            roll: 0,
          },
        });

        // 2D 모드의 카메라 제한
        cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
        cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 50000000;
      }
    }
  }, []);

  const cleanUpPrimitives = React.useCallback(() => {
    //On NextJS 13.4+, React Strict Mode is on by default.
    //The block below will remove all added primitives from the scene.
    addedScenePrimitives.current.forEach((scenePrimitive) => {
      if (cesiumViewer.current !== null) {
        cesiumViewer.current.scene.primitives.remove(scenePrimitive);
      }
    });
    addedScenePrimitives.current = [];
  }, []);

  const initializeCesiumJs = React.useCallback(async () => {
    if (cesiumViewer.current !== null) {
      // OSM Buildings는 3D 모드에서만 추가
      if (cesiumViewer.current.scene.mode === CesiumJs.SceneMode.SCENE3D) {
        const osmBuildingsTileset = await CesiumJs.createOsmBuildingsAsync();

        //Clean up potentially already-existing primitives.
        cleanUpPrimitives();

        //Adding tile and adding to addedScenePrimitives to keep track and delete in-case of a re-render.
        const osmBuildingsTilesetPrimitive = cesiumViewer.current.scene.primitives.add(osmBuildingsTileset);
        addedScenePrimitives.current.push(osmBuildingsTilesetPrimitive);
      }

      //Position camera per Sandcastle demo
      resetCamera();

      // 모드 변경 이벤트 리스너 추가
      cesiumViewer.current.scene.morphComplete.addEventListener(() => {
        const is3D = cesiumViewer.current?.scene.mode === CesiumJs.SceneMode.SCENE3D;

        // 2D 모드로 전환시 buildings 제거
        if (!is3D) {
          cleanUpPrimitives();
        } else {
          // 3D 모드로 전환시 buildings 다시 추가
          CesiumJs.createOsmBuildingsAsync().then((osmBuildingsTileset) => {
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
          position: CesiumJs.Cartesian3.fromDegrees(p.lng, p.lat),
          ellipse: {
            semiMinorAxis: 50000.0,
            semiMajorAxis: 50000.0,
            height: 0,
            material: CesiumJs.Color.RED.withAlpha(0.5),
            outline: true,
            outlineColor: CesiumJs.Color.BLACK,
          },
        });
      });

      setIsLoaded(true);
    }
  }, [positions, cleanUpPrimitives]);

  React.useEffect(() => {
    if (cesiumViewer.current === null && cesiumContainerRef.current) {
      CesiumJs.Ion.defaultAccessToken = `${process.env.NEXT_PUBLIC_CESIUM_TOKEN}`;

      cesiumViewer.current = new CesiumJs.Viewer(cesiumContainerRef.current, {
        terrain: CesiumJs.Terrain.fromWorldTerrain(),
        baseLayerPicker: true,
        navigationHelpButton: false,
        homeButton: true,
        geocoder: true,
        animation: false,
        timeline: false,
        shadows: true,
        terrainShadows: CesiumJs.ShadowMode.ENABLED,
        sceneMode: CesiumJs.SceneMode.SCENE3D, // 초기 모드를 3D로 설정
        sceneModePicker: true, // 모드 변경 버튼 활성화
      });

      // 모드 변경 시 카메라 재설정
      cesiumViewer.current.scene.morphComplete.addEventListener(() => {
        resetCamera();
      });

      cesiumViewer.current.scene.globe.enableLighting = true;
      cesiumViewer.current.scene.globe.shadows = CesiumJs.ShadowMode.ENABLED;

      cesiumViewer.current.clock.clockStep = CesiumJs.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isLoaded) return;
    initializeCesiumJs();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, isLoaded]);

  //NOTE: Examples of typing... See above on "import type"
  const entities: Entity[] = [];
  //NOTE: Example of a function that utilizes CesiumJs features
  const julianDate = dateToJulianDate(CesiumJs, new Date());

  return <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />;
};

export default CesiumComponent;
