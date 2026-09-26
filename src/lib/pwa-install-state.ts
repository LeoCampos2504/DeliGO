export type PwaInstallState =
  | "idle"
  | "available"
  | "prompting"
  | "installing-background"
  | "browser-install-event-received"
  | "installed-confirmed"

export type PwaInstallEvent =
  | "prompt-available"
  | "prompt-started"
  | "prompt-accepted"
  | "prompt-dismissed"
  | "prompt-failed"
  | "app-installed"
  | "standalone-detected"

export function transitionPwaInstallState(
  state: PwaInstallState,
  event: PwaInstallEvent
): PwaInstallState {
  // Once confirmed, no delayed prompt result may downgrade the authority.
  if (state === "installed-confirmed") return state

  switch (event) {
    case "app-installed":
      return "browser-install-event-received"
    case "standalone-detected":
      return "installed-confirmed"
    case "prompt-available":
      return "available"
    case "prompt-started":
      return state === "available" ? "prompting" : state
    case "prompt-accepted":
      return state === "prompting" ? "installing-background" : state
    case "prompt-dismissed":
    case "prompt-failed":
      return state === "prompting" || state === "available" ? "idle" : state
  }
}
