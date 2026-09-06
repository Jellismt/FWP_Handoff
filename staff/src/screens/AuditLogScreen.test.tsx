/**
 * @file AuditLogScreen.test.tsx
 * @module engage-mt/staff
 * @description Audit log screen: rows and diffs render, filters refetch with
 *              the right parameters, Load more appends via the cursor, and the
 *              CSV export shows only for approvers and admins.
 * @author Jamie Ellis / Engage MT
 * @created 2026-09-06
 * @updated 2026-09-06
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ auditLog: vi.fn(), auditLogCsvUrl: vi.fn() }));
vi.mock("../api.js", () => ({ api: { auditLog: h.auditLog, auditLogCsvUrl: h.auditLogCsvUrl } }));

import { AuditLogScreen } from "./AuditLogScreen.js";
import { useApp } from "../store.js";

const row = (audit_id: string, extra: Partial<Record<string, unknown>> = {}) => ({
  audit_id,
  table_name: "opportunity",
  row_pk: "1",
  action_code: "UPDATE",
  changed_by: "editor@fwp.mt.gov",
  changed_at: "2026-09-01T10:00:00Z",
  old_row_json: JSON.stringify({ quota: 10 }),
  new_row_json: JSON.stringify({ quota: 12 }),
  ...extra,
});
const me = (role: "viewer" | "editor" | "approver" | "admin") => ({ email: "x@fwp.mt.gov", displayName: "X", role, mustReset: false });

beforeEach(() => {
  h.auditLog.mockReset().mockResolvedValue({ rows: [row("2"), row("1")], nextCursor: null });
  h.auditLogCsvUrl.mockReset().mockImplementation((o) => `/api/v1/staff/audit-log.csv?${new URLSearchParams(o as Record<string, string>)}`);
  useApp.setState({ me: me("viewer"), seasonYear: 2026, seasonYears: [] });
});

describe("AuditLogScreen", () => {
  it("renders rows with a field-level diff", async () => {
    render(<AuditLogScreen />);
    expect(await screen.findAllByText("editor@fwp.mt.gov")).toHaveLength(2);
    expect(screen.getAllByText("1 field")).toHaveLength(2);
    expect(screen.getByText("Showing 2")).toBeInTheDocument();
    expect(screen.queryByText("Export CSV")).not.toBeInTheDocument();
  });

  it("refetches with table, user, and date-window filters", async () => {
    render(<AuditLogScreen />);
    await screen.findAllByText("editor@fwp.mt.gov");
    fireEvent.change(screen.getByLabelText("Table"), { target: { value: "hunt_area" } });
    fireEvent.change(screen.getByLabelText("User"), { target: { value: "Editor@fwp.mt.gov" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-03" } });
    await waitFor(() =>
      expect(h.auditLog).toHaveBeenLastCalledWith({
        table: "hunt_area",
        user: "Editor@fwp.mt.gov",
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-04T00:00:00.000Z",
        before: undefined,
        limit: 100,
      }),
    );
  });

  it("loads the next page with the cursor and appends it", async () => {
    h.auditLog
      .mockResolvedValueOnce({ rows: [row("9")], nextCursor: "9" })
      .mockResolvedValueOnce({ rows: [row("8")], nextCursor: null });
    render(<AuditLogScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("Showing 2")).toBeInTheDocument());
    expect(h.auditLog).toHaveBeenLastCalledWith(expect.objectContaining({ before: "9" }));
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("offers the CSV export to approvers with the active filters", async () => {
    useApp.setState({ me: me("approver") });
    render(<AuditLogScreen />);
    await screen.findAllByText("editor@fwp.mt.gov");
    fireEvent.change(screen.getByLabelText("Table"), { target: { value: "season_year" } });
    const link = await screen.findByRole("link", { name: "Export CSV" });
    expect(link).toHaveAttribute("href", expect.stringContaining("table=season_year"));
  });

  it("shows the API error", async () => {
    h.auditLog.mockRejectedValue(new Error("boom"));
    render(<AuditLogScreen />);
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });
});
