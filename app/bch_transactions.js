//Import modules
const MYSQL = require('mysql');
const DBCONFIG = require('./../config/database');
const BCC = require("./../service/bitcoincashrpc");
const BCHCONFIG = require('./../config/bchconfig');
const BCHADDR = require('bchaddrjs');
const DBSERVICE = require('./../service/db_service');
const BCHkeyStore = require('./../service/keystorebch');


// System variables
const connection = MYSQL.createConnection(DBCONFIG.connection);
const BCHRPCCLIENT = new BCC(BCHCONFIG.host, BCHCONFIG.username, BCHCONFIG.password, BCHCONFIG.port, 3000);//Bitcoin Cash RPC Connection

//All the unspent transactions that belong to the withdraw source account.
var unspentTxs =[];

const withdrawLogStatus ={
    CREATED: 0,
    SUBMITTED: 2,
    MINED: 4
};

function findRecipientAddresses(done) {
    connection.query("SELECT bch_address, username FROM "+DBCONFIG.database+ ".users", function(err, rows){
        if (err){
            return done(err);
        }
        if (rows.length===0){
            return done("New transactions weren't found!");
        }
        return done(null, rows);
    });
}

async function addRecipientAddresses(addressArray) {
    const bitcorecash = require('bitcoincashjs');
    const BASE58CHECK = bitcorecash.encoding.Base58Check;

    for(let i=0;i<addressArray.length;i++){
        let addressBase58Check;

        if(BCHCONFIG.network===bitcorecash.Networks.testnet) {
            console.log(addressArray[i].bch_address);
            console.log("6f" + addressArray[i].bch_address.slice(2));
            addressBase58Check = BASE58CHECK.encode(new Buffer.from("6f" + addressArray[i].bch_address.slice(2), "hex"));
        }
        else if(BCHCONFIG.network===bitcorecash.Networks.livenet){
            addressBase58Check = BASE58CHECK.encode(new Buffer("00"+addressArray[i].bch_address.slice(2),'hex'));
        }
        await BCHRPCCLIENT.importaddress(addressBase58Check.toString(),addressArray[i].username,false);
    }
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
async function checkBlockChainForDepositTx() {

    if((typeof  BCHRPCCLIENT!='undefined')){
        findRecipientAddresses(async function (err,data) {
            if(err){
                console.log(err);
            }else{
                for(var i =0;i <data.length; i++){
                    var username =data[i].username;
                    var transactions = await BCHRPCCLIENT.listTransactions(username,20,0,true);
                    for(var j=0;j<transactions.length;j++){
                        DBSERVICE.getBCHDepositTransactionByTxId(transactions[j].txid,function (err1, rows) {
                            if(err1)
                            {
                                console.log(err1);
                            }
                            else if(rows.length==0){
                                if((this.transaction.confirmations>=BCHCONFIG.minConfirmation)|| (this.transaction.category =='receive'))
                                {
                                    DBSERVICE.getUserByUsername(username,function (err2,data) {
                                        if(err2)
                                            console.log(err2);
                                        else{
                                            var coinsDeposit = this.transaction.amount*BCHCONFIG.coinsPerBCH;
                                            var coinBalanceNew = data[0].coin + coinsDeposit;
                                            var userid = data[0].id;
                                            DBSERVICE.updateCoinByUsername(coinBalanceNew,username,function (err3, rows) {
                                                if(err3)
                                                    console.log(err3);
                                                else{
                                                    DBSERVICE.addBCHDepositTransaction(this.transaction.txid,this.transaction.
                                                        address,userid,this.transaction.amount,0,
                                                        function (err4, rows) {
                                                            if(err4)
                                                                console.log(err4);
                                                            else{
                                                                console.log("Found a new BCH deposit transaction and updated all the records accordingly!");
                                                                console.log("Txid is "+this.transaction.txid);
                                                            }
                                                    }.bind({transaction: this.transaction}));

                                                }
                                            }.bind({transaction: this.transaction}));
                                        }
                                    }.bind({transaction: this.transaction}));
                                }
                            }
                            else
                                console.log("The transaction "+this.transaction.txid+" has already been handled by the system.");
                        }.bind({transaction: transactions[j]}));
                    }
                }
            }

        });
    }
};

/*
This function will subtract a certain amount of Coin and send User BCH instead.
 username: who asks to withdraw BCH.
 toAddress: The address that the user input to receive BCH for this request. It is legacy format.
 coinAmount: Coin to subtract from the user's account
 For example:
 withdrawBCH('8','mhREfUGuqNTpQSuPVG234kt6T9hzVYkD8Y',5000000);
*/
function withdrawBCH(username, toAddress, coinAmount,callback) {
    DBSERVICE.getUserByUsername(username, function (err1, data1) {
        if (err1) {
            return callback(err1);
        }
        else {
            var newCoinValue = data1[0].coin - coinAmount;
            var user = data1[0];
            user.coin = newCoinValue;
            if (newCoinValue < 0) {
                return callback("The user " + username + " does not have enough coins to withdraw!");
            }
            DBSERVICE.updateCoinByUsername(newCoinValue, username, function (err2, data2) {
                if (err2) {
                    return callback(err2);
                } else {
                    DBSERVICE.addBCHWithdrawLog(this.user.id, toAddress, coinAmount, withdrawLogStatus.CREATED, function (err3, data3) {
                        if (err3)
                            return callback(err3);
                        else {
                            sendTxToNode(data3, function (err4, data4) {
                                if (err4)
                                    return callback(err4);
                                else {
                                    DBSERVICE.updateBCHWithdrawLogById(this.withdrawLog.id, {
                                        tx_hash: data4,
                                        tx_status: withdrawLogStatus.SUBMITTED
                                    }, function (err5, data5) {
                                        if (err5)
                                            return callback(err5);
                                        else {
                                            return callback(null,data4);
                                        }
                                    });
                                }
                            }.bind({withdrawLog: data3}));
                        }
                    });
                }
            }.bind({user: data1[0]}));
        }
    });
}
async function sendTxToNode(withdrawLog, done) {
        var bch = require('bitcoincashjs');
        var bchkey = require('./../service/keystorebch');
        updateUnspentTx();
        var bch_value_bch = withdrawLog.coin_value / BCHCONFIG.coinsPerBCH;
        var bch_value_satoshi = bch_value_bch*100000000;
        var withdrawUTXO =chooseUnspentTxForWithdraw(bch_value_bch);
        if(withdrawUTXO.err){
            return done(withdrawUTXO.err);
        }else{
            //The current API only accept the legacy address format, not cash format. We have to convert the address format before we spend these UTXOs.
            for(var i=0; i<withdrawUTXO.UTXOs.length; i++){
                withdrawUTXO.UTXOs[i].address = BCHADDR.toLegacyAddress(withdrawUTXO.UTXOs[i].address);
            }

            var transaction = new bch.Transaction();
            transaction.from(withdrawUTXO.UTXOs);
            transaction.to(withdrawLog.to_address, bch_value_satoshi);
            transaction.change(bchkey.withdrawSource[0].address);
            transaction.sign(BCHkeyStore.withdrawSource[0].derivedPrivateKey.privateKey);

            var p =  Promise.resolve(BCHRPCCLIENT.sendRawTransaction (transaction.serialize()));
            p.then(info=>{
                return done(null,info);
            });
        }
    };

function updateUnspentTx(){

    var BCHKeyStore = require('./../service/keystorebch');
    if(BCHKeyStore.withdrawSource.length===0)
        BCHKeyStore.setWithdrawSource();
    var addresses =[];
    for (var i=0; i<BCHKeyStore.withdrawSource.length;i++){
        addresses.push(BCHKeyStore.withdrawSource[i].address.toString());
    }
    var p = Promise.resolve(BCHRPCCLIENT.listUnspent(BCHCONFIG.minConfirmation,99999999,addresses,false));
    p.then(info=>{
        unspentTxs = info;
        console.log("Retrieve unspent transaction list for withdraw source.")
    });

};


function chooseUnspentTxForWithdraw(withdrawAmount) {
    var withdrawFrom = [];
    for(var i=0; i<unspentTxs.length; i++){
            withdrawFrom.push(unspentTxs[i])
            withdrawFrom.sort(function (a,b) {
                return(a.amount-b.amount);
            });
    }
    var totalAmount =0;
    var j=0;
    for(j=0; j<withdrawFrom.length; j++){
        totalAmount += withdrawFrom[j].amount;
        if(totalAmount>withdrawAmount+BCHCONFIG.minTxFee) {
            withdrawFrom = withdrawFrom.slice(0,j+1);
            return({err:null,UTXOs:withdrawFrom});
        }
    }
    return ({err:"The account balance is insufficient."});
};


function updateSubmittedWithdrawTxs() {

    DBSERVICE.getBCHWithdrawLogByStatus(withdrawLogStatus.SUBMITTED,function (err,rows) {
        if(err)
            console.log(err);
        else{
            for(var i=0;i<rows.length;i++){
                var p= Promise.resolve(BCHRPCCLIENT.getTransaction(rows[i].tx_hash));
                p.then(function(info){

                    if(info.confirmations>=BCHCONFIG.minConfirmation)
                        DBSERVICE.updateBCHWithdrawLogById(this.row.id,{tx_status:withdrawLogStatus.MINED},function (err,date) {
                            if(err)
                                console.log(err);
                            else{
                                console.log("Tx id "+this.row.tx_hash+" has been mined successfully!");
                            }
                        }.bind({row:this.row}))
                }.bind({row:rows[i]}));

            }
        }
    });
}

module.exports = {
    addRecipientAddresses:addRecipientAddresses,
    initRecipientAddresses:initRecipientAddresses,
    checkBlockChainForDepositTx:checkBlockChainForDepositTx,
    withdrawBCH:withdrawBCH,
    BCHRPCCLIENT:BCHRPCCLIENT,
    updateUnspentTx:updateUnspentTx,
    updateSubmittedWithdrawTxs:updateSubmittedWithdrawTxs,
    withdrawBCH:withdrawBCH}