import express from 'express';
import { logger } from '../util/logger';
import { CONFIGS } from '../config';

export const serverStart = async () => {
    const app = express();
    const port = Number(CONFIGS.server.port);

    app.get('/ping', (_req, res) => {
        res.send('success');
    });

    app.listen(port, () => {
        logger.info(`Server started at :${port}`);
    });
};
