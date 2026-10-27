import { BASE_FEE } from '@stellar/stellar-sdk'

const STROOPS_PER_XLM = 10_000_000

export interface SimulationPreviewEffect {
  type:
    | 'token_transfer'
    | 'escrow_init'
    | 'escrow_release'
    | 'dispute_action'
    | 'contract_call'
  summary: string
  actor?: string
  target?: string
  amount?: string
}

export interface SimulationFeeBreakdown {
  baseFeeStroops: string
  minResourceFeeStroops: string
  totalFeeStroops: string
  totalFeeXlm: string
  cpuInstructions: number
  readBytes: number
  writeBytes: number
}

export interface SimulationFailureDiagnostic {
  code: number | null
  rawError: string
  title: string
  explanation: string
  remediation: string
}

export interface TransactionSimulationPreview {
  status: 'success' | 'error'
  methodName: string
  contractId: string
  latestLedger: number
  fees: SimulationFeeBreakdown
  effects: SimulationPreviewEffect[]
  authEntriesCount: number
  diagnostic?: SimulationFailureDiagnostic
  preparedXdr?: string
}

export interface SimulationActionContext {
  methodName: string
  contractId: string
  depositor?: string
  beneficiary?: string
  totalAmountXlm?: string
  milestoneCount?: number
  description?: string
}

export interface RawSimulationResponse {
  error?: string
  latestLedger?: number
  minResourceFee?: string | number
  cost?: {
    cpuInsns?: string | number
    memBytes?: string | number
  }
  results?: Array<{
    xdr?: string
    auth?: string[]
  }>
  transactionData?: string
}

const CONTRACT_DIAGNOSTICS: Record<
  number,
  { title: string; explanation: string; remediation: string }
> = {
  1: {
    title: 'Unauthorized Caller',
    explanation:
      'The connected wallet address is not authorized to invoke this contract action.',
    remediation:
      'Switch to the depositor, beneficiary, or admin wallet associated with this escrow.',
  },
  2: {
    title: 'Escrow Not Found',
    explanation: 'No escrow record exists on-chain for the specified escrow ID.',
    remediation:
      'Verify the escrow ID and confirm the creation transaction was finalized on-chain.',
  },
  3: {
    title: 'Invalid Amount',
    explanation:
      'One or more milestone or transfer amounts are zero, negative, or out of bounds.',
    remediation: 'Enter a positive token amount greater than zero for every milestone.',
  },
  4: {
    title: 'Dispute Not Found',
    explanation: 'No active dispute record exists for this escrow.',
    remediation: 'Ensure a dispute has been raised before attempting voting or resolution.',
  },
  5: {
    title: 'Dispute Already Resolved',
    explanation: 'This dispute has already been finalized and settled on-chain.',
    remediation: 'Refresh the dispute state; no further votes or rulings can be submitted.',
  },
  6: {
    title: 'Invalid Escrow State',
    explanation:
      'The escrow is not in the required lifecycle state (e.g. Active vs Disputed/Settled) for this operation.',
    remediation:
      'Check whether the escrow has already been settled or locked by an active dispute.',
  },
  7: {
    title: 'Juror Already Voted',
    explanation: 'This juror wallet has already revealed or cast a vote on this dispute.',
    remediation: 'Each juror address may only vote once per dispute.',
  },
  8: {
    title: 'Insufficient Juror Stake',
    explanation:
      'The juror account does not have enough staked tokens to perform this action.',
    remediation: 'Stake additional tokens in the Juror staking panel and retry.',
  },
  9: {
    title: 'No Votes Cast',
    explanation: 'Dispute resolution was attempted before any juror votes were revealed.',
    remediation: 'Wait for at least one committed juror vote to be revealed.',
  },
  10: {
    title: 'Milestone Amount Mismatch',
    explanation:
      'The requested tranche release exceeds the milestone or total escrow balance.',
    remediation: 'Reduce the release amount so it does not exceed the remaining milestone balance.',
  },
  22: {
    title: 'Protocol Paused',
    explanation:
      'Sensitive TrustFlow contract entrypoints are temporarily paused by the emergency circuit breaker.',
    remediation: 'Wait for the protocol administrator to unpause the contract.',
  },
  23: {
    title: 'Milestone Time-Locked',
    explanation:
      'The milestone release time-lock ledger sequence has not been reached yet.',
    remediation: 'Wait until the milestone unlock ledger passes before releasing funds.',
  },
  24: {
    title: 'Reentrancy Guard Triggered',
    explanation:
      'A cross-contract token call attempted to re-enter the TrustFlow contract during execution.',
    remediation: 'Verify the token contract address is a standard non-reentrant Stellar asset.',
  },
}

export function stroopsToXlmString(stroops: bigint | number | string): string {
  const value = BigInt(stroops)
  const whole = value / BigInt(STROOPS_PER_XLM)
  const fraction = value % BigInt(STROOPS_PER_XLM)
  const fractionStr = fraction.toString().padStart(7, '0').replace(/0+$/, '')
  return fractionStr.length > 0 ? `${whole.toString()}.${fractionStr}` : whole.toString()
}

export function formatShortAddress(address?: string): string {
  if (!address) return 'Unknown'
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function decodeContractFailure(rawError: string): SimulationFailureDiagnostic {
  const match = rawError.match(/Error\(Contract,\s*#(\d+)\)/)
  if (match) {
    const code = Number(match[1])
    const known = CONTRACT_DIAGNOSTICS[code]
    if (known) {
      return {
        code,
        rawError,
        ...known,
      }
    }
    return {
      code,
      rawError,
      title: `Contract Error #${code}`,
      explanation: `The Soroban contract aborted execution with error code #${code}.`,
      remediation: 'Review the transaction parameters and on-chain escrow status before retrying.',
    }
  }

  return {
    code: null,
    rawError,
    title: 'Transaction Simulation Failed',
    explanation:
      rawError || 'The Soroban RPC node rejected the transaction during pre-flight simulation.',
    remediation:
      'Check your wallet network connection, account XLM balance, and contract parameters.',
  }
}

export function buildFeeBreakdown(
  minResourceFee?: string | number,
  cost?: { cpuInsns?: string | number; memBytes?: string | number },
  baseFee: string = BASE_FEE
): SimulationFeeBreakdown {
  const base = BigInt(baseFee || '100')
  const resource = BigInt(minResourceFee ?? 0)
  const total = base + resource
  const cpuInstructions = Number(cost?.cpuInsns ?? 0)
  const memBytes = Number(cost?.memBytes ?? 0)

  return {
    baseFeeStroops: base.toString(),
    minResourceFeeStroops: resource.toString(),
    totalFeeStroops: total.toString(),
    totalFeeXlm: stroopsToXlmString(total),
    cpuInstructions: Number.isFinite(cpuInstructions) ? cpuInstructions : 0,
    readBytes: Number.isFinite(memBytes) ? Math.round(memBytes * 0.6) : 0,
    writeBytes: Number.isFinite(memBytes) ? Math.round(memBytes * 0.4) : 0,
  }
}

export function buildHumanReadableEffects(
  context: SimulationActionContext
): SimulationPreviewEffect[] {
  const effects: SimulationPreviewEffect[] = []

  if (context.methodName === 'init_escrow' || context.methodName === 'create_escrow') {
    if (context.totalAmountXlm && context.depositor) {
      effects.push({
        type: 'token_transfer',
        summary: `Lock ${context.totalAmountXlm} XLM from ${formatShortAddress(
          context.depositor
        )} into TrustFlow Escrow (${formatShortAddress(context.contractId)})`,
        actor: context.depositor,
        target: context.contractId,
        amount: `${context.totalAmountXlm} XLM`,
      })
    }
    effects.push({
      type: 'escrow_init',
      summary: `Initialize milestone escrow${
        context.milestoneCount ? ` with ${context.milestoneCount} milestone(s)` : ''
      }${
        context.beneficiary
          ? ` for beneficiary ${formatShortAddress(context.beneficiary)}`
          : ''
      }`,
      actor: context.depositor,
      target: context.beneficiary,
      amount: context.totalAmountXlm ? `${context.totalAmountXlm} XLM` : undefined,
    })
    return effects
  }

  if (context.methodName === 'release_milestone_tranche' || context.methodName === 'release') {
    effects.push({
      type: 'escrow_release',
      summary:
        context.description ||
        `Release approved milestone tranche${
          context.totalAmountXlm ? ` (${context.totalAmountXlm} XLM)` : ''
        } to beneficiary${
          context.beneficiary ? ` ${formatShortAddress(context.beneficiary)}` : ''
        }`,
      actor: context.depositor,
      target: context.beneficiary,
      amount: context.totalAmountXlm ? `${context.totalAmountXlm} XLM` : undefined,
    })
    return effects
  }

  if (
    context.methodName === 'raise_dispute' ||
    context.methodName === 'commit_vote' ||
    context.methodName === 'reveal_vote' ||
    context.methodName === 'resolve_dispute'
  ) {
    effects.push({
      type: 'dispute_action',
      summary:
        context.description ||
        `Execute dispute lifecycle operation "${context.methodName}" on contract ${formatShortAddress(
          context.contractId
        )}`,
      actor: context.depositor,
      target: context.contractId,
    })
    return effects
  }

  effects.push({
    type: 'contract_call',
    summary:
      context.description ||
      `Invoke "${context.methodName}" on Soroban contract ${formatShortAddress(
        context.contractId
      )}`,
    actor: context.depositor,
    target: context.contractId,
    amount: context.totalAmountXlm ? `${context.totalAmountXlm} XLM` : undefined,
  })
  return effects
}

export function decodeSimulationResponse(
  response: RawSimulationResponse,
  context: SimulationActionContext,
  baseFee: string = BASE_FEE
): TransactionSimulationPreview {
  const fees = buildFeeBreakdown(response.minResourceFee, response.cost, baseFee)
  const latestLedger = response.latestLedger ?? 0
  const firstResult = response.results?.[0]
  const authEntriesCount = firstResult?.auth?.length ?? 0

  if (response.error) {
    return {
      status: 'error',
      methodName: context.methodName,
      contractId: context.contractId,
      latestLedger,
      fees,
      effects: buildHumanReadableEffects(context),
      authEntriesCount,
      diagnostic: decodeContractFailure(response.error),
    }
  }

  return {
    status: 'success',
    methodName: context.methodName,
    contractId: context.contractId,
    latestLedger,
    fees,
    effects: buildHumanReadableEffects(context),
    authEntriesCount,
  }
}
