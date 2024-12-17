import { isTelegramUrl } from '@tonconnect/sdk';
import * as fs from 'fs';
import TelegramBot, { CallbackQuery, InlineKeyboardButton } from 'node-telegram-bot-api';
import QRCode from 'qrcode';
import { bot } from './bot';
import { getConnector, getTonPayload } from './ton-connect/connector';
import { getWalletInfo, getWallets } from './ton-connect/wallets';
import { addTGReturnStrategy, buildUniversalKeyboard } from './utils';
import { CONFIGS } from './config';

export const walletMenuCallbacks = {
    chose_wallet: onChooseWalletClick,
    select_wallet: onWalletClick,
    universal_qr: onOpenUniversalQRClick
};

async function onChooseWalletClick(query: CallbackQuery, _: string): Promise<void> {
    const wallets = await getWallets();
    const items = wallets.map(
        wallet =>
            [
                {
                    text: wallet.name,
                    callback_data: JSON.stringify({ method: 'select_wallet', data: wallet.appName })
                }
            ] as InlineKeyboardButton[]
    );
    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: [
                ...items,
                [
                    {
                        text: '« Back',
                        callback_data: JSON.stringify({
                            method: 'universal_qr'
                        })
                    }
                ]
            ]
        },
        {
            message_id: query.message?.message_id,
            chat_id: query.message?.chat.id
        }
    );
}

async function onOpenUniversalQRClick(query: CallbackQuery, _: string): Promise<void> {
    const chatId = query.message!.chat.id;
    const wallets = await getWallets();

    const connector = getConnector(chatId);
    const payload = await getTonPayload();
    const link = connector.connect(wallets, { request: { tonProof: payload } });

    await editQR(query.message!, link);

    const keyboard = await buildUniversalKeyboard(link, wallets);

    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: keyboard
        },
        {
            message_id: query.message?.message_id,
            chat_id: query.message?.chat.id
        }
    );
}

async function onWalletClick(query: CallbackQuery, data: string): Promise<void> {
    const chatId = query.message!.chat.id;
    const connector = getConnector(chatId);

    const selectedWallet = await getWalletInfo(data);
    if (!selectedWallet) {
        return;
    }
    const payload = await getTonPayload();
    let buttonLink = connector.connect(
        {
            bridgeUrl: selectedWallet.bridgeUrl,
            universalLink: selectedWallet.universalLink
        },
        { request: { tonProof: payload } }
    );

    let qrLink = buttonLink;

    if (isTelegramUrl(selectedWallet.universalLink)) {
        buttonLink = addTGReturnStrategy(buttonLink, CONFIGS.ton.botLink);
        qrLink = addTGReturnStrategy(qrLink, 'none');
    }

    await editQR(query.message!, qrLink);

    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: [
                [
                    {
                        text: '« Back',
                        callback_data: JSON.stringify({ method: 'chose_wallet' })
                    },
                    {
                        text: `Open ${selectedWallet.name}`,
                        url: buttonLink
                    }
                ]
            ]
        },
        {
            message_id: query.message?.message_id,
            chat_id: chatId
        }
    );
}

async function editQR(message: TelegramBot.Message, link: string): Promise<void> {
    const fileName = 'QR-code-' + Math.round(Math.random() * 10000000000);

    await QRCode.toFile(`./${fileName}`, link);

    await bot.editMessageMedia(
        {
            type: 'photo',
            media: `attach://${fileName}`
        },
        {
            message_id: message?.message_id,
            chat_id: message?.chat.id
        }
    );

    await new Promise(r => fs.rm(`./${fileName}`, r));
}
