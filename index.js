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

async function sendToDiscord(content, files = []) {
  try {
    const formData = new FormData();
    
    if (content) {
      const truncatedContent = content.length > 2000 ? content.substring(0, 1997) + '...' : content;
      formData.append('content', truncatedContent);
    }
    
    formData.append('username', config.DISCORD_APP_TITLE);
    formData.append('avatar_url', config.DISCORD_APP_LOGO);

    // Добавляем все файлы в форму
    if (files.length > 0) {
      console.log(`📤 Отправляем ${files.length} файлов в Discord`);
      files.forEach((file, index) => {
        formData.append(`file${index}`, file.buffer, file.filename);
        console.log(`   - Файл ${index + 1}: ${file.filename}`);
      });
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

// Хранилище для медиа-групп
const mediaGroups = new Map();

// Единственный обработчик для всех сообщений
bot.on('channel_post', async (post) => {
  // Пропускаем посты не из целевого канала
  const expectedChannelId = config.TELEGRAM_CHANNEL_ID;
  const receivedChatId = post.chat.id.toString();
  
  if (receivedChatId !== expectedChannelId) {
    return;
  }

  console.log('\n=== 📨 ПОЛУЧЕН ПОСТ ИЗ КАНАЛА ===');
  console.log('Chat ID:', post.chat.id);
  console.log('Post ID:', post.message_id);
  console.log('Media Group ID:', post.media_group_id || 'нет');
  console.log('Тип:', 
    post.text ? 'текст' :
    post.photo ? 'фото' :
    post.video ? 'видео' :
    post.document ? 'документ' :
    post.audio ? 'аудио' :
    'другое'
  );

  // ВСЕ сообщения с media_group_id обрабатываем как группы
  if (post.media_group_id) {
    await handleMediaGroup(post);
    return;
  }

  // Обычные сообщения без media_group_id
  await handleSingleMessage(post);
});

async function handleSingleMessage(post) {
  console.log('🔄 Обрабатываем обычное сообщение');
  
  let discordContent = '';
  const files = [];

  // Получаем текст
  if (post.text) {
    discordContent = post.text;
    console.log(`📝 Текст: ${discordContent.substring(0, 100)}...`);
  } else if (post.caption) {
    discordContent = post.caption;
    console.log(`📝 Подпись: ${discordContent.substring(0, 100)}...`);
  }

  try {
    // Обрабатываем фото - берем ТОЛЬКО фото высшего качества (последнее в массиве)
    if (post.photo && post.photo.length > 0) {
      console.log(`🖼️ Найдено ${post.photo.length} версий фото (берем только высшее качество)`);
      
      // Берем только фото наивысшего качества (последнее в массиве)
      const bestPhoto = post.photo[post.photo.length - 1];
      console.log(`📥 Скачиваем фото высшего качества: ${bestPhoto.file_id}`);
      const fileBuffer = await downloadTelegramFile(bestPhoto.file_id);
      if (fileBuffer) {
        files.push({
          buffer: fileBuffer,
          filename: 'image.jpg'
        });
      }
    }

    // Обрабатываем видео
    if (post.video) {
      console.log(`🎥 Видео: ${post.video.file_name || 'video'}`);
      const fileBuffer = await downloadTelegramFile(post.video.file_id);
      if (fileBuffer) {
        files.push({
          buffer: fileBuffer,
          filename: post.video.file_name || 'video.mp4'
        });
      }
    }

    // Обрабатываем документы
    if (post.document) {
      console.log(`📎 Документ: ${post.document.file_name}`);
      const fileBuffer = await downloadTelegramFile(post.document.file_id);
      if (fileBuffer) {
        files.push({
          buffer: fileBuffer,
          filename: post.document.file_name || 'file'
        });
      }
    }

    // Обрабатываем аудио
    if (post.audio) {
      console.log(`🎵 Аудио: ${post.audio.file_name}`);
      const fileBuffer = await downloadTelegramFile(post.audio.file_id);
      if (fileBuffer) {
        files.push({
          buffer: fileBuffer,
          filename: post.audio.file_name || 'audio.mp3'
        });
      }
    }

    // Отправляем в Discord
    if (files.length > 0 || discordContent) {
      console.log(`🔄 Отправляем в Discord: ${files.length} файлов`);
      const success = await sendToDiscord(discordContent, files);
      
      if (success) {
        console.log('🎉 Сообщение успешно отправлено в Discord!');
      } else {
        console.log('💥 Не удалось отправить сообщение в Discord');
      }
    } else {
      console.log('❌ Нет контента для отправки');
    }

  } catch (error) {
    console.error('❌ Ошибка обработки сообщения:', error);
  }
}

async function handleMediaGroup(post) {
  const mediaGroupId = post.media_group_id;
  console.log(`🖼️ Обрабатываем медиа-группу: ${mediaGroupId}, сообщение: ${post.message_id}`);

  // Создаем или получаем группу
  if (!mediaGroups.has(mediaGroupId)) {
    console.log(`🆕 Создаем новую группу: ${mediaGroupId}`);
    mediaGroups.set(mediaGroupId, {
      content: post.caption || '',
      files: [],
      messageIds: new Set(),
      processing: false,
      lastMessageTime: Date.now(),
      downloadPromises: [] // Храним промисы загрузки файлов
    });

    // Устанавливаем таймер для отправки группы
    setTimeout(async () => {
      const group = mediaGroups.get(mediaGroupId);
      if (group && !group.processing) {
        console.log(`⏰ Таймер сработал для группы ${mediaGroupId}, ожидаем завершения загрузки...`);
        
        // Ждем завершения всех загрузок
        if (group.downloadPromises.length > 0) {
          await Promise.allSettled(group.downloadPromises);
          console.log(`✅ Все загрузки для группы ${mediaGroupId} завершены`);
        }
        
        await processMediaGroup(mediaGroupId, group);
      }
    }, 5000); // Даем 5 секунд на получение всех сообщений и загрузку файлов
  }

  const group = mediaGroups.get(mediaGroupId);
  
  // Обновляем время последнего сообщения
  group.lastMessageTime = Date.now();

  // Проверяем, не обрабатывали ли мы уже это сообщение
  if (group.messageIds.has(post.message_id)) {
    console.log(`⚠️ Сообщение ${post.message_id} уже обработано в группе ${mediaGroupId}`);
    return;
  }

  group.messageIds.add(post.message_id);

  // Обновляем контент (если есть подпись и ее еще нет)
  if (post.caption && !group.content) {
    group.content = post.caption;
    console.log(`📝 Установлен текст для группы: ${group.content.substring(0, 100)}...`);
  }

  // Скачиваем и добавляем файлы
  const downloadPromise = processMediaInGroup(post, group, mediaGroupId);
  group.downloadPromises.push(downloadPromise);
}

async function processMediaInGroup(post, group, mediaGroupId) {
  // Добавляем ТОЛЬКО фото высшего качества из каждого сообщения
  if (post.photo && post.photo.length > 0) {
    console.log(`📸 Найдено ${post.photo.length} версий фото в сообщении ${post.message_id} (берем только высшее качество)`);
    
    // В медиа-группах каждое сообщение обычно содержит одно фото в разных размерах
    // Берем только фото наивысшего качества (последнее в массиве)
    const bestPhoto = post.photo[post.photo.length - 1];
    console.log(`📥 Скачиваем фото высшего качества для группы: ${bestPhoto.file_id}`);
    
    try {
      const fileBuffer = await downloadTelegramFile(bestPhoto.file_id);
      if (fileBuffer) {
        group.files.push({
          buffer: fileBuffer,
          filename: `image_${group.files.length + 1}.jpg`
        });
        console.log(`✅ Файл успешно добавлен в группу ${mediaGroupId}, всего файлов: ${group.files.length}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка загрузки файла для группы ${mediaGroupId}:`, error.message);
    }
  } else if (post.video) {
    console.log(`📥 Добавляем видео в группу: ${post.video.file_id}`);
    try {
      const fileBuffer = await downloadTelegramFile(post.video.file_id);
      if (fileBuffer) {
        group.files.push({
          buffer: fileBuffer,
          filename: post.video.file_name || `video_${group.files.length + 1}.mp4`
        });
      }
    } catch (error) {
      console.error(`❌ Ошибка загрузки видео для группы ${mediaGroupId}:`, error.message);
    }
  } else if (post.document) {
    console.log(`📥 Добавляем документ в группу: ${post.document.file_id}`);
    try {
      const fileBuffer = await downloadTelegramFile(post.document.file_id);
      if (fileBuffer) {
        group.files.push({
          buffer: fileBuffer,
          filename: post.document.file_name || `file_${group.files.length + 1}`
        });
      }
    } catch (error) {
      console.error(`❌ Ошибка загрузки документа для группы ${mediaGroupId}:`, error.message);
    }
  }

  console.log(`📊 Группа ${mediaGroupId}: ${group.files.length} файлов из ${group.messageIds.size} сообщений`);
}

async function processMediaGroup(mediaGroupId, group) {
  if (group.processing) {
    return;
  }
  
  group.processing = true;
  
  console.log(`\n=== 📨 ОБРАБОТКА ГРУППЫ МЕДИА ===`);
  console.log(`Группа: ${mediaGroupId}`);
  console.log(`Сообщений: ${group.messageIds.size}`);
  console.log(`Файлов: ${group.files.length}`);
  console.log(`Текст: ${group.content || 'нет'}`);

  if (group.files.length > 0) {
    console.log(`🔄 Отправляем группу медиа в Discord...`);
    const success = await sendToDiscord(group.content, group.files);
    
    if (success) {
      console.log('🎉 Группа медиа успешно отправлена в Discord!');
    } else {
      console.log('💥 Не удалось отправить группу медиа в Discord');
    }
  } else {
    console.log('❌ В группе медиа нет файлов для отправки');
  }

  // Удаляем группу из хранилища
  mediaGroups.delete(mediaGroupId);
  console.log(`🗑️ Группа ${mediaGroupId} удалена из хранилища`);
}

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