export function generateTestPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Test | MOONLANDING</title>
  <style>
    body { font-family: monospace; padding: 2rem; background: #04141f; color: #ced4da; }
    h1 { color: #3b82f6; }
    .check { color: #40c057; }
    .info { color: #868e96; font-size: 0.85rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>MOONLANDING System Test</h1>
  <p class="check">✓ Server is running</p>
  <p class="check">✓ Page handler is operational</p>
  <p class="info">Timestamp: ${new Date().toISOString()}</p>
  <p class="info">Environment: ${process.env.NODE_ENV || 'development'}</p>
</body>
</html>`;
}
