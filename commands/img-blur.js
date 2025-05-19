const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const Jimp = require('jimp');

async function blurCommand(sock, chatId, message, quotedMessage) {
    try {
        let imageBuffer;

        if (quotedMessage) {
            if (!quotedMessage.imageMessage) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Please reply to an image message' 
                });
                return;
            }

            const quoted = {
                message: {
                    imageMessage: quotedMessage.imageMessage
                }
            };

            imageBuffer = await downloadMediaMessage(
                quoted,
                'buffer',
                {},
                {}
            );
        } else if (message.message?.imageMessage) {
            imageBuffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                {}
            );
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Please reply to an image or send an image with caption .blur' 
            });
            return;
        }

        // Process image with Jimp
        const image = await Jimp.read(imageBuffer);

        image
            .resize(800, Jimp.AUTO)   // Resize width to 800px, auto height
            .quality(80)             // Set JPEG quality
            .blur(10);               // Apply blur

        const blurredImageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        await sock.sendMessage(chatId, {
            image: blurredImageBuffer,
            caption: '*[ ✔ ] Image Blurred Successfully*',
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363161513685998@newsletter',
                    newsletterName: 'KnightBot MD',
                    serverMessageId: -1
                }
            }
        });

    } catch (error) {
        console.error('Error in blur command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to blur image. Please try again later.' 
        });
    }
}

module.exports = blurCommand;
