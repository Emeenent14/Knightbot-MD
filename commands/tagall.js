// Even simpler approach that might work better
async function tagAllCommand(sock, chatId) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const numbers = metadata.participants.map(p => p.id.split('@')[0]);
        
        await sock.sendMessage(chatId, {
            text: 'Members: ' + numbers.map(n => `@${n}`).join(' '),
            mentions: metadata.participants.map(p => p.id)
        });
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: `Tagging failed. Try smaller groups or make bot admin.\nError: ${error.message}`
        });
    }
}