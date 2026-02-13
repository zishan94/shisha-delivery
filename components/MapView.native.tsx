import React, { useRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
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
}: Props) {
  const lat = region?.latitude ?? DEFAULT_REGION.latitude;
  const lng = region?.longitude ?? DEFAULT_REGION.longitude;
  const zoom = region?.latitudeDelta ? Math.round(Math.log2(360 / (region.latitudeDelta || 0.05)) + 1) : 13;

  const markersJSON = JSON.stringify(markers);
  const routeJSON = JSON.stringify(routeCoords || []);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0}
    html,body,#map{width:100%;height:100%}
    .leaflet-control-attribution{font-size:8px!important;opacity:0.6}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map',{zoomControl:false}).setView([${lat},${lng}],${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© OSM',
      maxZoom:19
    }).addTo(map);

    var markers = ${markersJSON};
    markers.forEach(function(m){
      var icon = L.divIcon({
        html:'<div style="width:24px;height:24px;border-radius:50%;background:'+(m.pinColor||'${Colors.primary}')+';border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
        className:'',
        iconSize:[24,24],
        iconAnchor:[12,12]
      });
      var marker = L.marker([m.latitude,m.longitude],{icon:icon}).addTo(map);
      if(m.title) marker.bindPopup('<b>'+m.title+'</b>'+(m.description?'<br>'+m.description:''));
      marker.on('click',function(){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'markerPress',id:m.id}));
      });
    });

    var route = ${routeJSON};
    if(route.length>1){
      var latlngs = route.map(function(r){return[r.latitude,r.longitude]});
      L.polyline(latlngs,{color:'${Colors.primary}',weight:4,opacity:0.8}).addTo(map);
    }

    map.on('click',function(e){
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'mapPress',
        coordinate:{latitude:e.latlng.lat,longitude:e.latlng.lng}
      }));
    });
  </script>
</body>
</html>`;

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'mapPress' && onPress) {
        onPress({ nativeEvent: { coordinate: data.coordinate } });
      }
      if (data.type === 'markerPress' && onMarkerPress) {
        onMarkerPress(data.id);
      }
    } catch {}
  }, [onPress, onMarkerPress]);

  return (
    <View style={[styles.map, style]}>
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={handleMessage}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%', borderRadius: 12, overflow: 'hidden' },
});
