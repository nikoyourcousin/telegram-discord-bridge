# 🤖 Telegram to Discord Bridge

## 📋 Description

This bot automatically forwards all new messages from a specified Telegram channel to a Discord channel via webhook. Supports text messages, photos, videos, documents, and audio.

## 🚀 Features

- ✅ Automatic message forwarding from Telegram to Discord
- ✅ Support for various content types:
  - 📝 Text messages
  - 🖼️ Photos
  - 🎥 Videos
  - 📎 Documents
  - 🎵 Audio files
- 🔄 Proxy support for bypassing restrictions
- 🛡️ Robust error handling
- 📊 Detailed logging

## ⚙️ Installation

### 1. Cloning and Setup

```bash
# Clone the repository
git clone https://github.com/nikoyourcousin/telegram-discord-bridge.git
cd telegram-discord-bridge

# Install dependencies
npm install
```

### 2. Environment Variables Configuration

Create a `.env` file in the project root:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHANNEL_ID=your_telegram_channel_id_here

# Discord Webhook Configuration
DISCORD_APP_TITLE=your_discord_app_title_here
DISCORD_APP_LOGO=your_discord_app_logo_here
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here

# Proxy Configuration (optional)
PROXY_URL=your_proxy_url_here
```

## 🔧 Obtaining Configuration Data

### 1. Telegram Bot Token

1. Find [@BotFather](https://t.me/BotFather) in Telegram
2. Send the `/newbot` command
3. Follow the instructions and get the token
4. Add the bot to your channel as an administrator with "Read messages" permissions

### 2. Telegram Channel ID

1. Find the [@username_to_id_bot](https://t.me/username_to_id_bot) bot
2. Forward any message from your channel to this bot
3. Get the numeric channel ID (starts with -100)

### 3. Discord Webhook URL

1. Go to your Discord channel settings
2. Navigate to "Integrations" → "Webhooks"
3. Click "Create Webhook" or "New Webhook"
4. Copy the webhook URL

### 4. Proxy URL (optional)

If you need to bypass restrictions, specify the proxy URL in the format:
- HTTP: `http://username:password@proxy-ip:port`
- HTTP without authentication: `http://proxy-ip:port`
- SOCKS5: `socks5://username:password@proxy-ip:port`

## 🚀 Running the Bot

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## 📝 Usage Example

After starting the bot:

1. 📨 Send a message to your Telegram channel
2. 🔄 The bot will automatically detect the new message
3. 📤 Forward it to the specified Discord channel
4. ✅ You'll see the operation status in the console

## 🐛 Troubleshooting

### Discord Connection Test
```bash
npm run test
```

### Common Issues and Solutions

**Bot doesn't see messages in the channel:**
- Verify the bot is added as a channel administrator
- Ensure the bot has "Read messages" permissions
- Check the correctness of TELEGRAM_CHANNEL_ID

**Discord sending errors:**
- Verify the correctness of DISCORD_WEBHOOK_URL
- Ensure the webhook hasn't been deleted in Discord
- Check internet connection

**Proxy issues:**
- Verify proxy server availability
- Ensure correct URL format
- If problems persist, disable proxy (remove PROXY_URL from .env)

## 📁 Project Structure

```
telegram-discord-bridge/
├── .env                    # Configuration variables
├── .gitignore             # Ignored files
├── package.json           # Dependencies and scripts
├── index.js              # Main bot code
├── test-connection.js    # Connection testing script
└── README.md            # Documentation
```

## 🔒 Security

- Never commit the `.env` file to git
- Keep tokens and keys secret
- Use different bots for development and production

## 📄 License

MIT License

## 🤝 Support

If you encounter issues:

1. Check the console logs
2. Verify all configuration data is correct
3. Run test scripts for diagnostics
4. Check for the latest updates

---
