export type WalletType = 'freighter' | 'albedo' | 'xbull' | 'manual';

export interface WalletNetworkDetails {
  network: string;
  networkUrl: string;
  networkPassphrase: string;
}

export interface WalletConnection {
  type: WalletType;
  publicKey: string;
  network: string;
  networkUrl?: string;
  networkPassphrase?: string;
  isAllowed?: boolean;
}

export interface SignWithFreighterOptions {
  networkPassphrase?: string;
  accountToSign?: string;
}

export declare function requestWalletAccess(): Promise<void>;
export declare function isFreighterConnected(): Promise<boolean>;
export declare function isFreighterAllowed(): Promise<boolean>;
export declare function getFreighterPublicKey(): Promise<string>;
export declare function getFreighterNetworkDetails(): Promise<WalletNetworkDetails | null>;
export declare function connectWallet(type?: WalletType): Promise<WalletConnection>;
export declare function disconnectWallet(): Promise<void>;
export declare function signWithFreighter(
  xdr: string,
  options?: SignWithFreighterOptions
): Promise<string>;
