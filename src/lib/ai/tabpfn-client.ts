/**
 * Thin HTTP client for the Prior Labs TabPFN REST API (TabPFN-3.5-Plus).
 *
 * The API is a 4-step flow — not a single call:
 *   1. POST /tabpfn/prepare_train_set_upload  -> signed URLs
 *   2. PUT  x_train.csv + y_train.csv
 *   3. POST /tabpfn/fit                       -> fitted_train_set_id
 *   4. POST /tabpfn/prepare_test_set_upload   -> signed URL
 *   5. PUT  x_test.csv
 *   6. POST /tabpfn/predict                   -> predictions
 *
 * Docs: https://docs.priorlabs.ai/api/rest-quickstart
 *
 * Everything here is best-effort: callers catch failures and fall back to the
 * on-device heuristic, so the app keeps working with no key and no network.
 */

const BASE = process.env.TABPFN_API_BASE ?? 'https://api.priorlabs.ai';
const DEFAULT_MODEL_PATH = process.env.TABPFN_MODEL_PATH ?? 'v3.5_default';

/** CSV uploads MUST carry a header row, or the API treats row 1 as the column names. */
function toCsv(header: string[], rows: number[][]): string {
  const head = header.join(',');
  const body = rows.map(r => r.join(',')).join('\n');
  return `${head}\n${body}\n`;
}

interface SignedInfo {
  signed_urls: string[];
  required_headers: Record<string, string>;
}

async function postJson<T>(path: string, body: unknown, token: string, timeoutMs: number): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`TabPFN ${path} -> ${res.status} ${text.slice(0, 180)}`);
  // Long fits stream keepalive whitespace before the JSON payload.
  return JSON.parse(text.trim()) as T;
}

async function putCsv(info: SignedInfo, csv: string, timeoutMs: number): Promise<void> {
  const headers: Record<string, string> = { ...info.required_headers };
  // `Host` is a forbidden header name in fetch — the signed URL already carries it.
  delete headers.Host;
  const res = await fetch(info.signed_urls[0], {
    method: 'PUT',
    headers,
    body: csv,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`TabPFN upload -> ${res.status}`);
}

export interface TabPFNRegressionInput {
  xTrain: number[][];
  yTrain: number[];
  xTest: number[][];
  featureNames?: string[];
  modelPath?: string;
  /** Budget for the (possibly slow) fit step. */
  fitTimeoutMs?: number;
}

export interface TabPFNRegressionResult {
  predictions: number[];
  modelVersion?: string;
  nEstimators?: number;
}

/**
 * Fit a TabPFN regressor on (xTrain -> yTrain) and predict `xTest`.
 * Throws on any error so callers can fall back deterministically.
 */
export async function tabpfnRegression(input: TabPFNRegressionInput): Promise<TabPFNRegressionResult> {
  const token = process.env.TABPFN_API_KEY;
  if (!token) throw new Error('TABPFN_API_KEY not set');

  const {
    xTrain, yTrain, xTest,
    featureNames = xTrain[0]?.map((_, i) => `f${i}`) ?? [],
    modelPath = DEFAULT_MODEL_PATH,
    fitTimeoutMs = 60_000,
  } = input;

  if (xTrain.length === 0 || xTest.length === 0) throw new Error('TabPFN: empty dataset');
  if (xTrain[0].length !== xTest[0].length) throw new Error('TabPFN: train/test column mismatch');

  const quick = 20_000;

  // 1 + 2) training set
  const prep = await postJson<{ train_set_upload_id: string; x_train_info: SignedInfo; y_train_info: SignedInfo }>(
    '/tabpfn/prepare_train_set_upload',
    { x_train_info: { format: 'csv' }, y_train_info: { format: 'csv' } },
    token, quick,
  );
  await putCsv(prep.x_train_info, toCsv(featureNames, xTrain), quick);
  await putCsv(prep.y_train_info, toCsv(['target'], yTrain.map(v => [v])), quick);

  // 3) fit
  const fit = await postJson<{ fitted_train_set_id: string }>(
    '/tabpfn/fit',
    {
      train_set_upload_id: prep.train_set_upload_id,
      task_config: { task: 'regression', tabpfn_config: { model_path: modelPath } },
    },
    token, fitTimeoutMs,
  );

  // 4 + 5) test set
  const tprep = await postJson<{ test_set_upload_id: string; x_test_info: SignedInfo }>(
    '/tabpfn/prepare_test_set_upload',
    { fitted_train_set_id: fit.fitted_train_set_id, x_test_info: { format: 'csv' } },
    token, quick,
  );
  await putCsv(tprep.x_test_info, toCsv(featureNames, xTest), quick);

  // 6) predict
  const pred = await postJson<{
    prediction: number[] | { mean?: number[] };
    metadata?: { tabpfn_config?: { n_estimators?: number }; billing_model_version?: string };
  }>(
    '/tabpfn/predict',
    {
      test_set_upload_id: tprep.test_set_upload_id,
      fitted_train_set_id: fit.fitted_train_set_id,
      task_config: { task: 'regression', predict_params: { output_type: 'mean' } },
    },
    token, quick,
  );

  const raw = Array.isArray(pred.prediction) ? pred.prediction : pred.prediction?.mean;
  if (!raw || raw.length !== xTest.length) throw new Error('TabPFN: unexpected prediction shape');

  return {
    predictions: raw.map(n => (Number.isFinite(n) ? n : 0)),
    modelVersion: pred.metadata?.billing_model_version,
    nEstimators: pred.metadata?.tabpfn_config?.n_estimators,
  };
}
