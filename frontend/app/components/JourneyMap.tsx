"use client";

import "leaflet/dist/leaflet.css";
import {
    MapContainer,
    TileLayer,
    Polyline,
    CircleMarker,
    Popup,
} from "react-leaflet";

type LatLng = [number, number];

interface JourneyMapProps {
    locationPoints: LatLng[];
}

export default function JourneyMap({ locationPoints }: JourneyMapProps) {
    if (locationPoints.length === 0) return null;

    return (
        <MapContainer
            center={locationPoints[0]}
            zoom={6}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
        >
            <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline positions={locationPoints} pathOptions={{ color: "#16a34a", weight: 3 }} />
            {locationPoints.map((point, idx) => (
                <CircleMarker
                    key={`point-${idx}`}
                    center={point}
                    radius={6}
                    pathOptions={{ color: idx === 0 ? "#16a34a" : "#2563eb" }}
                >
                    <Popup>
                        {idx === 0 ? "Farm" : `Checkpoint ${idx}`}
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
}
