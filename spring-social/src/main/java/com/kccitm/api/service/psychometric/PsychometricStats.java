package com.kccitm.api.service.psychometric;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Classical test-theory and matrix statistics for the "Psychometric properties
 * of Navigator 360" export. Everything here mirrors the closed-form methods the
 * original validation workbook was built with:
 *
 * <ul>
 *   <li>IRT difficulty b = -logit(p) for dichotomous items, -(mean-2) for
 *       0-4 polytomous items; discrimination a = 1.7r/sqrt(1-r^2) from the
 *       item-total point-biserial; GRM thresholds b_k = -logit(P(X&gt;=k)).</li>
 *   <li>EFA is principal components on the Pearson correlation matrix with
 *       Kaiser retention (eigenvalue &gt; 1).</li>
 * </ul>
 *
 * All methods are null-safe against degenerate cohorts (zero variance, n &lt; 3)
 * and return {@code Double.NaN} when a statistic is undefined; sheet writers
 * turn NaN into a blank cell.
 */
public final class PsychometricStats {

    private PsychometricStats() {
    }

    // ── univariate ──────────────────────────────────────────────────────────

    public static double mean(double[] x) {
        if (x.length == 0) return Double.NaN;
        double s = 0;
        for (double v : x) s += v;
        return s / x.length;
    }

    /** Sample standard deviation (n-1). */
    public static double sd(double[] x) {
        if (x.length < 2) return Double.NaN;
        double m = mean(x), s = 0;
        for (double v : x) s += (v - m) * (v - m);
        return Math.sqrt(s / (x.length - 1));
    }

    /** Population-moment skewness g1 = m3 / m2^1.5. */
    public static double skewness(double[] x) {
        if (x.length < 3) return Double.NaN;
        double m = mean(x), m2 = 0, m3 = 0;
        for (double v : x) {
            double d = v - m;
            m2 += d * d;
            m3 += d * d * d;
        }
        m2 /= x.length;
        m3 /= x.length;
        if (m2 == 0) return Double.NaN;
        return m3 / Math.pow(m2, 1.5);
    }

    /** Population-moment excess kurtosis g2 = m4 / m2^2 - 3. */
    public static double excessKurtosis(double[] x) {
        if (x.length < 4) return Double.NaN;
        double m = mean(x), m2 = 0, m4 = 0;
        for (double v : x) {
            double d = v - m;
            m2 += d * d;
            m4 += d * d * d * d;
        }
        m2 /= x.length;
        m4 /= x.length;
        if (m2 == 0) return Double.NaN;
        return m4 / (m2 * m2) - 3.0;
    }

    /** Linear-interpolation percentile (numpy default), p in [0,100]. */
    public static double percentile(double[] x, double p) {
        if (x.length == 0) return Double.NaN;
        double[] s = x.clone();
        Arrays.sort(s);
        if (s.length == 1) return s[0];
        double rank = p / 100.0 * (s.length - 1);
        int lo = (int) Math.floor(rank);
        int hi = (int) Math.ceil(rank);
        if (lo == hi) return s[lo];
        return s[lo] + (rank - lo) * (s[hi] - s[lo]);
    }

    public static double min(double[] x) {
        double m = Double.NaN;
        for (double v : x) m = Double.isNaN(m) ? v : Math.min(m, v);
        return m;
    }

    public static double max(double[] x) {
        double m = Double.NaN;
        for (double v : x) m = Double.isNaN(m) ? v : Math.max(m, v);
        return m;
    }

    // ── bivariate ───────────────────────────────────────────────────────────

    public static double pearson(double[] x, double[] y) {
        int n = Math.min(x.length, y.length);
        if (n < 3) return Double.NaN;
        double mx = 0, my = 0;
        for (int i = 0; i < n; i++) {
            mx += x[i];
            my += y[i];
        }
        mx /= n;
        my /= n;
        double sxy = 0, sxx = 0, syy = 0;
        for (int i = 0; i < n; i++) {
            double dx = x[i] - mx, dy = y[i] - my;
            sxy += dx * dy;
            sxx += dx * dx;
            syy += dy * dy;
        }
        if (sxx == 0 || syy == 0) return Double.NaN;
        return sxy / Math.sqrt(sxx * syy);
    }

    /** Cohen's d with pooled SD; positive when group1 scores higher. */
    public static double cohenD(double[] g1, double[] g2) {
        if (g1.length < 2 || g2.length < 2) return Double.NaN;
        double m1 = mean(g1), m2 = mean(g2);
        double v1 = sd(g1), v2 = sd(g2);
        double pooled = Math.sqrt(((g1.length - 1) * v1 * v1 + (g2.length - 1) * v2 * v2)
                / (g1.length + g2.length - 2));
        if (pooled == 0 || Double.isNaN(pooled)) return Double.NaN;
        return (m1 - m2) / pooled;
    }

    // ── reliability ─────────────────────────────────────────────────────────

    /**
     * Cronbach's alpha over a complete-case matrix [student][item].
     */
    public static double cronbachAlpha(double[][] items) {
        if (items.length < 3 || items[0].length < 2) return Double.NaN;
        int k = items[0].length;
        double sumItemVar = 0;
        double[] totals = new double[items.length];
        for (int j = 0; j < k; j++) {
            double[] col = column(items, j);
            double v = sd(col);
            sumItemVar += v * v;
        }
        for (int i = 0; i < items.length; i++) {
            for (int j = 0; j < k; j++) totals[i] += items[i][j];
        }
        double totalVar = sd(totals);
        totalVar *= totalVar;
        if (totalVar == 0) return Double.NaN;
        return (k / (k - 1.0)) * (1.0 - sumItemVar / totalVar);
    }

    /** Alpha of the matrix with column {@code drop} removed. */
    public static double alphaIfDeleted(double[][] items, int drop) {
        int k = items[0].length;
        if (k < 3) return Double.NaN;
        double[][] rest = new double[items.length][k - 1];
        for (int i = 0; i < items.length; i++) {
            int c = 0;
            for (int j = 0; j < k; j++) {
                if (j != drop) rest[i][c++] = items[i][j];
            }
        }
        return cronbachAlpha(rest);
    }

    /** Correlation of item {@code j} with the total including itself. */
    public static double itemTotalCorrelation(double[][] items, int j) {
        double[] totals = new double[items.length];
        for (int i = 0; i < items.length; i++) {
            for (double v : items[i]) totals[i] += v;
        }
        return pearson(column(items, j), totals);
    }

    /** Corrected item-total correlation (item vs total of the other items). */
    public static double correctedItemTotal(double[][] items, int j) {
        double[] rest = new double[items.length];
        for (int i = 0; i < items.length; i++) {
            for (int c = 0; c < items[i].length; c++) {
                if (c != j) rest[i] += items[i][c];
            }
        }
        return pearson(column(items, j), rest);
    }

    // ── IRT approximations (as used by the original workbook) ───────────────

    public static double logitDifficulty(double p) {
        if (p <= 0 || p >= 1) return Double.NaN;
        return -Math.log(p / (1 - p));
    }

    /** a = 1.7 r / sqrt(1 - r^2) from the item-total point-biserial. */
    public static double discriminationFromR(double r) {
        if (Double.isNaN(r) || Math.abs(r) >= 1) return Double.NaN;
        return 1.7 * r / Math.sqrt(1 - r * r);
    }

    /** GRM threshold for category k: -logit(P(X >= k)). */
    public static double grmThreshold(double[] x, double category) {
        if (x.length == 0) return Double.NaN;
        int atOrAbove = 0;
        for (double v : x) {
            if (v >= category) atOrAbove++;
        }
        double p = (double) atOrAbove / x.length;
        return logitDifficulty(p);
    }

    // ── matrices, PCA, KMO ──────────────────────────────────────────────────

    public static double[] column(double[][] m, int j) {
        double[] out = new double[m.length];
        for (int i = 0; i < m.length; i++) out[i] = m[i][j];
        return out;
    }

    public static double[][] correlationMatrix(double[][] data) {
        int k = data[0].length;
        double[][] r = new double[k][k];
        for (int i = 0; i < k; i++) {
            r[i][i] = 1.0;
            for (int j = i + 1; j < k; j++) {
                double v = pearson(column(data, i), column(data, j));
                if (Double.isNaN(v)) v = 0;
                r[i][j] = v;
                r[j][i] = v;
            }
        }
        return r;
    }

    /**
     * Eigenvalues of a symmetric matrix via the cyclic Jacobi method,
     * descending. Plenty fast for the 54x54 worst case here.
     */
    public static double[] eigenvaluesDescending(double[][] sym) {
        int n = sym.length;
        double[][] a = new double[n][n];
        for (int i = 0; i < n; i++) a[i] = sym[i].clone();

        for (int sweep = 0; sweep < 100; sweep++) {
            double off = 0;
            for (int i = 0; i < n; i++) {
                for (int j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
            }
            if (off < 1e-18) break;
            for (int p = 0; p < n; p++) {
                for (int q = p + 1; q < n; q++) {
                    if (Math.abs(a[p][q]) < 1e-14) continue;
                    double theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
                    double t = Math.signum(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                    if (theta == 0) t = 1;
                    double c = 1 / Math.sqrt(t * t + 1);
                    double s = t * c;
                    for (int i = 0; i < n; i++) {
                        double aip = a[i][p], aiq = a[i][q];
                        a[i][p] = c * aip - s * aiq;
                        a[i][q] = s * aip + c * aiq;
                    }
                    for (int i = 0; i < n; i++) {
                        double api = a[p][i], aqi = a[q][i];
                        a[p][i] = c * api - s * aqi;
                        a[q][i] = s * api + c * aqi;
                    }
                }
            }
        }
        double[] eig = new double[n];
        for (int i = 0; i < n; i++) eig[i] = a[i][i];
        Arrays.sort(eig);
        // descending
        for (int i = 0; i < n / 2; i++) {
            double tmp = eig[i];
            eig[i] = eig[n - 1 - i];
            eig[n - 1 - i] = tmp;
        }
        return eig;
    }

    /** Gauss-Jordan inverse; returns null if singular. */
    public static double[][] inverse(double[][] m) {
        int n = m.length;
        double[][] a = new double[n][2 * n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(m[i], 0, a[i], 0, n);
            a[i][n + i] = 1;
        }
        for (int col = 0; col < n; col++) {
            int pivot = col;
            for (int r = col + 1; r < n; r++) {
                if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
            }
            if (Math.abs(a[pivot][col]) < 1e-12) return null;
            double[] tmp = a[col];
            a[col] = a[pivot];
            a[pivot] = tmp;
            double pv = a[col][col];
            for (int c = 0; c < 2 * n; c++) a[col][c] /= pv;
            for (int r = 0; r < n; r++) {
                if (r == col) continue;
                double f = a[r][col];
                if (f == 0) continue;
                for (int c = 0; c < 2 * n; c++) a[r][c] -= f * a[col][c];
            }
        }
        double[][] inv = new double[n][n];
        for (int i = 0; i < n; i++) System.arraycopy(a[i], n, inv[i], 0, n);
        return inv;
    }

    /**
     * Kaiser-Meyer-Olkin sampling adequacy from a complete-case data matrix.
     * Uses the anti-image partial correlations from the inverse correlation
     * matrix; falls back to NaN when the matrix is singular.
     */
    public static double kmo(double[][] data) {
        if (data.length <= data[0].length + 1) return Double.NaN;
        double[][] r = correlationMatrix(data);
        double[][] inv = inverse(r);
        if (inv == null) return Double.NaN;
        int k = r.length;
        double sumR2 = 0, sumQ2 = 0;
        for (int i = 0; i < k; i++) {
            for (int j = 0; j < k; j++) {
                if (i == j) continue;
                double q = -inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j]);
                sumR2 += r[i][j] * r[i][j];
                sumQ2 += q * q;
            }
        }
        if (sumR2 + sumQ2 == 0) return Double.NaN;
        return sumR2 / (sumR2 + sumQ2);
    }

    // ── convenience ─────────────────────────────────────────────────────────

    /** Values of {@code col} restricted to rows where it is non-null. */
    public static double[] validColumn(Integer[][] rows, int col) {
        List<Double> out = new ArrayList<>();
        for (Integer[] row : rows) {
            if (col < row.length && row[col] != null) out.add((double) row[col]);
        }
        double[] a = new double[out.size()];
        for (int i = 0; i < a.length; i++) a[i] = out.get(i);
        return a;
    }

    /** Complete-case matrix: rows that have no null in any column. */
    public static double[][] completeCases(Integer[][] rows, int expectedCols) {
        List<double[]> out = new ArrayList<>();
        for (Integer[] row : rows) {
            if (row.length < expectedCols) continue;
            boolean ok = true;
            double[] r = new double[expectedCols];
            for (int j = 0; j < expectedCols; j++) {
                if (row[j] == null) {
                    ok = false;
                    break;
                }
                r[j] = row[j];
            }
            if (ok) out.add(r);
        }
        return out.toArray(new double[0][]);
    }

    public static double round(double v, int places) {
        if (Double.isNaN(v) || Double.isInfinite(v)) return v;
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }
}
