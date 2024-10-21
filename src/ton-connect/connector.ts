import TonConnect, { TonProofItemReplySuccess } from '@tonconnect/sdk';
import { CONFIGS } from '../config';
import { TonConnectStorage } from './storage';
import { bot } from '../bot';
import { createCrustAuth } from './tonCrust';

type StoredConnectorData = {
    connector: TonConnect;
    timeout: ReturnType<typeof setTimeout>;
    onConnectorExpired: ((connector: TonConnect) => void)[];
    storage?: TonConnectStorage;
    auth?: string;
};

const connectors = new Map<number, StoredConnectorData>();

const cachePayload: { payload?: string } = {};

export async function getTonPayload() {
    if (!cachePayload.payload)
        cachePayload.payload = await fetch('https://tonapi.io/v2/tonconnect/payload')
            .then(res => res.json())
            .then(res => res.payload);
    return cachePayload.payload!;
}

export function getConnector(
    chatId: number,
    onConnectorExpired?: (connector: TonConnect) => void
): TonConnect {
    let storedItem: StoredConnectorData;
    if (connectors.has(chatId)) {
        storedItem = connectors.get(chatId)!;
        clearTimeout(storedItem.timeout);
    } else {
        const storage = new TonConnectStorage(chatId);
        storedItem = {
            connector: new TonConnect({
                manifestUrl: CONFIGS.ton.manifestUrl,
                storage
            }),
            storage,
            onConnectorExpired: []
        } as unknown as StoredConnectorData;
    }

    if (onConnectorExpired) {
        storedItem.onConnectorExpired.push(onConnectorExpired);
    }
    storedItem.timeout = setTimeout(() => {
        if (connectors.has(chatId)) {
            const storedItem = connectors.get(chatId)!;
            storedItem.connector.pauseConnection();
            storedItem.onConnectorExpired.forEach(callback => callback(storedItem.connector));
            connectors.delete(chatId);
        }
    }, Number(CONFIGS.ton.connectorTtlMs));

    connectors.set(chatId, storedItem);
    return storedItem.connector;
}

export async function restoreConnect(chatId: number) {
    const connector = getConnector(chatId);
    await connector.restoreConnection();
    if (
        !connector.connected ||
        !connector.wallet ||
        !(connector.wallet.connectItems?.tonProof as TonProofItemReplySuccess)?.proof
    ) {
        bot.sendMessage(chatId, "You didn't connect a wallet send /connect - Connect to a wallet");
        return null;
    }
    const stored = getStoredConnector(chatId)!;
    if (!stored.auth) {
        stored.auth = await createCrustAuth(connector.wallet);
    }
    return { connector, auth: stored.auth };
}

export function getStoredConnector(chatId: number) {
    return connectors.get(chatId);
}

export function saveStoredConnector(chatId: number, storedItem: StoredConnectorData) {
    connectors.set(chatId, storedItem);
}

export function getTonStorage(chatId: number): TonConnectStorage {
    const storedItem = connectors.get(chatId);
    if (!storedItem) {
        return new TonConnectStorage(chatId);
    } else if (!storedItem.storage) {
        storedItem.storage = new TonConnectStorage(chatId);
    }
    return storedItem.storage!;
}
