import type { MatrixApiError } from '../api/matrixApi';

interface ErrorPanelProps {
  error: MatrixApiError;
}

export default function ErrorPanel({ error }: ErrorPanelProps) {
  return (
    <div className="error-panel" role="alert">
      <h2>Request failed</h2>
      <p className="error-panel__code">{error.code}</p>
      <p className="error-panel__message">{error.message}</p>
      {error.details && Object.keys(error.details).length > 0 && (
        <>
          <h3>Details</h3>
          <pre className="error-panel__details">{JSON.stringify(error.details, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
