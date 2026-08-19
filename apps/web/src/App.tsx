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
    return 'La matriz debe tener al menos una fila.';
  }
  if (matrix.some((row) => row.length === 0)) {
    return 'Cada fila debe tener al menos una columna.';
  }
  const width = matrix[0].length;
  if (matrix.some((row) => row.length !== width)) {
    return 'Todas las filas deben tener la misma cantidad de columnas.';
  }
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      const value = matrix[i][j];
      if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        return `La celda (fila ${i + 1}, columna ${j + 1}) debe ser un número finito.`;
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
        setError(new MatrixApiError('Error inesperado al contactar la API.', 'UNKNOWN_ERROR'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>QR y Estadísticas de Matriz</h1>
        <p>
          Ingrese una matriz, rótela 90° en sentido horario, calcule su factorización QR y
          visualice las estadísticas agrupadas — todo servido por <code>apps/go-api</code>, que
          internamente reenvía los resultados a <code>apps/node-api</code>.
        </p>
      </header>

      <main className="app__main">
        <form className="app__form" onSubmit={handleSubmit}>
          <MatrixInput matrix={matrix} onChange={setMatrix} disabled={loading} />

          {validationError && <p className="app__validation-error">{validationError}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Calculando…' : 'Calcular QR y estadísticas'}
          </button>
        </form>

        {error && <ErrorPanel error={error} />}
        {result && <ResultsPanel result={result} />}
      </main>
    </div>
  );
}
