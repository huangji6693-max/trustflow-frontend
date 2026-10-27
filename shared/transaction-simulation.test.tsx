import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import {
  buildFeeBreakdown,
  buildHumanReadableEffects,
  decodeContractFailure,
  decodeSimulationResponse,
  stroopsToXlmString,
} from './transaction-simulation'
import { SimulationPreviewModal } from '../components/molecules/simulation-preview-modal'

describe('Deterministic Transaction Simulation & Fee/Effects Preview', () => {
  const depositor = 'GBYWLISGOUWQ43VQEGXX6KRGDZ3CKAFFK3JXVLXKDO5TIFJUJ3OHJYOZ'
  const beneficiary = 'GD6W2X5L4UXJ24X5Q34U6W5A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q'
  const contractId = 'CC3X5L4UXJ24X5Q34U6W5A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R'

  it('converts stroops to human-readable XLM strings accurately', () => {
    expect(stroopsToXlmString(10_000_000)).toBe('1')
    expect(stroopsToXlmString(15_500_000)).toBe('1.55')
    expect(stroopsToXlmString(100)).toBe('0.00001')
  })

  it('decodes successful Soroban simulation into fee breakdown and effects', () => {
    const preview = decodeSimulationResponse(
      {
        latestLedger: 54321,
        minResourceFee: '45000',
        cost: {
          cpuInsns: '1250000',
          memBytes: '10000',
        },
        results: [
          {
            xdr: 'AAAAAQ==',
            auth: ['auth-entry-1'],
          },
        ],
      },
      {
        methodName: 'init_escrow',
        contractId,
        depositor,
        beneficiary,
        totalAmountXlm: '250',
        milestoneCount: 2,
      },
      '100'
    )

    expect(preview.status).toBe('success')
    expect(preview.latestLedger).toBe(54321)
    expect(preview.fees.baseFeeStroops).toBe('100')
    expect(preview.fees.minResourceFeeStroops).toBe('45000')
    expect(preview.fees.totalFeeStroops).toBe('45100')
    expect(preview.fees.totalFeeXlm).toBe('0.00451')
    expect(preview.fees.cpuInstructions).toBe(1250000)
    expect(preview.authEntriesCount).toBe(1)
    expect(preview.effects).toHaveLength(2)
    expect(preview.effects[0].summary).toContain('Lock 250 XLM')
    expect(preview.effects[1].summary).toContain('with 2 milestone(s)')
  })

  it('decodes on-chain TrustFlowError codes into actionable failure diagnostics', () => {
    const diag = decodeContractFailure('HostError: Error(Contract, #22)')
    expect(diag.code).toBe(22)
    expect(diag.title).toBe('Protocol Paused')
    expect(diag.remediation).toContain('unpause')

    const failedPreview = decodeSimulationResponse(
      {
        error: 'HostError: Error(Contract, #3)',
        latestLedger: 54322,
      },
      {
        methodName: 'init_escrow',
        contractId,
        depositor,
        beneficiary,
        totalAmountXlm: '0',
        milestoneCount: 1,
      }
    )
    expect(failedPreview.status).toBe('error')
    expect(failedPreview.diagnostic?.code).toBe(3)
    expect(failedPreview.diagnostic?.title).toBe('Invalid Amount')
  })

  it('renders SimulationPreviewModal and allows confirming a valid simulation', () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    const preview = decodeSimulationResponse(
      {
        latestLedger: 999,
        minResourceFee: '12000',
        cost: { cpuInsns: '50000', memBytes: '2000' },
        results: [{ xdr: 'AAAAAQ==', auth: ['a1'] }],
      },
      {
        methodName: 'release_milestone_tranche',
        contractId,
        depositor,
        beneficiary,
        totalAmountXlm: '100',
      }
    )

    render(
      <SimulationPreviewModal
        isOpen={true}
        preview={preview}
        onConfirmSign={onConfirm}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText('Simulation Passed')).toBeInTheDocument()
    expect(screen.getByText(/Release approved milestone tranche/i)).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Sign Transaction/i })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables signing in SimulationPreviewModal when simulation fails', () => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    const failedPreview = decodeSimulationResponse(
      {
        error: 'HostError: Error(Contract, #1)',
        latestLedger: 1000,
      },
      {
        methodName: 'release_milestone_tranche',
        contractId,
      }
    )

    render(
      <SimulationPreviewModal
        isOpen={true}
        preview={failedPreview}
        onConfirmSign={onConfirm}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText('Simulation Failed')).toBeInTheDocument()
    expect(screen.getByText('Unauthorized Caller')).toBeInTheDocument()
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Sign Transaction/i })
    expect(confirmBtn).toBeDisabled()
  })

  it('builds fallback effects for dispute and generic contract calls', () => {
    const disputeEffects = buildHumanReadableEffects({
      methodName: 'raise_dispute',
      contractId,
    })
    expect(disputeEffects[0].type).toBe('dispute_action')

    const genericEffects = buildHumanReadableEffects({
      methodName: 'custom_call',
      contractId,
    })
    expect(genericEffects[0].type).toBe('contract_call')

    const fees = buildFeeBreakdown(undefined, undefined, '100')
    expect(fees.totalFeeStroops).toBe('100')
  })
})
