async function tagAllCommand(sock, chatId, senderId) {
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        
        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: 'No participants found in the group.' });
            return;
        }
        
        // Create message with each member on a new line
        let message = '🔊 *Group Members:*\n\n';
        participants.forEach(participant => {
            message += `@${participant.id.split('@')[0]}\n`; // Add \n for new line
        });
        
        // Send message with mentions
        await sock.sendMessage(chatId, {
            text: message,
            mentions: participants.map(p => p.id)
        });
    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to tag all members. Note: Some mentions may not work without admin privileges.' 
        });
    }
}

module.exports = tagAllCommand;