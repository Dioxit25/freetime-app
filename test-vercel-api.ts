// Тестирование API на Vercel
const BASE_URL = 'https://freetime-app-jy3k.vercel.app'

async function testAPI() {
  console.log('🧪 Testing Vercel API...\n')

  // Тест 1: Главная страница
  try {
    const res = await fetch(BASE_URL)
    console.log(`✅ GET / - Status: ${res.status}`)
  } catch (e) {
    console.log(`❌ GET / - Error: ${e}`)
  }

  // Тест 2: Telegram Auth
  try {
    const res = await fetch(`${BASE_URL}/api/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 123456789,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        timezone: 'Europe/Moscow'
      })
    })
    const data = await res.json()
    console.log(`✅ POST /api/auth/telegram - Status: ${res.status}`)
    console.log(`   User: ${data.user?.firstName} ${data.user?.lastName}`)
    console.log(`   Groups: ${data.groups?.length || 0}`)
  } catch (e) {
    console.log(`❌ POST /api/auth/telegram - Error: ${e}`)
  }

  // Тест 3: Webhook health check
  try {
    const res = await fetch(`${BASE_URL}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'ping' })
    })
    console.log(`✅ POST /api/webhook - Status: ${res.status}`)
  } catch (e) {
    console.log(`❌ POST /api/webhook - Error: ${e}`)
  }

  console.log('\n✨ Testing complete!')
}

testAPI()
