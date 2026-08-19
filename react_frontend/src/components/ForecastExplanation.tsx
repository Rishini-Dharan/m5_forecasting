import { useEffect, useState } from 'react';
import { ENDPOINTS } from '../config';
import { authHeaders, errorFromResponse, toMessage } from '../lib/api';

export interface Driver {
  feature: string;
  label: string;
  description: string;
  contribution: number;
  multiplier: number;
  direction: 'increases' | 'decreases';
  value: number;
  approximate: boolean;
}

export interface Explanation {
  item_id: string;
  store_id: string;
  horizon_days: number;
  method: string;
  base_units_per_day: number;
  explained_units_per_day: number;
  drivers: Driver[];
  approximated_features: string[];
}

interface Props {
  itemId: string;
  storeId: string;
  days: number;
}

/**
 * Explains a forecast using LightGBM's exact SHAP contributions.
 *
 * Rendered as a diverging bar list rather than a chart library component so it stays readable
 * by a screen reader: it is a definition-style list with text values, and the bars are purely
 * decorative (aria-hidden).
 */
export default function ForecastExplanation({ itemId, storeId, days }: Props) {
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId || !storeId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${ENDPOINTS.prediction.explain}?item_id=${encodeURIComponent(itemId)}`
          + `&store_id=${encodeURIComponent(storeId)}&days=${days}&top_n=8`;
        const response = await fetch(url, { headers: authHeaders() });
        if (!response.ok) throw new Error(await errorFromResponse(response, 'Could not load the explanation'));
        const json: Explanation = await response.json();
        if (!cancelled) setData(json);
      } catch (err: unknown) {
        if (!cancelled) setError(toMessage(err, 'Could not load the explanation'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [itemId, storeId, days]);

  const maxMagnitude = data
    ? Math.max(...data.drivers.map((d) => Math.abs(d.contribution)), 0.0001)
    : 1;

  return (
    <section
      className="bg-gray-900 rounded-xl border border-gray-800 p-6"
      aria-labelledby="explanation-heading"
    >
      <h3 id="explanation-heading" className="text-lg font-semibold text-white mb-1">
        Why this forecast?
      </h3>
      <p className="text-sm text-gray-400 mb-5">
        Each driver&apos;s share of the prediction, from the model&apos;s own SHAP values. The
        contributions reconstruct the forecast exactly rather than approximating it.
      </p>

      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="text-gray-400 text-sm">Loading explanation…</p>}
        {error && (
          <p role="alert" className="text-red-300 text-sm bg-red-900/30 border border-red-700 rounded-lg p-3">
            {error}
          </p>
        )}
      </div>

      {data && !loading && (
        <>
          <p className="text-sm text-gray-300 mb-5">
            A typical item at this store averages{' '}
            <strong className="text-white">{data.base_units_per_day.toFixed(2)}</strong> units/day.
            The drivers below move that to{' '}
            <strong className="text-white">{data.explained_units_per_day.toFixed(2)}</strong>{' '}
            units/day for {data.item_id} at {data.store_id}.
          </p>

          <ul className="space-y-3 list-none p-0 m-0">
            {data.drivers.map((driver) => {
              const width = (Math.abs(driver.contribution) / maxMagnitude) * 100;
              const positive = driver.contribution > 0;
              const isOpen = expanded === driver.feature;
              return (
                <li key={driver.feature}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : driver.feature)}
                    aria-expanded={isOpen}
                    aria-controls={`driver-desc-${driver.feature}`}
                    className="w-full text-left bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                  >
                    <span className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-sm text-gray-200">
                        {driver.label}
                        {driver.approximate && (
                          <span
                            className="ml-2 text-[10px] uppercase tracking-wider text-amber-300/90 border border-amber-500/40 rounded px-1.5 py-0.5"
                            title="Computed from a shortened history, so this attribution is indicative"
                          >
                            approx
                          </span>
                        )}
                      </span>
                      <span className={positive ? 'text-green-400 text-sm font-mono' : 'text-red-400 text-sm font-mono'}>
                        {driver.multiplier.toFixed(2)}×
                      </span>
                    </span>
                    <span
                      className="block h-2 rounded bg-gray-800 overflow-hidden"
                      aria-hidden="true"
                    >
                      <span
                        className={`block h-full rounded ${positive ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${width}%` }}
                      />
                    </span>
                  </button>
                  <p
                    id={`driver-desc-${driver.feature}`}
                    hidden={!isOpen}
                    className="text-xs text-gray-400 mt-2 mb-0"
                  >
                    {driver.description} Current value: {driver.value}. This {driver.direction} the
                    forecast by {Math.abs((driver.multiplier - 1) * 100).toFixed(1)}%.
                  </p>
                </li>
              );
            })}
          </ul>

          {data.approximated_features.length > 0 && (
            <p className="text-xs text-gray-500 mt-5 mb-0">
              Drivers marked <em>approx</em> are computed over the full training history, which the
              published 57-day data file cannot reproduce. Their direction is reliable; their exact
              size is indicative.
            </p>
          )}
        </>
      )}
    </section>
  );
}
