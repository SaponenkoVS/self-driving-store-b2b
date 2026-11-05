import { createHash } from "crypto"
import { existsSync, mkdirSync, writeFileSync } from "fs"
import path from "path"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import buildingImages from "./data/building-images.json"

export const CATALOG_IMAGE_DIR = path.join(process.cwd(), "static", "catalog")

export const localImageName = (url: string) => {
  const extension = path.extname(new URL(url).pathname).toLowerCase() || ".jpg"
  return `${createHash("sha1").update(url).digest("hex").slice(0, 16)}${extension}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function download(url: string, attempt = 1): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": "STRATA-demo-seed/1.0 (catalog image cache)" },
  })

  if (response.status === 429 && attempt <= 5) {
    await sleep(15_000 * attempt)
    return download(url, attempt + 1)
  }

  if (!response.ok) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `${response.status} for ${url}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

export default async function downloadBuildingImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  mkdirSync(CATALOG_IMAGE_DIR, { recursive: true })

  const urls = [
    ...new Set(
      Object.values(buildingImages as Record<string, { url: string }[]>).flatMap((images) =>
        images.map((image) => image.url)
      )
    ),
  ]

  let downloaded = 0
  let skipped = 0
  const failed: string[] = []

  for (const url of urls) {
    const target = path.join(CATALOG_IMAGE_DIR, localImageName(url))

    if (existsSync(target)) {
      skipped++
      continue
    }

    try {
      writeFileSync(target, await download(url))
      downloaded++
      logger.info(`Downloaded ${downloaded + skipped}/${urls.length}`)
    } catch (error) {
      failed.push(url)
      logger.warn((error as Error).message)
    }

    await sleep(1200)
  }

  logger.info(
    `Catalog images: ${downloaded} downloaded, ${skipped} already present, ${failed.length} failed. Folder: ${CATALOG_IMAGE_DIR}`
  )
}
