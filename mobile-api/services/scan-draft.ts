export interface ScanDraft {
  name?: string;
  dose?: string;
  instruction?: string;
  frequency?: number;
  period?: string;
}
let draft: ScanDraft | null = null;
export const setScanDraft = (value: ScanDraft) => {
  draft = value;
};
export const getScanDraft = () => draft;
export const clearScanDraft = () => {
  draft = null;
};
