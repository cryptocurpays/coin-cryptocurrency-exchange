// This script creates a BIP 32 HD Private Key and save as a file to the server.

var bitcorecash = require('bitcoincashjs');
var HDPrivateKey = bitcorecash.HDPrivateKey;

var hdPrivateKey = new HDPrivateKey();
var hdPublicKey = hdPrivateKey.hdPublicKey;
var publickeyString = hdPublicKey.toString();
var privatekeyString = hdPrivateKey.toString();

const fs = require('fs');
fs.writeFile('./keystorebchprivate.txt', privatekeyString, function(err){
    // throws an error, you could also catch it here
    if (err) throw err;

    // success case, the file was saved
    console.log('BCH Private key '+ hdPrivateKey.toString()+'was saved to keystorebch.txt!');

});
fs.writeFile('./keystorebchpublic.txt', publickeyString, function(err){
    // throws an error, you could also catch it here
    if (err) throw err;

    // success case, the file was saved
    console.log('BCH Public key '+ publickeyString+'was saved to keystorebch.txt!');

});

