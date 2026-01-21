import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { useState, useEffect, useRef } from "react";

const WORLD_GEO_URL = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

interface WorldMapProps {
  onCountryClick?: (countryName: string) => void;
  highlightedCountry?: string;
}

const WorldMap = ({ onCountryClick, highlightedCountry }: WorldMapProps) => {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const hasLoadedRef = useRef(false);

  const handleGeographiesLoaded = (geographies: any[]) => {
    if (geographies.length > 0 && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // Use setTimeout to avoid setState during render
      setTimeout(() => setIsLoading(false), 0);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[400px] bg-gradient-to-br from-accent/5 to-primary/5 rounded-xl overflow-hidden border border-border/50">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/50">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
          scale: 140,
          center: [0, 30],
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} minZoom={0.5} maxZoom={6}>
          <Geographies 
            geography={WORLD_GEO_URL}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          >
            {({ geographies }) => {
              handleGeographiesLoaded(geographies);
              return geographies.map((geo) => {
                const countryName = geo.properties.name;
                const isHighlighted = highlightedCountry === countryName;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHoveredCountry(countryName)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    onClick={() => onCountryClick?.(countryName)}
                    style={{
                      default: {
                        fill: isHighlighted
                          ? "hsl(var(--primary))"
                          : "hsl(var(--secondary))",
                        stroke: "hsl(var(--border))",
                        strokeWidth: 0.3,
                        outline: "none",
                        transition: "all 0.2s ease",
                      },
                      hover: {
                        fill: "hsl(var(--accent))",
                        stroke: "hsl(var(--primary))",
                        strokeWidth: 0.5,
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: {
                        fill: "hsl(var(--primary))",
                        stroke: "hsl(var(--primary))",
                        strokeWidth: 0.8,
                        outline: "none",
                      },
                    }}
                  />
                );
              });
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {hoveredCountry && (
        <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm px-4 py-2 rounded-lg border shadow-lg z-10">
          <p className="font-medium text-sm">{hoveredCountry}</p>
        </div>
      )}
    </div>
  );
};

export default WorldMap;
