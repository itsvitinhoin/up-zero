"use client"

import Image, { type ImageProps } from "next/image"
import { cfImageUrl, type CfImageOptions } from "@/lib/cf-image-url"

type CloudflareImageOptions = Omit<CfImageOptions, "width" | "height"> & {
  width?: number
  height?: number
}

type CloudflareImageProps = Omit<ImageProps, "src"> & {
  src: ImageProps["src"]
  cloudflare?: CloudflareImageOptions
}

export function CloudflareImage({ src, cloudflare, ...props }: CloudflareImageProps) {
  const resolvedSrc =
    typeof src === "string" && cloudflare
      ? cfImageUrl(src, cloudflare)
      : src

  const imageProps = props.fill
    ? props
    : {
        ...props,
        width: props.width ?? cloudflare?.width ?? 100,
        height: props.height ?? cloudflare?.height ?? 100,
      }

  return <Image src={resolvedSrc} {...imageProps} />
}
