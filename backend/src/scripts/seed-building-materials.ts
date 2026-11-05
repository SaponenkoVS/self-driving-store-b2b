import {
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductTagsWorkflow,
  createProductsWorkflow,
  deleteCollectionsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductTagsWorkflow,
  deleteProductsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { existsSync } from "fs"
import path from "path"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import buildingImages from "./data/building-images.json"
import { CATALOG_IMAGE_DIR, localImageName } from "./download-building-images"
import {
  CATEGORY_TREE,
  COLLECTIONS,
  PRODUCTS,
  TAGS,
  type CatalogProduct,
  type CatalogVariant,
} from "./data/building-catalog"

const BATCH_SIZE = 10
const INGEST_CHUNK_SIZE = 25
const CURRENCY = "eur"

type ImageEntry = { url: string }

const BACKEND_URL = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")

const resolveImageUrl = (url: string) => {
  const name = localImageName(url)
  return existsSync(path.join(CATALOG_IMAGE_DIR, name)) ? `${BACKEND_URL}/static/catalog/${name}` : url
}

const imagePool = (key: string): string[] =>
  ((buildingImages as Record<string, ImageEntry[]>)[key] ?? []).map((image) => resolveImageUrl(image.url))

const round = (value: number) => Math.round(value * 100) / 100

const buildTiers = (variant: CatalogVariant, product: CatalogProduct) => {
  const tiers = variant.tiers ?? product.tiers ?? []
  const rows = [{ min_quantity: 1, max_quantity: tiers[0] ? tiers[0][0] - 1 : null, amount: variant.price }]

  tiers.forEach(([minQuantity, percent], index) => {
    const next = tiers[index + 1]
    rows.push({
      min_quantity: minQuantity,
      max_quantity: next ? next[0] - 1 : null,
      amount: round(variant.price * (1 - percent / 100)),
    })
  })

  return rows
}

const skuFor = (product: CatalogProduct, productIndex: number, variantIndex: number) =>
  `${product.brand.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}-${1001 + productIndex}-${String(variantIndex + 1).padStart(2, "0")}`

export default async function seedBuildingMaterials({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: salesChannels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  const { data: shippingProfiles } = await query.graph({ entity: "shipping_profile", fields: ["id"] })
  const { data: stockLocations } = await query.graph({ entity: "stock_location", fields: ["id", "name"] })

  const salesChannel = salesChannels[0]
  const shippingProfile = shippingProfiles[0]
  const stockLocation = stockLocations[0]

  if (!salesChannel || !shippingProfile || !stockLocation) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Missing sales channel, shipping profile or stock location. Run the migrations first."
    )
  }

  const catalogHandles = new Set(PRODUCTS.map((product) => product.handle))

  const { data: existingProducts } = await query.graph({ entity: "product", fields: ["id", "handle"] })
  const staleProducts = existingProducts.filter((product) => !catalogHandles.has(product.handle as string))

  for (let start = 0; start < staleProducts.length; start += 50) {
    await deleteProductsWorkflow(container).run({
      input: { ids: staleProducts.slice(start, start + 50).map((product) => product.id as string) },
    })
  }

  if (staleProducts.length) {
    logger.info(`Removed ${staleProducts.length} product(s) outside the building catalog`)
  }

  const catalogCategoryHandles = new Set(
    CATEGORY_TREE.flatMap((parent) => [parent.handle, ...parent.children.map((child) => child.handle)])
  )

  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "parent_category_id"],
  })
  const staleCategories = existingCategories.filter(
    (category) => !catalogCategoryHandles.has(category.handle as string)
  )
  const staleLeaves = staleCategories.filter((category) =>
    !existingCategories.some((other) => other.parent_category_id === category.id)
  )
  const staleParents = staleCategories.filter((category) => !staleLeaves.includes(category))

  for (const group of [staleLeaves, staleParents]) {
    if (group.length) {
      await deleteProductCategoriesWorkflow(container).run({
        input: group.map((category) => category.id as string),
      })
    }
  }

  if (staleCategories.length) {
    logger.info(`Removed ${staleCategories.length} category(ies) outside the building catalog`)
  }

  const catalogCollectionHandles = new Set(COLLECTIONS.map((collection) => collection.handle))
  const { data: existingCollections } = await query.graph({ entity: "product_collection", fields: ["id", "handle"] })
  const staleCollections = existingCollections.filter(
    (collection) => !catalogCollectionHandles.has(collection.handle as string)
  )

  if (staleCollections.length) {
    await deleteCollectionsWorkflow(container).run({
      input: { ids: staleCollections.map((collection) => collection.id as string) },
    })
    logger.info(`Removed ${staleCollections.length} collection(s)`)
  }

  const { data: existingTags } = await query.graph({ entity: "product_tag", fields: ["id", "value"] })
  const staleTags = existingTags.filter((tag) => !TAGS.includes(tag.value as string))

  if (staleTags.length) {
    await deleteProductTagsWorkflow(container).run({
      input: { ids: staleTags.map((tag) => tag.id as string) },
    })
    logger.info(`Removed ${staleTags.length} tag(s)`)
  }

  const categoryIds = new Map(
    existingCategories
      .filter((category) => catalogCategoryHandles.has(category.handle as string))
      .map((category) => [category.handle as string, category.id as string])
  )

  const missingParents = CATEGORY_TREE.filter((parent) => !categoryIds.has(parent.handle))

  if (missingParents.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingParents.map((parent, rank) => ({
          name: parent.name,
          handle: parent.handle,
          description: parent.description,
          is_active: true,
          rank,
          metadata: { image_url: imagePool(parent.image)[0] ?? null },
        })),
      },
    })
    result.forEach((category) => categoryIds.set(category.handle, category.id))
  }

  const missingChildren = CATEGORY_TREE.flatMap((parent) =>
    parent.children
      .filter((child) => !categoryIds.has(child.handle))
      .map((child, rank) => ({
        name: child.name,
        handle: child.handle,
        is_active: true,
        rank,
        parent_category_id: categoryIds.get(parent.handle),
      }))
  )

  if (missingChildren.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missingChildren },
    })
    result.forEach((category) => categoryIds.set(category.handle, category.id))
  }

  if (missingParents.length || missingChildren.length) {
    logger.info(`Created ${missingParents.length + missingChildren.length} categories`)
  }

  const collectionIds = new Map(
    existingCollections
      .filter((collection) => catalogCollectionHandles.has(collection.handle as string))
      .map((collection) => [collection.handle as string, collection.id as string])
  )
  const missingCollections = COLLECTIONS.filter((collection) => !collectionIds.has(collection.handle))

  if (missingCollections.length) {
    const { result } = await createCollectionsWorkflow(container).run({
      input: { collections: missingCollections },
    })
    result.forEach((collection) => collectionIds.set(collection.handle, collection.id))
    logger.info(`Created ${missingCollections.length} collection(s)`)
  }

  const tagIds = new Map(
    existingTags
      .filter((tag) => TAGS.includes(tag.value as string))
      .map((tag) => [tag.value as string, tag.id as string])
  )
  const missingTags = TAGS.filter((value) => !tagIds.has(value))

  if (missingTags.length) {
    const { result } = await createProductTagsWorkflow(container).run({
      input: { product_tags: missingTags.map((value) => ({ value })) },
    })
    result.forEach((tag) => tagIds.set(tag.value, tag.id))
    logger.info(`Created ${missingTags.length} tag(s)`)
  }

  const takenHandles = new Set(
    existingProducts
      .filter((product) => catalogHandles.has(product.handle as string))
      .map((product) => product.handle as string)
  )
  const imageCursor = new Map<string, number>()
  const stockBySku = new Map<string, number>()
  const imageUpdates: { handle: string; images: string[] }[] = []

  const products = PRODUCTS.flatMap((product, productIndex) => {
    const pool = imagePool(product.images)
    const cursor = imageCursor.get(product.images) ?? 0
    imageCursor.set(product.images, cursor + 1)
    const images = pool.length
      ? [...new Set([0, 1, 2].map((offset) => pool[(cursor + offset) % pool.length]))]
      : []

    product.variants.forEach((variant, variantIndex) => {
      stockBySku.set(skuFor(product, productIndex, variantIndex), variant.stock ?? 500)
    })

    if (takenHandles.has(product.handle)) {
      imageUpdates.push({ handle: product.handle, images })
      return []
    }

    const collectionHandle = product.collections?.[0]

    return [
      {
        title: product.title,
        handle: product.handle,
        subtitle: product.subtitle,
        description: product.description,
        status: ProductStatus.PUBLISHED,
        thumbnail: images[0],
        images: images.map((url) => ({ url })),
        weight: product.weight,
        origin_country: product.origin,
        discountable: true,
        shipping_profile_id: shippingProfile.id,
        collection_id: collectionHandle ? collectionIds.get(collectionHandle) : undefined,
        category_ids: [categoryIds.get(product.category)].filter(Boolean),
        tag_ids: (product.tags ?? []).map((tag) => tagIds.get(tag)).filter(Boolean),
        sales_channels: [{ id: salesChannel.id }],
        metadata: {
          brand: product.brand,
          unit: product.unit,
          specs: product.specs,
          lead_time: product.leadTime ?? null,
          collections: product.collections ?? [],
        },
        options: Object.entries(product.options).map(([title, values]) => ({ title, values })),
        variants: product.variants.map((variant, variantIndex) => {
          const tiers = buildTiers(variant, product)

          return {
            title: Object.values(variant.values).join(" / "),
            sku: skuFor(product, productIndex, variantIndex),
            options: variant.values,
            manage_inventory: true,
            allow_backorder: false,
            metadata: { price_tiers: tiers },
            prices: tiers.map((tier) => ({
              currency_code: CURRENCY,
              amount: tier.amount,
              ...(tier.min_quantity > 1 ? { min_quantity: tier.min_quantity } : {}),
              ...(tier.max_quantity ? { max_quantity: tier.max_quantity } : {}),
            })),
          }
        }),
      },
    ]
  })

  let created = 0

  for (let start = 0; start < products.length; start += BATCH_SIZE) {
    const batch = products.slice(start, start + BATCH_SIZE)

    await createProductsWorkflow(container).run({
      input: { products: batch as never },
    })

    created += batch.length
    logger.info(`Created ${created}/${products.length} building products`)
  }

  if (!products.length) {
    logger.info("Every building product already exists. Nothing to create.")
  }

  const { data: imageTargets } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "thumbnail"],
    filters: { handle: imageUpdates.map((update) => update.handle) },
  })
  const staleImages = imageUpdates.filter((update) => {
    const target = imageTargets.find((product) => product.handle === update.handle)
    return target && update.images.length && target.thumbnail !== update.images[0]
  })

  for (const update of staleImages) {
    const target = imageTargets.find((product) => product.handle === update.handle)!
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: target.id },
        update: { thumbnail: update.images[0], images: update.images.map((url) => ({ url })) },
      },
    })
  }

  if (staleImages.length) {
    logger.info(`Updated images for ${staleImages.length} existing product(s)`)
  }

  const { data: parentCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "metadata"],
    filters: { handle: CATEGORY_TREE.map((parent) => parent.handle) },
  })

  for (const category of parentCategories) {
    const parent = CATEGORY_TREE.find((entry) => entry.handle === category.handle)!
    const imageUrl = imagePool(parent.image)[0] ?? null
    const metadata = (category.metadata ?? {}) as Record<string, unknown>

    if (metadata.image_url !== imageUrl) {
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: category.id }, update: { metadata: { ...metadata, image_url: imageUrl } } },
      })
    }
  }

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "location_levels.location_id", "location_levels.stocked_quantity"],
    filters: { sku: [...stockBySku.keys()] } as never,
  })

  const toCreate: { location_id: string; inventory_item_id: string; stocked_quantity: number }[] = []
  const toUpdate: { location_id: string; inventory_item_id: string; stocked_quantity: number }[] = []

  for (const item of inventoryItems) {
    const stocked_quantity = stockBySku.get(item.sku as string) ?? 0
    const level = (item.location_levels ?? []).find((entry) => entry?.location_id === stockLocation.id)
    const row = { location_id: stockLocation.id, inventory_item_id: item.id as string, stocked_quantity }

    if (!level) {
      toCreate.push(row)
    } else if (level.stocked_quantity !== stocked_quantity) {
      toUpdate.push(row)
    }
  }

  for (let start = 0; start < toCreate.length; start += 100) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: toCreate.slice(start, start + 100) },
    })
  }

  if (toUpdate.length) {
    await updateInventoryLevelsWorkflow(container).run({
      input: { updates: toUpdate },
    })
  }

  logger.info(`Stock set for ${toCreate.length + toUpdate.length} variant(s) in "${stockLocation.name}"`)
}
