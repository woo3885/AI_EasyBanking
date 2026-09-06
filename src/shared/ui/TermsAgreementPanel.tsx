import {
  analyzeAgreementTerms,
  canConfirmTermsAgreement,
  createAgreementTermElementId,
  createTermsAgreementConfirmPayload,
  hasUnknownSelectedAgreementTermId,
  type AgreementTerm
} from '@/shared/model/terms-agreement';
import { Button } from './Button';
import { Panel } from './Panel';
import { Text } from './Text';

export const TERMS_AGREEMENT_PANEL_SELECTORS = {
  panel: 'panel-terms-agreement',
  heading: 'heading-terms-agreement',
  options: 'options-terms-agreement',
  status: 'status-terms-agreement',
  confirm: 'btn-terms-agreement-confirm'
} as const;

export interface TermsAgreementPanelProps {
  title?: string;
  message?: string;
  terms: readonly AgreementTerm[];
  selectedTermIds: ReadonlySet<string>;
  disabled?: boolean;
  isBusy?: boolean;
  onToggle: (termId: string, selected: boolean) => void;
  onConfirm: (selectedTermIds: readonly string[]) => void;
  className?: string;
}

const DEFAULT_TITLE = '약관 확인';
const DEFAULT_MESSAGE =
  '필수 약관과 선택 약관을 각각 확인하고 직접 선택해 주세요.';
const EMPTY_MESSAGE =
  '선택 항목을 준비하고 있습니다. 잠시 후 다시 확인해 주세요.';
const INVALID_MESSAGE =
  '약관 항목을 표시할 수 없습니다. 안전하게 다시 확인해 주세요.';

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

function normalizedText(value: string | undefined, fallback: string): string {
  const normalizedValue = value?.trim();
  return normalizedValue || fallback;
}

function createReadyStatusMessage(
  terms: readonly AgreementTerm[],
  selectedTermIds: ReadonlySet<string>
): string {
  const enabledRequiredTerms = terms.filter(
    (term) => term.required && !term.disabled
  );
  const enabledOptionalTerms = terms.filter(
    (term) => !term.required && !term.disabled
  );
  const selectedRequiredCount = enabledRequiredTerms.filter((term) =>
    selectedTermIds.has(term.id)
  ).length;
  const selectedOptionalCount = enabledOptionalTerms.filter((term) =>
    selectedTermIds.has(term.id)
  ).length;
  const optionalSummary = `선택 약관 ${enabledOptionalTerms.length}개 중 ${selectedOptionalCount}개를 선택했습니다.`;

  if (enabledRequiredTerms.length === 0) {
    return `필수 약관이 없습니다. ${optionalSummary} 확인 버튼을 눌러 선택 결과를 확인해 주세요.`;
  }

  if (selectedRequiredCount === enabledRequiredTerms.length) {
    return `필수 약관 ${enabledRequiredTerms.length}개를 모두 선택했습니다. ${optionalSummary} 확인 버튼을 눌러야 선택 확인 요청이 전달됩니다.`;
  }

  return `필수 약관 ${enabledRequiredTerms.length}개 중 ${selectedRequiredCount}개를 선택했습니다. ${optionalSummary}`;
}

export function TermsAgreementPanel({
  title,
  message,
  terms,
  selectedTermIds,
  disabled = false,
  isBusy = false,
  onToggle,
  onConfirm,
  className
}: TermsAgreementPanelProps) {
  const analysis = analyzeAgreementTerms(terms);
  const controlsDisabled = disabled || isBusy;
  const hasDisabledRequiredTerm =
    analysis.state === 'READY' &&
    analysis.terms.some((term) => term.required && term.disabled);
  const hasUnknownSelection = hasUnknownSelectedAgreementTermId(
    terms,
    selectedTermIds
  );
  const confirmEnabled = canConfirmTermsAgreement(
    terms,
    selectedTermIds,
    disabled,
    isBusy
  );
  const displayedTitle = normalizedText(title, DEFAULT_TITLE);
  const displayedMessage = normalizedText(message, DEFAULT_MESSAGE);

  const statusMessage = isBusy
    ? '약관 선택 확인 요청을 처리하고 있습니다.'
    : disabled
      ? '현재는 약관을 선택하거나 확인할 수 없습니다.'
      : analysis.state === 'EMPTY'
        ? EMPTY_MESSAGE
        : analysis.state === 'INVALID'
          ? INVALID_MESSAGE
          : hasDisabledRequiredTerm
            ? '선택할 수 없는 필수 약관이 있어 확인할 수 없습니다.'
            : hasUnknownSelection
              ? '현재 약관 목록과 선택 상태가 일치하지 않아 확인할 수 없습니다.'
              : createReadyStatusMessage(analysis.terms, selectedTermIds);

  const handleConfirm = () => {
    if (
      !canConfirmTermsAgreement(
        terms,
        selectedTermIds,
        disabled,
        isBusy
      )
    ) {
      return;
    }

    const payload = createTermsAgreementConfirmPayload(terms, selectedTermIds);
    if (payload !== null) {
      onConfirm(payload);
    }
  };

  return (
    <Panel
      {...elementIdentity(TERMS_AGREEMENT_PANEL_SELECTORS.panel)}
      aria-labelledby={TERMS_AGREEMENT_PANEL_SELECTORS.heading}
      aria-describedby={TERMS_AGREEMENT_PANEL_SELECTORS.status}
      aria-busy={isBusy}
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <h2
        {...elementIdentity(TERMS_AGREEMENT_PANEL_SELECTORS.heading)}
        className="text-2xl font-bold leading-snug text-text-primary"
      >
        {displayedTitle}
      </h2>
      <Text variant="guide" className="mt-3 text-text-secondary">
        {displayedMessage}
      </Text>

      <fieldset
        {...elementIdentity(TERMS_AGREEMENT_PANEL_SELECTORS.options)}
        disabled={controlsDisabled}
        className="mt-6 min-w-0"
      >
        <legend className="text-lg font-bold leading-relaxed text-text-primary">
          개별 약관 선택
        </legend>

        {analysis.state === 'READY' ? (
          <div className="mt-3 grid gap-3">
            {analysis.terms.map((term) => {
              const termElementId = createAgreementTermElementId(term.id);
              if (termElementId === null) {
                return null;
              }

              const descriptionId = `description-terms-agreement-${term.id}`;
              const hasDescription = Boolean(term.description);
              const termDisabled = controlsDisabled || Boolean(term.disabled);
              const isSelected =
                !term.disabled && selectedTermIds.has(term.id);

              return (
                <label
                  key={term.id}
                  htmlFor={termElementId}
                  className={[
                    'flex min-h-14 w-full items-start gap-4 rounded-xl border-2 p-4',
                    'break-words focus-within:ring-4 focus-within:ring-brand-100 focus-within:ring-offset-2',
                    'forced-colors:border-[CanvasText]',
                    termDisabled
                      ? 'cursor-not-allowed border-border bg-slate-100 opacity-70'
                      : 'cursor-pointer border-border bg-surface hover:bg-slate-50',
                    isSelected ? 'border-primary bg-brand-50' : ''
                  ].join(' ')}
                >
                  <input
                    {...elementIdentity(termElementId)}
                    type="checkbox"
                    required={term.required}
                    checked={isSelected}
                    disabled={termDisabled}
                    onChange={(event) => {
                      if (!termDisabled) {
                        onToggle(term.id, event.currentTarget.checked);
                      }
                    }}
                    aria-describedby={
                      hasDescription || term.disabled
                        ? descriptionId
                        : undefined
                    }
                    className="mt-1 size-5 shrink-0 accent-primary focus-visible:ring-4 focus-visible:ring-brand-100"
                  />
                  <span className="min-w-0 flex-1">
                    <Text as="span" variant="caption" className="font-bold">
                      {term.required ? '[필수]' : '[선택]'}
                    </Text>{' '}
                    <Text as="span" variant="guide">
                      {term.label}
                    </Text>
                    {hasDescription || term.disabled ? (
                      <Text
                        id={descriptionId}
                        as="span"
                        variant="body"
                        className="mt-2 block text-text-secondary"
                      >
                        {term.description}
                        {term.description && term.disabled ? ' ' : null}
                        {term.disabled
                          ? '현재 이 약관은 선택할 수 없습니다.'
                          : null}
                      </Text>
                    ) : null}
                    <Text
                      as="span"
                      variant="caption"
                      className="mt-2 block font-bold"
                    >
                      {term.disabled
                        ? '선택 불가'
                        : isSelected
                          ? '선택됨'
                          : '선택 전'}
                    </Text>
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
      </fieldset>

      <div
        {...elementIdentity(TERMS_AGREEMENT_PANEL_SELECTORS.status)}
        role="status"
        aria-live="polite"
        className="mt-6 rounded-xl border-2 border-border bg-slate-50 p-4 text-base leading-relaxed text-text-primary"
      >
        {statusMessage}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          {...elementIdentity(TERMS_AGREEMENT_PANEL_SELECTORS.confirm)}
          size="lg"
          disabled={!confirmEnabled}
          isLoading={isBusy}
          aria-describedby={TERMS_AGREEMENT_PANEL_SELECTORS.status}
          onClick={handleConfirm}
        >
          약관 선택 확인
        </Button>
      </div>
    </Panel>
  );
}
