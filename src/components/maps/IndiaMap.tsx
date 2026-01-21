import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useEffect, useState } from "react";

// High-quality India States TopoJSON (deldersveld/topojson via jsDelivr)
const INDIA_STATES_TOPOJSON =
  "https://cdn.jsdelivr.net/gh/deldersveld/topojson@master/countries/india/india-states.json";

interface IndiaMapProps {
  onStateClick?: (stateName: string) => void;
  highlightedState?: string;
}

const IndiaMap = ({ onStateClick, highlightedState }: IndiaMapProps) => {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [geo, setGeo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        const res = await fetch(INDIA_STATES_TOPOJSON);
        if (!res.ok) throw new Error(`Failed to fetch India map: ${res.status}`);
        const json = await res.json();
        if (!cancelled) setGeo(json);
      } catch (e) {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl overflow-hidden border border-border/50">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/50">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <p className="text-muted-foreground">Failed to load map. Please refresh.</p>
        </div>
      )}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          // tuned for India bounding box
          scale: 650,
          center: [82, 23],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} minZoom={0.7} maxZoom={6} center={[82, 23]}>
          {geo && (
            <Geographies geography={geo}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const stateName = geo.properties?.name || geo.properties?.NAME_1 || "Unknown";
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
          )}
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
