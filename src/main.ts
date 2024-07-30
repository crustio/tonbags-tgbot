import dotenv from 'dotenv';
dotenv.config();

import { bot } from './bot';
import { walletMenuCallbacks } from './connect-wallet-menu';
import {
    handleConnectCommand,
    handleDisconnectCommand,
    handleSendTXCommand,
    handleShowMyWalletCommand
} from './commands-handlers';
import { initRedisClient } from './ton-connect/storage';
import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import { getConnector } from './ton-connect/connector';
import { CHAIN, toUserFriendlyAddress } from '@tonconnect/sdk';
import axios from 'axios';

async function main(): Promise<void> {
    await initRedisClient();

    const callbacks = {
        ...walletMenuCallbacks
    };

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

    bot.onText(/\/send_tx/, handleSendTXCommand);

    bot.onText(/\/disconnect/, handleDisconnectCommand);

    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

    bot.onText(/\/start/, (msg: TelegramBot.Message) => {
        bot.sendMessage(
            msg.chat.id,
            `
Commands list: 
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/send_tx - Send transaction
/disconnect - Disconnect from the wallet

`
        );
    });
    bot.on('document', async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const fileId = msg.document?.file_id || '';
        const fileName = msg.document?.file_name || '';
        const connector = getConnector(chatId);

        console.log('chatIdchatId', chatId);

        const fromUser = msg.from;
        const file = await bot.getFile(fileId);
        const filePath = file.file_path;

        console.log('filef------ilefile', file, file.file_size);

        const maxSize = 20 * 1024 * 1024;

        await connector.restoreConnection();
        if (!connector.connected) {
            await bot.sendMessage(
                chatId,
                `
                You didn't connect a wallet
/connect - Connect to a wallet
                `
            );
            return;
        }

        if (connector.wallet) {
            console.log(
                'wall22asdaetswallets2222',
                toUserFriendlyAddress(
                    connector.wallet.account.address,
                    connector.wallet!.account.chain === CHAIN.TESTNET
                )
            );

            if ((file.file_size || 0) > maxSize) {
                await bot.sendMessage(chatId, 'The file size exceeds 20MB, please reselect');
                return;
            }

            try {
                const res = await axios.post('http://localhost:3010/record', {
                    address: toUserFriendlyAddress(connector.wallet.account.address),
                    from: fromUser?.username,
                    fileName,
                    file: file.file_path,
                    fileSize: String(file.file_size)
                });
                if (res.status === 200) {
                    console.log('resss', res.data);
                }
            } catch (error) {
                console.error('error', error);
            }

            try {
                console.log('filefile', file);

                const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

                console.log('fileUrlfileUrl', fileUrl);

                // const savePath = path.join('./download', fileName);

                // https
                //     .get(fileUrl, response => {
                //         if (response.statusCode === 200) {
                //             response.pipe(fs.createWriteStream(savePath));
                //             response.on('end', () => {
                //                 bot.sendMessage(chatId, `文件已收到并保存为：${fileName}`);
                //             });
                //         } else {
                //             bot.sendMessage(chatId, `文件下载失败：${response.statusCode}`);
                //         }
                //     })
                //     .on('error', err => {
                //         bot.sendMessage(chatId, `文件下载失败：${err.message}`);
                //     });
                bot.getFile(fileId).then(file => {
                    const filePath = file.file_path;
                    // const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
                    const fileName = path.basename(filePath as string);

                    // 下载文件并保存
                    bot.downloadFile(fileId, './download')
                        .then(() => {
                            bot.sendMessage(msg.chat.id, `文件已收到并保存为：${fileName}`);
                        })
                        .catch(err => {
                            bot.sendMessage(msg.chat.id, `文件下载失败：${err.message}`);
                        });
                });
            } catch (err) {
                bot.sendMessage(chatId, `文件下载失败：${err.message}`);
            }
        }
    });
}

main();
