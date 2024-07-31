import dotenv from 'dotenv';
dotenv.config();

import { toNano } from '@ton/core';
import { CHAIN, toUserFriendlyAddress } from '@tonconnect/sdk';
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import { bot } from './bot';
import {
    handleConnectCommand,
    handleDisconnectCommand,
    handleShowMyWalletCommand,
    sendTx
} from './commands-handlers';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { defOpt } from './merkle/merkle';
import merkleNode from './merkle/node';
import { createBag } from './merkle/tonsutils';
import { getConnector } from './ton-connect/connector';
import { initRedisClient } from './ton-connect/storage';
import { default_storage_period, TonBags } from './TonBags';

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

    // bot.onText(/\/send_tx/, handleSendTXCommand);

    bot.onText(/\/disconnect/, handleDisconnectCommand);

    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

    bot.onText(/\/start/, (msg: TelegramBot.Message) => {
        bot.sendMessage(
            msg.chat.id,
            `
Commands list: 
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/disconnect - Disconnect from the wallet
        `
        );
    });
    bot.on('document', async (msg: TelegramBot.Message) => {
        try {
            const chatId = msg.chat.id;
            const fileId = msg.document?.file_id || '';
            const fileName = msg.document?.file_name || '';
            const connector = getConnector(chatId);

            console.log('chatIdchatId', chatId);

            const fromUser = msg.from;
            const file = await bot.getFile(fileId);
            const filePath = file.file_path;

            console.log('filef------ilefile', file, file.file_size);

            const maxSize = 20 * 1000 * 1000;

            const fileSize = file.file_size || 0;

            if (fileSize > maxSize) {
                await bot.sendMessage(chatId, 'The file size exceeds 20MB, please reselect');
                return;
            }

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

                try {
                    const res = await axios.post('https://tonbags-api.crust.network/record', {
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
                    const fileName = path.basename(filePath as string);
                    // 保存用户文件每个用户一个文件夹
                    const saveDir = path.join(
                        process.env.SAVE_DIR!,
                        toUserFriendlyAddress(connector.wallet.account.address)
                    );
                    // 下载文件并保存
                    await bot.downloadFile(fileId, saveDir);
                    await bot.sendMessage(
                        msg.chat.id,
                        `文件已收到并保存为：${fileName}, 正在准备订单...`
                    );

                    const savePath = path.join(saveDir, fileName);
                    const bag_id = await createBag(savePath, fileName);
                    const torrentHash = BigInt(`0x${bag_id}`);
                    // 异步获取merkleroot。
                    const merkleHash = await merkleNode.getMerkleRoot(bag_id);
                    // 存储订单
                    await sendTx(chatId, [
                        {
                            address: process.env.TON_BAGS_ADDRESS!,
                            amount: toNano('0.2').toString(),
                            payload: TonBags.placeStorageOrderMessage(
                                torrentHash,
                                BigInt(file.file_size!),
                                merkleHash,
                                BigInt(defOpt.chunkSize),
                                toNano('0.1'),
                                default_storage_period
                            )
                                .toBoc()
                                .toString('base64')
                        }
                    ]);
                } catch (err) {
                    bot.sendMessage(chatId, `出错了：${err.message}`);
                }
            }
        } catch (error) {
            bot.sendMessage(msg.chat.id, error.message);
        }
    });
}

main();
