declare module 'react-simple-maps' {
  import type { CSSProperties, ReactNode } from 'react'

  export interface ProjectionConfig {
    center?: [number, number]
    scale?: number
    rotate?: [number, number, number]
    parallels?: [number, number]
  }

  export interface ComposableMapProps {
    projection?: string
    projectionConfig?: ProjectionConfig
    style?: CSSProperties
    viewBox?: string
    width?: number
    height?: number
    children?: ReactNode
  }

  export interface GeographiesProps {
    geography: string | object
    children: (args: { geographies: Geography[] }) => ReactNode
  }

  export interface Geography {
    rsmKey: string
    properties: Record<string, unknown>
    geometry: object
  }

  export interface GeographyProps {
    key?: string
    geography: Geography
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: CSSProperties
      hover?: CSSProperties
      pressed?: CSSProperties
    }
  }

  export interface MarkerProps {
    coordinates: [number, number]
    children?: ReactNode
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
  export function Marker(props: MarkerProps): JSX.Element
}
