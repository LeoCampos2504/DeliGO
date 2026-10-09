/**
 * F10-B2.2-B: opening a shift has no matching close/recovery flow yet.
 * Keep the UI and endpoint unavailable unless this is explicitly enabled in
 * TESTING and the employee is on the controlled-account allowlist.
 */
export function isControlledShiftUiEnabled(
  employeeId: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  const environment = env.DELIGO_ENVIRONMENT ?? env.RAILWAY_ENVIRONMENT_NAME ?? env.APP_ENV
  if (environment?.trim().toUpperCase() !== "TESTING") return false
  if (env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED !== "true") return false

  const allowlist = (env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "")
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
  return allowlist.includes(employeeId)
}
