'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import type { DGeoEntry } from '@/lib/dashboard-mock-data'

const STATE_COORDS: Record<string, [number, number]> = {
  SP: [-22.0, -48.5], RJ: [-22.9, -43.2], MG: [-18.5, -44.5],
  RS: [-30.0, -53.0], PR: [-25.3, -51.6], SC: [-27.5, -50.5],
  BA: [-12.5, -41.7], GO: [-15.9, -49.3], PE: [-8.8,  -37.3],
  DF: [-15.8, -47.9], CE: [-5.0,  -39.3], ES: [-19.6, -40.3],
  MA: [-5.4,  -45.3], PA: [-3.4,  -53.1], MT: [-12.6, -56.1],
  MS: [-20.5, -54.8], PB: [-7.2,  -36.8], RN: [-5.8,  -36.5],
  AL: [-9.7,  -36.6], PI: [-7.7,  -43.0], SE: [-10.6, -37.1],
  RO: [-10.9, -63.9], TO: [-10.2, -48.3], AC: [-9.0,  -70.8],
  AM: [-4.4,  -65.9], RR: [2.0,   -61.4], AP: [1.4,   -51.1],
}

const BRAND = '#3156FF'

interface Props {
  geoData: DGeoEntry[]
  maxCustomers: number
}

export default function BrazilMap({ geoData, maxCustomers }: Props) {
  return (
    <MapContainer
      center={[-15, -52]}
      zoom={4}
      style={{ height: '400px', width: '100%', borderRadius: '12px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {geoData.map(s => {
        const coords = STATE_COORDS[s.stateCode]
        if (!coords || s.customers === 0) return null
        const radius = Math.max(8, Math.min(28, 8 + (s.customers / maxCustomers) * 20))
        return (
          <CircleMarker
            key={s.stateCode}
            center={coords}
            radius={radius}
            pathOptions={{ color: BRAND, fillColor: BRAND, fillOpacity: 0.65, weight: 2 }}
          >
            <Tooltip direction="top">
              <strong>{s.stateCode}</strong>
              <br />
              {s.customers} cliente{s.customers !== 1 ? 's' : ''}
              <br />
              {s.orders} pedidos
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
