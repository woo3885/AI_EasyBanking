export type ControllerAction =
  | 'REPLAY'
  | 'PAUSE'
  | 'RESUME'
  | 'PREVIOUS'
  | 'CANCEL';

export const CONTROLLER_ACTION_MESSAGES: Record<ControllerAction, string> = {
  REPLAY: '안내 다시 듣기를 요청했습니다.',
  PAUSE: '일시정지를 요청했습니다.',
  RESUME: '계속 진행을 요청했습니다.',
  PREVIOUS: '이전 단계 이동을 요청했습니다.',
  CANCEL: '업무 취소를 요청했습니다.'
};

export const CONTROLLER_SELECTORS = {
  root: 'controller-main',
  replayButton: 'btn-controller-replay',
  pauseButton: 'btn-controller-pause',
  previousButton: 'btn-controller-previous',
  cancelButton: 'btn-controller-cancel',
  actionStatus: 'status-controller-action',
  cancelConfirmationPanel: 'panel-controller-cancel-confirm',
  cancelDismissButton: 'btn-controller-cancel-dismiss',
  cancelConfirmButton: 'btn-controller-cancel-confirm'
} as const;

export const CONTROLLER_PREVIEW_SELECTORS = {
  root: 'preview-main-controller',
  actionStatus: 'status-preview-controller-action'
} as const;

export const INITIAL_CONTROLLER_ACTION_MESSAGE =
  '요청된 컨트롤 동작이 없습니다.';

export function getControllerActionMessage(action: ControllerAction): string {
  return CONTROLLER_ACTION_MESSAGES[action];
}
