// Import all required modules

const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  Browsers,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// Load environment variables via dotenv
require('dotenv').config();

const AUTH_FOLDER = './auth_info_baileys';
const TRIGGER = (process.env.TRIGGER || '!tagall').trim();
const OWNER_JID = process.env.OWNER_JID; // Add this in .env

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.ubuntu('SilentTagBot'),
    syncFullHistory: true,
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ qr, connection }) => {
    if (qr) {
      console.log('📸 Scan QR:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('✅ Bot connected');
    if (connection === 'close') startBot();
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid?.endsWith('@g.us')) return;

    const text = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''
    ).trim();

    console.log('🔍 Message:', {
      text,
      participant: msg.key.participant,
      ownerJid: OWNER_JID,
    });

    if (text === TRIGGER && msg.key.participant === OWNER_JID) {
      const group = msg.key.remoteJid;
      const meta = await sock.groupMetadata(group);
      const mentions = meta.participants.map((p) => p.id);
      await sock.sendMessage(group, {
        text: '🔔 Silent notify all!',
        mentions,
      });
      console.log(`✅ Tagged ${mentions.length} members`);
    }
  });
}

startBot();
