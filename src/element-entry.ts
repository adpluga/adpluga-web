import {
  AdPlugaSlotElement,
  defineAdPlugaElement,
  destroy,
  getClient,
  initialize,
  whenReady,
} from "./element";
import { setLoggerEnabled, setLoggerSink } from "./logger";
import { SDK_VERSION } from "./constants";

defineAdPlugaElement();

export const version = SDK_VERSION;
export { AdPlugaSlotElement, defineAdPlugaElement, destroy, getClient, initialize, whenReady };
export { setLoggerEnabled, setLoggerSink };
export { AdPlugaClient } from "./client";
export { UpgradeRequiredError } from "./transport";
export type * from "./types";

if (typeof window !== "undefined") {
  const target = window as unknown as Record<string, unknown>;
  const existing = target.AdPluga as Record<string, unknown> | undefined;
  target.AdPluga = {
    ...(existing ?? {}),
    version: SDK_VERSION,
    initialize,
    destroy,
    getClient,
    whenReady,
    defineElement: defineAdPlugaElement,
    setLoggerEnabled,
    setLoggerSink,
  };
}
