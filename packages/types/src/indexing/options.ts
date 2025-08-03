export interface IndexRepoOptions {
  clearNamespace: boolean;
  embed?: boolean;
  force?: boolean;
}

export interface FileContentResponse {
  content: string;
  path: string;
  type: string;
}