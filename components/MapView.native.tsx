import React from 'react';
import RNMapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { StyleSheet } from 'react-native';
import { DEFAULT_REGION } from '@/constants/config';
import { Colors } from '@/constants/theme';

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

export default function MapViewComponent({
  region,
  markers = [],
  routeCoords,
  onPress,
  onMarkerPress,
  style,
  children,
}: Props) {
  const mapRegion = region ? {
    ...region,
    latitudeDelta: region.latitudeDelta || 0.05,
    longitudeDelta: region.longitudeDelta || 0.05,
  } : DEFAULT_REGION;

  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0A0A1A' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6EE7B7' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A1A' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  ];

  return (
    <RNMapView
      style={[styles.map, style]}
      initialRegion={mapRegion}
      region={mapRegion}
      onPress={onPress}
      mapType="standard"
      customMapStyle={darkMapStyle}
    >
      <UrlTile
        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
      />
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={m.title}
          description={m.description}
          pinColor={m.pinColor}
          onPress={() => onMarkerPress?.(m.id)}
        />
      ))}
      {routeCoords && routeCoords.length > 1 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor={Colors.primary}
          strokeWidth={4}
        />
      )}
      {children}
    </RNMapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%' },
});
