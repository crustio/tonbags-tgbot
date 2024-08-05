import dotenv from 'dotenv';
dotenv.config();

import { Address, toNano } from '@ton/core';
import { CHAIN, toUserFriendlyAddress } from '@tonconnect/sdk';
import axios from 'axios';
import fs from 'fs';
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
import { getTC } from './ton';
import { getConnector } from './ton-connect/connector';
import { initRedisClient } from './ton-connect/storage';
import { config_min_storage_fee, default_storage_period, TonBags } from './TonBags';

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
                    console.log('filefile', file);

                    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
                    console.log('fileUrlfileUrl', fileUrl);
                    // 保存用户文件每个用户一个文件夹
                    const saveDir = path.join(
                        process.env.SAVE_DIR!,
                        toUserFriendlyAddress(connector.wallet.account.address)
                    );
                    if (!fs.existsSync(saveDir)) {
                        fs.mkdirSync(saveDir, { recursive: true });
                    }
                    // 下载文件并保存
                    const savePath = await bot.downloadFile(fileId, saveDir);
                    await bot.sendMessage(
                        msg.chat.id,
                        `File received and saved as:"${fileName}", Preparing order...`
                    );
                    const bag_id = await createBag(savePath, fileName);
                    const torrentHash = BigInt(`0x${bag_id}`);
                    // 异步获取merkleroot。
                    const merkleHash = await merkleNode.getMerkleRoot(bag_id);
                    const tb = getTC(connector.account!.chain).open(
                        TonBags.createFromAddress(Address.parse(process.env.TON_BAGS_ADDRESS!))
                    );
                    const min_fee = await tb.getConfigParam(
                        BigInt(config_min_storage_fee),
                        toNano('0.1')
                    );
                    console.info('min_fee', min_fee.toString());
                    // 存储订单
                    await sendTx(chatId, [
                        {
                            address: process.env.TON_BAGS_ADDRESS!,
                            amount: min_fee.toString(),
                            payload: TonBags.placeStorageOrderMessage(
                                torrentHash,
                                BigInt(file.file_size!),
                                merkleHash,
                                BigInt(defOpt.chunkSize),
                                min_fee,
                                default_storage_period
                            )
                                .toBoc()
                                .toString('base64')
                        }
                    ]);
                    try {
                        const url = process.env.apiUrl || '';
                        const data = {
                            address: toUserFriendlyAddress(
                                connector.wallet.account.address,
                                connector.wallet!.account.chain === CHAIN.TESTNET
                            ),
                            from: fromUser?.username,
                            fileName,
                            file: file.file_path,
                            fileSize: String(file.file_size),
                            bagId: bag_id
                        };

                        console.log('callbackData', data, bag_id);

                        const res = await axios.post(url, data);
                        console.log('resss', res);

                        // if (res.status === 200) {
                        // }
                    } catch (error) {
                        bot.sendMessage(chatId, `uploadError：${error.message}`);
                        console.error('error', error);
                    }
                } catch (err) {
                    console.error(err);
                    bot.sendMessage(chatId, `error：${err.message}`);
                }
            }
        } catch (error) {
            console.error(error);
            bot.sendMessage(msg.chat.id, error.message);
        }
    });
}

main();
