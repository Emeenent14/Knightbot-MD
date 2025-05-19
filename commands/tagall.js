async function tagAllCommand(sock, chatId, senderId) {
    try {
        // Get group metadata
        const groupMetadata = await sock.groupMetadata(chatId).catch(err => {
            console.error('Failed to fetch group metadata:', err);
            throw new Error('Could not retrieve group information');
        });

        const participants = groupMetadata?.participants || [];
        
        if (participants.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: '🚫 No members found in this group.' 
            });
        }

        // First try bulk mention approach
        try {
            const mentions = participants.map(p => p.id);
            await sock.sendMessage(chatId, {
                text: '📢 Group Members:\n' + participants.map(p => `@${p.id.split('@')[0]}`).join('\n'),
                mentions
            });
            return;
        } catch (bulkError) {
            console.log('Bulk mention failed, trying sequential approach...', bulkError);
        }

        // If bulk fails, try sequential tagging
        let successCount = 0;
        const failedNumbers = [];
        
        for (const participant of participants) {
            try {
                const number = participant.id.split('@')[0];
                await sock.sendMessage(chatId, {
                    text: `@${number}`,
                    mentions: [participant.id]
                });
                successCount++;
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (individualError) {
                console.error(`Failed to mention ${participant.id}:`, individualError);
                failedNumbers.push(number);
            }
        }

        // Send summary
        let resultMessage = `✅ Successfully tagged ${successCount} members.`;
        if (failedNumbers.length > 0) {
            resultMessage += `\n🚫 Failed to tag: ${failedNumbers.join(', ')}`;
        }
        
        await sock.sendMessage(chatId, { text: resultMessage });

    } catch (error) {
        console.error('TagAll Command Error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to tag members. Error: ${error.message || 'Unknown error'}`
        });
    }
}

module.exports = tagAllCommand;