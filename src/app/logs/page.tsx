'use client'

import { useEffect, useState } from 'react'

interface WebhookLog {
  id: string
  updateId?: string
  eventType?: string
  telegramUserId?: string
  telegramChatId?: string
  payload: string
  response?: string
  error?: string
  processedAt: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterChatId, setFilterChatId] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const url = filterChatId
        ? `/api/logs?chatId=${filterChatId}`
        : '/api/logs'

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
      }
    } catch (error: any) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filterChatId])

  const formatPayload = (payload: string) => {
    try {
      const parsed = JSON.parse(payload)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return payload
    }
  }

  const formatResponse = (response?: string) => {
    if (!response) return 'Нет ответа'
    try {
      const parsed = JSON.parse(response)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return response
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">📊 Webhook Логи</h1>

          <div className="flex gap-4 items-center mb-4">
            <input
              type="text"
              placeholder="Фильтр по Chat ID (например: -1003829642821)"
              value={filterChatId}
              onChange={(e) => setFilterChatId(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchLogs}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              🔄 Обновить
            </button>
          </div>

          <div className="text-sm text-gray-600">
            Всего записей: <span className="font-bold">{logs.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Загрузка...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <div className="text-gray-500">Нет записей в логах</div>
            <div className="text-sm text-gray-400 mt-2">
              Отправьте команду боту (/test или /setup2), чтобы увидеть логи здесь
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Время:</span>{' '}
                      <span className="font-mono">
                        {new Date(log.processedAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Update ID:</span>{' '}
                      <span className="font-mono">{log.updateId || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Тип:</span>{' '}
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {log.eventType || 'unknown'}
                      </span>
                    </div>
                    {log.telegramChatId && (
                      <div>
                        <span className="text-gray-500">Chat ID:</span>{' '}
                        <span className="font-mono">{log.telegramChatId}</span>
                      </div>
                    )}
                    {log.telegramUserId && (
                      <div>
                        <span className="text-gray-500">User ID:</span>{' '}
                        <span className="font-mono">{log.telegramUserId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {log.error && (
                  <div className="p-4 bg-red-50 border-b">
                    <div className="text-sm font-semibold text-red-800 mb-1">
                      ❌ Ошибка:
                    </div>
                    <pre className="text-sm text-red-700 whitespace-pre-wrap">
                      {log.error}
                    </pre>
                  </div>
                )}

                <div className="p-4 border-b">
                  <div className="text-sm font-semibold mb-2">📥 Payload:</div>
                  <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">
                    {formatPayload(log.payload)}
                  </pre>
                </div>

                <div className="p-4">
                  <div className="text-sm font-semibold mb-2">📤 Response:</div>
                  <pre className="text-xs bg-green-50 p-3 rounded overflow-auto max-h-64">
                    {formatResponse(log.response)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
