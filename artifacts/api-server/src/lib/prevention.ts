/**
 * Bearing failure prevention techniques — mapped per fault class.
 *
 * PS 08 requires "risk alerts list with evidence" and recommended actions.
 * These are concrete, shop-floor-actionable prevention steps a technician can
 * act on immediately from a WhatsApp alert (lubrication, alignment, balancing,
 * replacement windows, contamination control — the standard bearing-care playbook).
 */
export const PREVENTION_TIPS: Record<string, string[]> = {
  Healthy: [
    'Continue routine greasing per OEM schedule (~every 90 days).',
    'Keep seals clean — dust & fly fibre ingress is the #1 killer of spindle bearings.',
    'Maintain the vibration baseline log so drift is caught early.',
    'Verify belt tension & coupling condition during scheduled rounds.',
  ],
  Imbalance: [
    'Run a dynamic balancing pass on the rotor / spindle assembly.',
    'Check for missing or loose balance weights and thread-wrapped debris on the shaft.',
    'Verify the wharve / pulley bore is concentric and properly seated.',
    'Re-balance after any rebuild, coupling change, or fan/rotor cleaning.',
  ],
  Misalignment: [
    'Laser-align the motor-to-spindle coupling (target < 0.05 mm).',
    'Check coupling wear & flexible element condition — replace if cracked.',
    'Verify bearing housing seat / foot flatness and re-torque foundation bolts.',
    'Inspect belt-driven sets for pulley misalignment before re-tensioning.',
  ],
  Ball: [
    'Regrease with the specified NLGI 2 lithium grease — correct amount, not more.',
    'Check for contamination (water, fibre, dust) in the grease; purge if present.',
    'Inspect ball tracks for pitting/spalling at the next maintenance window.',
    'Plan replacement at the next scheduled downtime while the machine still runs.',
  ],
  'Inner Race': [
    'Schedule immediate visual inspection of the inner race & shaft journal.',
    'Check for fretting / false brinelling from a loose shaft fit.',
    'Verify shaft journal roundness and correct interference fit before reinstall.',
    'Increase monitoring frequency to daily — inner-race faults propagate fast.',
  ],
  'Outer Race': [
    'Schedule bearing replacement within 18 hours — spalling is imminent.',
    'Inspect the housing bore for wear/ovality before fitting the new bearing.',
    'Order the correct clearance-class replacement (C3) and matching seals.',
    'After replacement, log a new vibration baseline and re-verify lubrication.',
  ],
};

/** Deterministic per-fault prevention steps; falls back to generic guidance. */
export function getPreventionTips(label: string): string[] {
  return PREVENTION_TIPS[label] ?? PREVENTION_TIPS.Healthy;
}
