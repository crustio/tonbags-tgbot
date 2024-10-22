import express from 'express';
import cors from 'cors';
import { logger } from '../util/logger';
import { CONFIGS } from '../config';
import { FileModel } from '../dao/files';
import { validate } from '../middleware/validator';
import { query } from 'express-validator';
import { formatFileSize } from '../utils';
import * as _ from 'lodash';
import { ChatModeModel } from '../dao/chatModes';

export const serverStart = async () => {
    const app = express();
    const port = Number(CONFIGS.server.port);
    app.use(
        cors({
            origin: true,
            credentials: true
        })
    );
    app.get('/ping', (_req, res) => {
        res.send('success');
    });

    app.get(
        '/users',
        validate([
            query('address')
                .notEmpty()
                .withMessage('address is required')
                .bail()
                .isLength({ min: 1 })
                .withMessage('address is required'),
            query('page')
                .optional()
                .isNumeric()
                .bail()
                .custom(value => {
                    if (Number(value) <= 0) {
                        throw new Error('page must be greater than 0');
                    }
                    return true;
                }),
            query('pageSize')
                .optional()
                .isNumeric()
                .bail()
                .custom(value => {
                    if (Number(value) <= 0) {
                        throw new Error('pageSize must be greater than 0');
                    }
                    return true;
                })
        ]),
        async (req, res) => {
            let { address = '', page = 1, pageSize = 10 } = req.query;
            if (!address || Array.isArray(address)) {
                res.send({
                    success: false,
                    data: null
                });
                return;
            }
            [address, page, pageSize] = [address as string, Number(page), Number(page)];
            const { count, totalFileSize } = await FileModel.queryFileCountAndTotalSizeByAddress(
                address
            );
            const data = await FileModel.queryFilePageByAddress(
                address,
                Number(page),
                Number(pageSize)
            );
            res.send({
                success: true,
                data: _.map(data, i => ({
                    ...i.dataValues,
                    id: i.uuid,
                    uuid: undefined,
                    uploadDate: Math.floor(i.uploadDate.getTime() / 1000)
                })),
                countFileSize: formatFileSize(totalFileSize),
                pagination: {
                    page,
                    pageSize,
                    totalRecords: count,
                    totalPages: Math.ceil(count / Number(pageSize))
                }
            });
        }
    );

    app.listen(port, () => {
        logger.info(`Server started at :${port}`);
    });
};
