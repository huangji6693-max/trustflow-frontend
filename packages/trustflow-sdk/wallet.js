const freighterApi = require('@stellar/freighter-api');

async function requestWalletAccess() {
  if (typeof freighterApi.setAllowed === 'function') {
    await freighterApi.setAllowed();
  }
}

async function isFreighterConnected() {
  if (typeof freighterApi.isConnected !== 'function') {
    return false;
  }
  return Boolean(await freighterApi.isConnected());
}

async function isFreighterAllowed() {
  if (typeof freighterApi.isAllowed !== 'function') {
    return false;
  }
  return Boolean(await freighterApi.isAllowed());
}

async function getFreighterPublicKey() {
  if (typeof freighterApi.getUserInfo === 'function') {
    const user = await freighterApi.getUserInfo();
    return user && user.publicKey ? user.publicKey : '';
  }
  return '';
}

async function getFreighterNetworkDetails() {
  if (typeof freighterApi.getNetworkDetails === 'function') {
    const details = await freighterApi.getNetworkDetails();
    if (details) {
      return {
        network: details.network,
        networkUrl: details.networkUrl,
        networkPassphrase: details.networkPassphrase,
      };
    }
  }
  return null;
}

async function connectWallet(type = 'freighter') {
  if (type !== 'freighter') {
    throw new Error(`Wallet type ${type} not supported`);
  }
  await requestWalletAccess();
  const connected = await isFreighterConnected();
  if (!connected) {
    throw new Error('Freighter wallet is not connected');
  }
  const publicKey = await getFreighterPublicKey();
  const allowed = await isFreighterAllowed();
  const netDetails = await getFreighterNetworkDetails();
  return {
    type: 'freighter',
    publicKey,
    network: (netDetails && netDetails.network) || 'TESTNET',
    networkUrl: netDetails ? netDetails.networkUrl : undefined,
    networkPassphrase: netDetails ? netDetails.networkPassphrase : undefined,
    isAllowed: allowed,
  };
}

async function disconnectWallet() {
  // Freighter maintains extension-side permissions; local state is cleared by the caller.
}

async function signWithFreighter(xdr, options = {}) {
  return freighterApi.signTransaction(xdr, {
    networkPassphrase: options.networkPassphrase,
    accountToSign: options.accountToSign,
  });
}

module.exports = {
  requestWalletAccess,
  isFreighterConnected,
  isFreighterAllowed,
  getFreighterPublicKey,
  getFreighterNetworkDetails,
  connectWallet,
  disconnectWallet,
  signWithFreighter,
};
