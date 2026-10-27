export * from './wallet';

export type StellarNetwork = 'TESTNET' | 'FUTURENET' | 'MAINNET' | 'STANDALONE' | (string & {});
export type Network = StellarNetwork;

export interface ClientConfig {
  /** Target Stellar network. Defaults to "TESTNET". */
  network?: Network;
  /** Primary Soroban escrow contract ID for the TrustFlow protocol. */
  contractId: string;
  /** Optional dispute resolution contract ID. */
  disputeContractId?: string;
  /** Soroban RPC endpoint URL. */
  rpcUrl?: string;
  /** Custom Horizon server endpoint URL. */
  horizonUrl?: string;
  /** Stellar network passphrase. */
  networkPassphrase?: string;
  /** Base URL for the TrustFlow backend API. */
  apiBaseUrl?: string;
  /** Default per-request timeout in milliseconds. */
  timeoutMs?: number;
}

export declare const DEFAULT_RPC_URL: string;
export declare const DEFAULT_NETWORK_PASSPHRASE: string;
export declare const DEFAULT_STELLAR_NETWORK: string;

export declare function createClientConfig(overrides?: Partial<ClientConfig>): ClientConfig;
