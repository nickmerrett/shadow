export const GIT_SELECTOR_COOKIE_NAME = "git-selector-state";
export const MODEL_SELECTOR_COOKIE_NAME = "model-selector-state";

export enum StreamingStatus {
  IDLE = "idle",
  PENDING = "pending",
  STREAMING = "streaming"
}

export type StreamingStatusSetter = (status: StreamingStatus) => void;