const wallet = require('./wallet');

const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const DEFAULT_STELLAR_NETWORK = 'TESTNET';

function createClientConfig(overrides = {}) {
  const legacyContractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';
  const legacyRpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC_URL;

  const network =
    overrides.network ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    DEFAULT_STELLAR_NETWORK;
  const rpcUrl =
    overrides.rpcUrl ??
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
    legacyRpcUrl;
  const networkPassphrase =
    overrides.networkPassphrase ??
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
    DEFAULT_NETWORK_PASSPHRASE;
  const contractId =
    overrides.contractId ??
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ??
    legacyContractId;
  const disputeContractId =
    overrides.disputeContractId ??
    process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ID ??
    '';

  return {
    network,
    contractId,
    disputeContractId,
    rpcUrl,
    networkPassphrase,
    timeoutMs: overrides.timeoutMs ?? 10000,
  };
}

module.exports = {
  ...wallet,
  DEFAULT_RPC_URL,
  DEFAULT_NETWORK_PASSPHRASE,
  DEFAULT_STELLAR_NETWORK,
  createClientConfig,
};
