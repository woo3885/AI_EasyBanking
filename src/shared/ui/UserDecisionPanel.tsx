import { useId } from 'react';

import {
  analyzeUserDecisionOptions,
  canConfirmUserDecision,
  createUserDecisionOptionElementId,
  getSelectedUserDecisionOption,
  type UserDecisionOption
} from '@/shared/model/user-decision';
import { Button } from './Button';
import { Panel } from './Panel';
import { Text } from './Text';

export const USER_DECISION_PANEL_SELECTORS = {
  panel: 'panel-user-decision',
  heading: 'heading-user-decision',
  options: 'options-user-decision',
  status: 'status-user-decision',
  confirm: 'btn-user-decision-confirm'
} as const;

export interface UserDecisionPanelProps {
  title?: string;
  message?: string;
  options: readonly UserDecisionOption[];
  selectedOptionId: string | null;
  disabled?: boolean;
  isBusy?: boolean;
  onSelect: (optionId: string) => void;
  onConfirm: (optionId: string) => void;
  className?: string;
}

const DEFAULT_TITLE = '직접 선택해 주세요';
const DEFAULT_MESSAGE =
  '아래 항목을 확인한 뒤 하나를 직접 선택하고 확인해 주세요.';
const EMPTY_MESSAGE =
  '선택 항목을 준비하고 있습니다. 잠시 후 다시 확인해 주세요.';
const INVALID_MESSAGE =
  '선택 항목을 표시할 수 없습니다. 안전하게 다시 확인해 주세요.';

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

function normalizedText(value: string | undefined, fallback: string): string {
  const normalizedValue = value?.trim();
  return normalizedValue || fallback;
}

export function UserDecisionPanel({
  title,
  message,
  options,
  selectedOptionId,
  disabled = false,
  isBusy = false,
  onSelect,
  onConfirm,
  className
}: UserDecisionPanelProps) {
  const radioGroupName = `user-decision-${useId()}`;
  const analysis = analyzeUserDecisionOptions(options);
  const selectedOption = getSelectedUserDecisionOption(
    options,
    selectedOptionId
  );
  const controlsDisabled = disabled || isBusy;
  const confirmEnabled = canConfirmUserDecision(
    options,
    selectedOptionId,
    disabled,
    isBusy
  );
  const displayedTitle = normalizedText(title, DEFAULT_TITLE);
  const displayedMessage = normalizedText(message, DEFAULT_MESSAGE);

  const statusMessage = isBusy
    ? '선택 확인 요청을 처리하고 있습니다.'
    : disabled
      ? '현재는 선택 기능을 사용할 수 없습니다.'
      : analysis.state === 'EMPTY'
      ? EMPTY_MESSAGE
      : analysis.state === 'INVALID'
        ? INVALID_MESSAGE
        : selectedOption
          ? `선택한 항목: ${selectedOption.label}`
          : '선택된 항목이 없습니다.';

  const handleConfirm = () => {
    const validatedOption = getSelectedUserDecisionOption(
      options,
      selectedOptionId
    );

    if (confirmEnabled && validatedOption) {
      onConfirm(validatedOption.id);
    }
  };

  return (
    <Panel
      {...elementIdentity(USER_DECISION_PANEL_SELECTORS.panel)}
      aria-labelledby={USER_DECISION_PANEL_SELECTORS.heading}
      aria-describedby={USER_DECISION_PANEL_SELECTORS.status}
      aria-busy={isBusy}
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <h2
        {...elementIdentity(USER_DECISION_PANEL_SELECTORS.heading)}
        className="text-2xl font-bold leading-snug text-text-primary"
      >
        {displayedTitle}
      </h2>
      <Text variant="guide" className="mt-3 text-text-secondary">
        {displayedMessage}
      </Text>

      <fieldset
        {...elementIdentity(USER_DECISION_PANEL_SELECTORS.options)}
        disabled={controlsDisabled}
        className="mt-6 min-w-0"
      >
        <legend className="text-lg font-bold leading-relaxed text-text-primary">
          선택 항목
        </legend>

        {analysis.state === 'READY' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {analysis.options.map((option) => {
              const optionElementId = createUserDecisionOptionElementId(
                option.id
              );
              if (optionElementId === null) {
                return null;
              }

              const descriptionId = `description-user-decision-${option.id}`;
              const hasDescription = Boolean(option.description);
              const optionDisabled = controlsDisabled || Boolean(option.disabled);
              const isSelected = selectedOption?.id === option.id;

              return (
                <label
                  key={option.id}
                  htmlFor={optionElementId}
                  className={[
                    'flex min-h-14 items-start gap-4 rounded-xl border-2 p-4',
                    'focus-within:ring-4 focus-within:ring-brand-100 focus-within:ring-offset-2',
                    optionDisabled
                      ? 'cursor-not-allowed border-border bg-slate-100 opacity-70'
                      : 'cursor-pointer border-border bg-surface hover:bg-slate-50',
                    isSelected ? 'border-primary bg-brand-50' : ''
                  ].join(' ')}
                >
                  <input
                    {...elementIdentity(optionElementId)}
                    type="radio"
                    name={radioGroupName}
                    value={option.id}
                    checked={isSelected}
                    disabled={optionDisabled}
                    onChange={(event) => {
                      if (event.currentTarget.checked && !optionDisabled) {
                        onSelect(option.id);
                      }
                    }}
                    aria-describedby={
                      hasDescription || option.disabled
                        ? descriptionId
                        : undefined
                    }
                    className="mt-1 size-5 shrink-0 accent-primary focus-visible:ring-4 focus-visible:ring-brand-100"
                  />
                  <span className="min-w-0 flex-1">
                    <Text as="span" variant="guide">
                      {option.label}
                    </Text>
                    {hasDescription || option.disabled ? (
                      <Text
                        id={descriptionId}
                        as="span"
                        variant="body"
                        className="mt-2 block text-text-secondary"
                      >
                        {option.description}
                        {option.description && option.disabled ? ' ' : null}
                        {option.disabled ? '현재 선택할 수 없습니다.' : null}
                      </Text>
                    ) : null}
                    <Text
                      as="span"
                      variant="caption"
                      className="mt-2 block font-bold"
                    >
                      {option.disabled
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
        {...elementIdentity(USER_DECISION_PANEL_SELECTORS.status)}
        role="status"
        aria-live="polite"
        className="mt-6 rounded-xl border-2 border-border bg-slate-50 p-4 text-base leading-relaxed text-text-primary"
      >
        {statusMessage}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          {...elementIdentity(USER_DECISION_PANEL_SELECTORS.confirm)}
          size="lg"
          disabled={!confirmEnabled}
          isLoading={isBusy}
          aria-describedby={USER_DECISION_PANEL_SELECTORS.status}
          onClick={handleConfirm}
        >
          선택 확인
        </Button>
      </div>
    </Panel>
  );
}
