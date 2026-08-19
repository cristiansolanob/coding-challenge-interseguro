import type { MatrixQrResponse } from '../api/matrixApi';
import MatrixTable from './MatrixTable';

interface ResultsPanelProps {
  result: MatrixQrResponse;
}

function BooleanBadge({ value }: { value: boolean }) {
  return <span className={`badge ${value ? 'badge--yes' : 'badge--no'}`}>{value ? 'Yes' : 'No'}</span>;
}

export default function ResultsPanel({ result }: ResultsPanelProps) {
  const { input, rotated, q, r, downstream } = result;
  const stats = downstream.body;

  return (
    <div className="results-panel">
      <section className="results-panel__section">
        <h2>Rotation &amp; QR factorization</h2>
        <p className="results-panel__note">
          Input matrix: {input.rows}×{input.cols}. The matrix is rotated 90° clockwise before
          factorization; values below are shown to 4 decimal places (full precision was received
          from the API).
        </p>
        <div className="results-panel__grid">
          <MatrixTable title="Rotated" dims={rotated} values={rotated.values} />
          <MatrixTable title="Q" dims={q} values={q.values} />
          <MatrixTable title="R" dims={r} values={r.values} />
        </div>
      </section>

      <section className="results-panel__section">
        <h2>Statistics (from apps/node-api, via go-api)</h2>
        <p className="results-panel__note">
          Pooled over all elements of the rotated matrix, Q, and R combined ({stats.count} values).
        </p>
        <dl className="stats-grid">
          <div className="stats-grid__item">
            <dt>Count</dt>
            <dd>{stats.count}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Max</dt>
            <dd>{stats.max.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Min</dt>
            <dd>{stats.min.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Sum</dt>
            <dd>{stats.sum.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Average</dt>
            <dd>{stats.average.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Is diagonal (any)</dt>
            <dd>
              <BooleanBadge value={stats.isDiagonal} />
            </dd>
          </div>
        </dl>

        <h3 className="results-panel__subheading">Per-matrix diagonal check</h3>
        <dl className="stats-grid">
          <div className="stats-grid__item">
            <dt>Rotated matrix</dt>
            <dd>
              <BooleanBadge value={stats.diagonal.matrix} />
            </dd>
          </div>
          <div className="stats-grid__item">
            <dt>Q</dt>
            <dd>
              <BooleanBadge value={stats.diagonal.q} />
            </dd>
          </div>
          <div className="stats-grid__item">
            <dt>R</dt>
            <dd>
              <BooleanBadge value={stats.diagonal.r} />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
