import { Metadata } from "next"

import credits from "@lib/data/image-credits.json"

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Sources and licenses of the photos used in this demo store.",
}

type Credit = { group: string; source: string; license: string; author: string }

const fileName = (source: string) =>
  decodeURIComponent(source.split("/File:")[1] ?? source).replace(/_/g, " ")

export default function PhotoCreditsPage() {
  const rows = credits as Credit[]

  return (
    <div className="content-container py-12 small:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink small:text-4xl">
        Photo credits
      </h1>
      <p className="mt-3 max-w-2xl text-ink-600">
        Product and page photos come from Wikimedia Commons and are used under the licenses below.
        Photos may have been cropped and resized. Brands shown in the store are fictional.
      </p>
      <div className="mt-8 overflow-x-auto rounded-large border border-concrete-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-concrete-50 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Photo</th>
              <th className="px-4 py-3 font-semibold">Author</th>
              <th className="px-4 py-3 font-semibold">License</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((credit) => (
              <tr key={credit.source} className="border-t border-concrete-100">
                <td className="px-4 py-3">
                  <a
                    href={credit.source}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline decoration-concrete-200 underline-offset-2 hover:decoration-brand"
                  >
                    {fileName(credit.source)}
                  </a>
                </td>
                <td className="px-4 py-3 text-ink-700">{credit.author}</td>
                <td className="px-4 py-3 text-ink-700">{credit.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
