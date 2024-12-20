import { getEnvOrExit } from '../utils';
import { Env } from '../type/common';

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
        deleteSendTxMessageTimeout: getEnvOrExit('DELETE_SEND_TX_MESSAGE_TIMEOUT_MS', '600000'),
        uploadGateway: getEnvOrExit('UPLOAD_GATEWAY', 'https://gw.crustfiles.net'),
        pinSever: getEnvOrExit('PIN_SEVER', 'https://pin.crustcode.com')
    },
    redis: {
        url: getEnvOrExit('REDIS_URL')
    },
    mysql: {
        host: getEnvOrExit('MYSQL_HOST', 'localhost', true),
        port: Number(getEnvOrExit('MYSQL_PORT', '23306', true)),
        database: getEnvOrExit('MYSQL_DB_NAME', 'bags'),
        user: getEnvOrExit('MYSQL_USER', 'root', true),
        password: getEnvOrExit('MYSQL_PASSWORD', 'root', true),
        schemaTable: 'data_migration',
        location: '../sql'
    },
    server: {
        port: getEnvOrExit('PORT', '3000')
    },
    isDev: getEnvOrExit('NODE_ENV', Env.DEV) === Env.DEV
};
