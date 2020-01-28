const FS = require('fs'); 

/**
 * Implements a MoneroWallet which only manages keys using WebAssembly.
 */
class MoneroWalletKeys extends MoneroWallet {
  
  // --------------------------- STATIC UTILITIES -----------------------------
  
  static async createWalletRandom(networkType, language) {

    // validate and sanitize params
    MoneroNetworkType.validate(networkType);
    if (language === undefined) language = "English";
    
    // load wasm module
    let module = await MoneroUtils.loadWasmModule();
    
    // return promise which is resolved on callback
    return new Promise(function(resolve, reject) {
      
      // define callback for wasm
      let callbackFn = async function(cppAddress) {
        resolve(new MoneroWalletKeys(cppAddress));
      };
      
      // create wallet in wasm and invoke callback when done
      module.create_keys_wallet_random(networkType, language, callbackFn);
    });
  }
  
  static async createWalletFromMnemonic(networkType, mnemonic, seedOffset) {
    
    // validate and sanitize params
    MoneroNetworkType.validate(networkType);
    if (mnemonic === undefined) throw Error("Must define mnemonic phrase to create wallet from");
    if (seedOffset === undefined) seedOffset = "";
    
    // load wasm module
    let module = await MoneroUtils.loadWasmModule();
    
    // return promise which is resolved on callback
    return new Promise(function(resolve, reject) {
      
      // define callback for wasm
      let callbackFn = async function(cppAddress) {
        resolve(new MoneroWalletKeys(cppAddress));
      };
      
      // create wallet in wasm and invoke callback when done
      module.create_keys_wallet_from_mnemonic(networkType, mnemonic, seedOffset, callbackFn);
    });
  }
  
  static async createWalletFromKeys(networkType, address, privateViewKey, privateSpendKey, language) {
    
    // validate and sanitize params
    MoneroNetworkType.validate(networkType);
    if (address === undefined) address = "";
    if (privateViewKey === undefined) privateViewKey = "";
    if (privateSpendKey === undefined) privateSpendKey = "";
    if (language === undefined) language = "English";
    
    // load wasm module
    let module = await MoneroUtils.loadWasmModule();
    
    // return promise which is resolved on callback
    return new Promise(function(resolve, reject) {
      
      // define callback for wasm
      let callbackFn = async function(cppAddress) {
        let wallet = new MoneroWalletKeys(cppAddress);
        resolve(wallet);
      };
      
      // create wallet in wasm and invoke callback when done
      module.create_keys_wallet_from_keys(networkType, address, privateViewKey, privateSpendKey, language, callbackFn);
    });
  }
  
  static async getMnemonicLanguages() {
    let module = await MoneroUtils.loadWasmModule();  // load wasm module
    return JSON.parse(module.get_keys_wallet_mnemonic_languages()).languages;
  }
  
  // --------------------------- INSTANCE METHODS -----------------------------
  
  /**
   * Internal constructor which is given the memory address of a C++ wallet
   * instance.
   * 
   * This method should not be called externally but should be called through
   * static wallet creation utilities in this class.
   * 
   * @param {int} cppAddress is the address of the wallet instance in C++
   */
  constructor(cppAddress) {
    super();
    this.cppAddress = cppAddress;
    this.module = MoneroUtils.WASM_MODULE;
    if (!this.module.create_core_wallet_from_mnemonic) throw new Error("WASM module not loaded - create wallet instance using static utilities");  // static utilites pre-load wasm module
  }
  
  async getVersion() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      let versionStr = that.module.get_version(that.cppAddress);
      let versionJson = JSON.parse(versionStr);
      return new MoneroVersion(versionJson.number, versionJson.isRelease);
    });
  }
  
  getPath() {
    this._assertNotClosed();
    throw new Error("MoneroWalletKeys does not support a persisted path");
  }
  
  async getMnemonic() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      return that.module.get_mnemonic(that.cppAddress);
    });
  }
  
  async getMnemonicLanguage() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      return that.module.get_mnemonic_language(that.cppAddress);
    });
  }
  
  async getMnemonicLanguages() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      return JSON.parse(that.module.get_mnemonic_languages(that.cppAddress)); // TODO: return native vector<string> in c++
    });
  }
  
  async getPrivateSpendKey() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      let privateSpendKey = that.module.get_private_spend_key(that.cppAddress);
      return privateSpendKey ? privateSpendKey : undefined;
    });
  }
  
  async getPrivateViewKey() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      return that.module.get_private_view_key(that.cppAddress);
    });
  }
  
  async getPublicViewKey() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      return that.module.get_public_view_key(that.cppAddress);
    });
  }
  
  async getPublicSpendKey() {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      return that.module.get_public_spend_key(that.cppAddress);
    });
  }
  
  async getAddress(accountIdx, subaddressIdx) {
    this._assertNotClosed();
    assert(typeof accountIdx === "number");
    let that = this;
    return that.module.queueTask(async function() {
      return that.module.get_address(that.cppAddress, accountIdx, subaddressIdx);
    });
  }
  
  async getAddressIndex(address) {
    this._assertNotClosed();
    let that = this;
    return that.module.queueTask(async function() {
      let subaddressJson = JSON.parse(that.module.get_address_index(that.cppAddress, address));
      return new MoneroSubaddress(subaddressJson);
    });
  }
  
  getAccounts() {
    this._assertNotClosed();
    throw new Error("MoneroWalletKeys does not support getting an enumerable set of accounts; query specific accounts");
  }
  
  // getIntegratedAddress(paymentId)
  // decodeIntegratedAddress
  
  async close(save) {
    if (this._isClosed) return; // closing a closed wallet has no effect
    
    // save wallet if requested
    if (save) await this.save();
    
    // queue task to use wasm module
    let that = this;
    return that.module.queueTask(async function() {
      return new Promise(function(resolve, reject) {
        
        // define callback for wasm
        let callbackFn = async function() {
          delete that.cppAddress;
          that._isClosed = true;
          resolve();
        };
        
        // close wallet in wasm and invoke callback when done
        that.module.close(that.cppAddress, false, callbackFn);  // saving handled external to webassembly
      });
    });
  }
  
  // ----------------------------- PRIVATE HELPERS ----------------------------
  
  _assertNotClosed() {
    if (this._isClosed) throw new MoneroError("Wallet is closed");
  }
}

module.exports = MoneroWalletKeys;