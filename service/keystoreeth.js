var dbconfig = require('./../config/database');
var ethconfig = require('./../config/ethereum');
const DBSERVICE = require('./../service/db_service');
const fs = require('fs');

var ks ;

function setksintance(ksi) {
    ks = ksi;
    console.log('The key store instance is good...'+ks);
};

function getKeyStore() {
    return ks;
};

function initKeystore(callback) {
        const fs = require('fs');
        ks = fs.readFile('keystore.txt', 'utf8', function(err, data) {
                if (err) {
                    console.log(err);
                    var lightwallet = require('eth-lightwallet');
                    var seed = lightwallet.keystore.generateRandomSeed();
                    var password = Math.random().toString();
                    console.log('The seed is '+seed);
                    console.log('The password is '+password);

                    lightwallet.keystore.createVault({
                        password: password,
                        seedPhrase: seed,
                        hdPathString: "m/0'/0'/0'"
                    }, function (err, ks) {

                        if(err){
                            console.log(err);
                            return callback(false);
                        }else{

                            ks.keyFromPassword(password, function (err, pwDerivedKey) {
                                if(err)
                                {
                                    console.log('Error keystore instance from password!');
                                    return callback(false);
                                }
                                else
                                {
                                    var serialized = ks.serialize();

                                    fs.writeFile('keystore.txt', serialized, function(err){
                                        // throws an error, you could also catch it here
                                        if (err) throw err;

                                        // success case, the file was saved
                                        console.log('Keystore saved!');
                                        return callback(true,ks);


                                    });

                                }

                            });

                        }

                    });
                }
                else{
                    var deserialize = data;
                    var lightwallet = require('eth-lightwallet');
                    var keystoreinstance = lightwallet.keystore.deserialize(deserialize);
                    console.log("Load keystore from local file.");

                    keystoreinstance.keyFromPassword(ethconfig.keyStorePassword, function (err, pwDerivedKey) {
                        if(err)
                        {
                            console.log(err);
                        }else{
                            keystoreinstance.passwordProvider = function (callback) {
                                callback(null, ethconfig.keyStorePassword);
                            };
                        }
                    });
                    return callback(true,keystoreinstance);

                }
            }

        );

};

function updateUserToAddress(username) {

    ks.keyFromPassword(ethconfig.keyStorePassword, function (err, pwDerivedKey) {
        if(err)
        {
            return console(err);
        }
        else
        {
            DBSERVICE.getUserByUsername(username,function (err,data) {
                if(err) {
                    console.log(err);
                    return;
                }
                if(ks.getAddresses().length <data[0].id)
                {
                    ks.generateNewAddress(pwDerivedKey,data[0].id-ks.getAddresses().length)
                }
                let address = ks.getAddresses()[data[0].id-1];
                let updateList ={eth_address:address};
                DBSERVICE.updateUsersByUsername(username,updateList,function (err,data) {
                    if(err){
                        console.log(err);
                        return;
                    }
                    else{
                        console.log("The new username "+ username+", ETH address is "+ address);
                        const ETH_TX = require('./../app/eth_transactions');
                        ETH_TX.addRecipientAddresses(address);
                        var serialized = ks.serialize();
                        fs.writeFile('keystore.txt', serialized, function(err){
                            if (err) throw err;
                            // success case, the file was saved
                            console.log('Keystore new key saved to file!');
                        });
                    }
                })

            });
        }
    });

};

module.exports ={
    getKeyStore: getKeyStore,
   init: function (callback) {
       initKeystore(function (isSucceed, ksi) {
           if(isSucceed){
               setksintance(ksi);
               return callback(true,ksi);
           }
       });
   },
    updateUserToAddress:updateUserToAddress
}
