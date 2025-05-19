const fs = require('fs');
const fsPromises = require('fs/promises');
const fse = require('fs-extra');
const path = require('path');
const Jimp = require('jimp');
const webp = require('webp-converter');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const scheduleFileDeletion = (filePath) => {
    setTimeout(async () => {
        try {
            await fse.remove(filePath);
            console.log(`File deleted: ${filePath}`);
        } catch (error) {
            console.error(`Failed to delete file:`, error);
        }
    }, 10000); // 10 seconds for now
};

const convertStickerToImage = async (sock, quotedMessage, chatId) => {
    try {
        const stickerMessage = quotedMessage.stickerMessage;
        if (!stickerMessage) {
            await sock.sendMessage(chatId, { text: 'Reply to a sticker with .simage to convert it.' });
            return;
        }

        const timestamp = Date.now();
        const webpPath = path.join(tempDir, `sticker_${timestamp}.webp`);
        const pngPath = path.join(tempDir, `converted_image_${timestamp}.png`);

        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await fsPromises.writeFile(webpPath, buffer);

        // Convert WebP to PNG using webp-converter (uses ffmpeg or dwebp under the hood)
        await webp.dwebp(webpPath, pngPath, "-o"); // "-o" = overwrite output

        const image = await Jimp.read(pngPath);
        const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

        await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: 'Here is the converted image!'
        });

        scheduleFileDeletion(webpPath);
        scheduleFileDeletion(pngPath);
    } catch (error) {
        console.error('Error converting sticker to image:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while converting the sticker.'
        });
    }
};

module.exports = convertStickerToImage;
