const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');
const { HttpsProxyAgent } = require('https-proxy-agent');

require('dotenv').config();

const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
  DISCORD_APP_TITLE: process.env.DISCORD_APP_TITLE || '📢 Telegram Channel',
  DISCORD_APP_LOGO: process.env.DISCORD_APP_LOGO || 'https://telegram.org/img/t_logo.png',
  PROXY_URL: process.env.PROXY_URL || '',
};

function validateConfig() {
  const errors = [];
  
  if (!config.TELEGRAM_BOT_TOKEN) {
    errors.push('TELEGRAM_BOT_TOKEN не установлен в .env файле');
  }
  
  if (!config.DISCORD_WEBHOOK_URL) {
    errors.push('DISCORD_WEBHOOK_URL не установлен в .env файле');
  }
  
  if (!config.TELEGRAM_CHANNEL_ID) {
    errors.push('TELEGRAM_CHANNEL_ID не установлен в .env файле');
  }
  
  if (errors.length > 0) {
    console.error('❌ Ошибки конфигурации:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.error('\n📝 Пример .env файла:');
    console.error(`
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DISCORD_WEBHOOK_URL=your_discord_webhook_url
TELEGRAM_CHANNEL_ID=your_channel_id
PROXY_URL=your_proxy_url_or_empty
    `);
    process.exit(1);
  }
}

validateConfig();

console.log('🔧 Проверка конфигурации:');
console.log('TELEGRAM_BOT_TOKEN:', config.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Отсутствует');
console.log('DISCORD_WEBHOOK_URL:', config.DISCORD_WEBHOOK_URL ? '✅ Установлен' : '❌ Отсутствует');
console.log('TELEGRAM_CHANNEL_ID:', config.TELEGRAM_CHANNEL_ID);
console.log('PROXY_URL:', config.PROXY_URL ? `✅ ${config.PROXY_URL}` : '❌ Не используется (работаем напрямую)');

console.log('\n🤖 Бот запускается...');

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

function createAxiosConfig() {
  const axiosConfig = {
    timeout: 30000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  };

  if (config.PROXY_URL && config.PROXY_URL.trim() !== '') {
    console.log(`🔀 Используем прокси: ${config.PROXY_URL}`);
    try {
      const agent = new HttpsProxyAgent(config.PROXY_URL);
      axiosConfig.httpsAgent = agent;
      axiosConfig.proxy = false;
    } catch (proxyError) {
      console.error('❌ Ошибка создания прокси агента:', proxyError.message);
      console.log('🔄 Продолжаем без прокси...');
    }
  } else {
    console.log('🌐 Работаем напрямую (без прокси)');
  }

  return axiosConfig;
}

async function sendToDiscord(content, fileBuffer = null, filename = 'file') {
  try {
    const formData = new FormData();
    
    if (content) {
      const truncatedContent = content.length > 2000 ? content.substring(0, 1997) + '...' : content;
      formData.append('content', truncatedContent);
    }
    
    formData.append('username', config.DISCORD_APP_TITLE);
    formData.append('avatar_url', config.DISCORD_APP_LOGO);

    if (fileBuffer) {
      formData.append('file', fileBuffer, filename);
      console.log(`📤 Отправляем файл в Discord: ${filename}`);
    }

    const requestConfig = {
      headers: {
        ...formData.getHeaders(),
      },
      ...createAxiosConfig()
    };

    console.log('🔄 Отправляем запрос к Discord...');
    const response = await axios.post(config.DISCORD_WEBHOOK_URL, formData, requestConfig);
    
    console.log('✅ Сообщение успешно отправлено в Discord');
    return true;
  } catch (error) {
    console.error('❌ Ошибка отправки в Discord:');
    console.error('Сообщение:', error.message);
    
    if (error.response) {
      console.error('Статус:', error.response.status);
      if (error.response.data) {
        console.error('Данные:', JSON.stringify(error.response.data));
      }
    }
    
    if (error.code) {
      console.error('Код ошибки:', error.code);
    }
    
    return false;
  }
}

async function downloadTelegramFile(fileId) {
  try {
    console.log(`📥 Скачиваем файл: ${fileId}`);
    const fileLink = await bot.getFileLink(fileId);
    
    const requestConfig = createAxiosConfig();
    
    const response = await axios({
      method: 'GET',
      url: fileLink,
      responseType: 'arraybuffer',
      ...requestConfig
    });
    
    console.log(`✅ Файл скачан, размер: ${response.data.length} байт`);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка скачивания файла:', error.message);
    return null;
  }
}

bot.on('channel_post', async (post) => {
  console.log('\n=== 📨 ПОЛУЧЕН ПОСТ ИЗ КАНАЛА ===');
  console.log('Chat ID:', post.chat.id);
  console.log('Chat Title:', post.chat.title);
  console.log('Post ID:', post.message_id);
  console.log('Тип поста:', post.text ? 'текст' : 
                            post.photo ? 'фото' : 
                            post.video ? 'видео' : 
                            post.document ? 'документ' : 
                            post.audio ? 'аудио' : 
                            'другое');

  const expectedChannelId = config.TELEGRAM_CHANNEL_ID;
  const receivedChatId = post.chat.id.toString();
  
  console.log(`Ожидаемый ID: ${expectedChannelId}`);
  console.log(`Полученный ID: ${receivedChatId}`);
  
  if (receivedChatId !== expectedChannelId) {
    console.log(`❌ Пропускаем пост: ID канала не совпадает`);
    return;
  }

  console.log('✅ Пост из целевого канала, обрабатываем...');

  let discordContent = '';
  let fileBuffer = null;
  let filename = 'file';

  if (post.text) {
    discordContent = post.text;
    console.log(`📝 Текст: ${discordContent.substring(0, 100)}...`);
  } else if (post.caption) {
    discordContent = post.caption;
    console.log(`📝 Подпись: ${discordContent.substring(0, 100)}...`);
  }

  try {
    if (post.photo && post.photo.length > 0) {
      const photo = post.photo[post.photo.length - 1];
      console.log(`🖼️ Фото обнаружено, file_id: ${photo.file_id}`);
      fileBuffer = await downloadTelegramFile(photo.file_id);
      filename = 'image.jpg';

    } else if (post.video) {
      console.log(`🎥 Видео обнаружено, file_id: ${post.video.file_id}`);
      fileBuffer = await downloadTelegramFile(post.video.file_id);
      filename = 'video.mp4';

    } else if (post.document) {
      console.log(`📎 Документ обнаружен: ${post.document.file_name}, file_id: ${post.document.file_id}`);
      fileBuffer = await downloadTelegramFile(post.document.file_id);
      filename = post.document.file_name || 'file';

    } else if (post.audio) {
      console.log(`🎵 Аудио обнаружено: ${post.audio.file_name}, file_id: ${post.audio.file_id}`);
      fileBuffer = await downloadTelegramFile(post.audio.file_id);
      filename = post.audio.file_name || 'audio.mp3';
    }

    console.log('🔄 Отправляем в Discord...');
    const success = await sendToDiscord(discordContent, fileBuffer, filename);
    
    if (success) {
      console.log('🎉 Пост успешно переслан в Discord!');
    } else {
      console.log('💥 Не удалось отправить пост в Discord');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка обработки:', error);
  }
});

bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error);
});

bot.on('error', (error) => {
  console.error('❌ Общая ошибка бота:', error);
});

bot.getMe().then((me) => {
  console.log('\n✅ Бот успешно подключен к Telegram');
  console.log(`👤 Имя бота: @${me.username}`);
  console.log(`🆔 ID бота: ${me.id}`);
  console.log(`📢 Ожидаю посты из канала: ${config.TELEGRAM_CHANNEL_ID}`);
  console.log('\n🎯 Бот готов к работе! Отправьте пост в канал для проверки...');
}).catch((error) => {
  console.error('❌ Не удалось подключиться к Telegram:', error.message);
});