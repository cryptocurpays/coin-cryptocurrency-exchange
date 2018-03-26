const MYSQL = require('mysql');
const DBCONFIG = require('./../config/database');
const connection = MYSQL.createConnection(DBCONFIG.connection);
const BCHCONFIG = require('./../config/bchconfig');
const ETHCONFIG = require('./../config/ethereum');


function getUserByUsername(username,done) {
    connection.query("SELECT * FROM "+DBCONFIG.database+ "."+ DBCONFIG.users_table +" where username='"+username+"'", function(err, rows){
        if (err){
            return done(err);
        }
        else if(rows.length==0){
            return done("No users with this username "+username+" were found!");
        }
        else if(rows.length>1){
            return done("More than one users with this username "+username+" were found!");
        }
        return done(null, rows);
    });
}

function getUserByUseId(userId,done) {
    connection.query("SELECT * FROM "+DBCONFIG.database+ "."+ DBCONFIG.users_table +" where id='"+userId+"'", function(err, rows){
        if (err){
            return done(err);
        }
        else if(rows.length==0){
            return done("No users with this user id "+userId+" were found!");
        }
        else if(rows.length>1){
            return done("More than one users with this id "+userId+" were found!");
        }
        return done(null, rows);
    });
}

function getUserByEthAddress(eth_address,done) {
    connection.query("SELECT * FROM "+DBCONFIG.database+ "."+ DBCONFIG.users_table +" where eth_address='"+eth_address+"'", function(err, rows){
        if (err){
            return done(err);
        }
        else if(rows.length==0){
            return done("No users with this eth_address "+eth_address+" were found!");
        }
        else if(rows.length>1){
            return done("More than one users with this eth_address "+eth_address+" were found!");
        }
        return done(null, rows);
    });
}


function getAllUsers(done) {
    connection.query("SELECT * FROM "+DBCONFIG.database+ ".users", function(err, rows){
        if (err){
            return done(err);
        }
        if (rows.length===0){
            return done("No Users are found in Mysql database!");
        }
        return done(null, rows);
    });
}

function updateCoinByUsername(coin,username,done) {

    connection.query("UPDATE "+DBCONFIG.database+".users SET coin = ? WHERE username = ?",[coin, username], function(err, rows){
        if (err){
            return done(err);
        }
        return done(null,rows);
    });
}

function addBCHDepositTransaction(txhash,to_address,to_user_id,value,blocknumber,done) {

    let insertQuery = "INSERT INTO "+DBCONFIG.database+".bch_transaction ( txhash, to_address, to_user_id, value, blocknumber )" +
        " values ('"+txhash+"','"+to_address+"',"+to_user_id+","+value+","+blocknumber+")";

    connection.query(insertQuery, function (err, rows) {
        if(err)
            return done(err);
        else{
            return done(null, rows);
        }
    });
}


function addETHDepositTransaction(txhash,to_address,to_user_id,value,blocknumber,done) {

    let insertQuery = "INSERT INTO "+DBCONFIG.database+".eth_transaction ( txhash, to_address, to_user_id, value, blocknumber )" +
        " values ('"+txhash+"','"+to_address+"',"+to_user_id+","+value+","+blocknumber+")";
    connection.query(insertQuery, function (err, rows) {
        if(err){
            return done(err);
        }
        else{
            return done(null, rows);
        }
    });
}


function getBCHDepositTransactionByTxId(txid, done) {
    connection.query("SELECT * FROM "+DBCONFIG.database+ "."+DBCONFIG.bch_transaction+ " where txhash = '" +txid+"'", function(err, rows){
        if (err){
            return done(err);
        }
        return done(null, rows);
    });
}

function addBCHWithdrawLog(userid, toAddress, coinAmount,status,done) {

    let from_address = BCHCONFIG.withdrawSourceAccount;
    let to_address = toAddress;
    let to_userId = userid;
    let coin_value= coinAmount;
    let bch_value = 100000000*coinAmount /BCHCONFIG.coinsPerBCH;
    let tx_status = status;

    let insertQuery = "INSERT INTO "+DBCONFIG.database+"."+ DBCONFIG.bch_withdraw_log+"( from_address, to_address, to_user_id, coin_value, bch_value, tx_status)" +
        " values ('"+from_address+"','"+to_address+"',"+to_userId+","+coin_value+","+bch_value+","+tx_status+")";

    connection.query(insertQuery,function (err, result) {
        if(err){
            return done(err);
        }else{
            let withdrawLog = {
                id:result.insertId,
                from_address: from_address,
                to_address:to_address,
                to_userId: to_userId,
                coin_value: coin_value,
                bch_value: bch_value,
                tx_status: tx_status
            };
            return done(null,withdrawLog );
        }
    })

}



function addETHWithdrawLog(userid, toAddress, coinAmount,status,done) {

    let from_address = ETHCONFIG.withdrawSourceAccount;
    let to_address = toAddress;
    let to_userId = userid;
    let coin_value = coinAmount;
    let eth_value = coinAmount*ETHCONFIG.WeisPerCoin/1000000000;
    let tx_status = status;

    let insertQuery = "INSERT INTO "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+"( from_address, to_address, to_user_id, coin_value, eth_value, tx_status)" +
        " values ('"+from_address+"','"+to_address+"',"+to_userId+","+coin_value+","+eth_value+","+tx_status+")";

    connection.query(insertQuery,function (err, result) {
        if(err){
            return done(err);
        }else{
            let withdrawLog = {
                id:result.insertId,
                from_address: from_address,
                to_address:to_address,
                to_userId: to_userId,
                coin_value: coin_value,
                eth_value: eth_value,
                tx_status: tx_status
            };
            return done(null,withdrawLog );
        }
    })

}

function updateBCHWithdrawLogById(id,list,done) {
    let keys = Object.keys(list);
    let values = Object.values(list);
    let setString = 'set ';
    for(let i=0; i<keys.length; i++){
        if(typeof values[i]==='string')
            setString = setString + keys[i]+"='"+values[i]+"'";
        else
            setString = setString + keys[i]+"="+values[i];
        if(i!==keys.length-1) setString= setString+', ';
    }
    let updateQuery = "UPDATE "+DBCONFIG.database+"."+ DBCONFIG.bch_withdraw_log+" "+setString+" WHERE id ="+id;

    connection.query(updateQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}


function updateETHWithdrawLogById(id,list,done) {
    let keys = Object.keys(list);
    let values = Object.values(list);
    let setString = 'set ';
    for(let i=0; i<keys.length; i++){
        if(typeof values[i]==='string')
            setString = setString + keys[i]+"='"+values[i]+"'";
        else
            setString = setString + keys[i]+"="+values[i];
        if(i!==keys.length-1) setString= setString+', ';
    }
    let updateQuery = "UPDATE "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+" "+setString+" WHERE id ="+id;

    connection.query(updateQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

function updateETHWithdrawLogById(id,list,done) {
    let keys = Object.keys(list);
    let values = Object.values(list);
    let setString = 'set ';
    for(let i=0; i<keys.length; i++){
        if(typeof values[i]==='string')
            setString = setString + keys[i]+"='"+values[i]+"'";
        else
            setString = setString + keys[i]+"="+values[i];
        if(i!==keys.length-1) setString= setString+', ';
    }
    let updateQuery = "UPDATE "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+" "+setString+" WHERE id ="+id;

    connection.query(updateQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

function updateUsersById(id,list,done) {
    let keys =Object.keys(list);
    let values = Object.values(list);
    let setString = 'set ';
    for(let i=0; i<keys.length; i++){
        if(typeof values[i]==='string')
            setString = setString + keys[i]+"='"+values[i]+"'";
        else
            setString = setString + keys[i]+"="+values[i];
        if(i!==keys.length-1) setString= setString+', ';
    }
    let updateQuery = "UPDATE "+DBCONFIG.database+"."+ DBCONFIG.users_table+" "+setString+" WHERE id ="+id;
    connection.query(updateQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
};


function updateUsersByUsername(username,list,done) {
    let keys =Object.keys(list);
    let values = Object.values(list);
    let setString = 'set ';
    for(let i=0; i<keys.length; i++){
        if(typeof values[i]==='string')
            setString = setString + keys[i]+"='"+values[i]+"'";
        else
            setString = setString + keys[i]+"="+values[i];
        if(i!==keys.length-1) setString= setString+', ';
    }
    let updateQuery = "UPDATE "+DBCONFIG.database+"."+ DBCONFIG.users_table+" "+setString+" WHERE username ='"+username+"'";
    connection.query(updateQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
};

function getBCHWithdrawLogByStatus(status,done) {
    let selectQuery = "select * from "+DBCONFIG.database+"."+ DBCONFIG.bch_withdraw_log+" WHERE tx_status ="+status;

    connection.query(selectQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

function getETHWithdrawLogByStatus(status,done) {
    let selectQuery = "select * from "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+" WHERE tx_status ="+status;

    connection.query(selectQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

function getLatestETHCheckedBlock(done) {
    connection.query("SELECT MAX(blocknumber) as max_blocknumber FROM "+DBCONFIG.database+ ".eth_transaction", function(err, rows){
        if (err){
            return done(err);
        }
        if (rows.length == 0){
            return done("No transactions were found in database!");
        }
        // all is well, return successful user
        return done(null, rows[0].max_blocknumber);
    });
};

function getETHDepositeTxsByUserId(userId,done){
    let selectQuery = "select * from "+DBCONFIG.database+"."+ DBCONFIG.ethereum_transaction+" WHERE to_user_id ="+userId;

    connection.query(selectQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

function getETHWithdrawTxsByUserId(userId,done){
    let selectQuery = "select * from "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+" WHERE to_user_id ="+userId;

    connection.query(selectQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

function getBCHDepositeTxsByUserId(userId,done){
    let selectQuery = "select * from "+DBCONFIG.database+"."+ DBCONFIG.bch_transaction+" WHERE to_user_id ="+userId;
    connection.query(selectQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

function getBCHWithdrawTxsByUserId(userId,done){
    let selectQuery = "select * from "+DBCONFIG.database+"."+ DBCONFIG.bch_withdraw_log+" WHERE to_user_id ="+userId;
    connection.query(selectQuery,function (err, rows) {
        if (err) {
            return done(err);
        }
        return done(null, rows);
    });
}

module.exports = {
    getUserByUsername: getUserByUsername,
    updateCoinByUsername: updateCoinByUsername,
    addBCHDepositTransaction:addBCHDepositTransaction,
    getBCHDepositTransactionByTxId:getBCHDepositTransactionByTxId,
    addBCHWithdrawLog:addBCHWithdrawLog,
    updateBCHWithdrawLogById:updateBCHWithdrawLogById,
    updateUsersById:updateUsersById,
    getBCHWithdrawLogByStatus:getBCHWithdrawLogByStatus,
    getAllUsers:getAllUsers,
    getETHWithdrawLogByStatus:getETHWithdrawLogByStatus,
    getLatestETHCheckedBlock:getLatestETHCheckedBlock,
    updateETHWithdrawLogById:updateETHWithdrawLogById,
    updateUsersByUsername:updateUsersByUsername,
    getUserByEthAddress:getUserByEthAddress,
    addETHDepositTransaction:addETHDepositTransaction,
    addETHWithdrawLog:addETHWithdrawLog,
    getETHDepositeTxsByUserId:getETHDepositeTxsByUserId,
    getETHWithdrawTxsByUserId:getETHWithdrawTxsByUserId,
    getBCHDepositeTxsByUserId:getBCHDepositeTxsByUserId,
    getBCHWithdrawTxsByUserId:getBCHWithdrawTxsByUserId,
    getUserByUseId:getUserByUseId
};
