import type { Prisma } from '@prisma/client';

import prisma from './prisma.js';

const slugifyPattern = /[^a-z0-9]+/g;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(slugifyPattern, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const normalizedBase = baseSlug.length ? baseSlug : 'storefront';
  let candidate = normalizedBase;
  let suffix = 1;

  while (true) {
    console.info('[storefront] checking slug availability', { slug: candidate });
    const existing = await prisma.storefront.findUnique({ where: { slug: candidate } });
    console.info('[storefront] slug check result', { slug: candidate, found: Boolean(existing) });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${normalizedBase}-${suffix}`;
  }
}

export async function ensureStorefrontForUser(userId: string): Promise<
  Awaited<ReturnType<typeof prisma.storefront.findUnique>>
> {
  console.info('[storefront] loading storefront for user', { userId });
  const existing = await prisma.storefront.findFirst({ where: { ownerUserId: userId } });
  console.info('[storefront] storefront lookup result', { userId, found: Boolean(existing) });

  if (existing) {
    return existing;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  console.info('[storefront] loaded user for storefront creation', {
    userId,
    found: Boolean(user),
  });

  const baseName = user?.name ?? user?.email?.split('@')[0] ?? 'Storefront';
  const baseSlug = slugify(baseName);
  const uniqueSlug = await ensureUniqueSlug(baseSlug);

  console.info('[storefront] creating storefront', {
    userId,
    name: baseName,
    slug: uniqueSlug,
  });

  return prisma.storefront.create({
    data: {
      ownerUserId: userId,
      name: baseName,
      slug: uniqueSlug,
    },
  });
}

export async function decrementStockTransaction(
  productId: string,
  qty: number,
  variantId?: string | null
) {
  if (qty <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    console.info('[storefront] loading product for stock decrement', {
      productId,
      qty,
      variantId,
    });

    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product) {
      throw new Error('Product not found for stock decrement.');
    }

    if (product.inventoryMode !== 'TRACKED') {
      console.info('[storefront] stock decrement skipped (unlimited inventory)', {
        productId,
      });
      return product;
    }

    if (variantId) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant) throw new Error('Variant not found for stock decrement.');

      if (variant.stockCountOverride !== null && variant.stockCountOverride !== undefined) {
        const current = Number(variant.stockCountOverride ?? 0);
        if (current < qty) {
          throw new Error('Insufficient stock to fulfill order.');
        }

        await tx.productVariant.update({
          where: { id: variantId },
          data: { stockCountOverride: current - qty },
        });

        await tx.inventoryMovement.create({
          data: {
            productId,
            variantId,
            change: -qty,
            reason: 'SALE',
          },
        });

        return product;
      }
    }

    const current = Number(product.stockCount ?? 0);
    if (current < qty) {
      throw new Error('Insufficient stock to fulfill order.');
    }

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stockCount: current - qty },
    });

    await tx.inventoryMovement.create({
      data: {
        productId,
        change: -qty,
        reason: 'SALE',
      },
    });

    return updated;
  });
}
