async function tagAllCommand(sock, chatId, senderId) {
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        
        if (!participants || participants.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: 'No participants found in this group.' 
            });
        }

        // Split into chunks to avoid message limits
        const chunkSize = 15; // WhatsApp typically allows ~15-20 mentions per message
        const chunks = [];
        
        for (let i = 0; i < participants.length; i += chunkSize) {
            chunks.push(participants.slice(i, i + chunkSize));
        }

        // Send each chunk as separate message
        for (const chunk of chunks) {
            let message = '📢 Group Members:\n\n';
            const mentions = [];
            
            chunk.forEach(participant => {
                const number = participant.id.split('@')[0];
                message += `@${number}\n`;
                mentions.push(participant.id);
            });

            await sock.sendMessage(chatId, {
                text: message,
                mentions: mentions
            });

            // Add small delay between messages
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.error('TagAll Error:', error);
        await sock.sendMessage(chatId, {
            text: '⚠️ Could not tag all members. The bot may need to be upgraded to tag everyone.'
        });
    }
}

module.exports = tagAllCommand;