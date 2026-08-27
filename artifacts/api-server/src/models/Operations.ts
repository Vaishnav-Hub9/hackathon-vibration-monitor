import mongoose, { Schema } from 'mongoose';

const timestamps = { timestamps: true };

const ProductionOrderSchema = new Schema({
  orderNo: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true, index: true },
  product: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitValue: { type: Number, required: true, min: 0 },
  dueDate: { type: Date, required: true, index: true },
  priority: { type: String, enum: ['standard', 'high', 'urgent'], default: 'standard', index: true },
  status: { type: String, enum: ['planned', 'in_progress', 'at_risk', 'complete'], default: 'planned', index: true },
  factoryUnit: { type: String, required: true, index: true },
}, timestamps);

const ProductionRunSchema = new Schema({
  runNo: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, required: true, index: true },
  machineId: { type: String, required: true, index: true },
  lineName: { type: String, required: true },
  plannedQuantity: { type: Number, required: true, min: 0 },
  producedQuantity: { type: Number, default: 0, min: 0 },
  goodQuantity: { type: Number, default: 0, min: 0 },
  scrapQuantity: { type: Number, default: 0, min: 0 },
  runtimeHours: { type: Number, default: 0, min: 0 },
  downtimeHours: { type: Number, default: 0, min: 0 },
  laborCost: { type: Number, default: 0, min: 0 },
  overtimeCost: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['planned', 'running', 'paused', 'complete', 'at_risk'], default: 'planned', index: true },
  factoryUnit: { type: String, required: true, index: true },
}, timestamps);

const MaterialSchema = new Schema({
  sku: { type: String, required: true, index: true },
  name: { type: String, required: true },
  lot: { type: String, default: '' },
  quantityOnHand: { type: Number, required: true, min: 0 },
  reservedQuantity: { type: Number, default: 0, min: 0 },
  requiredQuantity: { type: Number, default: 0, min: 0 },
  reorderPoint: { type: Number, default: 0, min: 0 },
  supplier: { type: String, required: true },
  leadTimeDays: { type: Number, default: 0, min: 0 },
  requiredBy: { type: Date, index: true },
  status: { type: String, enum: ['available', 'reserved', 'shortage', 'delayed'], default: 'available', index: true },
  factoryUnit: { type: String, required: true, index: true },
}, timestamps);

const QualityInspectionSchema = new Schema({
  inspectionNo: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, index: true },
  runId: { type: String, index: true },
  machineId: { type: String, index: true },
  factoryUnit: { type: String, required: true, index: true },
  result: { type: String, enum: ['pass', 'watch', 'fail'], required: true, index: true },
  inspectedQuantity: { type: Number, default: 0, min: 0 },
  defectRate: { type: Number, default: 0, min: 0 },
  defectCodes: { type: [String], default: [] },
  notes: { type: String, default: '' },
  holdStatus: { type: String, enum: ['released', 'on_hold', 'rework'], default: 'released', index: true },
  scrapCost: { type: Number, default: 0, min: 0 },
}, timestamps);

const WorkforceAssignmentSchema = new Schema({
  assignmentNo: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  assigneeName: { type: String, required: true },
  role: { type: String, required: true },
  shift: { type: String, required: true },
  skill: { type: String, required: true },
  workItemId: { type: String, index: true },
  availability: { type: String, enum: ['available', 'partial', 'unavailable'], default: 'available', index: true },
  status: { type: String, enum: ['planned', 'assigned', 'in_progress', 'complete'], default: 'planned', index: true },
  factoryUnit: { type: String, required: true, index: true },
}, timestamps);

const DemandPlanSchema = new Schema({
  planNo: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true },
  product: { type: String, required: true },
  forecastQuantity: { type: Number, required: true, min: 0 },
  horizon: { type: String, required: true },
  priority: { type: String, enum: ['standard', 'high', 'urgent'], default: 'standard' },
  scenario: { type: String, default: 'baseline' },
  confidence: { type: Number, default: 0.8, min: 0, max: 1 },
  factoryUnit: { type: String, required: true, index: true },
}, timestamps);

const IncidentSchema = new Schema({
  incidentNo: { type: String, required: true, unique: true, index: true },
  alertId: { type: String, index: true },
  category: { type: String, enum: ['machine_downtime', 'quality_deviation', 'material_delay', 'workforce_constraint', 'demand_change'], required: true, index: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  factoryUnit: { type: String, required: true, index: true },
  machineId: { type: String, index: true },
  orderId: { type: String, index: true },
  status: { type: String, enum: ['new', 'triaged', 'investigating', 'action_required', 'resolved', 'closed'], default: 'new', index: true },
  stage: { type: String, enum: ['detect', 'triage', 'investigate', 'correct', 'verify', 'closed'], default: 'detect', index: true },
  ownerUserId: { type: String, index: true },
  ownerName: { type: String, default: '' },
  ownerTeam: { type: String, default: '' },
  dueAt: { type: Date, index: true },
  responseSlaMinutes: { type: Number, default: 60, min: 1 },
  resolutionSlaMinutes: { type: Number, default: 1440, min: 1 },
  firstResponseAt: { type: Date },
  resolutionAt: { type: Date },
  rootCause: { type: String, default: '' },
  recoveryVerified: { type: Boolean, default: false },
  recoveryEvidence: { type: String, default: '' },
  escalationLevel: { type: Number, default: 0, min: 0 },
  impactScore: { type: Number, default: 0, min: 0, max: 100 },
  createdBy: { type: String, required: true },
}, timestamps);

const CorrectiveActionSchema = new Schema({
  incidentId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  ownerUserId: { type: String },
  ownerName: { type: String, default: '' },
  dueAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['open', 'in_progress', 'complete', 'verified'], default: 'open', index: true },
  completionNote: { type: String, default: '' },
  createdBy: { type: String, required: true },
}, timestamps);

const BusinessImpactSchema = new Schema({
  incidentId: { type: String, required: true, index: true },
  orderId: { type: String, index: true },
  factoryUnit: { type: String, required: true, index: true },
  productionValuePerUnit: { type: Number, required: true, min: 0 },
  unitsAtRisk: { type: Number, required: true, min: 0 },
  orderUrgency: { type: Number, required: true, min: 1, max: 5 },
  deliveryHoursRemaining: { type: Number, required: true, min: 0 },
  materialAvailability: { type: Number, required: true, min: 0, max: 1 },
  qualityLossRate: { type: Number, required: true, min: 0, max: 1 },
  laborCost: { type: Number, required: true, min: 0 },
  scrapCost: { type: Number, required: true, min: 0 },
  downtimeHours: { type: Number, required: true, min: 0 },
  productionValueAtRisk: { type: Number, required: true, min: 0 },
  estimatedLoss: { type: Number, required: true, min: 0 },
  deliveryRisk: { type: Number, required: true, min: 0, max: 100 },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  calculationVersion: { type: String, default: 'v1-live-inputs' },
  calculatedAt: { type: Date, default: Date.now, index: true },
}, timestamps);

const CommentSchema = new Schema({
  entityType: { type: String, enum: ['incident', 'corrective_action', 'order', 'quality'], required: true, index: true },
  entityId: { type: String, required: true, index: true },
  factoryUnit: { type: String, required: true, index: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  body: { type: String, required: true, maxlength: 4000 },
  visibility: { type: String, enum: ['internal', 'customer'], default: 'internal' },
}, timestamps);

const EvidenceSchema = new Schema({
  entityType: { type: String, enum: ['incident', 'corrective_action', 'quality'], required: true, index: true },
  entityId: { type: String, required: true, index: true },
  factoryUnit: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, default: 0, min: 0 },
  storageRef: { type: String, required: true },
  checksum: { type: String, default: '' },
  capturedBy: { type: String, required: true },
  notes: { type: String, default: '' },
}, timestamps);

const EscalationSchema = new Schema({
  incidentId: { type: String, required: true, index: true },
  factoryUnit: { type: String, required: true, index: true },
  fromRole: { type: String, required: true },
  toRole: { type: String, required: true },
  toUserId: { type: String },
  reason: { type: String, required: true },
  level: { type: Number, required: true, min: 1 },
  triggeredAt: { type: Date, default: Date.now, index: true },
  acknowledgedAt: { type: Date },
}, timestamps);

export const ProductionOrder = mongoose.models.ProductionOrder || mongoose.model('ProductionOrder', ProductionOrderSchema);
export const ProductionRun = mongoose.models.ProductionRun || mongoose.model('ProductionRun', ProductionRunSchema);
export const Material = mongoose.models.Material || mongoose.model('Material', MaterialSchema);
export const QualityInspection = mongoose.models.QualityInspection || mongoose.model('QualityInspection', QualityInspectionSchema);
export const WorkforceAssignment = mongoose.models.WorkforceAssignment || mongoose.model('WorkforceAssignment', WorkforceAssignmentSchema);
export const DemandPlan = mongoose.models.DemandPlan || mongoose.model('DemandPlan', DemandPlanSchema);
export const Incident = mongoose.models.Incident || mongoose.model('Incident', IncidentSchema);
export const CorrectiveAction = mongoose.models.CorrectiveAction || mongoose.model('CorrectiveAction', CorrectiveActionSchema);
export const BusinessImpact = mongoose.models.BusinessImpact || mongoose.model('BusinessImpact', BusinessImpactSchema);
export const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);
export const Evidence = mongoose.models.Evidence || mongoose.model('Evidence', EvidenceSchema);
export const Escalation = mongoose.models.Escalation || mongoose.model('Escalation', EscalationSchema);
