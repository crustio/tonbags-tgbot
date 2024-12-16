import TelegramBot from 'node-telegram-bot-api';
import { bot } from './bot';
import { getMode, MODE } from './ton-connect/storage';

export async function sendSelectMode(chatId: number, mode: MODE) {
    const msg = `current mode: ${mode === 'ton' ? 'Ton Storage' : 'Crust Network'}`;
    await bot.sendMessage(chatId, msg, {
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
    sendSelectMode(msg.chat.id, mode);
}
