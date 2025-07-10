const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  Browsers,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const AUTH_FOLDER = './auth_info_baileys';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.ubuntu('SilentNotifyAllBot'),
    syncFullHistory: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid?.endsWith('@g.us')) return;

    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const sender = msg.key.participant || msg.key.remoteJid;
    const command = process.env.TRIGGER || '!tagall';
    const ownerId = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;

    if (text.trim() === command && sender === ownerId) {
      const groupMeta = await sock.groupMetadata(msg.key.remoteJid);
      const mentions = groupMeta.participants.map((p) => p.id);

      await sock.sendMessage(msg.key.remoteJid, {
        text: '🔔 Silent notify all!',
        mentions,
      });
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { qr, connection } = update;

    if (qr) {
      console.log('📸 Scan the QR code below to authenticate:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      console.log('❌ Connection closed. Reconnecting...');
      startBot();
    }
  });
}

startBot();
