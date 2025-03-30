export interface Edit {
  path: string;
  original: string;
  updated: string;
}

export interface FailedEdit {
  edit: Edit;
  error: string;
}

export type EditResult = {
  passed?: Edit;
  failed?: FailedEdit;
};

export type EditResults = {
  passed?: Edit[];
  failed?: FailedEdit[];
};
