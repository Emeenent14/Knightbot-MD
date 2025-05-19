const fs = require('fs').promises;
const settings = require("../settings");

async function aliveCommand(sock, chatId) {
    try {
        const message = 
`┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🤖 *Knight Bot Status*
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📦 *Version:* ${settings.version}
┃ ⚡ *Status:* Online
┃ 🔧 *Mode:* Public
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🌟 *Features:*
┃ • Group Management
┃ • Antilink Protection
┃ • Fun Commands
┃ • And more!
┣━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📜 Type *.menu* to see commands
┗━━━━━━━━━━━━━━━━━━━━━━━┛`;

        // Read local image file
        const imageBuffer = await fs.readFile('./assets/bot_image.jpg');
        
        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: message,
            mimetype: 'image/jpeg',
        });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: '✅ Bot is alive, but image failed to load.' });
    }
}

module.exports = aliveCommand;