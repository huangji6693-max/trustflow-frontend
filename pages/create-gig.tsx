import { useEffect, useReducer, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Navbar } from '../components/organisms'
import { MarkdownEditor } from '../components/molecules'
import { MarkdownRenderer } from '../components/atoms'
import { useGlobalToast } from './_app'
import { useWallet } from '../hooks'
import { createGigEscrow } from '../shared/escrow-contract'
import {
  clearEscrowFundingDraft,
  createInitialEscrowFundingState,
  ESCROW_FUNDING_STEPS,
  EscrowMilestoneDraft,
  loadEscrowFundingDraft,
  saveEscrowFundingDraft,
  transitionEscrowFundingState,
} from '../utils/escrowFundingMachine'

const CATEGORIES = ['Development', 'Design', 'Writing', 'Marketing', 'Other']

const CreateGig: NextPage = () => {
  const [state, dispatch] = useReducer(
    transitionEscrowFundingState,
    undefined,
    createInitialEscrowFundingState
  )
  const hydratedRef = useRef(false)
  const stepButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const previousStepIndexRef = useRef(state.stepIndex)

  const toast = useGlobalToast()
  const router = useRouter()
  const { account, signTransaction } = useWallet()

  const { step, stepIndex: currentStep, formData, errors, announcement, resumedFromStorage } =
    state
  const isSubmitting = step === 'submitting'

  // Hydrate resumable progress from localStorage on initial client mount
  useEffect(() => {
    const saved = loadEscrowFundingDraft()
    if (saved) {
      dispatch({ type: 'HYDRATE', snapshot: saved })
    }
    hydratedRef.current = true
  }, [])

  // Persist draft state across reloads whenever form data or step changes
  useEffect(() => {
    if (!hydratedRef.current) return
    if (step === 'funded') {
      clearEscrowFundingDraft()
      return
    }
    saveEscrowFundingDraft(state)
  }, [state, step])

  // Move focus to the active step heading when transitioning steps
  useEffect(() => {
    if (previousStepIndexRef.current !== currentStep) {
      previousStepIndexRef.current = currentStep
      stepHeadingRef.current?.focus()
    }
  }, [currentStep])

  const addMilestone = () => {
    dispatch({ type: 'ADD_MILESTONE' })
  }

  const removeMilestone = (id: string) => {
    dispatch({ type: 'REMOVE_MILESTONE', id })
  }

  const updateMilestone = (
    id: string,
    field: keyof EscrowMilestoneDraft,
    value: string
  ) => {
    dispatch({ type: 'UPDATE_MILESTONE', id, field, value })
  }

  const handleNext = () => {
    dispatch({ type: 'NEXT' })
  }

  const handleBack = () => {
    dispatch({ type: 'BACK' })
  }

  const handleStepKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const lastIdx = ESCROW_FUNDING_STEPS.length - 1
    let targetIdx: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIdx = idx < lastIdx ? idx + 1 : 0
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIdx = idx > 0 ? idx - 1 : lastIdx
    } else if (event.key === 'Home') {
      targetIdx = 0
    } else if (event.key === 'End') {
      targetIdx = lastIdx
    }

    if (targetIdx !== null) {
      event.preventDefault()
      stepButtonRefs.current[targetIdx]?.focus()
      dispatch({ type: 'GOTO_STEP', stepIndex: targetIdx })
    }
  }

  const handleWizardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault()
      handleNext()
    } else if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault()
      handleBack()
    }
  }

  const handleResetDraft = () => {
    clearEscrowFundingDraft()
    dispatch({ type: 'RESET_DRAFT' })
  }

  const handleSubmit = async () => {
    if (!account) {
      toast.error('Connect your Stellar wallet before creating a gig')
      return
    }

    dispatch({ type: 'SUBMIT_START' })
    try {
      const { escrowId, txHash } = await createGigEscrow(
        {
          depositor: account.address,
          beneficiary: formData.beneficiaryAddress.trim(),
          milestones: formData.milestones.map((m) => ({
            label: m.title,
            amount: m.amount,
          })),
        },
        signTransaction
      )

      clearEscrowFundingDraft()
      dispatch({ type: 'SUBMIT_SUCCESS', escrowId, txHash })
      toast.success(`Gig created and escrow #${escrowId} funded successfully!`)
      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create gig escrow'
      dispatch({ type: 'SUBMIT_FAILURE', message })
      toast.error(message)
    }
  }

  return (
    <>
      <Head>
        <title>Create Gig - TrustFlow</title>
        <meta name="description" content="Create a new gig with milestone-based escrow" />
      </Head>

      <div
        className="min-h-screen bg-gray-50 dark:bg-gray-950"
        onKeyDown={handleWizardKeyDown}
      >
        <Navbar />

        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Screen-reader live region for step transitions, validation feedback, and draft restoration */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
            data-testid="escrow-wizard-announcer"
          >
            {announcement}
          </div>

          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Create a New Gig
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Set up milestone-based escrow for secure, trustless payments
              </p>
            </div>
            {resumedFromStorage && (
              <div className="flex items-center gap-3 px-3.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-200">
                <span>Draft restored</span>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="font-semibold underline hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  Reset draft
                </button>
              </div>
            )}
          </div>

          {/* Accessible Progress Stepper */}
          <nav aria-label="Escrow funding wizard steps" className="mb-8">
            <ol className="flex items-center justify-between" role="list">
              {ESCROW_FUNDING_STEPS.map((stepDef, idx) => {
                const isCompleted = idx < currentStep
                const isCurrent = idx === currentStep
                return (
                  <li key={stepDef.id} className="flex items-center flex-1">
                    <button
                      ref={(el) => {
                        stepButtonRefs.current[idx] = el
                      }}
                      type="button"
                      onClick={() => dispatch({ type: 'GOTO_STEP', stepIndex: idx })}
                      onKeyDown={(e) => handleStepKeyDown(e, idx)}
                      aria-current={isCurrent ? 'step' : undefined}
                      aria-label={`Step ${idx + 1}: ${stepDef.label}${
                        isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''
                      }`}
                      disabled={isSubmitting}
                      className="flex items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1"
                    >
                      <span
                        className={`
                          w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors
                          ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
                          }
                        `}
                        aria-hidden="true"
                      >
                        {isCompleted ? '✓' : idx + 1}
                      </span>
                      <span
                        className={`ml-2 text-sm font-medium ${
                          idx <= currentStep
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {stepDef.label}
                      </span>
                    </button>
                    {idx < ESCROW_FUNDING_STEPS.length - 1 && (
                      <div
                        aria-hidden="true"
                        className={`flex-1 h-1 mx-4 rounded ${
                          isCompleted
                            ? 'bg-green-500'
                            : 'bg-gray-200 dark:bg-gray-800'
                        }`}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>

          {/* Form content */}
          <div
            role="region"
            aria-labelledby="active-wizard-step-heading"
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 md:p-8"
          >
            <h2
              id="active-wizard-step-heading"
              ref={stepHeadingRef}
              tabIndex={-1}
              className="sr-only"
            >
              {`Step ${currentStep + 1} of ${ESCROW_FUNDING_STEPS.length}: ${
                ESCROW_FUNDING_STEPS[currentStep]?.label
              }`}
            </h2>

            {/* Step 0: Basic Info */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="gig-title-input"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Gig Title *
                  </label>
                  <input
                    id="gig-title-input"
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_FIELD',
                        field: 'title',
                        value: e.target.value,
                      })
                    }
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={errors.title ? 'gig-title-error' : undefined}
                    placeholder="e.g., Smart Contract Audit for DeFi Protocol"
                    className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white ${
                      errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />
                  {errors.title && (
                    <p id="gig-title-error" role="alert" className="text-red-500 text-sm mt-1">
                      {errors.title}
                    </p>
                  )}
                </div>

                <div>
                  <MarkdownEditor
                    label="Description"
                    value={formData.description}
                    onChange={(value) =>
                      dispatch({
                        type: 'UPDATE_FIELD',
                        field: 'description',
                        value,
                      })
                    }
                    placeholder="Provide detailed requirements, deliverables, and expectations using markdown formatting..."
                    height={300}
                    error={errors.description}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="gig-category-select"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Category *
                    </label>
                    <select
                      id="gig-category-select"
                      value={formData.category}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_FIELD',
                          field: 'category',
                          value: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="gig-total-budget-input"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Total Budget (XLM) *
                    </label>
                    <input
                      id="gig-total-budget-input"
                      type="number"
                      value={formData.totalBudget}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_FIELD',
                          field: 'totalBudget',
                          value: e.target.value,
                        })
                      }
                      aria-invalid={Boolean(errors.totalBudget)}
                      aria-describedby={
                        errors.totalBudget ? 'gig-total-budget-error' : undefined
                      }
                      placeholder="5000"
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white ${
                        errors.totalBudget
                          ? 'border-red-500'
                          : 'border-gray-300 dark:border-gray-700'
                      }`}
                    />
                    {errors.totalBudget && (
                      <p
                        id="gig-total-budget-error"
                        role="alert"
                        className="text-red-500 text-sm mt-1"
                      >
                        {errors.totalBudget}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="gig-beneficiary-input"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Freelancer&apos;s Wallet Address *
                  </label>
                  <input
                    id="gig-beneficiary-input"
                    type="text"
                    value={formData.beneficiaryAddress}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_FIELD',
                        field: 'beneficiaryAddress',
                        value: e.target.value,
                      })
                    }
                    aria-invalid={Boolean(errors.beneficiaryAddress)}
                    aria-describedby={
                      errors.beneficiaryAddress
                        ? 'gig-beneficiary-hint gig-beneficiary-error'
                        : 'gig-beneficiary-hint'
                    }
                    placeholder="G..."
                    className={`w-full px-4 py-3 bg-white dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white font-mono text-sm ${
                      errors.beneficiaryAddress
                        ? 'border-red-500'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  />
                  <p id="gig-beneficiary-hint" className="text-gray-500 dark:text-gray-500 text-xs mt-1">
                    The escrow contract locks funds for a specific freelancer up front. Enter the Stellar
                    address of the freelancer you&apos;re hiring for this gig.
                  </p>
                  {errors.beneficiaryAddress && (
                    <p
                      id="gig-beneficiary-error"
                      role="alert"
                      className="text-red-500 text-sm mt-1"
                    >
                      {errors.beneficiaryAddress}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: Milestones */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Define Milestones
                  </h3>
                  <button
                    type="button"
                    onClick={addMilestone}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    + Add Milestone
                  </button>
                </div>

                {formData.milestones.map((milestone, idx) => (
                  <div
                    key={milestone.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        Milestone {idx + 1}
                      </h4>
                      {formData.milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(milestone.id)}
                          aria-label={`Remove Milestone ${idx + 1}`}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div>
                      <label htmlFor={`milestone-${idx}-title`} className="sr-only">
                        Milestone {idx + 1} Title
                      </label>
                      <input
                        id={`milestone-${idx}-title`}
                        type="text"
                        value={milestone.title}
                        onChange={(e) => updateMilestone(milestone.id, 'title', e.target.value)}
                        aria-invalid={Boolean(errors[`milestone-${idx}-title`])}
                        placeholder="Milestone title"
                        className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white text-sm ${
                          errors[`milestone-${idx}-title`]
                            ? 'border-red-500'
                            : 'border-gray-300 dark:border-gray-700'
                        }`}
                      />
                      {errors[`milestone-${idx}-title`] && (
                        <p role="alert" className="text-red-500 text-xs mt-1">
                          {errors[`milestone-${idx}-title`]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Deliverables Description
                      </label>
                      <MarkdownEditor
                        value={milestone.description}
                        onChange={(value) => updateMilestone(milestone.id, 'description', value)}
                        placeholder="Describe deliverables for this milestone using markdown..."
                        height={200}
                        preview="edit"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor={`milestone-${idx}-amount`} className="sr-only">
                          Milestone {idx + 1} Amount (XLM)
                        </label>
                        <input
                          id={`milestone-${idx}-amount`}
                          type="number"
                          value={milestone.amount}
                          onChange={(e) => updateMilestone(milestone.id, 'amount', e.target.value)}
                          aria-invalid={Boolean(errors[`milestone-${idx}-amount`])}
                          placeholder="Amount (XLM)"
                          min="0"
                          step="0.01"
                          className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white text-sm ${
                            errors[`milestone-${idx}-amount`]
                              ? 'border-red-500'
                              : 'border-gray-300 dark:border-gray-700'
                          }`}
                        />
                        {errors[`milestone-${idx}-amount`] && (
                          <p role="alert" className="text-red-500 text-xs mt-1">
                            {errors[`milestone-${idx}-amount`]}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor={`milestone-${idx}-duration`} className="sr-only">
                          Milestone {idx + 1} Duration
                        </label>
                        <input
                          id={`milestone-${idx}-duration`}
                          type="text"
                          value={milestone.duration}
                          onChange={(e) => updateMilestone(milestone.id, 'duration', e.target.value)}
                          placeholder="Duration (e.g., 2 weeks)"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 2: Review */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-3">Gig Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Title:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formData.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Category:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formData.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Budget:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formData.totalBudget} XLM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Milestones:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formData.milestones.length}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600 dark:text-gray-400 shrink-0">Freelancer:</span>
                      <span className="font-medium text-gray-900 dark:text-white font-mono text-xs break-all text-right">
                        {formData.beneficiaryAddress}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-3">Description</h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <MarkdownRenderer content={formData.description} />
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-3">Milestone Breakdown</h3>
                  <div className="space-y-3">
                    {formData.milestones.map((m, idx) => (
                      <div key={m.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {idx + 1}. {m.title}
                          </span>
                          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {m.amount} XLM
                          </span>
                        </div>
                        {m.description && (
                          <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 mt-2">
                            <MarkdownRenderer content={m.description} />
                          </div>
                        )}
                        {m.duration && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Duration: {m.duration}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> Once created, funds will be locked in escrow until milestones are completed and approved. Make sure all details are correct before submitting.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0 || isSubmitting}
                className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Back
              </button>

              {currentStep < ESCROW_FUNDING_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating Escrow…' : 'Create Gig'}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default CreateGig
