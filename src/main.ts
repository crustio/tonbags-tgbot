import dotenv from 'dotenv';
dotenv.config();

import { CHAIN, toUserFriendlyAddress } from '@tonconnect/sdk';
import TelegramBot from 'node-telegram-bot-api';
import QRCode from 'qrcode';
import { bot } from './bot';
import {
    handleDisconnectCommand,
    handleFiles,
    handleShowMyWalletCommand
} from './commands-handlers';
import { walletMenuCallbacks } from './connect-wallet-menu';
import { getConnector } from './ton-connect/connector';
import { initRedisClient } from './ton-connect/storage';
import { getWalletInfo, getWallets } from './ton-connect/wallets';
import { buildUniversalKeyboard } from './utils';

async function main(): Promise<void> {
    let newConnectRequestListenersMap = new Map<number, () => void>();
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

    bot.onText(/\/connect/, async msg => {
        try {
            const chatId = msg.chat.id;
            let messageWasDeleted = false;

            newConnectRequestListenersMap.get(chatId)?.();

            const connector = getConnector(chatId, () => {
                if (!unsubscribe) return;

                unsubscribe();
                newConnectRequestListenersMap.delete(chatId);
                deleteMessage();
            });

            await connector.restoreConnection();
            if (connector.connected) {
                const connectedName =
                    (await getWalletInfo(connector.wallet!.device.appName))?.name ||
                    connector.wallet!.device.appName;
                await bot.sendMessage(
                    chatId,
                    `You have already connect ${connectedName} wallet\nYour address: ${toUserFriendlyAddress(
                        connector.wallet!.account.address,
                        connector.wallet!.account.chain === CHAIN.TESTNET
                    )}\n\n Disconnect wallet firstly to connect a new one`
                );

                return;
            }

            const unsubscribe = connector.onStatusChange(async wallet => {
                if (wallet) {
                    await deleteMessage();

                    const walletName =
                        (await getWalletInfo(wallet.device.appName))?.name || wallet.device.appName;
                    await bot.sendMessage(chatId, `${walletName} wallet connected successfully`);
                    unsubscribe();
                    newConnectRequestListenersMap.delete(chatId);
                }
            });

            const wallets = await getWallets();

            const link = connector.connect(wallets);
            const image = await QRCode.toBuffer(link);

            const keyboard = await buildUniversalKeyboard(link, wallets);

            const botMessage = await bot.sendPhoto(chatId, image, {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

            const deleteMessage = async (): Promise<void> => {
                if (!messageWasDeleted) {
                    messageWasDeleted = true;
                    await bot.deleteMessage(chatId, botMessage.message_id);
                }
            };

            newConnectRequestListenersMap.set(chatId, async () => {
                if (!unsubscribe) return;

                unsubscribe();

                await deleteMessage();

                newConnectRequestListenersMap.delete(chatId);
            });
        } catch (error) {
            console.error(error);
        }
    });

    // bot.onText(/\/send_tx/, handleSendTXCommand);

    bot.onText(/\/disconnect/, handleDisconnectCommand);

    bot.onText(/\/my_wallet/, handleShowMyWalletCommand);

    bot.onText(/\/my_files/, async msg => {
        const chatId = msg.chat.id;

        try {
            const connector = getConnector(chatId);

            await connector.restoreConnection();

            if (!connector.connected) {
                await bot.sendMessage(
                    chatId,
                    `You didn't connect a wallet
/connect - Connect to a wallet`
                );
                return;
            } else {
                const address = toUserFriendlyAddress(
                    connector.wallet!.account.address,
                    connector.wallet!.account.chain === CHAIN.TESTNET
                );
                bot.sendMessage(chatId, `Click the button enter the Mini App `, {
                    reply_markup: {
                        one_time_keyboard: true,
                        is_persistent: true,
                        keyboard: [
                            [
                                {
                                    text: 'Files',
                                    web_app: {
                                        url: `https://mini-app.crust.network?address=${
                                            address || ''
                                        }`
                                    }
                                }
                            ]
                        ]
                    }
                });
            }
        } catch (err) {
            await bot.sendMessage(chatId, `error:${err.messsage} `);
            console.log('err', err);
        }
    });

    bot.onText(/\/start/, (msg: TelegramBot.Message) => {
        bot.sendMessage(
            msg.chat.id,
            `
Commands list: 
/connect - Connect to a wallet
/my_wallet - Show connected wallet
/disconnect - Disconnect from the wallet
/my_files - View Files
/help - User operation instructions
        `
        );
    });
    bot.on('message', handleFiles);
}

main();
