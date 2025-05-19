/**
 * Knight Bot - A WhatsApp Bot
 * Copyright (c) 2024 Professor
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */

require('./settings');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const FileType = require('file-type');
const path = require('path');
const axios = require('axios');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const {
  smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize
} = require('./lib/myfunc');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateForwardMessageContent,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageID,
  downloadContentFromMessage,
  jidDecode,
  proto,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const { parsePhoneNumber } = require("libphonenumber-js");
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics');
const { rmSync, existsSync } = require('fs');
const { join } = require('path');

// Create a store object with required methods
const store = {
  messages: {},
  contacts: {},
  chats: {},
  groupMetadata: async (jid) => {
    return {};
  },
  bind: function (ev) {
    // Handle events
    ev.on('messages.upsert', ({ messages }) => {
      messages.forEach(msg => {
        if (msg.key && msg.key.remoteJid) {
          this.messages[msg.key.remoteJid] = this.messages[msg.key.remoteJid] || {};
          this.messages[msg.key.remoteJid][msg.key.id] = msg;
        }
      });
    });
    ev.on('contacts.update', (contacts) => {
      contacts.forEach(contact => {
        if (contact.id) {
          this.contacts[contact.id] = contact;
        }
      });
    });
    ev.on('chats.set', (chats) => {
      this.chats = chats;
    });
  },
  loadMessage: async (jid, id) => {
    return this.messages[jid]?.[id] || null;
  }
};

// Debug flag to help trace execution
const DEBUG = true;

function debugLog(message) {
  if (DEBUG) {
    console.log(chalk.blue(`[DEBUG] ${message}`));
  }
}

// Check if session exists
if (existsSync('./session')) {
  debugLog("Session folder exists. Checking contents...");
  const files = fs.readdirSync('./session');
  debugLog(`Session folder contains ${files.length} files`);
  if (files.length === 0) {
    debugLog("Session folder is empty. Will proceed with new session.");
  }
} else {
  debugLog("Session folder does not exist. Creating it...");
  fs.mkdirSync('./session', { recursive: true });
}

// Force mobile mode or pairing code based on command line
const forceMobile = process.argv.includes("--force-mobile");
const forceQR = process.argv.includes("--qr");
let phoneNumber = process.env.PHONE_NUMBER || "2349110036504"; // Your Nigerian number

// Added for better control
let owner = JSON.parse(fs.readFileSync('./data/owner.json'));
global.botname = "KNIGHT BOT";
global.themeemoji = "•";
const settings = require('./settings');

// Determine auth method based on flags
const pairingCode = !forceQR && (!!phoneNumber || process.argv.includes("--pairing-code"));
const useMobile = forceMobile || process.argv.includes("--mobile");

debugLog(`Auth method: ${pairingCode ? 'Pairing Code' : 'QR Code'}, Mobile: ${useMobile}`);

// Create readline interface
const rl = readline.createInterface({ 
  input: process.stdin, 
  output: process.stdout 
});

const question = (text) => {
  return new Promise((resolve) => rl.question(text, resolve));
};

// Helper function to validate and format phone number
function formatPhoneNumber(number) {
  debugLog(`Formatting number: ${number}`);
  
  // Remove any non-digit characters
  number = number.replace(/[^0-9]/g, '');
  
  // Special handling for Nigerian numbers
  if (number.startsWith('0') && number.length === 11) {
    // Convert 0XXX to 234XXX (Nigerian format)
    number = '234' + number.slice(1);
    debugLog(`Converted to Nigerian format: ${number}`);
  } 
  // If no country code is detected, add Nigerian code
  else if (!(number.startsWith('234') || number.startsWith('91') || number.startsWith('62'))) {
    number = '234' + number;
    debugLog(`Added Nigerian code: ${number}`);
  }
  
  debugLog(`Final formatted number: ${number}`);
  return number;
}

// Function to clear session if needed
function clearSession() {
  debugLog("Attempting to clear session...");
  const sessionPath = './session';
  if (existsSync(sessionPath)) {
    try {
      rmSync(sessionPath, { recursive: true, force: true });
      console.log(chalk.green("Session cleared successfully!"));
      // Recreate empty directory
      fs.mkdirSync('./session', { recursive: true });
      return true;
    } catch (error) {
      console.error("Error clearing session:", error);
      return false;
    }
  }
  return true;
}

async function startXeonBotInc() {
  debugLog("Starting bot initialization...");
  
  let { version, isLatest } = await fetchLatestBaileysVersion().catch(err => {
    console.error("Error fetching Baileys version:", err);
    return { version: [2, 2323, 4], isLatest: false };
  });
  
  debugLog(`Using Baileys version: ${version.join('.')}`);
  
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const msgRetryCounterCache = new NodeCache();
  
  debugLog("Creating WA Socket...");
  
  // Enhanced options for better connectivity
  const XeonBotInc = makeWASocket({
    version,
    logger: DEBUG ? pino({ level: 'debug' }) : pino({ level: 'silent' }),
    printQRInTerminal: !pairingCode,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: "fatal" }).child({ level: "fatal" })
      ),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      let jid = jidNormalizedUser(key.remoteJid);
      let msg = await store.loadMessage(jid, key.id);
      return msg?.message || "";
    },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: true,
    retryRequestDelayMs: 2500,
  });

  debugLog("Binding store to events...");
  store.bind(XeonBotInc.ev);

  // Handle messages.upsert event
  XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
    debugLog("Received messages.upsert event");
    try {
      const mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
        ? mek.message.ephemeralMessage.message
        : mek.message;

      if (mek.key && mek.key.remoteJid === 'status@broadcast') {
        await handleStatus(XeonBotInc, chatUpdate);
        return;
      }
      if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
      if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

      try {
        await handleMessages(XeonBotInc, chatUpdate, true);
      } catch (err) {
        console.error("Error in handleMessages:", err);
        if (mek.key && mek.key.remoteJid) {
          await XeonBotInc.sendMessage(mek.key.remoteJid, {
            text: '❌ An error occurred while processing your message.',
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: '120363161513685998@newsletter',
                newsletterName: 'KnightBot MD',
                serverMessageId: -1
              }
            }
          }).catch(console.error);
        }
      }
    } catch (err) {
      console.error("Error in messages.upsert:", err);
    }
  });

  XeonBotInc.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    } else return jid;
  };

  XeonBotInc.ev.on('contacts.update', update => {
    for (let contact of update) {
      let id = XeonBotInc.decodeJid(contact.id);
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
    }
  });

  XeonBotInc.getName = (jid, withoutContact = false) => {
    id = XeonBotInc.decodeJid(jid);
    withoutContact = XeonBotInc.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
      v = store.contacts[id] || {};
      if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {};
      resolve(
        v.name ||
        v.subject ||
        PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international')
      );
    });
    else v = id === '0@s.whatsapp.net'
      ? { id, name: 'WhatsApp' }
      : id === XeonBotInc.decodeJid(XeonBotInc.user.id)
        ? XeonBotInc.user
        : (store.contacts[id] || {});
    return (
      (withoutContact ? '' : v.name) ||
      v.subject ||
      v.verifiedName ||
      PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    );
  };

  XeonBotInc.public = true;
  XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

  // Improved pairing code logic
  if (pairingCode) {
    debugLog("Using pairing code authentication...");
    if (useMobile) {
      console.log(chalk.red("Cannot use pairing code with mobile api. Please use --qr instead."));
      process.exit(1);
    }
    
    // Check if already registered - this is critical
    const isRegistered = state.creds?.registered;
    debugLog(`Is already registered: ${isRegistered}`);
    
    if (!isRegistered) {
      let attemptPairing = async () => {
        try {
          // Get phone number from user or use the default
          const inputNumber = await question(
            chalk.bgBlack(
              chalk.greenBright(
                "Please type your WhatsApp number 😍\nFormat: 2349110036504 (with country code, no + or spaces): "
              )
            )
          );
          
          // Format the number
          const formattedNumber = formatPhoneNumber(inputNumber);
          console.log(chalk.yellow(`Requesting pairing code for ${formattedNumber}...`));
          
          // Wait a moment before requesting
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          console.log(chalk.cyan("Sending pairing code request..."));
          const code = await XeonBotInc.requestPairingCode(formattedNumber);
          const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
          
          console.log(
            chalk.black(chalk.bgGreen("Your Pairing Code : ")),
            chalk.black(chalk.white(formattedCode))
          );
          console.log(
            chalk.yellow(
              "\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap \"Link a Device\"\n4. Enter the code shown above"
            )
          );
          
          // Keep the process running to await connection
          console.log(chalk.cyan("\nWaiting for you to complete the pairing process..."));
          
          return true;
        } catch (error) {
          console.error('Error in pairing process:', error);
          return false;
        }
      };
      
      // Attempt pairing process
      if (!(await attemptPairing())) {
        console.log(chalk.yellow("Pairing code request failed. Trying again with QR code..."));
        // If pairing fails, fall back to QR code
        clearSession();
        XeonBotInc.printQRInTerminal = true;
      }
    } else {
      debugLog("Device already registered. Using existing credentials.");
    }
  } else {
    debugLog("Using QR code authentication...");
    console.log(chalk.yellow("Waiting for QR code scan. Please scan with your device..."));
  }

  // Enhanced connection handling
  XeonBotInc.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    debugLog(`Connection state: ${connection || 'unknown'}`);
    
    if (qr) {
      console.log(chalk.yellow("\nScan this QR code to login:"));
    }
    
    if (connection === "connecting") {
      console.log(chalk.yellow("Connecting to WhatsApp..."));
    }
    
    if (connection === "open") {
      console.log(chalk.green("\n✅ Successfully connected to WhatsApp!"));
      console.log(
        chalk.yellow("🌿Connected to =>  " + JSON.stringify(XeonBotInc.user, null, 2))
      );
      
      // Send message to bot's own number
      try {
        const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
        await XeonBotInc.sendMessage(botNumber, {
          text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!\n✅Make sure to join below channel,`,
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
      } catch (err) {
        console.error("Error sending initial message:", err);
      }
      
      // Display connection info
      console.log(
        chalk.yellow(
          `\n\n ${chalk.bold.blue(`[ ${global.botname || 'KNIGHT BOT'} ]`)}\n\n`
        )
      );
      console.log(chalk.cyan("< ================================================== >"));
      console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: MR UNIQUE HACKER`));
      console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: mrunqiuehacker`));
      console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`));
      console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: MR UNIQUE HACKER`));
      console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`));
      
      // Close the readline interface once connected
      if (rl && rl.close) {
        rl.close();
      }
    }
    
    if (connection === "close") {
      debugLog(`Connection closed. Reason: ${lastDisconnect?.error?.output?.payload?.message || 'unknown'}`);
      
      let shouldReconnect = true;
      let exitCode = 0;
      
      if (lastDisconnect?.error) {
        const statusCode = new Boom(lastDisconnect.error)?.output?.statusCode;
        debugLog(`Disconnection status code: ${statusCode}`);
        
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log(chalk.red("Device logged out. Please clear session and scan again."));
          clearSession();
          shouldReconnect = false;
          exitCode = 1;
        } else if (statusCode === DisconnectReason.badSession) {
          console.log(chalk.red("Bad session. Clearing and trying again..."));
          clearSession();
        } else if (statusCode === DisconnectReason.connectionReplaced) {
          console.log(chalk.red("Connection replaced. Another device connected."));
          shouldReconnect = false;
          exitCode = 1;
        }
      }
      
      if (shouldReconnect) {
        console.log(chalk.yellow("Reconnecting..."));
        setTimeout(() => {
          startXeonBotInc();
        }, 5000);
      } else if (exitCode > 0) {
        process.exit(exitCode);
      }
    }
  });

  // Other event handlers
  XeonBotInc.ev.on('creds.update', saveCreds);
  XeonBotInc.ev.on('group-participants.update', async (update) => {
    await handleGroupParticipantUpdate(XeonBotInc, update);
  });
  XeonBotInc.ev.on('messages.upsert', async (m) => {
    if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
      await handleStatus(XeonBotInc, m);
    }
  });
  XeonBotInc.ev.on('status.update', async (status) => {
    await handleStatus(XeonBotInc, status);
  });
  XeonBotInc.ev.on('messages.reaction', async (status) => {
    await handleStatus(XeonBotInc, status);
  });

  return XeonBotInc;
}

console.log(chalk.green("=== KNIGHT BOT WHATSAPP ==="));
console.log(chalk.yellow("Initializing... Please wait"));

// Start the bot with improved error handling
(async () => {
  try {
    await startXeonBotInc();
  } catch (error) {
    console.error('Fatal error during startup:', error);
    console.log(chalk.red("Trying to recover..."));
    
    // Clear session if there was a fatal error
    clearSession();
    
    // Try one more time
    try {
      await startXeonBotInc();
    } catch (retryError) {
      console.error('Retry failed. Fatal error:', retryError);
      console.log(chalk.red("Unable to recover. Please check your system and try again."));
      process.exit(1);
    }
  }
})();

// Improved error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});