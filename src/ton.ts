import { TonClient } from '@ton/ton';
import { CHAIN } from '@tonconnect/sdk';

export const tc = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC'
});
export const tcTest = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC'
});

export function getTC(chain: CHAIN) {
    if (chain === CHAIN.MAINNET) {
        return tc;
    } else {
        return tcTest;
    }
}
