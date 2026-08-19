import type { Matrix } from '../api/matrixApi';

interface MatrixTableProps {
  title: string;
  dims: { rows: number; cols: number };
  values: Matrix;
  precision?: number;
}

export default function MatrixTable({ title, dims, values, precision = 4 }: MatrixTableProps) {
  return (
    <div className="matrix-table">
      <h3>
        {title} <span className="matrix-table__dims">({dims.rows}×{dims.cols})</span>
      </h3>
      <div className="matrix-table__scroll">
        <table>
          <tbody>
            {values.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((value, colIdx) => (
                  <td key={colIdx} title={String(value)}>
                    {value.toFixed(precision)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
