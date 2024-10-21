import { encodeTelegramUrlParameters, isTelegramUrl, WalletInfoRemote } from '@tonconnect/sdk';
import { InlineKeyboardButton } from 'node-telegram-bot-api';
import { logger } from './util/logger';
import { CONFIGS } from './config';

export const AT_WALLET_APP_NAME = 'telegram-wallet';

export const pTimeoutException = Symbol();

export function pTimeout<T>(
    promise: Promise<T>,
    time: number,
    exception: unknown = pTimeoutException
): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise((_r, rej) => (timer = setTimeout(rej, time, exception)))
    ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export function addTGReturnStrategy(link: string, strategy: string): string {
    const parsed = new URL(link);
    parsed.searchParams.append('ret', strategy);
    link = parsed.toString();

    const lastParam = link.slice(link.lastIndexOf('&') + 1);
    return link.slice(0, link.lastIndexOf('&')) + '-' + encodeTelegramUrlParameters(lastParam);
}

export function convertDeeplinkToUniversalLink(link: string, walletUniversalLink: string): string {
    const search = new URL(link).search;
    const url = new URL(walletUniversalLink);

    if (isTelegramUrl(walletUniversalLink)) {
        const startattach = 'tonconnect-' + encodeTelegramUrlParameters(search.slice(1));
        url.searchParams.append('startattach', startattach);
    } else {
        url.search = search;
    }

    return url.toString();
}

export async function buildUniversalKeyboard(
    link: string,
    wallets: WalletInfoRemote[]
): Promise<InlineKeyboardButton[][]> {
    const atWallet = wallets.find(wallet => wallet.appName.toLowerCase() === AT_WALLET_APP_NAME);

    const atWalletLink = atWallet
        ? addTGReturnStrategy(
              convertDeeplinkToUniversalLink(link, atWallet?.universalLink),
              CONFIGS.ton.botLink
          )
        : undefined;

    const keyboard = [
        [
            {
                text: 'Choose a Wallet',
                callback_data: JSON.stringify({ method: 'chose_wallet' })
            }
        ],
        [
            {
                text: 'Open Link',
                url: `https://mini-app.crust.network/`
            }
        ]
    ];

    if (atWalletLink) {
        keyboard.unshift([
            {
                text: '@wallet',
                url: atWalletLink
            }
        ]);
    }

    return keyboard;
}

export async function retryPromise<T>(fun: () => Promise<T>, retry: number = 3): Promise<T> {
    let count = retry;
    let error: unknown;
    while (count > 0) {
        try {
            return await fun();
        } catch (_error) {
            console.error(error);
            // eslint-disable-next-line unused-imports/no-unused-vars
            error = _error;
            count--;
            await new Promise(_r => setTimeout(_r, 1000));
        }
    }
    throw error;
}

export function getFileExtension(filePath: string) {
    const lastDotIndex = filePath.lastIndexOf('.');

    if (lastDotIndex !== -1 && lastDotIndex < filePath.length - 1) {
        return filePath.substring(lastDotIndex);
    }
    return '';
}

export const getEnvOrExit = (
    key: string,
    defaultValue: string = '',
    exit: boolean = true
): string => {
    const value = process.env[key];
    const result = value || defaultValue;
    if ((!result || result === '') && exit) {
        logger.error(`Required env var '${key}' missing`);
        process.exit(1);
    }
    return result;
};
