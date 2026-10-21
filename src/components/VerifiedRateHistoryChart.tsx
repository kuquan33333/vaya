"use client";

import type { CatalogRateSnapshot } from "@/lib/catalog/types";

function snapshotValue(snapshot: CatalogRateSnapshot): number | null {
  return snapshot.basis === "monthly-flat"
    ? snapshot.monthlyRatePercent
    : snapshot.annualRatePercent;
}

function basisLabel(basis: CatalogRateSnapshot["basis"]): string {
  if (basis === "monthly-flat") return "%/tháng · dư nợ gốc";
  if (basis === "annual-nominal-original-principal") return "%/năm · dư nợ gốc";
  if (basis === "annual-nominal-reducing-balance") return "%/năm · dư nợ giảm dần";
  return basis;
}

export default function VerifiedRateHistoryChart({ snapshots }: { snapshots: CatalogRateSnapshot[] }) {
  const latestBasis = snapshots[snapshots.length - 1]?.basis;
  const points = snapshots
    .filter((snapshot) => snapshot.basis === latestBasis && snapshotValue(snapshot) != null)
    .map((snapshot) => ({ snapshot, value: snapshotValue(snapshot) as number }));

  if (!latestBasis || points.length < 2) {
    return <div className="verified-history-empty">Chưa có đủ hai snapshot cùng cơ sở lãi suất để vẽ lịch sử.</div>;
  }

  const width = 720;
  const height = 220;
  const left = 46;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.2 || 0.4;
  const low = min - pad;
  const high = max + pad;
  const x = (index: number) => left + (index * (width - left - right)) / (points.length - 1);
  const y = (value: number) => top + (1 - (value - low) / (high - low)) * (height - top - bottom);
  const line = points.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");

  return (
    <div className="verified-rate-history">
      <div className="csub">{basisLabel(latestBasis)} · {points.length} snapshot đã xác minh</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Lịch sử lãi suất đã xác minh">
        {[0, 1, 2, 3].map((step) => {
          const value = high - ((high - low) * step) / 3;
          const yy = y(value);
          return (
            <g key={step}>
              <line x1={left} y1={yy} x2={width - right} y2={yy} stroke="#EDF1F4" />
              <text x={left - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#95A29F">{value.toFixed(2)}%</text>
            </g>
          );
        })}
        <polyline points={line} fill="none" stroke="#0A8F55" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={point.snapshot.snapshotId}>
            <circle cx={x(index)} cy={y(point.value)} r="4" fill="#00C776" stroke="#fff" strokeWidth="2" />
            <text x={x(index)} y={height - 14} textAnchor="middle" fontSize="10" fill="#95A29F">
              {new Date(point.snapshot.observedAt).toLocaleDateString("vi-VN")}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
