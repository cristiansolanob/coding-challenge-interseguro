import { useState } from 'react';
import {
  MatrixApiError,
  submitMatrix,
  type Matrix,
  type MatrixQrResponse,
} from './api/matrixApi';
import MatrixInput from './components/MatrixInput';
import ResultsPanel from './components/ResultsPanel';
import ErrorPanel from './components/ErrorPanel';
import './App.css';

const DEFAULT_MATRIX: Matrix = [
  [1, 2, 3],
  [4, 5, 6],
];

function validateMatrix(matrix: Matrix): string | null {
  if (matrix.length === 0) {
    return 'The matrix must have at least one row.';
  }
  if (matrix.some((row) => row.length === 0)) {
    return 'Every row must have at least one column.';
  }
  const width = matrix[0].length;
  if (matrix.some((row) => row.length !== width)) {
    return 'All rows must have the same number of columns.';
  }
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      const value = matrix[i][j];
      if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        return `Cell (row ${i + 1}, column ${j + 1}) must be a finite number.`;
      }
    }
  }
  return null;
}

export default function App() {
  const [matrix, setMatrix] = useState<Matrix>(DEFAULT_MATRIX);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatrixQrResponse | null>(null);
  const [error, setError] = useState<MatrixApiError | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const problem = validateMatrix(matrix);
    if (problem) {
      setValidationError(problem);
      setError(null);
      setResult(null);
      return;
    }

    setValidationError(null);
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await submitMatrix(matrix);
      setResult(response);
    } catch (err) {
      if (err instanceof MatrixApiError) {
        setError(err);
      } else {
        setError(new MatrixApiError('Unexpected error while contacting the API.', 'UNKNOWN_ERROR'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Matrix QR &amp; Statistics</h1>
        <p>
          Enter a matrix, rotate it 90° clockwise, compute its QR factorization, and view pooled
          statistics — all served by <code>apps/go-api</code>, which internally forwards results to{' '}
          <code>apps/node-api</code>.
        </p>
      </header>

      <main className="app__main">
        <form className="app__form" onSubmit={handleSubmit}>
          <MatrixInput matrix={matrix} onChange={setMatrix} disabled={loading} />

          {validationError && <p className="app__validation-error">{validationError}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Computing…' : 'Compute QR & statistics'}
          </button>
        </form>

        {error && <ErrorPanel error={error} />}
        {result && <ResultsPanel result={result} />}
      </main>
    </div>
  );
}
