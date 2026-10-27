import {
  getTrustFlowClientConfig,
  TRUSTFLOW_CLIENT_CONFIG,
  STELLAR_NETWORK,
  SOROBAN_RPC_URL,
  NETWORK_PASSPHRASE,
} from './contracts'

describe('shared/contracts SDK ClientConfig integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('provides a valid default ClientConfig sourced from @trustflow/sdk', () => {
    expect(TRUSTFLOW_CLIENT_CONFIG).toBeDefined()
    expect(TRUSTFLOW_CLIENT_CONFIG.network).toBe(STELLAR_NETWORK)
    expect(TRUSTFLOW_CLIENT_CONFIG.rpcUrl).toBe(SOROBAN_RPC_URL)
    expect(TRUSTFLOW_CLIENT_CONFIG.networkPassphrase).toBe(NETWORK_PASSPHRASE)
  })

  it('reads NEXT_PUBLIC_* environment variables into ClientConfig', () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = 'FUTURENET'
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = 'https://rpc-futurenet.stellar.org'
    process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID = 'CESCROW123'
    process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ID = 'CDISPUTE456'

    const config = getTrustFlowClientConfig()
    expect(config.network).toBe('FUTURENET')
    expect(config.rpcUrl).toBe('https://rpc-futurenet.stellar.org')
    expect(config.contractId).toBe('CESCROW123')
    expect(config.disputeContractId).toBe('CDISPUTE456')
  })

  it('falls back to legacy NEXT_PUBLIC_CONTRACT_ID and NEXT_PUBLIC_RPC_URL when specific vars are unset', () => {
    delete process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID
    delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL
    process.env.NEXT_PUBLIC_CONTRACT_ID = 'CLEGACY789'
    process.env.NEXT_PUBLIC_RPC_URL = 'https://legacy-rpc.stellar.org'

    const config = getTrustFlowClientConfig()
    expect(config.contractId).toBe('CLEGACY789')
    expect(config.rpcUrl).toBe('https://legacy-rpc.stellar.org')
  })
})
