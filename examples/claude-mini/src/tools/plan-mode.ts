// Plan mode global state (s03)

let planMode = false;

export function enterPlanMode(): void { planMode = true; }
export function exitPlanMode(): void { planMode = false; }
export function isPlanMode(): boolean { return planMode; }
export function resetPlanMode(): void { planMode = false; }
