import {
  createClientConfig,
  DEFAULT_NETWORK_PASSPHRASE,
  DEFAULT_RPC_URL,
  DEFAULT_STELLAR_NETWORK,
} from '@trustflow/sdk'
import type { ClientConfig, Network, StellarNetwork } from '@trustflow/sdk'

export type { ClientConfig, Network, StellarNetwork }

/**
 * Resolves a fresh SDK `ClientConfig` from `NEXT_PUBLIC_*` environment
 * variables, with backwards-compatible fallbacks for `NEXT_PUBLIC_CONTRACT_ID`
 * and `NEXT_PUBLIC_RPC_URL`.
 */
export function getTrustFlowClientConfig(
  overrides: Partial<ClientConfig> = {}
): ClientConfig {
  return createClientConfig(overrides)
}

export const TRUSTFLOW_CLIENT_CONFIG: ClientConfig = getTrustFlowClientConfig()

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? ''
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC_URL
export const NETWORK_PASSPHRASE =
  TRUSTFLOW_CLIENT_CONFIG.networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE

export const STELLAR_NETWORK =
  TRUSTFLOW_CLIENT_CONFIG.network ?? DEFAULT_STELLAR_NETWORK

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? RPC_URL

export const ESCROW_CONTRACT_ID =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? CONTRACT_ID

export const DISPUTE_CONTRACT_ID =
  TRUSTFLOW_CLIENT_CONFIG.disputeContractId ?? ''
