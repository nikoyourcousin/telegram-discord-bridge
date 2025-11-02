require('dotenv').config();
const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');

async function testProxy() {
  const PROXY_URL = process.env.PROXY_URL;
  const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

  console.log('🔍 Тестируем подключение...\n');

  if (!PROXY_URL) {
    console.log('❌ Прокси не указан, тестируем прямое подключение');
  } else {
    console.log(`🔀 Указан прокси: ${PROXY_URL}`);
  }

  // Тест 1: Прямое подключение
  console.log('\n1. Тестируем прямое подключение к Discord...');
  try {
    const response = await axios.get(DISCORD_WEBHOOK_URL, { timeout: 10000 });
    console.log('✅ Прямое подключение работает!');
  } catch (error) {
    console.log('❌ Прямое подключение не работает:', error.message);
  }

  // Тест 2: Подключение через прокси
  if (PROXY_URL) {
    console.log('\n2. Тестируем подключение через прокси...');
    try {
      const agent = new HttpsProxyAgent(PROXY_URL);
      const response = await axios.get(DISCORD_WEBHOOK_URL, {
        httpsAgent: agent,
        timeout: 10000
      });
      console.log('✅ Прокси работает!');
    } catch (error) {
      console.log('❌ Прокси не работает:', error.message);
      console.log('💡 Возможные причины:');
      console.log('   - Прокси сервер не отвечает');
      console.log('   - Прокси требует аутентификацию');
      console.log('   - Прокси заблокирован в вашем регионе');
      console.log('   - Неправильный формат прокси URL');
    }
  }

  // Тест 3: Webhook
  console.log('\n3. Тестируем webhook...');
  try {
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('content', '🧪 Тестовое сообщение');

    let requestConfig = { timeout: 15000 };

    if (PROXY_URL) {
      try {
        const agent = new HttpsProxyAgent(PROXY_URL);
        requestConfig.httpsAgent = agent;
      } catch (proxyError) {
        console.log('🔄 Не удалось создать прокси агент, пробуем без прокси...');
      }
    }

    await axios.post(DISCORD_WEBHOOK_URL, formData, {
      headers: formData.getHeaders(),
      ...requestConfig
    });
    console.log('✅ Webhook работает! Сообщение отправлено в Discord');
  } catch (error) {
    console.log('❌ Webhook не работает:', error.message);
  }
}

testProxy();