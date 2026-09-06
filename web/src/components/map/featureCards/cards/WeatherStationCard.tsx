/**
 * @file WeatherStationCard.tsx
 * @module engage-mt/map/featureCards
 * @description Tier-2 renderer for Living Atlas weather stations.
 *              Current temperature + wind + pressure + station metadata.
 * @author Jamie Ellis / Engage MT
 * @created 2026-05-29
 * @updated 2026-07-03
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import {
  DomainPill,
  HeroBlock,
  ListCard,
  MetricGrid,
} from "@/components/map/featureCards/core/cardPrimitives";
import { num, pick, str } from "@/components/map/featureCards/core/types";
import { registerFeature } from "@/components/map/featureCards/core/registry";
import type { FeatureRendererProps } from "@/components/map/featureCards/core/types";

const Body = ({ attrs }: FeatureRendererProps): JSX.Element => {
  const get = pick(attrs);
  const temp = num(get("temperature", "TEMP", "TEMP_F"));
  const wind = num(get("wind_speed", "WIND_SPEED", "WindSpeed"));
  const gust = num(get("wind_gust", "WIND_GUST"));
  const dir = str(get("wind_dir", "WIND_DIR"));
  const pressure = num(get("pressure", "PRESSURE"));
  const elevation = num(get("elevation", "ELEV"));
  const station = str(get("station_id", "STATION_ID"));

  return (
    <>
      {temp !== null ? (
        <HeroBlock caption="Air temperature" value={temp.toFixed(0)} unit="°F" domain="temp" live />
      ) : (
        <HeroBlock caption="Weather station" value="Reading pending" domain="temp" />
      )}
      <MetricGrid>
        {wind !== null && (
          <DomainPill
            label="Wind"
            value={`${wind.toFixed(0)} mph${dir ? ` ${dir}` : ""}`}
            domain="wind"
          />
        )}
        {gust !== null && (
          <DomainPill label="Gust" value={`${gust.toFixed(0)} mph`} domain="wind" />
        )}
        {pressure !== null && (
          <DomainPill label="Pressure" value={`${pressure.toFixed(2)} inHg`} domain="elev" />
        )}
      </MetricGrid>
      {(station || elevation !== null) && (
        <ListCard
          title="Station"
          rows={[
            ...(station ? [{ label: "Station id", value: station }] : []),
            ...(elevation !== null
              ? [{ label: "Elevation", value: `${elevation.toLocaleString()} ft` }]
              : []),
          ]}
        />
      )}
    </>
  );
};

registerFeature("weather-stations", {
  summary: (a) => String(a.NAME ?? a.station ?? a.STATION_ID ?? "Weather station"),
  subtitle: () => "Living Atlas weather station",
  Body,
});
