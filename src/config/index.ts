import { getEnvOrExit } from '../utils';

export const CONFIGS = {
    ton: {
        token: getEnvOrExit('TELEGRAM_BOT_TOKEN'),
        botLink: getEnvOrExit('TELEGRAM_BOT_LINK'),
        manifestUrl: getEnvOrExit('MANIFEST_URL'),
        connectorTtlMs: getEnvOrExit('CONNECTOR_TTL_MS', '600000'),
        walletsListCacheTtlMs: getEnvOrExit('WALLETS_LIST_CACHE_TTL_MS', '86400000'),
        tonStorageUtilsApi: getEnvOrExit('TON_STORAGE_UTILS_API'),
        tonBagsAddress: getEnvOrExit('TON_BAGS_ADDRESS')
    },
    common: {
        saveDir: getEnvOrExit('SAVE_DIR'),
        deleteSendTxMessageTimeout: getEnvOrExit('DELETE_SEND_TX_MESSAGE_TIMEOUT_MS', '600000')
    },
    redis: {
        url: getEnvOrExit('REDIS_URL')
    },
    server: {
        port: getEnvOrExit('PORT', '3000')
    }
};
