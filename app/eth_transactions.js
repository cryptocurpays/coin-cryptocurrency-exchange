//Import modules
const Web3 = require("web3");
const KS = require('./../service/keystoreeth');
const HookedWeb3Provider = require("hooked-web3-provider");
const ETHCONFIG = require('./../config/ethereum');
const DBSERVICE = require('./../service/db_service');


// System variables
var web3;
var latestCheckedBlock;
var recipientAddresses;
var unconfirmedDepositTxs;

const withdrawLogStatus ={
    CREATED: 0,
    SUBMITTED: 2,
    MINED: 4
};

function initWeb3() {
    let ks = KS.getKeyStore();
    let provider = new HookedWeb3Provider({
        host: ETHCONFIG.host,
        transaction_signer: ks
    });
    web3 = new Web3(provider);
    console.log("The web3 instance was initiated successfully. It is "+web3);
}

function initLatestCheckedBlock() {
    DBSERVICE.getLatestETHCheckedBlock(function (err,data) {
        if(err) latestCheckedBlock = ETHCONFIG.minStartBlock;
        else {
            latestCheckedBlock= Math.max(data,ETHCONFIG.minStartBlock);
        }
        console.log("The latest checked block was initiated successfully. It is "+latestCheckedBlock);
    })
}


function initRecipientAddresses() {
    DBSERVICE.getAllUsers(function (err,data) {
        if(!err){
            let addressArray = [];
            for(let i=0;i<data.length;i++){
                addressArray.push(data[i].eth_address);
            }
            addRecipientAddresses(addressArray);
        }else{
            console.log(err);
        }
    })
}

function addRecipientAddresses(addressArray) {
    if (typeof recipientAddresses !=='undefined')
        recipientAddresses = recipientAddresses.concat(addressArray);
    else recipientAddresses = addressArray;
}

function checkBlockChainForMinedTxService() {

    let latestMinedBlock = web3.eth.getBlock('latest').number;
    if((typeof recipientAddresses !=='undefined')|| (typeof latestCheckedBlock!=='undefined')|| (typeof  web3!=='undefined')){

        if(latestCheckedBlock>=latestMinedBlock-ETHCONFIG.minMinedRequirement){
            console.log('The lasted checked block is '+ latestMinedBlock+'. No new mined blocks........');
        }
        else
            checkDepositTxs(recipientAddresses,latestCheckedBlock+1,latestMinedBlock-ETHCONFIG.minMinedRequirement);
    }
    checkSubmittedWithdrawTxs();
    unconfirmedDepositTxs =getUnconfirmedDepositTx(recipientAddresses);
}

function checkDepositTxs(myaccounts, startBlockNumber, endBlockNumber) {
    if(typeof myaccounts ==='undefined')  return;

    if((startBlockNumber <ETHCONFIG.minStartBlock)||startBlockNumber===null) startBlockNumber=ETHCONFIG.minStartBlock;

    if ((endBlockNumber ===null)||(endBlockNumber<startBlockNumber)){
        endBlockNumber = web3.eth.blockNumber;
    }

    console.log("Searching for transactions for accounts \"" + myaccounts.toString() + "\" from block "  + startBlockNumber + " to block " + endBlockNumber);

    for (let i = startBlockNumber; i <= endBlockNumber; i++) {
        console.log("Searching block " + i);
        let block = web3.eth.getBlock(i, true);
        if (block !== null && block.transactions !== null) {
            block.transactions.forEach( function(transaction) {
                if (myaccounts.indexOf(transaction.to) >= 0) {
                    DBSERVICE.getUserByEthAddress(transaction.to,function (err,users) {
                        if(err) {
                            console.log(err);
                            return;
                        }
                        let depositCoinNumber = this.transaction.value/ETHCONFIG.WeisPerCoin;
                        let currentCoinNumber = users[0].coin;
                        let username = users[0].username;
                        DBSERVICE.updateCoinByUsername(depositCoinNumber+currentCoinNumber,username,function (err,data) {
                            if(err) {
                                console.log(err);
                                return;
                            }
                            DBSERVICE.addETHDepositTransaction(this.transaction.hash,this.transaction.to,this.user.id,this.transaction.value/1000000000,this.transaction.blockNumber,function (err,data) {
                                if(err) {
                                    console.log(err);
                                    return;
                                }
                                console.log(" Find a new ETH deposit transaction. TX  is "+transaction.hash+". The recipient user id is "+this.user.id);
                            }.bind({transaction:transaction,user:this.user}));

                        }.bind({transaction:transaction,user:users[0]}));

                    }.bind({transaction:transaction}));
                }
            });
            if(i>latestCheckedBlock)
                latestCheckedBlock=i;
        }
    }
}


function getUnconfirmedDepositTx(addressArray) {

    let latestMinedBlock = web3.eth.getBlock('latest').number;
    let startBlock = latestMinedBlock- ETHCONFIG.minMinedRequirement;
    let unconfirmedDepositTxs = [];
    for(let i= startBlock;i<=latestMinedBlock;i++){
        let block = web3.eth.getBlock(i, true);
        block.transactions.forEach(function (tx) {
            if(addressArray.indexOf(tx.to)>=0)
            {
                let returnTx ={'blockHash':tx.blockHash,'eth_address':tx.to,'confirmations':latestMinedBlock-tx.blockNumber,'need':20}
                unconfirmedDepositTxs.push(returnTx)
            }
        });
    }
    return unconfirmedDepositTxs;
}

function getUnconfirmedDepositTxByUsername(username,callback) {
    DBSERVICE.getUserByUsername(username,function (err,data) {
        if(err) return callback(err);
        let latestMinedBlock = web3.eth.getBlock('latest').number;
        let startBlock = latestMinedBlock- ETHCONFIG.minMinedRequirement;
        let eth_address= data[0].eth_address;
        let unconfirmedTx = [];
        for(let i= 0;i<unconfirmedDepositTxs.length;i++){
            if(eth_address===unconfirmedDepositTxs[i].eth_address)
                unconfirmedTx.push(unconfirmedDepositTxs[i]);
        }
        return callback(null,unconfirmedTx);
    })
}

function withdrawETH(username, toAddress, coinAmount,callback) {
    DBSERVICE.getUserByUsername(username, function (err1, data1) {
        if (err1) {
            return callback(err1);
        }
        else {
            let newCoinValue = data1[0].coin - coinAmount;
            let user = data1[0];
            user.coin = newCoinValue;
            if (newCoinValue < 0) {
                return callback("The user " + username + " does not have enough coins to withdraw!");
            }
            DBSERVICE.updateCoinByUsername(newCoinValue, username, function (err2, data2) {
                if (err2) {
                    return callback(err2);
                } else {
                    DBSERVICE.addETHWithdrawLog(this.user.id, toAddress, coinAmount, withdrawLogStatus.CREATED, function (err3, data3) {
                        if (err3)
                            return callback(err3);
                        else {
                            sendTxToNode(data3, function (err4, data4) {
                                if (err4)
                                    return callback(err4);
                                else {
                                    DBSERVICE.updateETHWithdrawLogById(this.withdrawLog.id, {
                                        tx_hash: data4.tx_hash,
                                        tx_status: withdrawLogStatus.SUBMITTED
                                    }, function (err5, data5) {
                                        if (err5)
                                            return callback(err5);
                                        else {
                                            return callback(null,data4.tx_hash);
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

function sendTxToNode(withdrawLog, done) {

    let from = withdrawLog.from_address;
    let to = withdrawLog.to_address;
    let value = withdrawLog.eth_value;


    let date = {
        from: from,
        to: to,
        value: value,
        gas: 50000,
        gasPrice:web3.eth.gasPrice
    }

    web3.eth.sendTransaction(date, function(error, result){
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

function checkSubmittedWithdrawTxs() {
    let latestMinedBlock = web3.eth.getBlock('latest').number;
    DBSERVICE.getETHWithdrawLogByStatus(withdrawLogStatus.SUBMITTED,function (err,rows) {
        if(err)
            console.log(err);
        else{
            for(let i=0;i<rows.length;i++) {

                let tx = web3.eth.getTransaction(rows[i].tx_hash);
                if (tx !==null && tx.blockNumber) {
                    if (tx.blockNumber < latestMinedBlock - ETHCONFIG.minMinedRequirement) {
                        DBSERVICE.updateETHWithdrawLogById(rows[i].id,{tx_status:withdrawLogStatus.MINED,block_number:tx.blockNumber},function (err,date) {
                            if(err)
                                console.log(err);
                            else{
                                console.log("ETH Tx id "+this.row.tx_hash+" has been mined successfully!");
                            }
                        }.bind({row:rows[i]}))

                    }
                }
            }
        }
    });
}

function getETHBalanceByUserId(userId,done) {
    DBSERVICE.getETHDepositeTxsByUserId(userId,function (err,data) {
        if(err)
        {
            return done(err);
        }
        let totalWithdraw =0;
        for(let i=0;i<data.length;i++){
            totalWithdraw+=data[i].value;
        }
        DBSERVICE.getETHWithdrawTxsByUserId(userId,function (err,data) {
            if(err){
                return done(err);
            }
            for(let j=0;j<data.length;j++){
                totalWithdraw-=data[j].eth_value;
            }
            return done(null,totalWithdraw);
        }.bind({totalWithdraw:totalWithdraw}))
    })
}

function getETHBalanceByUsername(username,done) {
  DBSERVICE.getUserByUsername(username,function (err,data) {
      if(err) return done(err);
      if(data.length!==1) return done("More than one user have this user name!");
      else
          getETHBalanceByUserId(data[0].id,function (err,data) {
              if(err) return done(err);
              return done(null,data)
          });
  })
}

function getETHTransactionByTxHash(txid) {
    let returnTx= web3.eth.getTransaction(txid);
    let latestMinedBlock = web3.eth.getBlock('latest').number;
    let confirmations =0;
    if(returnTx.blockNumber===null) confirmations=0;
    else confirmations = latestMinedBlock-returnTx.blockNumber;
    let tx={
        hash:txid,
        to:returnTx.to,
        value: returnTx.value,
        confirmations: confirmations
    };
    return tx;
}
module.exports = {
    init: function () {
        initWeb3();
        initLatestCheckedBlock();
        initRecipientAddresses();
    },
    addRecipientAddresses: addRecipientAddresses,
    checkBlockChainForMinedTxService: checkBlockChainForMinedTxService,
    withdrawETH:withdrawETH,
    getETHBalanceByUserId:getETHBalanceByUserId,
    getUnconfirmedDepositTxByUsername:getUnconfirmedDepositTxByUsername,
    getETHBalanceByUsername:getETHBalanceByUsername,
    getETHTransactionByTxHash,getETHTransactionByTxHash
}