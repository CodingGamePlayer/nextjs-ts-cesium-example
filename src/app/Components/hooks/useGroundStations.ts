"use client";

import * as Cesium from "cesium";
import { useCallback, useEffect, useRef, useState } from "react";
import { GroundStation, GroundStationVisibility } from "../types/GroundStationTypes";
import { groundStations } from "../data/groundStations";

export function useGroundStations(cesiumViewer: React.MutableRefObject<Cesium.Viewer | null>) {
  // 지상국 엔티티 참조 저장
  const groundStationEntities = useRef<{ [id: string]: Cesium.Entity }>({});

  // 지상국 가시성 상태
  const [stationVisibility, setStationVisibility] = useState<GroundStationVisibility>({});

  // 선택된 지상국
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  // 지상국 초기화
  useEffect(() => {
    if (!cesiumViewer.current) return;

    // 초기 가시성 상태 설정
    const initialVisibility: GroundStationVisibility = {};
    groundStations.forEach((station) => {
      initialVisibility[station.id || station.name] = true;
    });
    setStationVisibility(initialVisibility);

    // 지상국 엔티티 생성
    groundStations.forEach((station) => {
      createGroundStationEntity(station);
    });

    return () => {
      // 정리 함수: 모든 지상국 엔티티 제거
      Object.values(groundStationEntities.current).forEach((entity) => {
        if (cesiumViewer.current) {
          cesiumViewer.current.entities.remove(entity);
        }
      });
    };
  }, []);

  // 지상국 엔티티 생성 함수
  const createGroundStationEntity = useCallback((station: GroundStation) => {
    if (!cesiumViewer.current) return;

    const stationId = station.id || station.name;
    const stationColor = Cesium.Color.fromCssColorString(station.color || "#FF4500");

    // 지상국 위치 설정
    const position = Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, station.height);

    // 지상국 엔티티 생성 (통신 범위 없이)
    const stationEntity = cesiumViewer.current.entities.add({
      id: `groundStation-${stationId}`,
      name: station.name,
      position: position,
      billboard: {
        image: "/images/ground-station.png", // 지상국 아이콘 (필요시 생성)
        scale: 0.5,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
      label: {
        text: station.name,
        font: "14px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
      point: {
        pixelSize: 10,
        color: stationColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
    });

    // 엔티티 참조 저장 (통신 범위 엔티티 없음)
    groundStationEntities.current[stationId] = stationEntity;
  }, []);

  // 지상국 가시성 토글 함수
  const toggleStationVisibility = useCallback((stationId: string) => {
    setStationVisibility((prev) => {
      const newVisibility = { ...prev };
      newVisibility[stationId] = !prev[stationId];

      // 엔티티 가시성 업데이트 (통신 범위 엔티티 없음)
      if (groundStationEntities.current[stationId]) {
        groundStationEntities.current[stationId].show = newVisibility[stationId];
      }

      return newVisibility;
    });
  }, []);

  // 지상국으로 카메라 이동 함수
  const flyToGroundStation = useCallback((stationId: string) => {
    if (!cesiumViewer.current) return;

    const station = groundStations.find((s) => (s.id || s.name) === stationId);
    if (!station) return;

    // 선택된 지상국 설정
    setSelectedStation(stationId);

    // 지상국 위치로 카메라 이동
    cesiumViewer.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        station.longitude,
        station.latitude,
        station.height + 10000 // 지상국 위 10km 높이에서 바라봄
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45), // 45도 각도로 내려다봄
        roll: 0,
      },
      duration: 2, // 2초 동안 이동
    });
  }, []);

  return {
    groundStations,
    stationVisibility,
    selectedStation,
    toggleStationVisibility,
    flyToGroundStation,
    setSelectedStation,
  };
}
