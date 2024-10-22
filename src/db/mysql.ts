import { Sequelize } from 'sequelize';
import { CONFIGS } from '../config';
import { Env } from '../type/common';
export const sequelize = new Sequelize({
    database: CONFIGS.mysql.database,
    username: CONFIGS.mysql.user,
    password: CONFIGS.mysql.password,
    host: CONFIGS.mysql.host,
    port: CONFIGS.mysql.port,
    pool: {
        max: 10,
        min: 0
    },
    dialect: 'mysql',
    define: {
        freezeTableName: true,
        timestamps: true
    },
    sync: {
        alter: true
    },
    logging: CONFIGS.isDev
});
