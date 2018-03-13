var mysql = require('mysql');
var dbconfig = require('./../config/database');
var ethconfig = require('./../config/ethereum');
var connection = mysql.createConnection(dbconfig.connection);
const fs = require('fs');

var ks ;

function setksintance(ksi) {
    ks = ksi;
    console.log('The key store instance is good...'+ks);
};

function getKeyStore() {
    return ks;
};

function initkeystore(callback) {
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
            console.log(err);
        }
        else
        {
            ks.generateNewAddress(pwDerivedKey, 10);
            var addresses = ks.getAddresses();
            updateUserToAddressWithArray(username,addresses);
        }
    });
};


function updateUserToAddressWithArray(username, addressArray){
    var ethtransaction = require('./../app/eth_transactions');

    if(addressArray.length==0)
        console.log("UpdateUserToAddress failed. No more addresses in Address Array.");
    else{
        var newAddress = addressArray[0];
        ethtransaction.findUserByToAddresses(newAddress,function (ifSucceed, u) {
            if(!ifSucceed){
                var updateQuery = "UPDATE "+dbconfig.database+".users SET eth_address = '"+ newAddress+ "' where username = '" + username+"'";
                connection.query(updateQuery,function(err, rows) {
                    if(err){
                        console.log(err);
                    }else
                        console.log("The new username "+ username+", address is "+ newAddress);
                    ethtransaction.addRecipientAddresses([newAddress]);
                    var serialized = ks.serialize();
                    fs.writeFile('keystore.txt', serialized, function(err){
                        if (err) throw err;
                        // success case, the file was saved
                        console.log('Keystore new key saved to file!');
                    });
                });
            }else{
                addressArray.shift();
                updateUserToAddressWithArray(username,addressArray);
            }
        });
    }
};


module.exports ={
    getKeyStore: getKeyStore,
    getks: function () {
        return ks;
    },
   init: function (callback) {
       initkeystore(function (isSucceed, ksi) {
           if(isSucceed){
               setksintance(ksi);
               return callback(true,ksi);
           }
       });
   },
    updateUserToAddress:updateUserToAddress
}
