import type { RecordModel } from "pocketbase";

export type FolderRecord = RecordModel & {
  name: string;
  parent: string;
  user: string;
};

export type BookRecord = RecordModel & {
  title: string;
  file: string;
  folder: string;
  user: string;
};

export type ReadingProgressRecord = RecordModel & {
  book: string;
  user: string;
  last_page: number;
};

export type PromptMode =
  | "explain"
  | "deconstruct"
  | "summarize"
  | "derivation"
  | "intuition"
  | "problem-solving";

export type HighlightColor = "cyan" | "violet" | "amber" | "emerald" | "rose";

export type PdfAnchor = {
  rects: Array<{
    height: number;
    left: number;
    top: number;
    width: number;
  }>;
  start: number;
  end: number;
};

export type HighlightRecord = RecordModel & {
  user: string;
  book: string;
  page: number;
  selected_text: string;
  anchor_json: string;
  color: HighlightColor;
  note: string;
};

export type BookmarkRecord = RecordModel & {
  user: string;
  book: string;
  page: number;
  label: string;
};

export type ResearchNoteKind =
  | "note"
  | "sticky"
  | "citation"
  | "formula";

export type NoteRecord = RecordModel & {
  user: string;
  book: string;
  page: number;
  kind: ResearchNoteKind;
  content: string;
  anchor_json: string;
};

export type AiAnalysisRecord = RecordModel & {
  user: string;
  book: string;
  page: number;
  mode: PromptMode;
  selected_text: string;
  response: string;
  provider: string;
};

export type DocumentPageRecord = RecordModel & {
  user: string;
  book: string;
  page: number;
  content: string;
};

export type ExplainResponse = {
  analysis: string;
  completed: boolean;
  continuationCount: number;
  evidenceTruncated: boolean;
  fallback: boolean;
  model: string;
  provider: string;
};

export type TutorStreamEvent =
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "reset";
      text: string;
    }
  | {
      type: "status";
      message: string;
      phase: "generating" | "retrying" | "continuing" | "fallback";
    }
  | ({
      type: "complete";
    } & ExplainResponse)
  | {
      type: "error";
      message: string;
      partial?: string;
    };
