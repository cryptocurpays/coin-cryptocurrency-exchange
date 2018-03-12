const MYSQL = require('mysql');
const DBCONFIG = require('./../config/database');
const connection = MYSQL.createConnection(DBCONFIG.connection);
const BCHCONFIG = require('./../config/bchconfig');

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
            return(err);
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
    let coin_value = coinAmount;
    let bch_value = coinAmount / BCHCONFIG.coinsPerBCH;
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

function getBCHWithdrawLogByStatus(status,done) {
    let selectQuery = "select * from "+DBCONFIG.database+"."+ DBCONFIG.bch_withdraw_log+" WHERE tx_status ="+status;

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
    getBCHWithdrawLogByStatus:getBCHWithdrawLogByStatus
};
