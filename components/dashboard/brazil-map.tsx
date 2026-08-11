'use client'

import { useMemo, useState } from 'react'
import { CircleF, GoogleMap, InfoWindowF, useJsApiLoader } from '@react-google-maps/api'
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

interface MarkerEntry extends DGeoEntry {
  lat: number
  lng: number
}

const LAT_MIN = -34
const LAT_MAX = 6
const LON_MIN = -75
const LON_MAX = -33

const GOOGLE_MAPS_EMBED_SRC =
  'https://www.google.com/maps?q=Brazil&z=4&hl=pt-BR&output=embed'

const BRAZIL_CENTER = { lat: -14.235, lng: -51.9253 }

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
}

const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: 'greedy' as const,
  restriction: {
    latLngBounds: {
      north: 5.8,
      south: -34.5,
      west: -74.5,
      east: -33.0,
    },
    strictBounds: false,
  },
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#eef3ff' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4867ff' }, { weight: 1.6 }] },
    { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#97adff' }, { weight: 0.8 }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8f0ff' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }, { saturation: -40 }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c7dcff' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

function mercatorY(lat: number) {
  const clamped = Math.max(-85, Math.min(85, lat))
  const rad = (clamped * Math.PI) / 180
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2
}

const MERCATOR_Y_NORTH = mercatorY(LAT_MAX)
const MERCATOR_Y_SOUTH = mercatorY(LAT_MIN)

function toPercentPosition(lat: number, lon: number) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100
  const yMercator = mercatorY(lat)
  const y = ((yMercator - MERCATOR_Y_NORTH) / (MERCATOR_Y_SOUTH - MERCATOR_Y_NORTH)) * 100
  return {
    x: Math.max(2, Math.min(98, x)),
    y: Math.max(2, Math.min(98, y)),
  }
}

function markerRadiusMeters(customers: number, safeMax: number) {
  const normalized = Math.sqrt(customers / safeMax)
  return Math.max(14000, Math.min(110000, 14000 + normalized * 96000))
}

function BubbleOverlayFallback({ geoData, maxCustomers }: Props) {
  const safeMax = Math.max(1, maxCustomers)

  return (
    <>
      {geoData.map((s) => {
        const coords = STATE_COORDS[s.stateCode]
        if (!coords || s.customers <= 0) return null

        const [lat, lon] = coords
        const { x, y } = toPercentPosition(lat, lon)
        const normalized = Math.sqrt(s.customers / safeMax)
        const radius = Math.max(7, Math.min(24, 7 + normalized * 17))

        return (
          <button
            key={s.stateCode}
            type="button"
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-blue-600/70 shadow-sm outline-none ring-blue-500/40 transition-transform hover:scale-105 focus-visible:ring-2"
            style={{ left: `${x}%`, top: `${y}%`, width: radius * 2, height: radius * 2 }}
            title={`${s.stateCode}: ${s.customers} clientes, ${s.orders} pedidos`}
            aria-label={`${s.stateCode}: ${s.customers} clientes e ${s.orders} pedidos`}
          >
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-md group-hover:block">
              <strong>{s.stateCode}</strong> • {s.customers} cliente{s.customers !== 1 ? 's' : ''} • {s.orders} pedidos
            </span>
          </button>
        )
      })}
    </>
  )
}

function InteractiveGoogleMap({ markers, safeMax, selectedMarker, onSelect, onClose }: {
  markers: MarkerEntry[]
  safeMax: number
  selectedMarker: MarkerEntry | null
  onSelect: (stateCode: string) => void
  onClose: () => void
}) {
  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={BRAZIL_CENTER}
      zoom={4}
      options={MAP_OPTIONS}
    >
      {markers.map((marker) => (
        <CircleF
          key={marker.stateCode}
          center={{ lat: marker.lat, lng: marker.lng }}
          radius={markerRadiusMeters(marker.customers, safeMax)}
          options={{
            strokeColor: '#ffffff',
            strokeWeight: 2,
            fillColor: BRAND,
            fillOpacity: 0.55,
            clickable: true,
          }}
          onClick={() => onSelect(marker.stateCode)}
        />
      ))}

      {selectedMarker && (
        <InfoWindowF
          position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
          options={{ pixelOffset: new google.maps.Size(0, -8) }}
          onCloseClick={onClose}
        >
          <div className="min-w-40 pr-2 text-[12px] text-slate-800">
            <div className="font-semibold text-slate-900">{selectedMarker.stateCode}</div>
            <div>{selectedMarker.customers} cliente{selectedMarker.customers !== 1 ? 's' : ''}</div>
            <div>{selectedMarker.orders} pedido{selectedMarker.orders !== 1 ? 's' : ''}</div>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  )
}

export default function BrazilMap({ geoData, maxCustomers }: Props) {
  const safeMax = Math.max(1, maxCustomers)
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null)
  const googleMapsApiKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim()

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'dashboard-brazil-map',
    googleMapsApiKey: googleMapsApiKey || 'missing-key',
    language: 'pt-BR',
    region: 'BR',
    preventGoogleFontsLoading: true,
  })

  const markers = useMemo<MarkerEntry[]>(() => {
    return geoData
      .map((entry) => {
        const coords = STATE_COORDS[entry.stateCode]
        if (!coords || entry.customers <= 0) return null
        return {
          ...entry,
          lat: coords[0],
          lng: coords[1],
        }
      })
      .filter((entry): entry is MarkerEntry => entry !== null)
  }, [geoData])

  const selectedMarker = useMemo(() => {
    if (!selectedStateCode) return null
    return markers.find((marker) => marker.stateCode === selectedStateCode) ?? null
  }, [markers, selectedStateCode])

  const showInteractiveMap = googleMapsApiKey.length > 0 && isLoaded && !loadError
  const showFallbackReason = !googleMapsApiKey
    ? 'Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ativar o mapa interativo.'
    : loadError
      ? 'Falha ao carregar Google Maps. Exibindo fallback.'
      : !isLoaded
        ? 'Carregando Google Maps...'
        : ''

  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-xl border border-border/40 bg-gradient-to-b from-slate-50 to-white">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:14px_14px]" />
      <div className="absolute inset-5 overflow-hidden rounded-xl border border-slate-200/80 bg-white/25">
        {showInteractiveMap ? (
          <>
            <InteractiveGoogleMap
              markers={markers}
              safeMax={safeMax}
              selectedMarker={selectedMarker}
              onSelect={(stateCode) => setSelectedStateCode(stateCode)}
              onClose={() => setSelectedStateCode(null)}
            />
          </>
        ) : (
          <>
            <iframe
              title="Mapa do Brasil no Google Maps"
              src={GOOGLE_MAPS_EMBED_SRC}
              className="h-full w-full border-0 grayscale-[0.1]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="absolute inset-0 bg-white/10" />
          </>
        )}
      </div>

      {!showInteractiveMap && showFallbackReason && (
        <div className="absolute left-3 top-10 z-20 max-w-[80%] rounded-md bg-amber-50/95 px-2 py-1 text-[10px] font-medium text-amber-800 shadow-sm">
          {showFallbackReason}
        </div>
      )}

      <div className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
        {showInteractiveMap ? 'Google Maps interativo (Brasil)' : 'Google Maps (fallback)'}
      </div>

      {!showInteractiveMap && <BubbleOverlayFallback geoData={geoData} maxCustomers={maxCustomers} />}

      <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground">
        Escala por clientes
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-blue-600/70" />
        <span>Menor</span>
        <span className="inline-block h-4 w-4 rounded-full bg-blue-600/70" />
        <span>Maior</span>
      </div>
    </div>
  )
}
