/**
 * File Exporter
 *
 * Writes traces to files for local debugging
 */

import { writeFile, mkdir, appendFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { BaseExporter } from './base-exporter.js';
import type { TracingEvent } from '../core/types.js';

/**
 * File exporter options
 */
export interface FileExporterOptions {
  /** Output directory path */
  outputPath?: string;
  /** File format: json (single file) or ndjson (newline-delimited) */
  format?: "json" | "ndjson";
  /** Whether to write immediately or batch */
  batchSize?: number;
  /** Flush interval in milliseconds */
  flushIntervalMs?: number;
}

/**
 * File exporter
 */
export class FileExporter extends BaseExporter {
  name = "file";

  private outputPath: string;
  private format: "json" | "ndjson";
  private batchSize: number;
  private spans: any[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;
  private currentFile: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: FileExporterOptions = {}) {
    super();

    this.outputPath = options.outputPath || "./traces";
    this.format = options.format || "ndjson";
    this.batchSize = options.batchSize || 100;

    // Create timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.currentFile = join(
      this.outputPath,
      `traces-${timestamp}.${this.format === "json" ? "json" : "ndjson"}`
    );

    // Start flush timer
    if (options.flushIntervalMs && options.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, options.flushIntervalMs);
    }

    // Ensure directory exists
    this.ensureDirectory();
  }

  /**
   * Ensure output directory exists
   */
  private async ensureDirectory(): Promise<void> {
    if (!existsSync(this.outputPath)) {
      try {
        await mkdir(this.outputPath, { recursive: true });
      } catch (error) {
        this.setDisabled(`Failed to create directory: ${this.outputPath}`);
      }
    }
  }

  /**
   * Export tracing event
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    this.spans.push({
      ...event.exportedSpan,
      eventType: event.type,
      exportedAt: new Date().toISOString(),
    });

    // Flush if batch size reached
    if (this.spans.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush spans to file
   */
  async flush(): Promise<void> {
    if (this.isDisabled || this.spans.length === 0) return;

    const spansToWrite = [...this.spans];
    this.spans = [];

    // Queue writes to prevent concurrent file access
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.ensureDirectory();

        if (this.format === "ndjson") {
          // Append as newline-delimited JSON
          const lines = spansToWrite
            .map((s) => JSON.stringify(s))
            .join("\n");
          await appendFile(this.currentFile, lines + "\n", "utf-8");
        } else {
          // JSON format - read existing, merge, write
          let existing: any[] = [];
          if (existsSync(this.currentFile)) {
            try {
              const content = await import("fs/promises").then((fs) =>
                fs.readFile(this.currentFile, "utf-8")
              );
              existing = JSON.parse(content);
            } catch {
              // File might be empty or corrupted, start fresh
            }
          }

          const merged = [...existing, ...spansToWrite];
          await writeFile(
            this.currentFile,
            JSON.stringify(merged, null, 2),
            "utf-8"
          );
        }
      } catch (error) {
        this.logger.error(`FileExporter write error:`, error);
      }
    });

    await this.writeQueue;
  }

  /**
   * Shutdown - flush remaining spans and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    await this.flush();
    await super.shutdown();
  }
}
