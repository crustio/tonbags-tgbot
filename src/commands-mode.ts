import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { getMode, setMode } from './ton-connect/storage';
import { createReadStream, ReadStream } from 'fs';
import path from 'path';

const cacheCrustLogo: { logo?: Buffer | ReadStream | string } = {};
export async function getCrustLogoBuffer() {
    if (!cacheCrustLogo.logo) {
        // cacheCrustLogo.logo = await axios
        //     .get<Buffer>('https://crustfiles.io/images/logo_12x.png', {
        //         responseType: 'arraybuffer'
        //     })
        //     .then(res => res.data);
        cacheCrustLogo.logo = createReadStream(path.join(__dirname, '/crust.jpg'));
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
    const logoIdOrBuffer = await getCrustLogoBuffer();
    const sendMsg = await bot.sendPhoto(chatId, logoIdOrBuffer, {
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
    // cache logo id
    const photos = sendMsg.photo || [];
    if (photos.length) {
        cacheCrustLogo.logo = photos[photos.length - 1]!.file_id;
    }
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
    // await sendSelectMode(msg.chat.id);
}
