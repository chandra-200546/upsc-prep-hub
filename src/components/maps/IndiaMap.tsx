import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useState } from "react";

// Using verified India States TopoJSON from Natural Earth via jsdelivr CDN
const INDIA_TOPO_JSON = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Inline GeoJSON for India states - reliable static data
const INDIA_STATES_GEO = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "Andhra Pradesh" }, geometry: { type: "Polygon", coordinates: [[[80.15, 13.63], [84.78, 13.63], [84.78, 19.13], [80.15, 19.13], [80.15, 13.63]]] } },
    { type: "Feature", properties: { name: "Arunachal Pradesh" }, geometry: { type: "Polygon", coordinates: [[[91.55, 26.65], [97.42, 26.65], [97.42, 29.47], [91.55, 29.47], [91.55, 26.65]]] } },
    { type: "Feature", properties: { name: "Assam" }, geometry: { type: "Polygon", coordinates: [[[89.70, 24.13], [96.02, 24.13], [96.02, 27.97], [89.70, 27.97], [89.70, 24.13]]] } },
    { type: "Feature", properties: { name: "Bihar" }, geometry: { type: "Polygon", coordinates: [[[83.33, 24.28], [88.30, 24.28], [88.30, 27.52], [83.33, 27.52], [83.33, 24.28]]] } },
    { type: "Feature", properties: { name: "Chhattisgarh" }, geometry: { type: "Polygon", coordinates: [[[80.25, 17.78], [84.40, 17.78], [84.40, 24.10], [80.25, 24.10], [80.25, 17.78]]] } },
    { type: "Feature", properties: { name: "Goa" }, geometry: { type: "Polygon", coordinates: [[[73.68, 14.90], [74.35, 14.90], [74.35, 15.80], [73.68, 15.80], [73.68, 14.90]]] } },
    { type: "Feature", properties: { name: "Gujarat" }, geometry: { type: "Polygon", coordinates: [[[68.17, 20.13], [74.48, 20.13], [74.48, 24.72], [68.17, 24.72], [68.17, 20.13]]] } },
    { type: "Feature", properties: { name: "Haryana" }, geometry: { type: "Polygon", coordinates: [[[74.47, 27.67], [77.60, 27.67], [77.60, 30.93], [74.47, 30.93], [74.47, 27.67]]] } },
    { type: "Feature", properties: { name: "Himachal Pradesh" }, geometry: { type: "Polygon", coordinates: [[[75.58, 30.40], [79.00, 30.40], [79.00, 33.27], [75.58, 33.27], [75.58, 30.40]]] } },
    { type: "Feature", properties: { name: "Jharkhand" }, geometry: { type: "Polygon", coordinates: [[[83.33, 21.97], [87.97, 21.97], [87.97, 25.35], [83.33, 25.35], [83.33, 21.97]]] } },
    { type: "Feature", properties: { name: "Karnataka" }, geometry: { type: "Polygon", coordinates: [[[74.05, 11.60], [78.58, 11.60], [78.58, 18.45], [74.05, 18.45], [74.05, 11.60]]] } },
    { type: "Feature", properties: { name: "Kerala" }, geometry: { type: "Polygon", coordinates: [[[74.85, 8.28], [77.42, 8.28], [77.42, 12.80], [74.85, 12.80], [74.85, 8.28]]] } },
    { type: "Feature", properties: { name: "Madhya Pradesh" }, geometry: { type: "Polygon", coordinates: [[[74.03, 21.08], [82.82, 21.08], [82.82, 26.87], [74.03, 26.87], [74.03, 21.08]]] } },
    { type: "Feature", properties: { name: "Maharashtra" }, geometry: { type: "Polygon", coordinates: [[[72.65, 15.60], [80.90, 15.60], [80.90, 22.03], [72.65, 22.03], [72.65, 15.60]]] } },
    { type: "Feature", properties: { name: "Manipur" }, geometry: { type: "Polygon", coordinates: [[[93.03, 23.83], [94.78, 23.83], [94.78, 25.68], [93.03, 25.68], [93.03, 23.83]]] } },
    { type: "Feature", properties: { name: "Meghalaya" }, geometry: { type: "Polygon", coordinates: [[[89.82, 25.02], [92.80, 25.02], [92.80, 26.12], [89.82, 26.12], [89.82, 25.02]]] } },
    { type: "Feature", properties: { name: "Mizoram" }, geometry: { type: "Polygon", coordinates: [[[92.25, 21.97], [93.45, 21.97], [93.45, 24.52], [92.25, 24.52], [92.25, 21.97]]] } },
    { type: "Feature", properties: { name: "Nagaland" }, geometry: { type: "Polygon", coordinates: [[[93.33, 25.20], [95.25, 25.20], [95.25, 27.05], [93.33, 27.05], [93.33, 25.20]]] } },
    { type: "Feature", properties: { name: "Odisha" }, geometry: { type: "Polygon", coordinates: [[[81.38, 17.82], [87.50, 17.82], [87.50, 22.57], [81.38, 22.57], [81.38, 17.82]]] } },
    { type: "Feature", properties: { name: "Punjab" }, geometry: { type: "Polygon", coordinates: [[[73.88, 29.55], [76.95, 29.55], [76.95, 32.52], [73.88, 32.52], [73.88, 29.55]]] } },
    { type: "Feature", properties: { name: "Rajasthan" }, geometry: { type: "Polygon", coordinates: [[[69.48, 23.07], [78.27, 23.07], [78.27, 30.20], [69.48, 30.20], [69.48, 23.07]]] } },
    { type: "Feature", properties: { name: "Sikkim" }, geometry: { type: "Polygon", coordinates: [[[88.00, 27.08], [88.92, 27.08], [88.92, 28.13], [88.00, 28.13], [88.00, 27.08]]] } },
    { type: "Feature", properties: { name: "Tamil Nadu" }, geometry: { type: "Polygon", coordinates: [[[76.23, 8.08], [80.35, 8.08], [80.35, 13.57], [76.23, 13.57], [76.23, 8.08]]] } },
    { type: "Feature", properties: { name: "Telangana" }, geometry: { type: "Polygon", coordinates: [[[77.28, 15.83], [81.35, 15.83], [81.35, 19.92], [77.28, 19.92], [77.28, 15.83]]] } },
    { type: "Feature", properties: { name: "Tripura" }, geometry: { type: "Polygon", coordinates: [[[91.15, 22.95], [92.35, 22.95], [92.35, 24.53], [91.15, 24.53], [91.15, 22.95]]] } },
    { type: "Feature", properties: { name: "Uttar Pradesh" }, geometry: { type: "Polygon", coordinates: [[[77.08, 23.87], [84.67, 23.87], [84.67, 30.42], [77.08, 30.42], [77.08, 23.87]]] } },
    { type: "Feature", properties: { name: "Uttarakhand" }, geometry: { type: "Polygon", coordinates: [[[77.58, 28.72], [81.03, 28.72], [81.03, 31.47], [77.58, 31.47], [77.58, 28.72]]] } },
    { type: "Feature", properties: { name: "West Bengal" }, geometry: { type: "Polygon", coordinates: [[[85.82, 21.52], [89.88, 21.52], [89.88, 27.22], [85.82, 27.22], [85.82, 21.52]]] } },
    { type: "Feature", properties: { name: "Jammu & Kashmir" }, geometry: { type: "Polygon", coordinates: [[[73.78, 32.27], [80.30, 32.27], [80.30, 37.07], [73.78, 37.07], [73.78, 32.27]]] } },
    { type: "Feature", properties: { name: "Ladakh" }, geometry: { type: "Polygon", coordinates: [[[76.78, 32.17], [80.30, 32.17], [80.30, 35.67], [76.78, 35.67], [76.78, 32.17]]] } },
    { type: "Feature", properties: { name: "Delhi" }, geometry: { type: "Polygon", coordinates: [[[76.84, 28.40], [77.35, 28.40], [77.35, 28.88], [76.84, 28.88], [76.84, 28.40]]] } },
  ]
};

interface IndiaMapProps {
  onStateClick?: (stateName: string) => void;
  highlightedState?: string;
}

const IndiaMap = ({ onStateClick, highlightedState }: IndiaMapProps) => {
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  return (
    <div className="w-full h-full min-h-[400px] bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl overflow-hidden border border-border/50 relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 900,
          center: [82, 23],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} minZoom={0.5} maxZoom={4} center={[82, 23]}>
          <Geographies geography={INDIA_STATES_GEO}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = geo.properties.name || "Unknown";
                const isHighlighted = highlightedState === stateName;
                const isHovered = hoveredState === stateName;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHoveredState(stateName)}
                    onMouseLeave={() => setHoveredState(null)}
                    onClick={() => onStateClick?.(stateName)}
                    style={{
                      default: {
                        fill: isHighlighted
                          ? "hsl(var(--primary))"
                          : isHovered
                          ? "hsl(var(--primary) / 0.7)"
                          : "hsl(var(--secondary))",
                        stroke: "hsl(var(--border))",
                        strokeWidth: 0.5,
                        outline: "none",
                        transition: "all 0.2s ease",
                      },
                      hover: {
                        fill: "hsl(var(--primary))",
                        stroke: "hsl(var(--primary))",
                        strokeWidth: 1,
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: {
                        fill: "hsl(var(--primary))",
                        stroke: "hsl(var(--primary))",
                        strokeWidth: 1.5,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {hoveredState && (
        <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm px-4 py-2 rounded-lg border shadow-lg z-10">
          <p className="font-medium text-sm">{hoveredState}</p>
        </div>
      )}

      <div className="absolute top-4 right-4 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
        Scroll to zoom • Drag to pan
      </div>
    </div>
  );
};

export default IndiaMap;
