const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  Browsers,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
require('dotenv').config();

const AUTH_FOLDER = './auth_info_baileys';
const TRIGGER = (process.env.TRIGGER || '!tagall').trim();
const OWNER_JID = process.env.OWNER_JID?.trim();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('SilentTagBot'),
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ qr, connection }) => {
    if (qr) {
      console.log('📸 Scan QR to connect:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Bot connected. Waiting for full readiness...');
    }

    if (connection === 'close') {
      console.log('🔄 Disconnected. Reconnecting...');
      await startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    try {
      if (!msg.message || !msg.key.remoteJid?.endsWith('@g.us')) return;

      const text =
        msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      const senderJid = msg.key.participant || msg.key.remoteJid;

      // Warm up session: respond to owner's first message
      if (text.trim() === '.' && senderJid === OWNER_JID) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: '✅ Bot is warmed up and ready.',
        });
        return;
      }

      // Handle trigger command
      if (text.trim() === TRIGGER && senderJid === OWNER_JID) {
        const group = msg.key.remoteJid;
        const meta = await sock.groupMetadata(group);
        const mentions = meta.participants.map((p) => p.id);

        await sock.sendMessage(group, {
          text: '🔔 Silently tag everyone...🌝',
          mentions,
        });

        console.log(
          `✅ Tagged ${mentions.length} member(s) in group: ${meta.subject}`
        );
      }
    } catch (err) {
      const msg = err?.message || '';
      if (
        msg.includes('No SenderKeyRecord') ||
        msg.includes('Bad MAC') ||
        msg.includes('decryptWhisperMessage')
      ) {
        // Expected decrypt issues — skip silently
        return;
      }

      console.error('❌ Unexpected error in message handler:', err);
    }
  });
}

startBot();
