import { OSRM_BASE, DELIVERY_BUFFER_MINUTES } from '@/constants/config';

interface RouteResult {
  coordinates: [number, number][];
  duration: number; // seconds
  distance: number; // meters
  legs: { duration: number; distance: number }[];
}

export function useOSRM() {
  const getRoute = async (
    waypoints: { latitude: number; longitude: number }[]
  ): Promise<RouteResult | null> => {
    if (waypoints.length < 2) return null;

    const coords = waypoints.map((w) => `${w.longitude},${w.latitude}`).join(';');
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=true`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes?.[0]) return null;

      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
        duration: route.duration,
        distance: route.distance,
        legs: route.legs.map((l: any) => ({ duration: l.duration, distance: l.distance })),
      };
    } catch (e) {
      console.error('OSRM error:', e);
      return null;
    }
  };

  const getETAs = (legs: { duration: number }[]): number[] => {
    const etas: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < legs.length; i++) {
      cumulative += legs[i].duration + DELIVERY_BUFFER_MINUTES * 60;
      etas.push(Math.ceil(cumulative / 60));
    }
    return etas;
  };

  return { getRoute, getETAs };
}
