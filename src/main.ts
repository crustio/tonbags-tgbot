import dotenv from 'dotenv';
dotenv.config();

import TelegramBot, { CallbackQuery } from 'node-telegram-bot-api';
import { bot } from './bot';
import {
    handleConnectCommand,
    handleDisconnectCommand,
    handleFiles,
    handleMyFilesCommand,
    handleShowMyWalletCommand
} from './commands-handlers';
import {
    getCrustLogoBuffer,
    handleMode,
    handleSwitchMode,
    sendCurrentMode,
    sendSelectMode
} from './commands-mode';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { dbMigration } from './migration';
import { serverStart } from './server';
import { initRedisClient, MODE, setMode } from './ton-connect/storage';

const COMMANDS: TelegramBot.BotCommand[] = [
    { command: 'start', description: 'Show commands' },
    { command: 'connect', description: 'Connect to a wallet' },
    { command: 'disconnect', description: 'Disconnect from the wallet' },
    { command: 'my_wallet', description: 'Show connected wallet' },
    { command: 'my_files', description: 'View Files' },
    { command: 'mode', description: 'Show current storage mode' },
    { command: 'switch_mode', description: 'Switch between two modes' }
];

async function sendCommands(chatId: number) {
    const startMsg = ['Commands list:']
        .concat(COMMANDS.map(c => `/${c.command} - ${c.description}`))
        .join('\n');
    bot.sendMessage(chatId, startMsg);
}

async function main(): Promise<void> {
    await dbMigration();
    await serverStart();
    await getCrustLogoBuffer();
    await initRedisClient();
    const onChooseModeClick = async (query: CallbackQuery, data: string): Promise<void> => {
        const chatId = query.message!.chat.id;
        if (!data) return;
        if (['ton', 'crust'].includes(data)) {
            await setMode(chatId, data as MODE);
            await sendCurrentMode(chatId);
            await sendCommands(chatId);
        }
    };
    const callbacks = {
        ...walletMenuCallbacks,
        chose_mode: onChooseModeClick
    };
    // init commands
    bot.getMyCommands({ type: 'default' }).then(commands => {
        if (
            commands.length !== COMMANDS.length ||
            JSON.stringify(commands) !== JSON.stringify(COMMANDS)
        ) {
            bot.setMyCommands(COMMANDS, { scope: { type: 'default' } });
        }
    });
    bot.on('callback_query', query => {
        if (!query.data) {
            return;
        }

        let request: { method: string; data: string };

        try {
            request = JSON.parse(query.data);
        } catch {
            return;
        }

        if (!callbacks[request.method as keyof typeof callbacks]) {
            return;
        }

        callbacks[request.method as keyof typeof callbacks](query, request.data);
    });

    bot.onText(/\/connect/, handleConnectCommand);

    bot.onText(/\/disconnect/, handleDisconnectCommand);

    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

    bot.onText(/\/my_files/, handleMyFilesCommand);
    bot.onText(/\/mode/, handleMode);
    bot.onText(/\/switch_mode/, handleSwitchMode);
    bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
        // const mode = await getMode(msg.chat.id);
        // if (!mode) {
        await sendSelectMode(msg.chat.id);
        // } else {
        //     await sendCommands(msg.chat.id);
        // }
    });
    bot.on('message', handleFiles);
}

main();
