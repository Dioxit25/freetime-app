'use client'

import { useEffect, useState } from 'react'

export default function DebugPage() {
  const [info, setInfo] = useState<any>(null)
  const [authResult, setAuthResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    collectInfo()
  }, [])

  const collectInfo = async () => {
    try {
      // Collect ALL Telegram WebApp data
      const tg = (window as any).Telegram?.WebApp
      const tgUser = tg?.initDataUnsafe?.user
      const tgChat = tg?.initDataUnsafe?.chat
      const tgInitData = tg?.initData
      const tgQueryId = tg?.initDataUnsafe?.query_id
      const tgStartParam = tg?.initDataUnsafe?.start_param
      const tgThemeParams = tg?.themeParams

      // Parse data from URL hash if Telegram.WebApp is not available
      let urlHashData = null
      let urlHashUser = null
      let urlHashQueryId = null
      let urlHashAuthDate = null

      if (!tg && window.location.hash.includes('tgWebAppData')) {
        try {
          const hash = window.location.hash

          // Extract tgWebAppData value (everything after tgWebAppData= until & or end)
          const tgWebAppDataMatch = hash.match(/tgWebAppData=([^&]*)/)
          if (tgWebAppDataMatch && tgWebAppDataMatch[1]) {
            const webAppData = tgWebAppDataMatch[1]

            // Decode and parse the URL-encoded data
            const decodedData = decodeURIComponent(webAppData)
            const dataParams = new URLSearchParams(decodedData)

            const userStr = dataParams.get('user')
            if (userStr) {
              try {
                urlHashUser = JSON.parse(userStr)
                console.log('✅ Parsed user from URL hash:', urlHashUser)
              } catch (e) {
                console.error('Error parsing user from URL hash:', e)
              }
            }

            urlHashQueryId = dataParams.get('query_id')
            urlHashAuthDate = dataParams.get('auth_date')

            urlHashData = {
              user: urlHashUser,
              query_id: urlHashQueryId,
              auth_date: urlHashAuthDate,
              signature: dataParams.get('signature'),
              hash: dataParams.get('hash'),
            }
          }
        } catch (e) {
          console.error('Error parsing URL hash:', e)
        }
      }

      const debugInfo = {
        telegramWebApp: {
          available: !!tg,
          version: tg?.version,
          platform: tg?.platform,
          colorScheme: tg?.colorScheme,
          viewportHeight: tg?.viewportHeight,
          viewportStableHeight: tg?.viewportStableHeight,
          headerColor: tg?.headerColor,
          backgroundColor: tg?.backgroundColor,
          isExpanded: tg?.isExpanded,
          initData: tgInitData || null,
          initDataUnsafe: {
            user: tgUser || null,
            chat: tgChat || null,
            query_id: tgQueryId || null,
            start_param: tgStartParam || null,
            _all: tg?.initDataUnsafe || null,
          },
          themeParams: tgThemeParams || null,
          hasInitData: !!tgInitData,
          allProperties: tg ? Object.keys(tg) : [],
        },
        urlHash: {
          hasData: !!urlHashData,
          data: urlHashData,
        },
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        },
        url: {
          full: window.location.href,
          protocol: window.location.protocol,
          host: window.location.host,
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          hashPreview: window.location.hash.length > 100
            ? window.location.hash.substring(0, 100) + '...'
            : window.location.hash,
        },
        timestamp: new Date().toISOString(),
      }

      setInfo(debugInfo)

      // Use data from URL hash if Telegram.WebApp is not available
      const effectiveUser = tgUser || urlHashUser
      const effectiveChat = tgChat || null // URL hash doesn't include chat
      const effectiveChatId = effectiveChat?.id || null

      // Try to authenticate with detailed logging
      if (effectiveUser) {
        console.log('🔍 Debug: User found, attempting auth...', {
          userId: effectiveUser.id,
          firstName: effectiveUser.first_name,
          chatId: effectiveChatId,
          source: tg ? 'Telegram.WebApp' : 'URL hash',
        })

        try {
          const authBody = {
            id: effectiveUser.id,
            firstName: effectiveUser.first_name,
            lastName: effectiveUser.last_name,
            username: effectiveUser.username,
            photoUrl: effectiveUser.photo_url,
            languageCode: effectiveUser.language_code,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            chatId: effectiveChatId,
          }

          console.log('📤 Debug: Sending auth request:', authBody)

          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authBody),
          })

          console.log('📥 Debug: Auth response status:', response.status)

          const data = await response.json()
          console.log('📥 Debug: Auth response data:', data)

          setAuthResult({
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: data,
            dataSource: tg ? 'Telegram.WebApp' : 'URL hash',
          })
        } catch (err: any) {
          console.error('❌ Debug: Auth error:', err)
          setAuthResult({
            success: false,
            error: err.message,
            stack: err.stack,
          })
        }
      } else {
        console.log('⚠️ Debug: No Telegram user data found')
        console.log('⚠️ Debug: Telegram.WebApp:', tg)
        console.log('⚠️ Debug: URL hash data:', urlHashData)
        setAuthResult({
          success: false,
          error: 'No Telegram user data found',
          telegramWebApp: !!tg,
          hasInitData: !!tgInitData,
          initDataKeys: tgInitData ? Object.keys(tgInitData) : [],
          initDataUnsafeKeys: tg?.initDataUnsafe ? Object.keys(tg.initDataUnsafe) : [],
          urlHashHasData: !!urlHashData,
          urlHashUser: urlHashUser,
        })
      }
    } catch (err: any) {
      console.error('❌ Debug: Error collecting info:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Сбор информации...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">🔍 Debug Info</h1>

        {/* Auth Result */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">📝 Auth Result</h2>
          {authResult?.success ? (
            <div className="space-y-2 text-sm">
              <p className="text-green-400">✅ Auth successful!</p>
              <div>
                <p className="text-gray-400 font-semibold">User:</p>
                <pre className="text-xs bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(authResult.data.user, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-gray-400 font-semibold">Groups ({authResult.data.groups?.length || 0}):</p>
                <pre className="text-xs bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(authResult.data.groups, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-red-400">
              <p>❌ Auth failed:</p>
              <pre className="text-xs bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(authResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Telegram Info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">📱 Telegram WebApp</h2>
          <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
            {JSON.stringify(info?.telegramWebApp, null, 2)}
          </pre>
        </div>

        {/* URL Hash Data */}
        {info?.urlHash?.hasData && (
          <div className="bg-green-900 rounded-lg p-4 mb-4">
            <h2 className="text-lg font-semibold mb-2 text-green-300">✅ URL Hash Data Found!</h2>
            <pre className="text-xs bg-green-950 p-2 rounded overflow-x-auto">
              {JSON.stringify(info?.urlHash, null, 2)}
            </pre>
          </div>
        )}

        {/* URL Info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">🔗 URL Info</h2>
          <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
            {JSON.stringify(info?.url, null, 2)}
          </pre>
        </div>

        {/* Browser Info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">🌐 Browser Info</h2>
          <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
            {JSON.stringify(info?.browser, null, 2)}
          </pre>
        </div>

        {/* Timestamp */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">⏰ Timestamp</h2>
          <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
            {info?.timestamp}
          </pre>
        </div>

        {/* Button to retry */}
        <button
          onClick={collectInfo}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
        >
          🔄 Обновить данные
        </button>

        {/* Button to go back */}
        <button
          onClick={() => window.location.href = '/'}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition mt-2"
        >
          ← Вернуться в приложение
        </button>
      </div>
    </div>
  )
}
