import TonConnect from '@tonconnect/sdk';
import { TonConnectStorage } from './storage';
import * as process from 'process';
import { CONFIGS } from '../config';

type StoredConnectorData = {
    connector: TonConnect;
    timeout: ReturnType<typeof setTimeout>;
    onConnectorExpired: ((connector: TonConnect) => void)[];
    storage?: TonConnectStorage;
};

const connectors = new Map<number, StoredConnectorData>();

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

export function getTonStorage(chatId: number): TonConnectStorage {
    const storedItem = connectors.get(chatId);
    if (!storedItem) {
        return new TonConnectStorage(chatId);
    } else if (!storedItem.storage) {
        storedItem.storage = new TonConnectStorage(chatId);
    }
    return storedItem.storage!;
}
