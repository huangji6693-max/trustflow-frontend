import React from 'react'
import { TransactionSimulationPreview } from '../../../shared/transaction-simulation'

export interface SimulationPreviewModalProps {
  isOpen: boolean
  preview: TransactionSimulationPreview | null
  isSigning?: boolean
  onConfirmSign: () => void
  onCancel: () => void
}

export function SimulationPreviewModal({
  isOpen,
  preview,
  isSigning = false,
  onConfirmSign,
  onCancel,
}: SimulationPreviewModalProps) {
  if (!isOpen || !preview) {
    return null
  }

  const isSuccess = preview.status === 'success'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulation-preview-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3
              id="simulation-preview-title"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              Transaction Pre-Flight Preview
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Method: <span className="font-mono">{preview.methodName}</span>
              {preview.latestLedger > 0 ? ` · Ledger #${preview.latestLedger}` : ''}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              isSuccess
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
            }`}
          >
            {isSuccess ? 'Simulation Passed' : 'Simulation Failed'}
          </span>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* What Will Happen */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              What Will Happen
            </h4>
            <ul className="space-y-2">
              {preview.effects.map((effect, index) => (
                <li
                  key={`${effect.type}-${index}`}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 p-3 text-sm text-gray-800 dark:text-gray-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{effect.summary}</span>
                    {effect.amount && (
                      <span className="shrink-0 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                        {effect.amount}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Failure Diagnostic */}
          {!isSuccess && preview.diagnostic && (
            <div
              className="rounded-xl border border-red-300 dark:border-red-900/80 bg-red-50/80 dark:bg-red-950/40 p-4 space-y-2"
              role="alert"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-red-800 dark:text-red-300">
                  {preview.diagnostic.title}
                </span>
                {preview.diagnostic.code !== null && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-200/70 dark:bg-red-900/70 text-red-900 dark:text-red-200">
                    Error #{preview.diagnostic.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-red-700 dark:text-red-200">
                {preview.diagnostic.explanation}
              </p>
              <p className="text-xs font-medium text-red-900 dark:text-red-100">
                Suggested Fix: {preview.diagnostic.remediation}
              </p>
            </div>
          )}

          {/* Resource & Fee Breakdown */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Estimated Network & Resource Fees
            </h4>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 p-3 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Base Inclusion Fee</span>
                <span className="font-mono">{preview.fees.baseFeeStroops} stroops</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Soroban Resource Fee</span>
                <span className="font-mono">{preview.fees.minResourceFeeStroops} stroops</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-gray-800">
                <span>Total Estimated Fee</span>
                <span className="font-mono">{preview.fees.totalFeeXlm} XLM</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-gray-500 dark:text-gray-400">
                <div>CPU: {preview.fees.cpuInstructions.toLocaleString()} insns</div>
                <div>Read: {preview.fees.readBytes.toLocaleString()} B</div>
                <div>Auth Entries: {preview.authEntriesCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSigning}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmSign}
            disabled={!isSuccess || isSigning}
            className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
              !isSuccess || isSigning
                ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {isSigning ? 'Waiting for Wallet Signature...' : 'Confirm & Sign Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
