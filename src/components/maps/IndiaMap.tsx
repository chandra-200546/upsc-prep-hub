import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useState } from "react";

// Using a reliable TopoJSON source for India
const INDIA_TOPO_JSON = "https://cdn.jsdelivr.net/npm/india-topojson@1.0.0/india.json";

interface IndiaMapProps {
  onStateClick?: (stateName: string) => void;
  highlightedState?: string;
}

const IndiaMap = ({ onStateClick, highlightedState }: IndiaMapProps) => {
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  return (
    <div className="w-full h-full min-h-[400px] bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl overflow-hidden border border-border/50">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 1100,
          center: [83, 23],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
          <Geographies geography={INDIA_TOPO_JSON}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = geo.properties.st_nm || geo.properties.NAME_1 || geo.properties.name;
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
        <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm px-4 py-2 rounded-lg border shadow-lg">
          <p className="font-medium text-sm">{hoveredState}</p>
        </div>
      )}
    </div>
  );
};

export default IndiaMap;
