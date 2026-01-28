import { readFileSync } from "fs";
import { join } from "path";

interface StatsRow {
  timestamp: number;
  container: string;
  cpu: number;
  memUsage: number;
  memLimit: number;
  memPct: number;
  netIn: number;
  netOut: number;
  blockIn: number;
  blockOut: number;
}

interface ContainerStats {
  name: string;
  samples: number;
  duration: number;
  cpu: { min: number; max: number; avg: number };
  memory: { min: number; max: number; avg: number; unit: string };
  memPct: { min: number; max: number; avg: number };
  netIn: { total: number; unit: string };
  netOut: { total: number; unit: string };
}

function parseSize(value: string): number {
  const match = value.match(/^([\d.]+)([a-zA-Z]+)?/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 * 1024,
    MIB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    GIB: 1024 * 1024 * 1024,
  };

  return num * (multipliers[unit] || 1);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KiB`;
  }
  return `${bytes} B`;
}

function parseCsv(content: string): StatsRow[] {
  const lines = content.trim().split("\n");
  const rows: StatsRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const parts = line.split(",");
    if (parts.length < 7) continue;

    const memParts = parts[3].split(" / ");
    const netParts = parts[5].split(" / ");
    const blockParts = parts[6].split(" / ");

    rows.push({
      timestamp: parseInt(parts[0]),
      container: parts[1],
      cpu: parseFloat(parts[2].replace("%", "")),
      memUsage: parseSize(memParts[0]),
      memLimit: parseSize(memParts[1] || "0"),
      memPct: parseFloat(parts[4].replace("%", "")),
      netIn: parseSize(netParts[0]),
      netOut: parseSize(netParts[1] || "0"),
      blockIn: parseSize(blockParts[0]),
      blockOut: parseSize(blockParts[1] || "0"),
    });
  }

  return rows;
}

function analyzeContainer(rows: StatsRow[]): ContainerStats | null {
  if (rows.length === 0) return null;

  const cpuValues = rows.map((r) => r.cpu);
  const memValues = rows.map((r) => r.memUsage);
  const memPctValues = rows.map((r) => r.memPct);

  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];

  return {
    name: rows[0].container,
    samples: rows.length,
    duration: lastRow.timestamp - firstRow.timestamp,
    cpu: {
      min: Math.min(...cpuValues),
      max: Math.max(...cpuValues),
      avg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
    },
    memory: {
      min: Math.min(...memValues),
      max: Math.max(...memValues),
      avg: memValues.reduce((a, b) => a + b, 0) / memValues.length,
      unit: "bytes",
    },
    memPct: {
      min: Math.min(...memPctValues),
      max: Math.max(...memPctValues),
      avg: memPctValues.reduce((a, b) => a + b, 0) / memPctValues.length,
    },
    netIn: { total: lastRow.netIn, unit: "bytes" },
    netOut: { total: lastRow.netOut, unit: "bytes" },
  };
}

function printStats(stats: ContainerStats) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${stats.name}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  Samples: ${stats.samples} | Duration: ${stats.duration}s`);
  console.log();
  console.log("  CPU Usage:");
  console.log(`    Min: ${stats.cpu.min.toFixed(2)}%`);
  console.log(`    Max: ${stats.cpu.max.toFixed(2)}%`);
  console.log(`    Avg: ${stats.cpu.avg.toFixed(2)}%`);
  console.log();
  console.log("  Memory Usage:");
  console.log(`    Min: ${formatSize(stats.memory.min)}`);
  console.log(`    Max: ${formatSize(stats.memory.max)}`);
  console.log(`    Avg: ${formatSize(stats.memory.avg)}`);
  console.log(`    Peak %: ${stats.memPct.max.toFixed(2)}%`);
  console.log();
  console.log("  Network I/O:");
  console.log(`    In:  ${formatSize(stats.netIn.total)}`);
  console.log(`    Out: ${formatSize(stats.netOut.total)}`);
}

function printComparison(swiftStats: ContainerStats, goStats: ContainerStats) {
  console.log(`\n${"═".repeat(60)}`);
  console.log("  COMPARISON");
  console.log(`${"═".repeat(60)}`);
  console.log();
  console.log(
    "  | Metric          | Swift            | Go               | Winner |"
  );
  console.log(
    "  |-----------------|------------------|------------------|--------|"
  );

  const cpuWinner = swiftStats.cpu.avg < goStats.cpu.avg ? "Swift" : "Go";
  console.log(
    `  | CPU (avg)       | ${swiftStats.cpu.avg.toFixed(1).padStart(14)}% | ${goStats.cpu.avg.toFixed(1).padStart(14)}% | ${cpuWinner.padStart(6)} |`
  );

  const memWinner = swiftStats.memory.max < goStats.memory.max ? "Swift" : "Go";
  console.log(
    `  | Memory (max)    | ${formatSize(swiftStats.memory.max).padStart(15)} | ${formatSize(goStats.memory.max).padStart(15)} | ${memWinner.padStart(6)} |`
  );

  const netInWinner = swiftStats.netIn.total > goStats.netIn.total ? "Swift" : "Go";
  console.log(
    `  | Network In      | ${formatSize(swiftStats.netIn.total).padStart(15)} | ${formatSize(goStats.netIn.total).padStart(15)} | ${netInWinner.padStart(6)} |`
  );

  const netOutWinner = swiftStats.netOut.total > goStats.netOut.total ? "Swift" : "Go";
  console.log(
    `  | Network Out     | ${formatSize(swiftStats.netOut.total).padStart(15)} | ${formatSize(goStats.netOut.total).padStart(15)} | ${netOutWinner.padStart(6)} |`
  );
}

function main() {
  const statsFile = process.argv[2] || join(import.meta.dir, "stats.csv");

  let content: string;
  try {
    content = readFileSync(statsFile, "utf-8");
  } catch {
    console.error(`Error: Could not read file: ${statsFile}`);
    process.exit(1);
  }

  const rows = parseCsv(content);
  if (rows.length === 0) {
    console.error("Error: No data found in CSV");
    process.exit(1);
  }

  const containers = new Map<string, StatsRow[]>();
  for (const row of rows) {
    const existing = containers.get(row.container) || [];
    existing.push(row);
    containers.set(row.container, existing);
  }

  console.log("\n  DOCKER STATS ANALYSIS");
  console.log(`  File: ${statsFile}`);
  console.log(`  Total samples: ${rows.length}`);

  const allStats: ContainerStats[] = [];

  for (const [, containerRows] of containers) {
    const stats = analyzeContainer(containerRows);
    if (stats) {
      allStats.push(stats);
      printStats(stats);
    }
  }

  const swiftStats = allStats.find((s) => s.name.includes("swift"));
  const goStats = allStats.find((s) => s.name.includes("go"));

  if (swiftStats && goStats) {
    printComparison(swiftStats, goStats);
  }

  console.log();
}

main();
