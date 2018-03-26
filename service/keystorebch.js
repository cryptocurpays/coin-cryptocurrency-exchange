var BCHConfig = require('./../config/bchconfig')//Bitcoin Cash Configurations

const fs = require('fs');//File system

var DBService = require('./../service/db_service');//Mysql Database Services

// RPC connection to the bitcoin cash node
var BCHRpc = require("./../service/bitcoincashrpc");
var BCHRpcConnect = new BCHRpc(BCHConfig.host, BCHConfig.username, BCHConfig.password, BCHConfig.port, 3000);

//Nodejs bitcoin cash modules
var BCHCashCore = require("bitcoincashjs");
var HDPublicKey = BCHCashCore.HDPublicKey;
var HDPrivateKey = BCHCashCore.HDPrivateKey;
var Address = BCHCashCore.Address;


var hdPublicKey;
var hdPrivateKey;

// withdrawSource array includes each withdraw source account's private key and address. The address is Base58check format.
var withdrawSource=[];

function initBCHPublicKey(callback) {
        fs.readFile('keystorebchpublic.txt', 'utf8', function(err, data) {
                if (err) {
                    console.log(err);

                }
                else{
                    hdPublicKey = new HDPublicKey(data);
                    return callback;
                }
            }

        );

};

function initBCHPrivateKey(callback) {
    fs.readFile('keystorebchprivate.txt', 'utf8', function(err, data) {
            if (err) {
                return callback(err);

            }
            else{
                hdPrivateKey = new HDPrivateKey(data);
                return callback(null,hdPrivateKey);
            }
        }

    );

};


//Add addresses in withdrawSource array into bitcoin cash node with account "withdraw source". Make it possisble to check unspent transactions from nodejs.
function addWithdrawSourceAddrToWallet(callback) {

    if(withdrawSource.length===0)
        setWithdrawSource();
    var BCC = require("./../service/bitcoincashrpc");
    var BCHRrcClient = new BCC(BCHConfig.host, BCHConfig.username, BCHConfig.password, BCHConfig.port, 3000);//Bitcoin Cash RPC Connection
    var p;
    for(var i=0;i<withdrawSource.length;i++){
        p =  Promise.resolve(BCHRpcConnect.importaddress(withdrawSource[i].address.toString(),"withdrawSource",false));
    }
    p.then(info=>{
        return callback(null, i);
    });
};


//set up withdrawSource Array
function setWithdrawSource() {
    var hdPath = BCHConfig.withdrawSourceHDPath;
    for (var i=0; i< hdPath.length; i++){
        var derivedPrivateKey = hdPrivateKey.derive(hdPath[i]);
        var derivedAddressBase58Check = new Address(derivedPrivateKey.publicKey, BCHConfig.network,'pubkeyhash');
        withdrawSource.push({derivedPrivateKey:derivedPrivateKey,address: derivedAddressBase58Check.toString()});
    }
};

function updateUserToAddress(username) {

    var derivedByArgument = hdPublicKey.derive("m/0/0");
    DBService.getUserByUsername(username,function (err, users) {
        if(err)
        {
            console.log(err);
            return;
        }else{
            var userid = users[0].id;
            var derivedAddressBase58Check = new Address(derivedByArgument.derive(userid).publicKey, BCHConfig.network,'pubkeyhash');
            var BASE58CHECK = BCHCashCore.encoding.Base58Check;
            var derivedAddressHex ="0x"+BASE58CHECK.decode(derivedAddressBase58Check.toString()).toString('hex').slice(2);

            var updateList ={bch_address:derivedAddressHex};
            DBService.updateUsersById(userid,updateList,function (err2,data2) {
                if(err2){
                    console.log(err);
                    return;
                }
                else{
                    console.log("The new username "+ username+", BCH Hex address is "+ derivedAddressHex+". BCH Base58check address is "+derivedAddressBase58Check.toString());
                    var p =  Promise.resolve(BCHRpcConnect.importaddress(derivedAddressBase58Check.toString(),username,false));
                    p.then(info=>{
                        console.log("Import the address to the node wallet!")
                    });
                }
            });
        }
    });
};

module.exports ={
   init:function(callback){
       initBCHPublicKey();
       initBCHPrivateKey(function (err, privateKey) {
           if(err)
               return (err);
           else {
               setWithdrawSource();
               addWithdrawSourceAddrToWallet(function (err, amount) {
                   if (err)
                       return callback(err);
                   else{
                       return callback(null);
                   }
               });
           }

       });
   },
    updateUserToAddress:updateUserToAddress, 
    withdrawSource:withdrawSource,
    hdPrivateKey:hdPrivateKey,
    setWithdrawSource:setWithdrawSource,
}
