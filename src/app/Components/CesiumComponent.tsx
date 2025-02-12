"use client";

import React from "react";
import type { CesiumType } from "../types/cesium";
import { Cesium3DTileset, Entity, type Viewer } from "cesium";
import type { Position } from "../types/position";
import { dateToJulianDate } from "../example_utils/date";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { SatellitePosition } from "../utils/satellite";
import * as Cesium from "cesium";

interface CesiumComponentProps {
  CesiumJs?: CesiumType;
  positions: Position[];
  issPositions?: SatellitePosition[];
}

export const CesiumComponent = ({ CesiumJs, positions, issPositions }: CesiumComponentProps) => {
  if (!CesiumJs) return null;

  const cesiumViewer = React.useRef<Viewer | null>(null);
  const cesiumContainerRef = React.useRef<HTMLDivElement>(null);
  const addedScenePrimitives = React.useRef<Cesium3DTileset[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const resetCamera = React.useCallback(async () => {
    if (cesiumViewer.current !== null) {
      const is3D = cesiumViewer.current.scene.mode === Cesium.SceneMode.SCENE3D;

      if (is3D) {
        // 3D 모드: 지구본이 화면 중앙에 오도록 설정
        cesiumViewer.current.scene.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(128, 36, 25000000), // 한반도 쪽에서 지구를 바라보기
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        // 3D 모드의 카메라 제한 완화
        cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 1000; // 1km까지 줌인 가능
        cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
      } else {
        // 2D 모드: 전세계가 보이도록 설정
        cesiumViewer.current.scene.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 0, 40000000), // 적도 0도, 경도 0도 위치
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(0),
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
      if (cesiumViewer.current.scene.mode === Cesium.SceneMode.SCENE3D) {
        const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();

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
        const is3D = cesiumViewer.current?.scene.mode === Cesium.SceneMode.SCENE3D;

        // 2D 모드로 전환시 buildings 제거
        if (!is3D) {
          cleanUpPrimitives();
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
  }, [positions, cleanUpPrimitives]);

  const drawISSOrbit = React.useCallback(() => {
    if (!cesiumViewer.current || !issPositions?.length) return;

    const orbitPositions = issPositions.map((pos) => Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.height));

    cesiumViewer.current.entities.add({
      polyline: {
        positions: orbitPositions,
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.BLUE,
        }),
      },
    });

    // ISS 모델 추가
    const issEntity = cesiumViewer.current.entities.add({
      id: "ISS",
      position: orbitPositions[0],
      point: {
        pixelSize: 20,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: "ISS",
        font: "14pt sans-serif",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -9),
      },
    });

    // ISS 기준 XYZ 축 추가
    const axisScale = 100000; // 축 길이 (미터 단위)

    // X축 (빨간색)
    cesiumViewer.current.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
          const issPosition = issEntity.position?.getValue(time);
          if (!issPosition) return [orbitPositions[0], orbitPositions[0]];

          const transform = Cesium.Transforms.eastNorthUpToFixedFrame(issPosition);
          const endPoint = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(axisScale, 0, 0), new Cesium.Cartesian3());
          return [issPosition, endPoint];
        }, false),
        width: 2,
        material: Cesium.Color.RED,
      },
      position: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
        const issPosition = issEntity.position?.getValue(time);
        if (!issPosition) return orbitPositions[0];

        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(issPosition);
        const endPoint = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(axisScale, 0, 0), new Cesium.Cartesian3());
        return Cesium.Cartesian3.midpoint(issPosition, endPoint, new Cesium.Cartesian3());
      }, false) as any,
      label: {
        text: "X",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.RED,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        eyeOffset: new Cesium.Cartesian3(0, 0, -10000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      },
    });

    // Y축 (초록색)
    cesiumViewer.current.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
          const issPosition = issEntity.position?.getValue(time);
          if (!issPosition) return [orbitPositions[0], orbitPositions[0]];

          const transform = Cesium.Transforms.eastNorthUpToFixedFrame(issPosition);
          const endPoint = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(0, axisScale, 0), new Cesium.Cartesian3());
          return [issPosition, endPoint];
        }, false),
        width: 2,
        material: Cesium.Color.GREEN,
      },
      position: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
        const issPosition = issEntity.position?.getValue(time);
        if (!issPosition) return orbitPositions[0];

        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(issPosition);
        const endPoint = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(0, axisScale, 0), new Cesium.Cartesian3());
        return Cesium.Cartesian3.midpoint(issPosition, endPoint, new Cesium.Cartesian3());
      }, false) as any,
      label: {
        text: "Y",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.GREEN,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        eyeOffset: new Cesium.Cartesian3(0, 0, -10000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      },
    });

    // Z축 (파란색)
    cesiumViewer.current.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
          const issPosition = issEntity.position?.getValue(time);
          if (!issPosition) return [orbitPositions[0], orbitPositions[0]];

          const transform = Cesium.Transforms.eastNorthUpToFixedFrame(issPosition);
          const endPoint = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(0, 0, axisScale), new Cesium.Cartesian3());
          return [issPosition, endPoint];
        }, false),
        width: 2,
        material: Cesium.Color.BLUE,
      },
      position: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
        const issPosition = issEntity.position?.getValue(time);
        if (!issPosition) return orbitPositions[0];

        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(issPosition);
        const endPoint = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(0, 0, axisScale), new Cesium.Cartesian3());
        return Cesium.Cartesian3.midpoint(issPosition, endPoint, new Cesium.Cartesian3());
      }, false) as any,
      label: {
        text: "Z",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.BLUE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        eyeOffset: new Cesium.Cartesian3(0, 0, -10000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      },
    });
  }, [Cesium, issPositions]);

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
      });

      // 모드 변경 시 카메라 재설정
      cesiumViewer.current.scene.morphComplete.addEventListener(() => {
        resetCamera();
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
      drawISSOrbit();
    }
  }, [isLoaded, issPositions, drawISSOrbit]);

  //NOTE: Examples of typing... See above on "import type"
  const entities: Entity[] = [];
  //NOTE: Example of a function that utilizes CesiumJs features
  const julianDate = dateToJulianDate(Cesium, new Date());

  return <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />;
};

export default CesiumComponent;
