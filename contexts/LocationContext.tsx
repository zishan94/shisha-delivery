import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Location from 'expo-location';

interface LocationContextType {
  location: { latitude: number; longitude: number } | null;
  errorMsg: string | null;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<{ latitude: number; longitude: number } | null>;
}

const LocationContext = createContext<LocationContextType>({} as LocationContextType);

export const useLocation = () => useContext(LocationContext);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const granted = await requestPermission();
      if (!granted) return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);
      return coords;
    } catch (e) {
      console.log('Location error:', e);
      // Fallback: Zurich
      const fallback = { latitude: 47.3769, longitude: 8.5417 };
      setLocation(fallback);
      return fallback;
    }
  };

  return (
    <LocationContext.Provider value={{ location, errorMsg, requestPermission, getCurrentLocation }}>
      {children}
    </LocationContext.Provider>
  );
}
