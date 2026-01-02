export function getStorefrontCartKey(slug: string) {
  return `storefront_cart_${slug}`;
}

export function readStorefrontCart(
  req: any,
  slug: string
): Array<{ productId: string; variantId?: string | null; qty: number; customAmount?: number | null }> {
  const raw = req.cookies?.[getStorefrontCartKey(slug)];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: String(item.productId || ""),
        variantId: item.variantId ? String(item.variantId) : null,
        qty: Math.max(1, Number(item.qty || 1)),
        customAmount: item.customAmount ? Number(item.customAmount) : null,
      }))
      .filter((item) => item.productId);
  } catch {
    return [];
  }
}

export function readStorefrontCartCount(req: any, slug: string) {
  const cart = readStorefrontCart(req, slug);
  return cart.reduce((sum, item) => sum + Math.max(1, Number(item?.qty || 1)), 0);
}

export function clearStorefrontCart(res: any, slug: string) {
  res.cookie(getStorefrontCartKey(slug), JSON.stringify([]), {
    httpOnly: true,
    sameSite: "lax",
  });
}
