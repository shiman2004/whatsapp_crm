import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Clock, Filter, HelpCircle, RefreshCw, ShieldAlert, UserCheck, XCircle,
} from 'lucide-react';
import { securityApi, SecurityApiError } from './api';
import { Badge, ConfirmDialog, ErrorState, Pagination, SkeletonBlock, Spinner, cx } from './bits';
import type { AccessRequestItem, AccessRequestPage } from './types';

export const AccessRequestsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<AccessRequestPage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    request: AccessRequestItem;
    decision: 'approve' | 'reject';
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await securityApi.accessRequests({ status: statusFilter, page });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load access requests.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleReview = async () => {
    if (!confirmAction) return;
    const { request, decision } = confirmAction;
    setProcessingId(request.id);
    try {
      await securityApi.reviewAccessRequest(request.id, decision, reviewNotes);
      setConfirmAction(null);
      setReviewNotes('');
      await loadRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process access request.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize motion-safe:transition-colors',
                statusFilter === s
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
            >
              {s === 'pending' ? 'Pending Approval' : s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={loadRequests} />}

      {/* Requests Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Request Type</th>
                <th className="px-4 py-3">Details / Target</th>
                <th className="px-4 py-3">Justification</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && !data && (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Spinner label="Loading access requests..." />
                  </td>
                </tr>
              )}

              {!loading && (!data?.items || data.items.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <CheckCircle2 className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">No requests found</p>
                    <p className="mt-1 text-xs text-slate-500">There are no access requests matching the current filter.</p>
                  </td>
                </tr>
              )}

              {data?.items.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {req.requester?.fullName || 'Unknown User'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {req.requester?.email}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>{req.requester?.company}</span>
                      <span>•</span>
                      <span>{req.requester?.role}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium">
                    {req.requestType === 'cross_company_access' && (
                      <Badge tone="teal">Cross-Company Access</Badge>
                    )}
                    {req.requestType === 'role_assignment' && (
                      <Badge tone="indigo">Role Elevation</Badge>
                    )}
                    {req.requestType === 'permission_override' && (
                      <Badge tone="amber">Permission Override</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {req.targetCompany && (
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        Company: {req.targetCompany}
                      </div>
                    )}
                    {req.requestedRoleKey && (
                      <div className="text-xs text-indigo-600 dark:text-indigo-400">
                        Role: {req.requestedRoleKey}
                      </div>
                    )}
                    {req.requestedPermissionKey && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        Capability: {req.requestedPermissionKey}
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3.5">
                    <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300" title={req.reason}>
                      {req.reason}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                    {req.durationHours ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {req.durationHours} hours
                      </span>
                    ) : (
                      <span className="text-slate-400">Indefinite</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {req.status === 'pending' && <Badge tone="amber">Pending Review</Badge>}
                    {req.status === 'approved' && <Badge tone="emerald">Approved</Badge>}
                    {req.status === 'rejected' && <Badge tone="rose">Rejected</Badge>}
                    {req.status === 'expired' && <Badge tone="slate">Expired</Badge>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {req.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={processingId === req.id}
                          onClick={() => setConfirmAction({ request: req, decision: 'approve' })}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={processingId === req.id}
                          onClick={() => setConfirmAction({ request: req, decision: 'reject' })}
                          className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <Pagination
              page={page}
              pages={data.pagination.totalPages}
              total={data.pagination.total}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmDialog
          open={Boolean(confirmAction)}
          title={confirmAction.decision === 'approve' ? 'Approve Access Request' : 'Reject Access Request'}
          description={`Are you sure you want to ${confirmAction.decision} this access request for ${confirmAction.request.requester?.fullName}?`}
          confirmLabel={confirmAction.decision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
          tone={confirmAction.decision === 'approve' ? 'primary' : 'danger'}
          busy={Boolean(processingId)}
          onConfirm={handleReview}
          onCancel={() => {
            setConfirmAction(null);
            setReviewNotes('');
          }}
        >
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Review Notes (optional):
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Provide reason or approval conditions..."
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};
