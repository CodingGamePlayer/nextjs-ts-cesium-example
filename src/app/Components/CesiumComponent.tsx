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
  groundStations?: {
    name: string;
    latitude: number;
    longitude: number;
    height?: number;
    communicationRange?: number;
    coneAngle?: number;
  }[];
}

export const CesiumComponent = ({
  CesiumJs,
  positions,
  issPositions,
  groundStations = [
    {
      name: "대전 지상국",
      latitude: 36.3504,
      longitude: 127.3845,
      height: 100,
      communicationRange: 1000,
      coneAngle: 45,
    },
    {
      name: "제주 지상국",
      latitude: 33.4996,
      longitude: 126.5312,
      height: 100,
      communicationRange: 1000,
      coneAngle: 45,
    },
  ],
}: CesiumComponentProps) => {
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
        fillColor: Cesium.Color.YELLOW,
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
        fillColor: Cesium.Color.YELLOW,
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
        fillColor: Cesium.Color.YELLOW,
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

  // 지상국 및 통신 범위 추가 함수 수정
  const addGroundStations = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    groundStations.forEach((station) => {
      // 지상국 위치 계산 (고도 포함)
      const stationHeight = station.height || 0;
      const stationPosition = Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, stationHeight);

      // 지상국 위치 마커는 그대로 유지
      cesiumViewer.current?.entities.add({
        name: station.name,
        position: stationPosition,
        billboard: {
          image:
            "data:image/svg+xml;base64," +
            btoa(`
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="#3498db" stroke="white" stroke-width="2"/>
              <path d="M16 6 L16 26 M6 16 L26 16" stroke="white" stroke-width="2"/>
            </svg>
          `),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          scale: 1,
        },
        label: {
          text: station.name,
          font: "14px sans-serif",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
        },
      });

      // 통신 범위 원뿔 수정
      const coneAngle = Cesium.Math.toRadians(station.coneAngle || 45);
      const range = (station.communicationRange || 1000) * 500; // km를 m로 변환

      // 원뿔의 높이를 절반으로 하여 지표면에서 시작하도록 조정
      const coneHeight = range;
      const conePosition = Cesium.Cartesian3.fromDegrees(
        station.longitude,
        station.latitude,
        stationHeight + coneHeight / 2 // 원뿔의 중심을 높이의 절반만큼 올림
      );

      cesiumViewer.current?.entities.add({
        name: `${station.name} 통신범위`,
        position: conePosition,
        cylinder: {
          length: coneHeight,
          topRadius: range * Math.tan(coneAngle),
          bottomRadius: 0,
          material: Cesium.Color.BLUE.withAlpha(0.2),
          outline: true,
          outlineColor: Cesium.Color.BLUE.withAlpha(0.8),
          outlineWidth: 2,
        },
        orientation: Cesium.Transforms.headingPitchRollQuaternion(conePosition, new Cesium.HeadingPitchRoll(0, Cesium.Math.toRadians(0), 0)),
      });
    });
  }, [groundStations]);

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

  // 지상국 추가 useEffect
  React.useEffect(() => {
    if (isLoaded) {
      addGroundStations();
    }
  }, [isLoaded, addGroundStations]);

  //NOTE: Examples of typing... See above on "import type"
  const entities: Entity[] = [];
  //NOTE: Example of a function that utilizes CesiumJs features
  const julianDate = dateToJulianDate(Cesium, new Date());

  // 버튼 컨테이너 스타일 추가
  const buttonContainerStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    right: "20px",
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    zIndex: 1000,
  };

  // 공통 버튼 스타일 수정
  const buttonStyle: React.CSSProperties = {
    width: "40px",
    height: "40px",
    padding: "0",
    backgroundColor: "rgba(48, 48, 48, 0.8)",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // 카메라 이동 함수 추가
  const flyToISS = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    const issEntity = cesiumViewer.current.entities.getById("ISS");
    if (!issEntity) return;

    const position = issEntity.position?.getValue(cesiumViewer.current.clock.currentTime);
    if (!position) return;

    // 위성을 화면 중앙에 위치시키고 위에서 바라보기
    cesiumViewer.current.zoomTo(
      issEntity,
      new Cesium.HeadingPitchRange(
        0, // heading
        Cesium.Math.toRadians(-90), // pitch: 위에서 아래로 보기
        2000000 // 거리 (미터)
      )
    );
  }, [Cesium]);

  // 한반도로 이동하는 함수 수정
  const flyToKorea = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    // 한반도 중심점으로 이동
    cesiumViewer.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(128, 36, 10000000), // 고도를 더 높임
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90), // 완전히 수직으로 내려다보기
        roll: 0,
      },
      duration: 2,
    });

    // 카메라 제한 설정
    cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 3000000; // 최소 줌 거리 증가
    cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 20000000; // 최대 줌 거리 증가

    // 화면 중앙에 오도록 추가 설정
    cesiumViewer.current.scene.camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;
  }, [Cesium]);

  // 태양 기준 시점으로 이동하는 함수 추가
  const flyToSunView = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    const issEntity = cesiumViewer.current.entities.getById("ISS");
    if (!issEntity) return;

    const position = issEntity.position?.getValue(cesiumViewer.current.clock.currentTime);
    if (!position) return;

    // 현재 시간의 태양 위치 계산
    const sunPosition = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(cesiumViewer.current.clock.currentTime);

    cesiumViewer.current.camera.flyTo({
      destination: Cesium.Cartesian3.add(
        position,
        Cesium.Cartesian3.multiplyByScalar(Cesium.Cartesian3.normalize(sunPosition, new Cesium.Cartesian3()), 2000000, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      ),
      orientation: {
        direction: Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(position, sunPosition, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
        up: Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3()),
      },
      duration: 2,
    });
  }, [Cesium]);

  return (
    <>
      <div style={buttonContainerStyle}>
        <button onClick={flyToISS} style={buttonStyle} title="Go to ISS">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L9 4V7L6 9L3 9.5V12L6 14L9 16L12 19L15 16L18 14L21 12V9.5L18 9L15 7V4L12 2Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2" stroke="white" strokeWidth="1.5" />
          </svg>
        </button>
        <button onClick={flyToKorea} style={buttonStyle} title="Go to Korea">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              stroke="white"
              strokeWidth="1.5"
            />
            <path d="M2 12H22" stroke="white" strokeWidth="1.5" />
            <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22" stroke="white" strokeWidth="1.5" />
          </svg>
        </button>
        <button onClick={flyToSunView} style={buttonStyle} title="Sun View">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5" />
            <path
              d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />
    </>
  );
};

export default CesiumComponent;
