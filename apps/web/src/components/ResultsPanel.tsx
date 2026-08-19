import type { MatrixQrResponse } from '../api/matrixApi';
import MatrixTable from './MatrixTable';

interface ResultsPanelProps {
  result: MatrixQrResponse;
}

function BooleanBadge({ value }: { value: boolean }) {
  return <span className={`badge ${value ? 'badge--yes' : 'badge--no'}`}>{value ? 'Sí' : 'No'}</span>;
}

export default function ResultsPanel({ result }: ResultsPanelProps) {
  const { input, rotated, q, r, downstream } = result;
  const stats = downstream.body;

  return (
    <div className="results-panel">
      <section className="results-panel__section">
        <h2>Rotación y factorización QR</h2>
        <p className="results-panel__note">
          Matriz de entrada: {input.rows}×{input.cols}. La matriz se rota 90° en sentido horario
          antes de factorizarla; los valores de abajo se muestran con 4 decimales (la API devolvió
          precisión completa).
        </p>
        <div className="results-panel__grid">
          <MatrixTable title="Rotada" dims={rotated} values={rotated.values} />
          <MatrixTable title="Q" dims={q} values={q.values} />
          <MatrixTable title="R" dims={r} values={r.values} />
        </div>
      </section>

      <section className="results-panel__section">
        <h2>Estadísticas (desde apps/node-api, vía go-api)</h2>
        <p className="results-panel__note">
          Agrupadas sobre todos los elementos de la matriz rotada, Q y R combinados ({stats.count}{' '}
          valores).
        </p>
        <dl className="stats-grid">
          <div className="stats-grid__item">
            <dt>Cantidad</dt>
            <dd>{stats.count}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Máximo</dt>
            <dd>{stats.max.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Mínimo</dt>
            <dd>{stats.min.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Suma</dt>
            <dd>{stats.sum.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>Promedio</dt>
            <dd>{stats.average.toFixed(4)}</dd>
          </div>
          <div className="stats-grid__item">
            <dt>¿Es diagonal (alguna)?</dt>
            <dd>
              <BooleanBadge value={stats.isDiagonal} />
            </dd>
          </div>
        </dl>

        <h3 className="results-panel__subheading">Verificación de diagonal por matriz</h3>
        <dl className="stats-grid">
          <div className="stats-grid__item">
            <dt>Matriz rotada</dt>
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
