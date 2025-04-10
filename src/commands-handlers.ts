import { Address, toNano } from '@ton/core';
import TonConnect, {
    CHAIN,
    isTelegramUrl,
    SendTransactionRequest,
    TonProofItemReplySuccess,
    UserRejectsError
} from '@tonconnect/sdk';
import axios from 'axios';
import FD from 'form-data';
import fs, { createReadStream } from 'fs';
import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import QRCode from 'qrcode';
import { config_min_storage_fee, CrustBags, default_storage_period } from './CrustBags';
import { bot } from './bot';
import { CONFIGS } from './config';
import { FileModel } from './dao/files';
import { defOpt } from './merkle/merkle';
import merkleNode from './merkle/node';
import { createBag } from './merkle/tonsutils';
import { getTC } from './ton';
import {
    getAddress,
    getConnector,
    getStoredConnector,
    getTonPayload,
    restoreConnect
} from './ton-connect/connector';
import { getAuth, getMode, setAuth } from './ton-connect/storage';
import { createCrustAuth } from './ton-connect/tonCrust';
import { getWalletInfo, getWallets } from './ton-connect/wallets';
import {
    addTGReturnStrategy,
    buildUniversalKeyboard,
    getFileExtension,
    pTimeout,
    pTimeoutException
} from './utils';

let newConnectRequestListenersMap = new Map<number, () => void>();

export async function sendMyWalletMsg(chatId: number, address: string) {
    await bot.sendMessage(
        chatId,
        `You have already connected your wallet.\n\nConnected address: \n${address}\n\n If you want to connect a new wallet, please /disconnect the existing one first.`
    );
}

export async function handleConnectCommand(msg: TelegramBot.Message): Promise<void> {
    try {
        const chatId = msg.chat.id;
        let messageWasDeleted = false;

        const deleteMessage = async (): Promise<void> => {
            if (!messageWasDeleted) {
                messageWasDeleted = true;
                await bot.deleteMessage(chatId, botMessage.message_id);
            }
        };
        newConnectRequestListenersMap.get(chatId)?.();
        let unsubscribe: (() => void) | null = null;
        const connector = getConnector(chatId, () => {
            if (!unsubscribe) return;
            unsubscribe();
            newConnectRequestListenersMap.delete(chatId);
            deleteMessage();
        });
        await connector.restoreConnection();
        const storedItem = getStoredConnector(chatId)!;
        storedItem.auth = await getAuth(chatId);
        if (connector.connected && connector.wallet && storedItem.auth) {
            const address = getAddress(storedItem);
            await sendMyWalletMsg(chatId, address);
            return;
        } else if (connector.connected) {
            await connector.disconnect();
        }

        unsubscribe = connector.onStatusChange(async wallet => {
            if (wallet) {
                await deleteMessage();
                const walletName =
                    (await getWalletInfo(wallet.device.appName))?.name || wallet.device.appName;
                if ((wallet.connectItems?.tonProof as TonProofItemReplySuccess)?.proof) {
                    storedItem.auth = await createCrustAuth(wallet);
                    setAuth(chatId, storedItem.auth);
                    await bot.sendMessage(chatId, `${walletName} connected successfully`);
                }
                unsubscribe?.();
                newConnectRequestListenersMap.delete(chatId);
            }
        });

        const wallets = await getWallets();
        const payload = await getTonPayload();
        const link = connector.connect(wallets, { request: { tonProof: payload } });
        const image = await QRCode.toBuffer(link);

        const keyboard = await buildUniversalKeyboard(link, wallets);

        const botMessage = await bot.sendPhoto(chatId, image, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });

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
        deeplink = addTGReturnStrategy(url.toString(), CONFIGS.ton.botLink);
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

const txProcessing = new Map<number, boolean>();
export async function sendTx(
    connector: TonConnect,
    chatId: number,
    messages: SendTransactionRequest['messages']
): Promise<void> {
    // 等待上一个交易完成
    while (txProcessing.get(chatId)) {
        await new Promise(_r => setTimeout(_r, 1000));
    }
    txProcessing.set(chatId, true);
    try {
        const sentPromise = connector.sendTransaction({
            validUntil: Math.round(
                (Date.now() + Number(CONFIGS.common.deleteSendTxMessageTimeout)) / 1000
            ),
            messages: messages
        });
        needConfirmTx(connector, chatId);
        await pTimeout(sentPromise, Number(CONFIGS.common.deleteSendTxMessageTimeout))
            .then(() => {
                bot.sendMessage(chatId, `Transaction sent successfully`);
            })
            .catch(e => {
                if (e === pTimeoutException) {
                    throw new Error(`Transaction was not confirmed`);
                }

                if (e instanceof UserRejectsError) {
                    throw new Error(`You rejected the transaction`);
                }
                throw e;
            });
    } catch (error) {
        throw error;
    } finally {
        txProcessing.delete(chatId);
    }
}

export async function handleDisconnectCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const rc = await restoreConnect(chatId);
    if (!rc.connected) return;

    await rc.connector.disconnect();
    await setAuth(chatId, null);

    await bot.sendMessage(chatId, 'Wallet has been disconnected');
}

export async function handleShowMyWalletCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    const rc = await restoreConnect(chatId);
    if (!rc.connected) return;
    await sendMyWalletMsg(chatId, getAddress(rc));
}

export async function handleMyFilesCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    try {
        const rc = await restoreConnect(chatId);
        if (!rc.connected) return;
        const address = getAddress(rc);
        const link = `https://mini-app.crust.network?address=${address || ''}`;
        await bot.sendMessage(chatId, `Click to enter the Mini app:`, {
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
    } catch (err) {
        await bot.sendMessage(chatId, `error:${err.messsage} `);
        console.log('err', err);
    }
}

async function saveToTonStorage(params: {
    connector: TonConnect;
    chatId: number;
    chain: CHAIN;
    address: string;
    from: string;
    filePath: string;
    fileName: string;
    fileSize: number;
}) {
    const { chatId, chain, address, from, fileName, filePath, fileSize } = params;
    const bag_id = await createBag(filePath, fileName);
    const torrentHash = BigInt(`0x${bag_id}`);
    // 异步获取merkleroot。
    const merkleHash = await merkleNode.getMerkleRoot(bag_id);
    const tb = getTC(chain).open(
        CrustBags.createFromAddress(Address.parse(CONFIGS.ton.tonBagsAddress))
    );
    const min_fee = await tb.getConfigParam(BigInt(config_min_storage_fee), toNano('0.1'));
    console.info('min_fee', min_fee.toString());
    // 存储订单
    await sendTx(params.connector, chatId, [
        {
            address: CONFIGS.ton.tonBagsAddress,
            amount: min_fee.toString(),
            payload: CrustBags.placeStorageOrderMessage(
                torrentHash,
                BigInt(fileSize),
                merkleHash,
                BigInt(defOpt.chunkSize),
                min_fee,
                default_storage_period
            )
                .toBoc()
                .toString('base64')
        }
    ]);
    await FileModel.createFile({
        chatId: `${chatId}`,
        address,
        from,
        fileName,
        file: filePath,
        fileSize: BigInt(fileSize),
        saveMode: 'ton',
        bagId: bag_id
    });
}

async function saveToCrust(params: {
    chatId: number;
    auth: string;
    address: string;
    from: string;
    filePath: string;
    fileName: string;
    fileSize: number;
}) {
    const { chatId, auth, address, from, fileName, filePath, fileSize } = params;
    const AuthBasic = `Basic ${auth}`;
    const AuthBearer = `Bearer ${auth}`;
    // upload
    const form = new FD();

    form.append('file', createReadStream(filePath), { filename: fileName });
    // IPFS add
    const upRes = await axios
        .request({
            data: form,
            headers: { Authorization: AuthBasic },
            maxContentLength: 1024 * 1024 * 20,
            method: 'POST',
            params: { pin: true, 'cid-version': 1, hash: 'sha2-256' },
            url: `${CONFIGS.common.uploadGateway}/api/v0/add`
        })
        .then(res => res.data);
    // pin
    const cid = upRes.Hash;
    await axios.post(
        `${CONFIGS.common.pinSever}/psa/pins`,
        {
            cid,
            name: upRes.Name
        },
        {
            headers: { Authorization: AuthBearer, 'User-Agent': 'Chrome/128.0.0.0' }
        }
    );
    // saveTo database
    await FileModel.createFile({
        chatId: `${chatId}`,
        address,
        from,
        fileName,
        file: filePath,
        fileSize: BigInt(fileSize),
        saveMode: 'crust',
        cid
    });
}

const supportTypes: TelegramBot.MessageType[] = [
    'document',
    'photo',
    'video',
    'audio',
    'voice',
    'video_note'
];
export async function handleFiles(
    msg: TelegramBot.Message,
    metadata: TelegramBot.Metadata
): Promise<void> {
    const isNotUser = !msg.forward_from && !msg.from;
    const isNotSupportType = metadata.type && !supportTypes.includes(metadata.type);
    if (isNotUser || isNotSupportType) {
        return;
    }
    console.info(metadata.type, 'msg:', msg);
    const chatId = msg.chat.id;
    try {
        // console.info(metadata.type, 'msg:', msg);
        const file =
            msg.document ||
            msg.photo?.[(msg.photo?.length || 1) - 1] ||
            msg.video ||
            msg.audio ||
            msg.voice ||
            msg.video_note;
        if (!file || !file.file_id || !file.file_size) {
            bot.sendMessage(chatId, 'Not support save this message');
            return;
        }
        if (file.file_size >= 20 * 1024 * 1024) {
            bot.sendMessage(chatId, 'The file size exceeds 20MB, please reselect');
            return;
        }

        const rc = await restoreConnect(chatId);
        if (!rc.connected) return;
        const saveDir = path.join(
            CONFIGS.common.saveDir,
            getAddress(rc, false) // mainnet address fmt
        );
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        // await bot.sendMessage(chatId, `Saving in progress...`);
        // 下载文件并保存
        const savePath = await bot.downloadFile(file.file_id, saveDir);

        const originName =
            (file as TelegramBot.Document).file_name ||
            `${file.file_unique_id}${getFileExtension(savePath)}`;

        console.log('savePathsavePath', savePath, originName);
        const address = getAddress(rc);
        const from = msg.forward_from?.username || msg.from!.username || String(msg.from!.id);
        const mode = await getMode(chatId);
        if (mode === 'ton') {
            await bot.sendMessage(
                chatId,
                `File received and saved as:"${originName}", Preparing order...`
            );
            await saveToTonStorage({
                connector: rc.connector,
                chatId: chatId,
                chain: rc.connector.account!.chain,
                address,
                from,
                filePath: savePath,
                fileName: originName,
                fileSize: file.file_size!
            });
        } else if (mode === 'crust') {
            await bot.sendMessage(chatId, `File received and saved as:"${originName}", Saving...`);
            await saveToCrust({
                chatId: chatId,
                auth: rc.auth!,
                address,
                from,
                filePath: savePath,
                fileName: originName,
                fileSize: file.file_size!
            });
        }
        await bot.sendMessage(chatId, `"${originName}", Save success.`);
    } catch (error) {
        console.error('handleFiles', error);
        bot.sendMessage(
            chatId,
            `Save failed. Please check your wallet balance or network connection.`
        );
        // bot.sendMessage(chatId, `Error: ${error?.message || 'Unknown'}`);
    }
}
