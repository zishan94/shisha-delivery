import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DEFAULT_REGION } from '@/constants/config';

interface Props {
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  markers?: {
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
    pinColor?: string;
  }[];
  routeCoords?: { latitude: number; longitude: number }[];
  onPress?: (e: any) => void;
  onMarkerPress?: (id: string) => void;
  style?: any;
  children?: React.ReactNode;
}

export default function MapViewComponent({ region, markers = [], style }: Props) {
  const lat = region?.latitude || DEFAULT_REGION.latitude;
  const lng = region?.longitude || DEFAULT_REGION.longitude;

  return (
    <View style={[styles.map, style]}>
      {/* @ts-ignore */}
      <iframe
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.015},${lng + 0.02},${lat + 0.015}&layer=mapnik&marker=${lat},${lng}`}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%', minHeight: 250 },
});
