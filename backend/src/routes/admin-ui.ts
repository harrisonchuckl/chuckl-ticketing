import { Router } from "express";

const router = Router();

const productStoreMarkup = `
  <div style="width:100%;min-height:100%;padding:60px 40px;background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
      * { font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif; }
      .product-card { pointer-events: none; }
      .cta-button { transition: all 0.3s ease; }
      .cta-button:hover { transform: scale(1.05); box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3); }
      .gradient-text { color: #009fe3; }
      .nav-tab { transition: all 0.3s ease; }
      .nav-tab:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
      .nav-tab:active { transform: translateY(0); }
    </style>
    <div style="text-align:center;margin-bottom:60px;">
      <h1 style="font-size:clamp(32px,5vw,72px);font-weight:700;margin:0 0 24px 0;color:#1a202c;line-height:1.1;min-height:160px;display:flex;align-items:center;justify-content:center;" class="gradient-text">Selling products just got superpowers</h1>
      <div style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <a class="nav-tab" href="/admin/ui/product-store/products/new" data-view="/admin/ui/product-store/products/new" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;text-decoration:none;">Create Product</a>
        <a class="nav-tab" href="/admin/ui/product-store" data-view="/admin/ui/product-store" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;text-decoration:none;">Product Store</a>
        <a class="nav-tab" href="/admin/ui/product-store/orders" data-view="/admin/ui/product-store/orders" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;text-decoration:none;">Orders</a>
        <a class="nav-tab" href="/admin/ui/product-store/settings" data-view="/admin/ui/product-store/settings" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;text-decoration:none;">Settings</a>
        <a class="nav-tab" href="/admin/ui/product-store/upsells" data-view="/admin/ui/product-store/upsells" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;text-decoration:none;">Upsells</a>
      </div>
      <p style="font-size:20px;color:#4a5568;margin:0;">Create products and link them to your store, events and shows</p>
    </div>
    <div style="display:flex;justify-content:center;align-items:center;margin-bottom:80px;position:relative;height:400px;max-width:1200px;margin-left:auto;margin-right:auto;">
      <div class="product-card" style="background:linear-gradient(145deg,#ffffff,#f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0,0,0,0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% - 320px)) rotate(-6deg);z-index:1;">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
          <div style="text-align:center;">
            <div style="font-size:30px;font-weight:700;color:white;margin-bottom:12px;line-height:1.2;">Signed Merchandise</div>
            <div style="font-size:17px;color:rgba(255,255,255,0.9);font-weight:500;">Special items</div>
          </div>
        </div>
      </div>
      <div class="product-card" style="background:linear-gradient(145deg,#ffffff,#f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0,0,0,0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% - 160px)) rotate(-3deg);z-index:2;">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
          <div style="text-align:center;">
            <div style="font-size:30px;font-weight:700;color:white;margin-bottom:12px;line-height:1.2;">Books</div>
            <div style="font-size:17px;color:rgba(255,255,255,0.9);font-weight:500;">Custom signage</div>
          </div>
        </div>
      </div>
      <div class="product-card" style="background:linear-gradient(145deg,#ffffff,#f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 12px 32px rgba(0,0,0,0.2);overflow:hidden;position:absolute;left:50%;transform:translateX(-50%) rotate(0deg);z-index:3;">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
          <div style="text-align:center;">
            <div style="font-size:30px;font-weight:700;color:white;margin-bottom:12px;line-height:1.2;">Event T-Shirts</div>
            <div style="font-size:17px;color:rgba(255,255,255,0.9);font-weight:500;">Premium apparel</div>
          </div>
        </div>
      </div>
      <div class="product-card" style="background:linear-gradient(145deg,#ffffff,#f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0,0,0,0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% + 160px)) rotate(3deg);z-index:2;">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,#ffecd2 0%,#fcb69f 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
          <div style="text-align:center;">
            <div style="font-size:30px;font-weight:700;color:#333;margin-bottom:12px;line-height:1.2;">Event Posters</div>
            <div style="font-size:17px;color:rgba(0,0,0,0.7);font-weight:500;">High-quality prints</div>
          </div>
        </div>
      </div>
      <div class="product-card" style="background:linear-gradient(145deg,#ffffff,#f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0,0,0,0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% + 320px)) rotate(6deg);z-index:1;">
        <div style="width:100%;height:100%;background:linear-gradient(135deg,#a8edea 0%,#fed6e3 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
          <div style="text-align:center;">
            <div style="font-size:30px;font-weight:700;color:#333;margin-bottom:12px;line-height:1.2;">Custom Mugs</div>
            <div style="font-size:17px;color:rgba(0,0,0,0.7);font-weight:500;">Personalized drinkware</div>
          </div>
        </div>
      </div>
    </div>
    <div style="text-align:center;max-width:700px;margin:0 auto;background:white;padding:48px 40px;border-radius:24px;box-shadow:0 8px 24px rgba(0,0,0,0.1);">
      <h2 style="font-size:40px;font-weight:700;margin:0 0 16px 0;color:#2d3748;">Create Your Product</h2>
      <p style="font-size:18px;color:#4a5568;margin:0 0 32px 0;line-height:1.6;">Creating products has never been simpler. Whether you're an event organiser, a product seller, or both, our platform lets you sell across your store and connect with other TixAll stores. Link products to tickets and shows, or sell across our entire partner network. Start creating professional products that work everywhere.</p>
      <a id="create-button" class="cta-button" href="/admin/ui/product-store/products/new" data-view="/admin/ui/product-store/products/new" style="background:#009fe3;color:white;font-size:20px;font-weight:600;padding:18px 48px;border:none;border-radius:12px;cursor:pointer;text-decoration:none;display:inline-block;">Create Product</a>
    </div>
  </div>
`;

function htmlShell() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Product Store • Chuckl</title>
</head>
<body style="margin:0;">
${productStoreMarkup}
</body>
</html>`;
}

router.get("/ui", (_req, res) => {
  res.type("html").send(htmlShell());
});

router.get("/ui/product-store", (_req, res) => {
  res.type("html").send(htmlShell());
});

router.get("/ui/product-store/*", (_req, res) => {
  res.type("html").send(htmlShell());
});

export default router;
