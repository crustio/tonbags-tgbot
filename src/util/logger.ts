import { createLogger, format, Logger, transports } from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { Env } from '../type/common';
const level = process.env.NODE_ENV === Env.PROD ? 'info' : 'debug';
const dailyTransportErr = new DailyRotateFile({
    maxSize: '20m',
    maxFiles: '30d',
    filename: 'error-%DATE%.log',
    dirname: 'log',
    level: 'error'
});

const dailyTransportCommon = new DailyRotateFile({
    maxSize: '100m',
    maxFiles: '10d',
    filename: 'common-%DATE%.log',
    dirname: 'log',
    level: 'info'
});

const defaultLogger = createLogger({
    level: level,
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.colorize(),
        format.errors({ stack: true }),
        format.splat(),
        format.printf(info => {
            let left = `[${info.timestamp}] ${info.level}: `;
            if (info.modulePrefix) {
                left += info.modulePrefix + ' ';
            }
            if (info.moduleId) {
                left += `[${info.moduleId}]`;
            }
            if (typeof info.message === 'string') {
                return `${left} ${info.message}`;
            }
            const m = JSON.stringify(info.message);
            return `${left} ${m}`;
        })
    ),
    transports: [dailyTransportErr, dailyTransportCommon, new transports.Console()]
});

export interface ChildLoggerConfig {
    moduleId: string;
    modulePrefix?: string;
}

export const logger = createChildLogger({
    moduleId: 'global',
    modulePrefix: '☄'
});

export function createChildLoggerWith(config: ChildLoggerConfig, loggerParent: Logger): Logger {
    return loggerParent.child(config);
}

export function createChildLogger(config: ChildLoggerConfig): Logger {
    return createChildLoggerWith(config, defaultLogger);
}
