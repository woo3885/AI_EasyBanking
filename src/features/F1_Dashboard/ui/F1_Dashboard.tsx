import { useRef, useState } from 'react';

import {
  DASHBOARD_SITES,
  DASHBOARD_TASKS,
  type DashboardSiteId,
  type DashboardTaskType
} from '@/features/F1_Dashboard/model/dashboard-options';
import type {
  DashboardSessionStartResult,
  DashboardStartSelection
} from '@/features/F1_Dashboard/model/dashboard-session';
import AppLayout from '@/shared/ui/AppLayout';
import { Button } from '@/shared/ui/Button';
import { NoticeBox } from '@/shared/ui/NoticeBox';
import { Panel } from '@/shared/ui/Panel';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';
import type { FrontendScreenState } from '@/types/frontend-state';

export type { DashboardStartSelection } from '@/features/F1_Dashboard/model/dashboard-session';

export interface F1DashboardProps {
  onStart?: (
    selection: DashboardStartSelection
  ) =>
    | void
    | DashboardSessionStartResult
    | Promise<void | DashboardSessionStartResult>;
}

const INITIAL_STATUS_MESSAGE =
  '사이트와 업무를 선택한 뒤 시작해 주세요.';
const READY_STATUS_MESSAGE =
  '선택한 업무를 시작할 준비가 완료되었습니다.';
const STARTING_STATUS_MESSAGE = '세션을 준비하고 있습니다.';
const SUCCESS_STATUS_MESSAGE = '금융 업무 세션이 준비되었습니다.';
const ERROR_STATUS_MESSAGE =
  '세션을 준비하지 못했습니다. 다시 시도해 주세요.';
const START_REQUIREMENTS_ID = 'description-dashboard-start-requirements';

const taskRadioIds: Record<DashboardTaskType, string> = {
  OPEN_DEPOSIT: 'radio-task-open-deposit',
  TRANSFER_MONEY: 'radio-task-transfer-money'
};

export default function F1_Dashboard({ onStart }: F1DashboardProps) {
  const startRequestInFlight = useRef(false);
  const [selectedSiteId, setSelectedSiteId] =
    useState<DashboardSiteId | null>(null);
  const [selectedTaskType, setSelectedTaskType] =
    useState<DashboardTaskType | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    INITIAL_STATUS_MESSAGE
  );
  const [isStarting, setIsStarting] = useState(false);
  const [startResult, setStartResult] =
    useState<DashboardSessionStartResult | null>(null);
  const [startError, setStartError] = useState(false);

  const selectedSite = DASHBOARD_SITES.find(
    (site) => site.id === selectedSiteId
  );
  const selectedTask = DASHBOARD_TASKS.find(
    (task) => task.id === selectedTaskType
  );
  const canStart =
    selectedSiteId !== null && selectedTaskType !== null;
  const frontendScreenState: FrontendScreenState = {
    sessionId: startResult?.sessionId ?? null,
    workflowStatus: startError ? 'ERROR' : 'SESSION_CREATED',
    screenType: startError
      ? 'WORKFLOW_ERROR'
      : startResult
        ? 'SESSION_READY'
        : 'INITIAL_SCREEN',
    message: statusMessage,
    isConnected: false,
    isLoading: isStarting
  };

  const resetStartFeedback = () => {
    setStartResult(null);
    setStartError(false);
    setStatusMessage(INITIAL_STATUS_MESSAGE);
  };

  const handleSiteSelect = (siteId: DashboardSiteId) => {
    const nextSite = DASHBOARD_SITES.find((site) => site.id === siteId);

    setSelectedSiteId(siteId);
    setSelectedTaskType((currentTaskType) => {
      if (
        currentTaskType !== null &&
        !nextSite?.supportedTaskTypes.includes(currentTaskType)
      ) {
        return null;
      }

      return currentTaskType;
    });
    resetStartFeedback();
  };

  const handleTaskSelect = (taskType: DashboardTaskType) => {
    setSelectedTaskType(taskType);
    resetStartFeedback();
  };

  const handleStart = async () => {
    if (
      selectedSiteId === null ||
      selectedTaskType === null ||
      startRequestInFlight.current
    ) {
      return;
    }

    startRequestInFlight.current = true;
    setStartResult(null);
    setStartError(false);
    setIsStarting(true);
    setStatusMessage(STARTING_STATUS_MESSAGE);

    try {
      const result = await onStart?.({
        siteId: selectedSiteId,
        taskType: selectedTaskType
      });

      if (result === undefined) {
        setStatusMessage(READY_STATUS_MESSAGE);
        return;
      }

      setStartResult(result);
      setStatusMessage(SUCCESS_STATUS_MESSAGE);
    } catch {
      setStartError(true);
      setStatusMessage(ERROR_STATUS_MESSAGE);
    } finally {
      startRequestInFlight.current = false;
      setIsStarting(false);
    }
  };

  return (
    <AppLayout
      workflowStatus={frontendScreenState.workflowStatus}
      screenType={frontendScreenState.screenType}
      message={frontendScreenState.message}
      isConnected={frontendScreenState.isConnected}
      isLoading={frontendScreenState.isLoading}
      tone={startError ? 'danger' : 'default'}
      actions={
        <Button
          id="btn-start-financial-task"
          data-testid="btn-start-financial-task"
          type="button"
          size="lg"
          disabled={!canStart || isStarting}
          isLoading={isStarting}
          aria-describedby={START_REQUIREMENTS_ID}
          onClick={handleStart}
        >
          선택한 업무 시작
        </Button>
      }
    >
      <div className="w-full max-w-5xl space-y-6 py-4">
        <div className="text-center">
          <Text as="h2" variant="title">
            금융 업무 시작
          </Text>
          <Text variant="guide" className="mt-3">
            이용할 사이트와 업무를 직접 선택해 주세요.
          </Text>
        </div>

        <NoticeBox
          variant="info"
          title="데모 환경 안내"
          announce="off"
          role="note"
        >
          현재는 시연용 데모 환경이며 실제 금융거래는 발생하지 않습니다.
        </NoticeBox>

        <Panel aria-label="지원 사이트 선택">
          <fieldset>
            <legend>
              <Text as="span" variant="heading">
                1. 이용할 사이트 선택
              </Text>
            </legend>

            <div className="mt-4 space-y-3">
              {DASHBOARD_SITES.map((site) => {
                const isSelected = selectedSiteId === site.id;
                const descriptionId = `site-${site.id}-description`;

                return (
                  <label
                    key={site.id}
                    htmlFor={`radio-site-${site.id}`}
                    className={[
                      'flex min-h-12 cursor-pointer items-start gap-4 rounded-xl border-2 p-4',
                      'focus-within:ring-4 focus-within:ring-brand-100 focus-within:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-brand-50'
                        : 'border-border bg-surface hover:bg-slate-50'
                    ].join(' ')}
                  >
                    <input
                      id={`radio-site-${site.id}`}
                      data-testid={`radio-site-${site.id}`}
                      type="radio"
                      name="dashboard-site"
                      value={site.id}
                      checked={isSelected}
                      disabled={isStarting}
                      onChange={() => handleSiteSelect(site.id)}
                      aria-label={site.name}
                      aria-describedby={descriptionId}
                      className="mt-1 size-5 shrink-0 accent-primary focus-visible:ring-4 focus-visible:ring-brand-100"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Text as="span" variant="guide">
                          {site.name}
                        </Text>
                        <StatusBadge variant="progress">
                          {site.environmentLabel}
                        </StatusBadge>
                        <StatusBadge
                          variant={isSelected ? 'success' : 'neutral'}
                        >
                          {isSelected ? '선택됨' : '선택 전'}
                        </StatusBadge>
                      </span>
                      <Text
                        as="span"
                        variant="body"
                        id={descriptionId}
                        className="mt-2 block text-text-secondary"
                      >
                        {site.description}
                      </Text>
                      <Text
                        as="span"
                        variant="caption"
                        className="mt-2 block"
                      >
                        지원 업무: 예금 가입, 계좌이체
                      </Text>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Panel>

        <Panel aria-label="업무 종류 선택">
          <fieldset>
            <legend>
              <Text as="span" variant="heading">
                2. 진행할 업무 선택
              </Text>
            </legend>
            <Text variant="body" className="mt-2 text-text-secondary">
              사이트를 먼저 선택하면 진행할 업무를 선택할 수 있습니다.
            </Text>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {DASHBOARD_TASKS.map((task) => {
                const isSelected = selectedTaskType === task.id;
                const isSupported =
                  selectedSite?.supportedTaskTypes.includes(task.id) ??
                  false;
                const isDisabled =
                  isStarting || selectedSiteId === null || !isSupported;
                const radioId = taskRadioIds[task.id];
                const descriptionId = `task-${task.id.toLowerCase()}-description`;

                return (
                  <label
                    key={task.id}
                    htmlFor={radioId}
                    className={[
                      'flex min-h-12 items-start gap-4 rounded-xl border-2 p-4',
                      'focus-within:ring-4 focus-within:ring-brand-100 focus-within:ring-offset-2',
                      isDisabled
                        ? 'cursor-not-allowed border-border bg-slate-100 opacity-70'
                        : 'cursor-pointer hover:bg-slate-50',
                      isSelected
                        ? 'border-primary bg-brand-50'
                        : 'border-border'
                    ].join(' ')}
                  >
                    <input
                      id={radioId}
                      data-testid={radioId}
                      type="radio"
                      name="dashboard-task"
                      value={task.id}
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => handleTaskSelect(task.id)}
                      aria-label={task.name}
                      aria-describedby={descriptionId}
                      className="mt-1 size-5 shrink-0 accent-primary focus-visible:ring-4 focus-visible:ring-brand-100"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Text as="span" variant="guide">
                          {task.name}
                        </Text>
                        <StatusBadge
                          variant={isSelected ? 'success' : 'neutral'}
                        >
                          {isSelected ? '선택됨' : '선택 전'}
                        </StatusBadge>
                      </span>
                      <Text
                        as="span"
                        variant="body"
                        id={descriptionId}
                        className="mt-2 block text-text-secondary"
                      >
                        {task.description}
                      </Text>
                      <Text
                        as="span"
                        variant="caption"
                        className="mt-3 block font-bold text-text-primary"
                      >
                        데모 요청
                      </Text>
                      <Text
                        as="span"
                        variant="body"
                        className="mt-1 block text-text-secondary"
                      >
                        {task.userRequest}
                      </Text>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Panel>

        <Panel
          title="선택 결과"
          description="사이트와 업무를 모두 선택하면 시작할 수 있습니다."
        >
          <Text
            id={START_REQUIREMENTS_ID}
            variant="body"
            className="mb-4 font-semibold text-text-primary"
          >
            {canStart
              ? '시작 준비가 완료되었습니다.'
              : '사이트와 업무를 모두 선택해 주세요.'}
          </Text>
          <dl className="grid gap-4 text-base sm:grid-cols-2">
            <div>
              <dt className="font-bold text-text-secondary">선택 사이트</dt>
              <dd className="mt-1 font-semibold text-text-primary">
                {selectedSite?.name ?? '선택 전'}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-text-secondary">선택 업무</dt>
              <dd className="mt-1 font-semibold text-text-primary">
                {selectedTask?.name ?? '선택 전'}
              </dd>
            </div>
            {startResult ? (
              <div data-testid="dashboard-session-result">
                <dt className="font-bold text-text-secondary">세션 ID</dt>
                <dd className="mt-1 font-semibold text-text-primary">
                  {startResult.sessionId}
                </dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      </div>
    </AppLayout>
  );
}
