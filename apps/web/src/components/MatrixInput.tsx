import type { Matrix } from '../api/matrixApi';

const MIN_DIM = 1;
const MAX_DIM = 10;

interface PresetExample {
  label: string;
  matrix: Matrix;
}

const PRESETS: PresetExample[] = [
  { label: '2x3 por defecto', matrix: [[1, 2, 3], [4, 5, 6]] },
  { label: '3x3 identidad', matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
  { label: '3x3 diagonal', matrix: [[2, 0, 0], [0, 5, 0], [0, 0, -3]] },
];

interface MatrixInputProps {
  matrix: Matrix;
  onChange: (matrix: Matrix) => void;
  disabled?: boolean;
}

function buildMatrix(rows: number, cols: number, source: Matrix): Matrix {
  const next: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(source[i]?.[j] ?? 0);
    }
    next.push(row);
  }
  return next;
}

export default function MatrixInput({ matrix, onChange, disabled }: MatrixInputProps) {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  const handleRowsChange = (value: number) => {
    const clamped = Math.min(MAX_DIM, Math.max(MIN_DIM, value || MIN_DIM));
    onChange(buildMatrix(clamped, cols || 1, matrix));
  };

  const handleColsChange = (value: number) => {
    const clamped = Math.min(MAX_DIM, Math.max(MIN_DIM, value || MIN_DIM));
    onChange(buildMatrix(rows || 1, clamped, matrix));
  };

  const handleCellChange = (rowIdx: number, colIdx: number, raw: string) => {
    const next = matrix.map((row) => [...row]);
    next[rowIdx][colIdx] = raw === '' || raw === '-' ? (raw as unknown as number) : Number(raw);
    onChange(next);
  };

  const handleClear = () => {
    onChange(buildMatrix(rows || 2, cols || 2, []));
  };

  const handlePreset = (preset: PresetExample) => {
    onChange(preset.matrix.map((row) => [...row]));
  };

  return (
    <div className="matrix-input">
      <div className="matrix-input__controls">
        <label>
          Filas
          <input
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={rows}
            disabled={disabled}
            onChange={(e) => handleRowsChange(Number(e.target.value))}
          />
        </label>
        <label>
          Columnas
          <input
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            value={cols}
            disabled={disabled}
            onChange={(e) => handleColsChange(Number(e.target.value))}
          />
        </label>
        <button type="button" onClick={handleClear} disabled={disabled} className="btn-secondary">
          Limpiar
        </button>
      </div>

      <div className="matrix-input__presets">
        <span className="matrix-input__presets-label">Ejemplos:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePreset(preset)}
            disabled={disabled}
            className="btn-preset"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="matrix-input__grid" role="table" aria-label="Editor de celdas de la matriz">
        {matrix.map((row, rowIdx) => (
          <div className="matrix-input__row" role="row" key={rowIdx}>
            {row.map((value, colIdx) => (
              <input
                key={colIdx}
                role="cell"
                type="number"
                className="matrix-input__cell"
                value={value}
                disabled={disabled}
                onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                aria-label={`fila ${rowIdx + 1} columna ${colIdx + 1}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
