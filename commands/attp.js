const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function attpCommand(sock, chatId, message) {
    const userMessage = message.message.conversation || message.message.extendedTextMessage?.text || '';
    const text = userMessage.split(' ').slice(1).join(' ');
    
    if (!text) {
        await sock.sendMessage(chatId, { text: 'Please provide text after the .attp command.' });
        return;
    }
    
    const width = 512;
    const height = 512;
    const tempDir = path.join(__dirname, './temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const pngPath = path.join(tempDir, `sticker-${Date.now()}.png`);
    const webpPath = path.join(tempDir, `sticker-${Date.now()}.webp`);
    
    try {
        // Create image with text using Jimp
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
        const image = new Jimp(width, height, '#FFFFFF');
        
        // Calculate text position for centering
        const textWidth = Jimp.measureText(font, text);
        const textHeight = Jimp.measureTextHeight(font, text, width);
        const x = (width - textWidth) / 2;
        const y = (height - textHeight) / 2;
        
        // Print text on image
        image.print(font, x, y, text, width);
        
        // Save PNG temporarily
        await image.writeAsync(pngPath);
        
        // Method 1: Use Jimp to convert PNG to WebP
        try {
            // Read the PNG image again with Jimp and write as WebP
            const webpImage = await Jimp.read(pngPath);
            await webpImage.writeAsync(webpPath);
            
            // Read the WebP file
            const stickerBuffer = fs.readFileSync(webpPath);
            
            // Send sticker
            await sock.sendMessage(chatId, {
                sticker: stickerBuffer,
                mimetype: 'image/webp',
                packname: 'My Sticker Pack',
                author: 'My Bot',
            });
        } catch (jimpError) {
            console.error('Jimp WebP conversion failed:', jimpError);
            
            // Method 2: Fallback to ffmpeg for WebP conversion if Jimp fails
            try {
                const ffmpegCommand = `ffmpeg -i "${pngPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#FFFFFF" -c:v libwebp -quality 75 "${webpPath}"`;
                
                await execPromise(ffmpegCommand);
                
                // Read the WebP file
                const stickerBuffer = fs.readFileSync(webpPath);
                
                // Send sticker
                await sock.sendMessage(chatId, {
                    sticker: stickerBuffer,
                    mimetype: 'image/webp',
                    packname: 'My Sticker Pack',
                    author: 'My Bot',
                });
            } catch (ffmpegError) {
                console.error('FFmpeg WebP conversion failed:', ffmpegError);
                throw new Error('All conversion methods failed');
            }
        }
    } catch (error) {
        console.error('Error generating sticker:', error);
        await sock.sendMessage(chatId, { text: 'Failed to generate the sticker. Please try again later.' });
    } finally {
        // Clean up temporary files
        try {
            if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);
        } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
        }
    }
}

module.exports = attpCommand;