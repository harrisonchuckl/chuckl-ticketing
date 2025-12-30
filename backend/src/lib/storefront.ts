import prisma from './prisma';

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

export async function decrementStockTransaction(productId: string, qty: number) {
  if (qty <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  return prisma.$transaction(async (tx) => {
    console.info('[storefront] loading product for stock decrement', { productId, qty });
    const product = await tx.product.findUnique({ where: { id: productId } });

    if (!product) {
      throw new Error('Product not found for stock decrement.');
    }

    if (!product.inventoryEnabled || product.stockQty === null) {
      console.info('[storefront] stock decrement skipped', {
        productId,
        inventoryEnabled: product.inventoryEnabled,
        stockQty: product.stockQty,
      });
      return product;
    }

    if (product.stockQty < qty) {
      throw new Error('Insufficient stock to fulfill order.');
    }

    console.info('[storefront] decrementing stock', {
      productId,
      from: product.stockQty,
      qty,
    });

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stockQty: { decrement: qty } },
    });

    console.info('[storefront] stock decrement complete', {
      productId,
      to: updated.stockQty,
    });

    return updated;
  });
}
