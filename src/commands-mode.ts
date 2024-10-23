import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { getMode, setMode } from './ton-connect/storage';

const cacheCrustLogo: { logo?: Buffer } = {};
export async function getCrustLogoBuffer() {
    if (!cacheCrustLogo.logo) {
        cacheCrustLogo.logo = await axios
            .get<Buffer>('https://crustfiles.io/images/logo_12x.png', {
                responseType: 'arraybuffer'
            })
            .then(res => res.data);
    }
    return cacheCrustLogo.logo!;
}
export async function sendSelectMode(chatId: number) {
    const msg = `
Welcome to Use CrustBags!

💾Store your files in Telegram!
🎞️Photos, videos, documents...
📔Manage your files in MiniApps!

Choose storage mode first:
    `;
    const logoBuffer = await getCrustLogoBuffer();
    await bot.sendPhoto(chatId, logoBuffer, {
        caption: msg,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Ton Storage',
                        callback_data: JSON.stringify({ method: 'chose_mode', data: 'ton' })
                    }
                ],
                [
                    {
                        text: 'Crust Network',
                        callback_data: JSON.stringify({ method: 'chose_mode', data: 'crust' })
                    }
                ]
            ]
        }
    });
}

export async function sendCurrentMode(chatId: number) {
    const mode = await getMode(chatId);
    if (!mode) return;
    await bot.sendMessage(
        chatId,
        `current mode: ${mode === 'ton' ? 'Ton Storage' : 'Crust Network'}`
    );
}

export async function handleMode(msg: TelegramBot.Message): Promise<void> {
    const mode = await getMode(msg.chat.id);
    if (!mode) return sendSelectMode(msg.chat.id);
    await sendCurrentMode(msg.chat.id);
}

export async function handleSwitchMode(msg: TelegramBot.Message): Promise<void> {
    const mode = await getMode(msg.chat.id);
    if (!mode) return sendSelectMode(msg.chat.id);
    await setMode(msg.chat.id, mode === 'ton' ? 'crust' : 'ton');
    sendCurrentMode(msg.chat.id);
}
