/**
 * Created by barrett on 8/28/14.
 */

var mysql = require('mysql');
var dbconfig = require('../config/database');

var connection = mysql.createConnection(dbconfig.connection);

connection.query('CREATE DATABASE ' + dbconfig.database);

connection.query('\
CREATE TABLE `' + dbconfig.database + '`.`' + dbconfig.users_table + '` ( \
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT, \
    `username` VARCHAR(20) NOT NULL, \
    `coin` INT DEFAULT 0, \
    `eth_address` VARCHAR(50),\
    `bch_address` VARCHAR(50),\
    `password` CHAR(60) NOT NULL, \
        PRIMARY KEY (`id`), \
    UNIQUE INDEX `id_UNIQUE` (`id` ASC), \
    UNIQUE INDEX `username_UNIQUE` (`username` ASC) \
)');


connection.query('\
CREATE TABLE `' + dbconfig.database + '`.`' + dbconfig.ethereum_transaction + '` ( \
    `txhash` VARCHAR(100), \
    `to_address` VARCHAR(50) NOT NULL, \
    `to_user_id` VARCHAR(50) NOT NULL, \
    `value` BIGINT DEFAULT 0, \
    `blocknumber` INT,\
    `timestamp` TIMESTAMP, \
    PRIMARY KEY (`txhash`), \
    INDEX `to_user_id` (`to_user_id` ASC) \
)');


connection.query("CREATE TABLE `" + dbconfig.database + '`.`' + dbconfig.eth_withdraw_log + "` ( \
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,\
    `tx_status` INT DEFAULT 0 ,\
    `tx_hash` VARCHAR(100), \
    `from_address` VARCHAR(50) NOT NULL, \
    `to_address` VARCHAR(50) NOT NULL, \
    `to_user_id` VARCHAR(50) NOT NULL, \
    `eth_value` BIGINT DEFAULT 0, \
    `coin_value` INT DEFAULT 0, \
    `block_number` INT,\
    `timestamp` TIMESTAMP, \
    PRIMARY KEY (`id`))");


connection.query('\
CREATE TABLE `' + dbconfig.database + '`.`' + dbconfig.bch_transaction + '` ( \
    `txhash` VARCHAR(100), \
    `to_address` VARCHAR(50) NOT NULL, \
    `to_user_id` VARCHAR(50) NOT NULL, \
    `value` BIGINT DEFAULT 0, \
    `blocknumber` INT,\
    `timestamp` TIMESTAMP, \
    PRIMARY KEY (`txhash`), \
    INDEX `to_user_id` (`to_user_id` ASC) \
)');


connection.query("CREATE TABLE `" + dbconfig.database + '`.`' + dbconfig.bch_withdraw_log + "` ( \
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,\
    `tx_status` INT DEFAULT 0 ,\
    `tx_hash` VARCHAR(100), \
    `from_address` VARCHAR(50) NOT NULL, \
    `to_address` VARCHAR(50) NOT NULL, \
    `to_user_id` VARCHAR(50) NOT NULL, \
    `bch_value` BIGINT DEFAULT 0, \
    `coin_value` INT DEFAULT 0, \
    `block_number` INT,\
    `timestamp` TIMESTAMP, \
    PRIMARY KEY (`id`))");

console.log('Success: Database Created!');

connection.end();
