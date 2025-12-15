<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>FreeTime - Telegram Mini App</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <!-- Using Tailwind CDN for simplicity as requested, though postcss is configured -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
      /* Telegram Mini App Theme Variables Override/Fallback */
      :root {
        --tg-theme-bg-color: #18181b;
        --tg-theme-text-color: #ffffff;
        --tg-theme-hint-color: #a1a1aa;
        --tg-theme-link-color: #3b82f6;
        --tg-theme-button-color: #3b82f6;
        --tg-theme-button-text-color: #ffffff;
        --tg-theme-secondary-bg-color: #27272a;
      }

      body {
        background-color: var(--tg-theme-bg-color);
        color: var(--tg-theme-text-color);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        overflow-x: hidden;
      }

      /* Custom scrollbar for webkit */
      ::-webkit-scrollbar {
        width: 4px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: var(--tg-theme-hint-color);
        border-radius: 2px;
      }

      .ios-safe-area-bottom {
        padding-bottom: env(safe-area-inset-bottom);
      }
      
      .slide-in {
        animation: slideIn 0.3s ease-out forwards;
      }
      
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^19.2.3",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@^2.87.2",
    "react/": "https://esm.sh/react@^19.2.3/",
    "vite": "https://esm.sh/vite@^7.3.0",
    "@vitejs/plugin-react": "https://esm.sh/@vitejs/plugin-react@^5.1.2"
  }
}
</script>
</head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
