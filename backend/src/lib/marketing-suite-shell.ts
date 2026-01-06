import type { Response } from 'express';

export function marketingSuiteHtml() {
  return `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Marketing Suite</title>
      <link rel="stylesheet" href="/static/marketing-suite.css" />
      <link rel="stylesheet" href="https://unpkg.com/grapesjs@0.21.11/dist/css/grapes.min.css" />
      <link rel="stylesheet" href="https://unpkg.com/reactflow@11/dist/style.css" />
    </head>
    <body>
      <div id="ms-root"></div>
      <script src="https://unpkg.com/grapesjs@0.21.11/dist/grapes.min.js"></script>
      <script type="module" src="/static/marketing-suite.js"></script>
    </body>
  </html>
  `;
}

export function sendMarketingSuiteShell(res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(marketingSuiteHtml());
}
