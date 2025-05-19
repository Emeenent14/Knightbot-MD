const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(__dirname, '../temp/', `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

async function tagCommand(sock, chatId, senderId, messageText, replyMessage) {
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        
        // Get all participants for mentioning (no admin check)
        const mentionedJidList = participants.map(p => p.id);
        
        if (replyMessage) {
            let messageContent = {};
            
            // Handle image messages
            if (replyMessage.imageMessage) {
                const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
                messageContent = {
                    image: { url: filePath },
                    caption: messageText || replyMessage.imageMessage.caption || '',
                    mentions: mentionedJidList
                };
            }
            // Handle video messages
            else if (replyMessage.videoMessage) {
                const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
                messageContent = {
                    video: { url: filePath },
                    caption: messageText || replyMessage.videoMessage.caption || '',
                    mentions: mentionedJidList
                };
            }
            // Handle text messages
            else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
                messageContent = {
                    text: messageText || (replyMessage.conversation || replyMessage.extendedTextMessage.text),
                    mentions: mentionedJidList
                };
            }
            // Handle document messages
            else if (replyMessage.documentMessage) {
                const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
                messageContent = {
                    document: { url: filePath },
                    fileName: replyMessage.documentMessage.fileName,
                    caption: messageText || '',
                    mentions: mentionedJidList
                };
            }
            
            if (Object.keys(messageContent).length > 0) {
                await sock.sendMessage(chatId, messageContent);
            }
        } else {
            await sock.sendMessage(chatId, {
                text: messageText || "Tagged message",
                mentions: mentionedJidList
            });
        }
    } catch (error) {
        console.error('Error in tagCommand:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while tagging members.' 
        });
    }
}

module.exports = tagCommand;