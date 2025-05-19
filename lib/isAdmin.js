async function isAdmin(sock, chatId, senderId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        
        // Normalize JIDs
        const botJidNormalized = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const ownerJid = 'YOUR_OWNER_NUMBER@s.whatsapp.net'; // Replace with actual owner number
        
        // Find participants
        const participant = groupMetadata.participants.find(p => p.id === senderId);
        const bot = groupMetadata.participants.find(p => p.id === botJidNormalized);

        // Check if sender is owner (override all permissions)
        const isOwner = senderId === ownerJid;
        
        // Original admin checks
        const isBotAdmin = bot && (bot.admin === 'admin' || bot.admin === 'superadmin');
        const isSenderAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');

        // Modified return - owner and bot always have full permissions
        return { 
            isSenderAdmin: isSenderAdmin || isOwner,
            isBotAdmin: isBotAdmin || true, // Bot always considered admin
            isOwner // Additional flag for owner status
        };
    } catch (error) {
        console.error('Error in isAdmin check:', error);
        return {
            isSenderAdmin: false,
            isBotAdmin: false,
            isOwner: false
        };
    }
}

module.exports = isAdmin;