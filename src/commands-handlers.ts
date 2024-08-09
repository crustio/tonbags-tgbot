import { Address, toNano } from '@ton/core';
import TonConnect, {
    CHAIN,
    isTelegramUrl,
    SendTransactionRequest,
    toUserFriendlyAddress,
    UserRejectsError
} from '@tonconnect/sdk';
import axios from 'axios';
import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import QRCode from 'qrcode';
import { config_min_storage_fee, default_storage_period, TonBags } from './TonBags';
import { bot } from './bot';
import { defOpt } from './merkle/merkle';
import merkleNode from './merkle/node';
import { createBag } from './merkle/tonsutils';
import { getTC } from './ton';
import { getConnector } from './ton-connect/connector';
import { getWalletInfo, getWallets } from './ton-connect/wallets';
import { addTGReturnStrategy, buildUniversalKeyboard, pTimeout, pTimeoutException } from './utils';

let newConnectRequestListenersMap = new Map<number, () => void>();

export async function handleConnectCommand(msg: TelegramBot.Message): Promise<void> {
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
}

export async function needConfirmTx(connector: TonConnect, chatId: number): Promise<void> {
    let deeplink = '';
    const walletInfo = await getWalletInfo(connector.wallet!.device.appName);
    if (walletInfo) {
        deeplink = walletInfo.universalLink;
    }

    if (isTelegramUrl(deeplink)) {
        const url = new URL(deeplink);
        url.searchParams.append('startattach', 'tonconnect');
        deeplink = addTGReturnStrategy(url.toString(), process.env.TELEGRAM_BOT_LINK!);
    }

    await bot.sendMessage(
        chatId,
        `Open ${walletInfo?.name || connector.wallet!.device.appName} and confirm transaction`,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `Open ${walletInfo?.name || connector.wallet!.device.appName}`,
                            url: deeplink
                        }
                    ]
                ]
            }
        }
    );
}

export async function sendTx(
    chatId: number,
    messages: SendTransactionRequest['messages']
): Promise<void> {
    const connector = getConnector(chatId);
    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, 'Connect wallet to send transaction');
        return;
    }

    await needConfirmTx(connector, chatId);
    await pTimeout(
        connector.sendTransaction({
            validUntil: Math.round(
                (Date.now() + Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)) / 1000
            ),
            messages: messages
        }),
        Number(process.env.DELETE_SEND_TX_MESSAGE_TIMEOUT_MS)
    )
        .then(() => {
            bot.sendMessage(chatId, `Transaction sent successfully`);
        })
        .catch(e => {
            if (e === pTimeoutException) {
                bot.sendMessage(chatId, `Transaction was not confirmed`);
                return;
            }

            if (e instanceof UserRejectsError) {
                bot.sendMessage(chatId, `You rejected the transaction`);
                return;
            }

            bot.sendMessage(chatId, `Unknown error happened`);
        })
        .finally(() => connector.pauseConnection());
}

export async function handleDisconnectCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, "You didn't connect a wallet");
        return;
    }

    await connector.disconnect();

    await bot.sendMessage(chatId, 'Wallet has been disconnected');
}

export async function handleShowMyWalletCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const connector = getConnector(chatId);

    await connector.restoreConnection();
    if (!connector.connected) {
        await bot.sendMessage(chatId, "You didn't connect a wallet");
        return;
    }

    const walletName =
        (await getWalletInfo(connector.wallet!.device.appName))?.name ||
        connector.wallet!.device.appName;

    await bot.sendMessage(
        chatId,
        `Connected wallet: ${walletName}\nYour address: ${toUserFriendlyAddress(
            connector.wallet!.account.address,
            connector.wallet!.account.chain === CHAIN.TESTNET
        )}`
    );
}

export async function handleMyFilesCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    try {
        const connector = getConnector(chatId);
        await connector.restoreConnection();
        const address =
            connector.wallet?.account &&
            toUserFriendlyAddress(
                connector.wallet!.account.address,
                connector.wallet!.account.chain === CHAIN.TESTNET
            );
        if (!connector.connected || !address) {
            await bot.sendMessage(
                chatId,
                `You didn't connect a wallet
/connect - Connect to a wallet`
            );
            return;
        } else {
            const link = `https://mini-app.crust.network?address=${address || ''}`;
            await bot.sendMessage(chatId, `Click the button enter the Mini App`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Files',
                                web_app: {
                                    url: link
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
}

const supportTypes: TelegramBot.MessageType[] = ['document', 'photo', 'video', 'audio', 'voice'];
export async function handleFiles(
    msg: TelegramBot.Message,
    metadata: TelegramBot.Metadata
): Promise<void> {
    // console.info(metadata.type, 'msg:', msg);
    const chatId = msg.chat.id;
    try {
        // parse files
        if (metadata.type && supportTypes.includes(metadata.type)) {
            // console.info(metadata.type, 'msg:', msg);
            const file =
                msg.document ||
                msg.photo?.[(msg.photo?.length || 1) - 1] ||
                msg.video ||
                msg.audio ||
                msg.voice;
            if (!file || !file.file_id || !file.file_size) {
                bot.sendMessage(chatId, 'Not support save this message');
                return;
            }
            if (file.file_size >= 20 * 1024 * 1024) {
                bot.sendMessage(chatId, 'The file size exceeds 20MB, please reselect');
                return;
            }
            const originName =
                (file as TelegramBot.Document).file_name ||
                `${file.file_unique_id}.${
                    metadata.type === 'voice'
                        ? (file as TelegramBot.Voice).mime_type!.split('/')[1]
                        : 'png'
                }`;
            console.info('originName:', originName);
            const connector = getConnector(chatId);
            await connector.restoreConnection();
            if (!connector.connected || !connector.wallet) {
                bot.sendMessage(
                    chatId,
                    "You didn't connect a wallet send /connect - Connect to a wallet"
                );
                return;
            }
            const saveDir = path.join(
                process.env.SAVE_DIR!,
                toUserFriendlyAddress(connector.wallet.account.address) // mainnet address fmt
            );
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir, { recursive: true });
            }
            // await bot.sendMessage(chatId, `Saving in progress...`);
            // 下载文件并保存
            const savePath = await bot.downloadFile(file.file_id, saveDir);
            await bot.sendMessage(
                chatId,
                `File received and saved as:"${originName}", Preparing order...`
            );
            const bag_id = await createBag(savePath, originName);
            const torrentHash = BigInt(`0x${bag_id}`);
            // 异步获取merkleroot。
            const merkleHash = await merkleNode.getMerkleRoot(bag_id);
            const tb = getTC(connector.account!.chain).open(
                TonBags.createFromAddress(Address.parse(process.env.TON_BAGS_ADDRESS!))
            );
            const min_fee = await tb.getConfigParam(BigInt(config_min_storage_fee), toNano('0.1'));
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
            // 保存记录
            const url = process.env.apiUrl || '';
            const data = {
                address: toUserFriendlyAddress(
                    connector.wallet.account.address,
                    connector.wallet!.account.chain === CHAIN.TESTNET
                ),
                from: msg.forward_from?.username,
                fileName: originName,
                file: savePath,
                fileSize: String(file.file_size),
                bagId: bag_id
            };
            await axios.post(url, data);
        } else {
            bot.sendMessage(chatId, 'Not support save this message');
        }
    } catch (error) {
        console.error('handleFiles', error);
        bot.sendMessage(chatId, `Error: ${error?.message || 'Unknown'}`);
    }
}
