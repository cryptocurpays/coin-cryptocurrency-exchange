var Keystore = require('./app/keystore');
var Eth = require('./app/eth_transactions');
var Ethconfig = require('./config/ethereum');
Keystore.init(function (ifSucceed,ksi) {
    if(ifSucceed){
        Eth.init();
    }
});

setTimeout(function () {

    Eth.checkBlockChainForMinedTxService();

},Ethconfig.ethDepositCheckInterval);

