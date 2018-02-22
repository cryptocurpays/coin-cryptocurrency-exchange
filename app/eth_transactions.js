//Import modules
var Web3 = require("web3");
var KS = require('./keystore');
var HookedWeb3Provider = require("hooked-web3-provider");
var MYSQL = require('mysql');
var DBCONFIG = require('./../config/database');
var ETHCONFIG = require('./../config/ethereum');


// System variables
var connection = MYSQL.createConnection(DBCONFIG.connection);
var web3;
var latestCheckedBlock;
var recipientAddresses;
var unMinedWithdrawTxs = [];


const withdrawLogStatus ={
    CREATED: 0,
    SUBMITTED: 2,
    MINED: 4
};


function initWeb3() {
    var ks = KS.getKeyStore();
    var provider = new HookedWeb3Provider({
        host: ETHCONFIG.host,
        transaction_signer: ks
    });
    web3 = new Web3(provider);
    console.log("The web3 instance was initiated successfully. It is "+web3);

};

function initUnMinedWithdrawTxs() {

    var selectQuery ="SELECT * FROM " + DBCONFIG.database + "." + DBCONFIG.eth_withdraw_log+" WHERE tx_status = "+withdrawLogStatus.SUBMITTED;
    connection.query(selectQuery,function (err, rows) {
        if(err){
            console.log(err);
        }else{
            unMinedWithdrawTxs = unMinedWithdrawTxs.concat(rows);
        }
    })
}

function initLatestCheckedBlock() {
    findLatestCheckedBlockMysql(function (err, number) {
        if(err) latestCheckedBlock =0;
        else
            latestCheckedBlock = number;
        console.log("The latest checked block was initiated successfully. It is "+latestCheckedBlock);

    })
};

function initRecipientAddresses() {
    findRecipientAddresses(function (err, addressArray) {
        if(!err){
            addRecipientAddresses(addressArray);

        }else{
            console.log(err);
        }
    })
};


function checkBlockChainForMinedTxService() {

    var latestMinedBlock = web3.eth.getBlock('latest').number;


    if((typeof getRecipientAddresses() != 'undefined')||
        (typeof getLatestCheckedBlock()!='undefined')||
        (typeof  getWeb3()!='undefined')){


        if(latestCheckedBlock==latestMinedBlock){
            console.log('The lasted checked block is '+ latestMinedBlock+'. No new mined blocks........');
        }
        else
            depositTransactionsToAccounts(recipientAddresses,latestCheckedBlock+1,latestMinedBlock-ETHCONFIG.minMinedRequirement);
    }
    for(var i=0; i<unMinedWithdrawTxs.length;i++){
        var tx = web3.eth.getTransaction(unMinedWithdrawTxs[i].tx_hash);
        if (tx != null) {
                if(tx.blockNumber <latestMinedBlock - ETHCONFIG.minMinedRequirement){
                        console.log("Found a mined withdraw transaction. The Tx ID is "+tx.id+", at blockNumber "+tx.blockNumber);
                        unMinedWithdrawTxs[0].block_number = tx.blockNumber;
                        updateWithdrawLog(unMinedWithdrawTxs[0],withdrawLogStatus.MINED,function (err,withdrawLog) {
                            if(err){
                                console.log(err);
                            }else{
                                console.log("Update status to Mined in withdraw log database, id "+unMinedWithdrawTxs[0].id);
                            }

                        });

                }
        }
    }
};


function findLatestCheckedBlockMysql(done) {
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


function getLatestCheckedBlock() {
    return latestCheckedBlock;
};

function setLatestCheckedBlock(number) {
    latestCheckedBlock = number;
};



function findRecipientAddresses(done) {
    connection.query("SELECT eth_address FROM "+DBCONFIG.database+ ".users", function(err, rows){
        if (err){
            return done(err);
        }
        if (rows.length==0){
            return done("New transactions weren't found!");
        }
        // all is well, return successful user
        var returnArray =[];
        for(var i=0; i<rows.length;i++){
            returnArray.push(rows[i].eth_address);
        }
        return done(null, returnArray);
    });
};

function findUserByToAddresses(address,done) {
    connection.query("SELECT * FROM "+DBCONFIG.database+ ".users Where eth_address = '"+address+"'", function(err, rows){
        if (err){
            console.log(err);
            return done(false);
        }
        if (rows.length==0){
            console.log("This address belongs to nobody!");
            return done(false);
        }
        return done(true, rows);
    });
};

function getRecipientAddresses() {
    return recipientAddresses;
};

function addRecipientAddresses(addressArray) {
    if (typeof recipientAddresses !='undefined')
        recipientAddresses = recipientAddresses.concat(addressArray);
    else recipientAddresses = addressArray;
    console.log("The recipient address array was initiated successfully. It is "+recipientAddresses.toString());
};


function depositTransactionsToAccounts(myaccounts, startBlockNumber, endBlockNumber) {
    for(var j=0; j<myaccounts.length; j++)
        console.log("The addresss array is "+myaccounts[j]);

    if(startBlockNumber <ETHCONFIG.minStartBlock) startBlockNumber=ETHCONFIG.minStartBlock;
    var eth = web3.eth;
    if (endBlockNumber == null) {
        endBlockNumber = eth.blockNumber;
        console.log("Using endBlockNumber: " + endBlockNumber);
    }
    if (startBlockNumber == null) {
        startBlockNumber = endBlockNumber - 1000;
        console.log("Using startBlockNumber: " + startBlockNumber);
    }
    console.log("Searching for transactions to/from account \"" + myaccounts.toString() + "\" within blocks "  + startBlockNumber + " and " + endBlockNumber);

    for (var i = startBlockNumber; i <= endBlockNumber; i++) {
  //      if (i % 1000 == 0) {
            console.log("Searching block " + i);
    //    }
        var block = eth.getBlock(i, true);
        if (block != null && block.transactions != null) {
            block.transactions.forEach( function(e) {

                if (myaccounts.indexOf(e.to) >= 0) {
                    findUserByTx(e,function (ifSucceed, u, e) {
                        if(ifSucceed){
                            console.log('findUserByTx succeeded '+u.id);
                            depositCoinsByTx(u,e,function (ifSucceed1,u1,e1) {
                                if(ifSucceed1){
                                    insertTransaction(e1,u1,function (ifSucceed2,e2) {
                                        if(ifSucceed2)
                                            if(typeof getLatestCheckedBlock()!= 'undefined')
                                                if(e2.blockNumber>getLatestCheckedBlock())
                                                    setLatestCheckedBlock(e2.blockNumber);
                                    });
                                }

                            })
                        }
                    });
                }
            });
            if(i>getLatestCheckedBlock())
                    setLatestCheckedBlock(i);
        }
    }
};

function insertTransaction(e,user,done) {

    var newTxMysql = {
        txhash: e.hash,
        to_address: e.to,
        to_user_id: user.id,
        value: e.value,
        blocknumber: e.blockNumber,
    };

    var insertQuery = "INSERT INTO "+DBCONFIG.database+".eth_transaction ( txhash, to_address, to_user_id, value, blocknumber )" +
        " values (?,?,?,"+newTxMysql.value+","+newTxMysql.blocknumber+")";

    connection.query(insertQuery, [newTxMysql.txhash, newTxMysql.to_address, newTxMysql.to_user_id], function (err, rows) {
        if(err)
            console.log(err);

        else{
            console.log('The new transaction is created successful!');
            return done(true, e);
        }

    });
};

function findUserByTx(e, done) {

    var txhash = e.to;
    connection.query("SELECT * FROM "+DBCONFIG.database+".users WHERE eth_address = ?",[txhash], function(err, rows){
        if (err){
            console.log(err);
            return done(false);
        }

        if (rows.length!=1) {
            console.log('More than one user have the ethereum recipient address!');
            return done(false);
        }

        // all is well, return successful user
        return done(true, rows[0], e);
    });
};

function depositCoinsByTx(u, e, done) {

    var depositCoinNumber = e.value/ETHCONFIG.WeisPerCoin;
    var currentCoinNumber = u.coin;
    var userid = u.id;

    connection.query("UPDATE "+DBCONFIG.database+".users SET coin = ? WHERE id = ?",[currentCoinNumber+depositCoinNumber, userid], function(err, rows){
        if (err){
            console.log(err);
            return done(false);
        }

        // all is well, return successful user
        return done(true, u, e);
    });
};


/*
This function will subtract a certain amount of Coin and send User Ethereum instead.
 u.id: the address that User is willing to accept the Ethereum.
 u.coin: User's current coin value.
 toAddress: The address that user put in to receive Ethereum for this request.
 coinAmount: Coin amount deduct from User for Ethereum.
*/
function withdrawEth(u, toAddress, coinAmount) {
    subtractCoin(u, coinAmount, function (err, u) {
        if(err){
            console.log(err);
        }else{
            createWithdrawLog(u,toAddress,coinAmount,function (err, withdrawLog) {
                if(err){
                    console.log(err);//Need to consider rollback the coin and let user know
                }else{
                    sendTxToNode(withdrawLog,function (err, withdrawLog) {
                        if(err){
                            console.log(err);//Need to consider retry
                        }else{
                            updateWithdrawLog(withdrawLog,withdrawLogStatus.SUBMITTED,function (err, withdrawLog) {
                                if(err){
                                    console.log(err);
                                }else{
                                    console.log("The withdraw transaction was sent to Ethereum node and transaction hash:"+withdrawLog.tx_hash+" was save to log DB!");
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};

function subtractCoin(u, coinAmount, done) {
    var currentCoin = u.coin;
    var userId = u.id;
    connection.query("UPDATE "+DBCONFIG.database+".users SET coin = ? WHERE id = ?",[currentCoin-coinAmount, userId], function(err, rows){
        if (err){
            return done(err);
        }
        return done(null, u);
    });
};

function createWithdrawLog(u, toAddress, coinAmount,done) {

    var from_address = ETHCONFIG.withdrawSourceAccount;
    var to_address = toAddress;
    var to_userId = u.id;
    var coin_value = coinAmount;
    var eth_value = coinAmount*ETHCONFIG.WeisPerCoin;
    var tx_status = withdrawLogStatus.CREATED;

    var insertQuery = "INSERT INTO "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+"( from_address, to_address, to_user_id, coin_value, eth_value, tx_status)" +
        " values ('"+from_address+"','"+to_address+"',"+to_userId+","+coin_value+","+eth_value+","+tx_status+")";

    connection.query(insertQuery,function (err, result) {
        if(err){
            return done(err);
        }else{
            var withdrawLog = {
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

};

function sendTxToNode(withdrawLog, done) {
    ks = KS.getKeyStore();
    var provider = new HookedWeb3Provider({
        host: ETHCONFIG.host,
        transaction_signer: ks
    });

    var web3 = new Web3(provider);

    var from = withdrawLog.from_address;
    var to = withdrawLog.to_address;
    var value = withdrawLog.eth_value

    web3.eth.sendTransaction({
        from: from,
        to: to,
        value: value,
        gas: 21000
    }, function(error, result){
        if(error)
        {
            return done(error);
        }
        else
        {
            withdrawLog.tx_status = withdrawLogStatus.SUBMITTED;
            withdrawLog.tx_hash = result;
            return done(null, withdrawLog);
        }
    })


}

function updateWithdrawLog(withdrawLog,status,done) {

    if(status ==withdrawLogStatus.SUBMITTED)
    {
        var id = withdrawLog.id;
        var tx_status = withdrawLog.tx_status;
        var tx_hash = withdrawLog.tx_hash;

        var updateQuery = "UPDATE "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+" SET tx_status="+tx_status+", tx_hash='"+tx_hash+"' WHERE id ="+id;

        connection.query(updateQuery,function (err, rows) {
            if(err){
                console.log(err);
                return done(err);
            }else{
                return done(null, withdrawLog);
            }
        });
    }
    else if(status==withdrawLogStatus.MINED)
    {
        var id = withdrawLog.id;
        var block_number = withdrawLog.block_number;
        var tx_status = withdrawLog.tx_status;
        var updateQuery = "UPDATE "+DBCONFIG.database+"."+ DBCONFIG.eth_withdraw_log+" SET block_number="+block_number+", tx_status='"+status+"' WHERE id ="+id;
        connection.query(updateQuery,function (err, rows) {
            if(err){
                return done(err);
            }else{
                if(!removeWithdrawTransactionList(withdrawLog))
                    console("Fail to remove the just mined transaction from localUnminedList.");
                return done(null, rows[0]);
            }
        });

    }else{
        return done("Update ethereum withdraw request error. The status must be submitted or mined!");
    }

};

function removeWithdrawTransactionList(withdrawLog) {

    for(var j=0;j< unMinedWithdrawTxs.length; j++){
        if(unMinedWithdrawTxs[j].id == withdrawLog.id)
        {
            unMinedWithdrawTxs.splice(j,1);
            return true;
        }
    }
    return false;
}


function getWeb3() {
        return web3;
    };

module.exports = {
    withdrawEth:withdrawEth,
    init: function () {
        initWeb3();
        initLatestCheckedBlock();
        initRecipientAddresses();
        initUnMinedWithdrawTxs();
    },
    addRecipientAddresses: addRecipientAddresses,
    checkBlockChainForMinedTxService: checkBlockChainForMinedTxService,
    findUserByToAddresses:findUserByToAddresses,
    withdrawEth:withdrawEth

}