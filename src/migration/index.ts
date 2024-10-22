import {CONFIGS} from "../config";
const path = require('path');
const mysql = require('mysql2/promise');
const Postgrator = require('postgrator');

export const dbMigration = async () => {
    const { host, port, user, password, database, schemaTable } = CONFIGS.mysql;
    // create db
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await connection.end();
    // execute migration
    const migration = new Postgrator({
        migrationDirectory: path.join(__dirname, CONFIGS.mysql.location),
        driver: 'mysql2',
        username: user,
        schemaTable,
        host,
        port,
        database,
        password
    });
    await migration.migrate('max');
};
