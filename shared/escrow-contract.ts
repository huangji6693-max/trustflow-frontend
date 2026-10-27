import { Address, BASE_FEE, Contract, StrKey, TransactionBuilder, nativeToScVal, scValToNative, rpc } from '@stellar/stellar-sdk'
import { getSorobanServer } from './soroban-rpc'
import { ESCROW_CONTRACT_ID, NETWORK_PASSPHRASE } from './contracts'
import {
  decodeSimulationResponse,
  type RawSimulationResponse,
  type TransactionSimulationPreview,
} from './transaction-simulation'

const STROOPS_PER_XLM = 10_000_000

/**
 * Maps the `TrustFlowError` enum from the on-chain contract
 * (trustflow-protocol/trustflow-contract, contracts/trustflow/src/lib.rs)
 * to a human-readable message. Soroban surfaces contract errors as strings
 * like "... Error(Contract, #3) ..." in RPC/simulation failures.
 */
const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: 'Unauthorized: the connected wallet is not allowed to perform this action',
  2: 'Escrow not found',
  3: 'Invalid amount: every milestone amount must be greater than zero',
  4: 'Dispute not found',
  5: 'This dispute has already been resolved',
  6: 'The escrow is not in a valid state for this action',
  7: 'This juror has already voted on this dispute',
  8: 'Insufficient staked balance',
  9: 'No votes have been cast on this dispute',
  10: 'Milestone amounts do not match the escrow total',
}

function describeContractError(message: string): string {
  const match = message.match(/Error\(Contract,\s*#(\d+)\)/)
  if (match) {
    const code = Number(match[1])
    return CONTRACT_ERROR_MESSAGES[code] ?? message
  }
  return message
}

function xlmToStroops(amount: string): bigint {
  return BigInt(Math.round(Number(amount) * STROOPS_PER_XLM))
}

export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address)
}

export interface EscrowMilestoneInput {
  label: string
  amount: string
}

export interface CreateGigEscrowInput {
  /** The gig poster's wallet address; funds are drawn from this account. */
  depositor: string
  /** The freelancer's wallet address; receives the escrowed funds on release/settlement. */
  beneficiary: string
  milestones: EscrowMilestoneInput[]
}

export interface CreateGigEscrowResult {
  escrowId: string
  txHash: string
}

/**
 * Signs a transaction XDR envelope, returning the signed XDR. Matches the
 * shape of Freighter's `signTransaction`, but kept generic so this module
 * doesn't depend on a specific wallet.
 */
export type SignTransaction = (xdr: string) => Promise<string>

function milestoneToScVal(milestone: EscrowMilestoneInput) {
  return nativeToScVal(
    {
      label: milestone.label,
      amount: xlmToStroops(milestone.amount),
      approved: false,
    },
    {
      type: {
        label: ['symbol', 'string'],
        amount: ['symbol', 'i128'],
        approved: ['symbol', null],
      },
    }
  )
}

/**
 * Builds an `init_escrow` invocation on the TrustFlow contract, signs it via
 * the caller-supplied `signTransaction`, submits it to Soroban RPC, and
 * polls until it lands on-chain. Returns the new escrow ID and tx hash.
 *
 * There's no generated TypeScript client for the contract yet, so the
 * invocation is built by hand against the ABI in
 * trustflow-protocol/trustflow-contract (contracts/trustflow/src/lib.rs):
 *
 *   fn init_escrow(depositor: Address, beneficiary: Address, milestones: Vec<Milestone>) -> Result<u64, TrustFlowError>
 *   struct Milestone { label: String, amount: i128, approved: bool }
 *
 * The contract locks `sum(milestones[].amount)` of its configured token from
 * `depositor` and requires `beneficiary` up front (there's no on-chain
 * method to change it later), so this must be called with the chosen
 * freelancer's address already known.
 */
export async function createGigEscrow(
  input: CreateGigEscrowInput,
  signTransaction: SignTransaction
): Promise<CreateGigEscrowResult> {
  if (!ESCROW_CONTRACT_ID) {
    throw new Error('Escrow contract is not configured (set NEXT_PUBLIC_ESCROW_CONTRACT_ID)')
  }
  if (input.milestones.length === 0) {
    throw new Error('At least one milestone is required')
  }

  const server = getSorobanServer()
  const sourceAccount = await server.getAccount(input.depositor)
  const contract = new Contract(ESCROW_CONTRACT_ID)

  const operation = contract.call(
    'init_escrow',
    Address.fromString(input.depositor).toScVal(),
    Address.fromString(input.beneficiary).toScVal(),
    nativeToScVal(input.milestones.map(milestoneToScVal))
  )

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build()

  let preparedTransaction
  try {
    preparedTransaction = await server.prepareTransaction(transaction)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(describeContractError(message))
  }

  const signedXdr = await signTransaction(preparedTransaction.toXDR())
  const signedTransaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)

  const sendResult = await server.sendTransaction(signedTransaction)
  if (sendResult.status === 'ERROR' || sendResult.status === 'DUPLICATE') {
    throw new Error(describeContractError(`Failed to submit transaction (status: ${sendResult.status})`))
  }

  return waitForTransaction(server, sendResult.hash)
}

/**
 * Simulates an `init_escrow` transaction before requesting a wallet signature,
 * returning a deterministic fee/effects preview and failure diagnostics.
 */
export async function simulateGigEscrow(
  input: CreateGigEscrowInput
): Promise<TransactionSimulationPreview> {
  if (!ESCROW_CONTRACT_ID) {
    throw new Error('Escrow contract is not configured (set NEXT_PUBLIC_ESCROW_CONTRACT_ID)')
  }
  if (input.milestones.length === 0) {
    throw new Error('At least one milestone is required')
  }

  const totalAmountNum = input.milestones.reduce(
    (sum, m) => sum + (Number(m.amount) || 0),
    0
  )
  const context = {
    methodName: 'init_escrow',
    contractId: ESCROW_CONTRACT_ID,
    depositor: input.depositor,
    beneficiary: input.beneficiary,
    totalAmountXlm: totalAmountNum.toString(),
    milestoneCount: input.milestones.length,
  }

  const server = getSorobanServer()
  const sourceAccount = await server.getAccount(input.depositor)
  const contract = new Contract(ESCROW_CONTRACT_ID)

  const operation = contract.call(
    'init_escrow',
    Address.fromString(input.depositor).toScVal(),
    Address.fromString(input.beneficiary).toScVal(),
    nativeToScVal(input.milestones.map(milestoneToScVal))
  )

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build()

  try {
    const simResult = (await server.simulateTransaction(
      transaction
    )) as unknown as RawSimulationResponse
    return decodeSimulationResponse(simResult, context, BASE_FEE)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return decodeSimulationResponse({ error: message }, context, BASE_FEE)
  }
}

async function waitForTransaction(
  server: rpc.Server,
  hash: string,
  attempts = 15,
  intervalMs = 1500
): Promise<CreateGigEscrowResult> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = await server.getTransaction(hash)

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const escrowId = result.returnValue ? String(scValToNative(result.returnValue)) : ''
      return { escrowId, txHash: hash }
    }

    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('Timed out waiting for transaction confirmation')
}
