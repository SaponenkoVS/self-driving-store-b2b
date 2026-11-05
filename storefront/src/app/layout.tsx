import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "STRATA Building Supply | Trade building materials",
    template: "%s | STRATA Building Supply",
  },
  description:
    "Building materials at trade prices for contractors and developers. Volume pricing, next-day delivery to site and invoice terms.",
}

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body className="font-sans antialiased bg-white text-ink">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
