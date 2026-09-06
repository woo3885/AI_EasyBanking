interface SensitiveMessageWarningProps {
  message: string;
  onDismiss?: () => void;
}

export default function SensitiveMessageWarning({
  message,
  onDismiss
}: SensitiveMessageWarningProps) {
  return (
    <div className="agent-message-warning" role="alert">
      <p>{message}</p>
      {onDismiss ? (
        <button type="button" onClick={onDismiss}>
          안내 닫기
        </button>
      ) : null}
    </div>
  );
}
