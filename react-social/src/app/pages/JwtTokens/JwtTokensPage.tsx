import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import BlockIcon from "@mui/icons-material/Block";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  JwtTokenAudit,
  JwtTokenStats,
  JwtTokenStatus,
  JwtTokenType,
  getJwtTokenStats,
  listJwtTokens,
  revokeJwtToken,
} from "./API/JwtTokens_APIs";

const TOKEN_TYPES: JwtTokenType[] = ["ACCESS", "REFRESH", "ASSESSMENT", "LEGACY"];
const STATUSES: { value: JwtTokenStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "live", label: "Live" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
];

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const computeStatus = (row: JwtTokenAudit): "Live" | "Revoked" | "Expired" => {
  if (row.revokedAt) return "Revoked";
  if (new Date(row.expiresAt).getTime() <= Date.now()) return "Expired";
  return "Live";
};

const statusColor = (s: string): "success" | "error" | "default" => {
  if (s === "Live") return "success";
  if (s === "Revoked") return "error";
  return "default";
};

const truncate = (s: string | null, n: number): string => {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

export default function JwtTokensPage() {
  const [rows, setRows] = useState<JwtTokenAudit[]>([]);
  const [stats, setStats] = useState<JwtTokenStats | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailFilter, setEmailFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [tokenTypeFilter, setTokenTypeFilter] = useState<JwtTokenType | "">("");
  const [statusFilter, setStatusFilter] = useState<JwtTokenStatus>("");

  const [detail, setDetail] = useState<JwtTokenAudit | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<JwtTokenAudit | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userIdNum = userIdFilter ? Number(userIdFilter) : undefined;
      const [listRes, statsRes] = await Promise.all([
        listJwtTokens({
          page,
          size,
          email: emailFilter || undefined,
          userId: Number.isFinite(userIdNum) ? userIdNum : undefined,
          tokenType: tokenTypeFilter || undefined,
          status: statusFilter || undefined,
        }),
        getJwtTokenStats(),
      ]);
      setRows(listRes.data.content);
      setTotal(listRes.data.totalElements);
      setStats(statsRes.data);
    } catch (e: any) {
      setError(
        e?.response?.status === 403
          ? "Access denied — this console requires super-admin."
          : e?.response?.data?.message || e?.message || "Failed to load tokens"
      );
    } finally {
      setLoading(false);
    }
  }, [page, size, emailFilter, userIdFilter, tokenTypeFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total Tokens", value: stats.total, color: "#1976d2" },
      { label: "Live", value: stats.live, color: "#2e7d32" },
      { label: "Revoked", value: stats.revoked, color: "#c62828" },
      { label: "Expired", value: stats.expired, color: "#757575" },
    ];
  }, [stats]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeJwtToken(revokeTarget.jti, revokeReason || "Force-revoked by admin");
      setRevokeTarget(null);
      setRevokeReason("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Revoke failed");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            JWT Token Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Super-admin audit of every JWT issued — who, when, from where, and current status.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((c) => (
          <Grid item xs={6} md={3} key={c.label}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {c.label}
                </Typography>
                <Typography variant="h4" sx={{ color: c.color, fontWeight: 600 }}>
                  {c.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {stats && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
          {TOKEN_TYPES.map((t) => (
            <Chip key={t} label={`${t}: ${stats.byType[t] ?? 0}`} size="small" />
          ))}
        </Stack>
      )}

      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Email contains"
              size="small"
              fullWidth
              value={emailFilter}
              onChange={(e) => {
                setPage(0);
                setEmailFilter(e.target.value);
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              label="User ID"
              size="small"
              fullWidth
              type="number"
              value={userIdFilter}
              onChange={(e) => {
                setPage(0);
                setUserIdFilter(e.target.value);
              }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              label="Token type"
              size="small"
              fullWidth
              select
              value={tokenTypeFilter}
              onChange={(e) => {
                setPage(0);
                setTokenTypeFilter(e.target.value as JwtTokenType | "");
              }}
            >
              <MenuItem value="">All types</MenuItem>
              {TOKEN_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Status"
              size="small"
              fullWidth
              select
              value={statusFilter}
              onChange={(e) => {
                setPage(0);
                setStatusFilter(e.target.value as JwtTokenStatus);
              }}
            >
              {STATUSES.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: "#fdecea", borderColor: "#f5c6c6" }} variant="outlined">
          <Typography color="error">{error}</Typography>
        </Paper>
      )}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Issued At</TableCell>
                <TableCell>Expires At</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>User-Agent</TableCell>
                <TableCell>JTI</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No tokens match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                rows.map((row) => {
                  const s = computeStatus(row);
                  return (
                    <TableRow key={row.jti} hover>
                      <TableCell>
                        <Chip label={s} size="small" color={statusColor(s)} />
                      </TableCell>
                      <TableCell>
                        <Chip label={row.tokenType} size="small" variant="outlined" />
                        {row.superAdmin && (
                          <Chip
                            label="SA"
                            size="small"
                            color="warning"
                            sx={{ ml: 0.5 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {row.userEmail || `#${row.userId}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            id: {row.userId}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(row.issuedAt)}</TableCell>
                      <TableCell>{formatDate(row.expiresAt)}</TableCell>
                      <TableCell>{row.ipAddress || "—"}</TableCell>
                      <TableCell>
                        <Tooltip title={row.userAgent || ""}>
                          <span>{truncate(row.userAgent, 28)}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={row.jti}>
                          <span style={{ fontFamily: "monospace" }}>
                            {row.jti.slice(0, 8)}…
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Details">
                          <IconButton size="small" onClick={() => setDetail(row)}>
                            <InfoOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={s === "Live" ? "Revoke token" : "Already revoked / expired"}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={s !== "Live"}
                              onClick={() => {
                                setRevokeTarget(row);
                                setRevokeReason("");
                              }}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size}
          onRowsPerPageChange={(e) => {
            setSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100, 200]}
        />
      </Paper>

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>Token Details</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Grid container spacing={1.5}>
              {(
                [
                  ["JTI (JWT ID)", detail.jti],
                  ["Token Type", detail.tokenType],
                  ["Subject (user_id)", String(detail.userId)],
                  ["User Email", detail.userEmail || "—"],
                  ["Issuer", detail.issuer || "—"],
                  ["Issued At", formatDate(detail.issuedAt)],
                  ["Not Before", formatDate(detail.notBefore)],
                  ["Expires At", formatDate(detail.expiresAt)],
                  ["IP Address", detail.ipAddress || "—"],
                  ["User-Agent", detail.userAgent || "—"],
                  ["Roles at issuance", detail.rolesSnapshot || "—"],
                  ["Super Admin", detail.superAdmin ? "Yes" : "No"],
                  ["Revoked At", formatDate(detail.revokedAt)],
                  ["Revoked By", detail.revokedBy ? `#${detail.revokedBy}` : "—"],
                  ["Revocation Reason", detail.revocationReason || "—"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <Grid item xs={12} sm={6} key={k}>
                  <Typography variant="caption" color="text.secondary">
                    {k}
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    {v}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Revoke Token</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will add the JWT to the deny list and mark the audit row as revoked.
            The holder will be force-logged-out on their next request.
          </Typography>
          {revokeTarget && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">JTI</Typography>
              <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: "break-all" }}>
                {revokeTarget.jti}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                User
              </Typography>
              <Typography variant="body2">
                {revokeTarget.userEmail || `#${revokeTarget.userId}`}
              </Typography>
            </Box>
          )}
          <TextField
            label="Reason"
            fullWidth
            multiline
            minRows={2}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="e.g. Suspected credential compromise"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRevoke} disabled={revoking}>
            {revoking ? "Revoking…" : "Revoke"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
