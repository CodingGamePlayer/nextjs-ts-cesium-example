"use client";

import React from "react";
import { GroundStation, GroundStationVisibility } from "../types/GroundStationTypes";

interface GroundStationPanelProps {
  groundStations: GroundStation[];
  stationVisibility: GroundStationVisibility;
  selectedStation: string | null;
  toggleStationVisibility: (stationId: string) => void;
  flyToGroundStation: (stationId: string) => void;
}

const GroundStationPanel: React.FC<GroundStationPanelProps> = ({
  groundStations,
  stationVisibility,
  selectedStation,
  toggleStationVisibility,
  flyToGroundStation,
}) => {
  return (
    <div className="absolute top-20 right-4 bg-gray-800 bg-opacity-80 rounded-lg p-4 text-white z-10 w-64 shadow-lg">
      <h3 className="text-lg font-bold mb-3 border-b border-gray-600 pb-2">지상국 관리</h3>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {groundStations.map((station) => {
          const stationId = station.id || station.name;
          const isVisible = stationVisibility[stationId];
          const isSelected = selectedStation === stationId;

          return (
            <div key={stationId} className={`flex items-center justify-between p-2 rounded ${isSelected ? "bg-blue-700" : "hover:bg-gray-700"}`}>
              <div className="flex items-center">
                <input type="checkbox" checked={isVisible} onChange={() => toggleStationVisibility(stationId)} className="mr-2" />
                <span>{station.name}</span>
              </div>

              <button onClick={() => flyToGroundStation(stationId)} className="px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-xs">
                보기
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-gray-300">
        <p>체크박스: 지상국 표시/숨김</p>
        <p>보기 버튼: 지상국으로 카메라 이동</p>
      </div>
    </div>
  );
};

export default GroundStationPanel;
