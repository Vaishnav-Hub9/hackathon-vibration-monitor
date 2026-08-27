import { Router, type Response } from 'express';
import { authenticateJWT, factoryScope, requireRoles, type AuthRequest } from '../middleware/auth.js';
import { getIo } from '../socket.js';
import {
  BusinessImpact,
  Comment,
  CorrectiveAction,
  DemandPlan,
  Escalation,
  Evidence,
  Incident,
  Material,
  ProductionOrder,
  ProductionRun,
  QualityInspection,
  WorkforceAssignment,
} from '../models/Operations.js';

const router = Router();
router.use(authenticateJWT);

const ACTIVE_STATUSES = { $nin: ['resolved', 'closed'] };

function scopeFor(req: AuthRequest, factoryUnit?: string): Record<string, any> | null {
  return factoryScope(req.user, factoryUnit);
}

function emitOperation(event: string, data: unknown) {
  getIo()?.to('fleet').emit(event, data);
}

function impactFromInputs(inputs: {
  productionValuePerUnit: number;
  unitsAtRisk: number;
  orderUrgency: number;
  deliveryHoursRemaining: number;
  materialAvailability: number;
  qualityLossRate: number;
  laborCost: number;
  scrapCost: number;
  downtimeHours: number;
}) {
  const productionValueAtRisk = inputs.productionValuePerUnit * inputs.unitsAtRisk;
  const urgencyPressure = Math.min(1, Math.max(0, inputs.orderUrgency / 5));
  const deadlinePressure = Math.min(1, Math.max(0, (72 - inputs.deliveryHoursRemaining) / 72));
  const materialPressure = 1 - Math.min(1, Math.max(0, inputs.materialAvailability));
  const qualityPressure = Math.min(1, Math.max(0, inputs.qualityLossRate));
  const downtimeExposure = Math.min(1, Math.max(0, inputs.downtimeHours / 24));
  const deliveryRisk = Math.round(Math.min(100, urgencyPressure * 28 + deadlinePressure * 25 + materialPressure * 22 + qualityPressure * 15 + downtimeExposure * 10));
  const estimatedLoss = Math.round(
    productionValueAtRisk * (0.35 * downtimeExposure + 0.3 * qualityPressure + 0.2 * materialPressure + 0.15 * urgencyPressure) +
    inputs.laborCost + inputs.scrapCost,
  );
  const confidence = Number((0.55 + (1 - materialPressure) * 0.15 + (1 - qualityPressure) * 0.15 + Math.min(1, inputs.unitsAtRisk / 1000) * 0.15).toFixed(2));
  return {
    productionValueAtRisk: Math.round(productionValueAtRisk),
    estimatedLoss,
    deliveryRisk,
    confidence,
    calculationVersion: 'v1-live-inputs',
  };
}

function incidentPublicView(incident: any, customer: boolean) {
  if (!customer) return incident;
  return {
    _id: incident._id,
    incidentNo: incident.incidentNo,
    category: incident.category,
    severity: incident.severity,
    title: incident.title,
    factoryUnit: incident.factoryUnit,
    status: incident.status,
    stage: incident.stage,
    dueAt: incident.dueAt,
    impactScore: incident.impactScore,
    recoveryVerified: incident.recoveryVerified,
    createdAt: incident.createdAt,
  };
}

async function getIncident(req: AuthRequest, id: string) {
  const incident = await Incident.findById(id).lean();
  if (!incident) return null;
  const scope = scopeFor(req, incident.factoryUnit);
  if (scope === null) return null;
  if (req.user.role === 'customer') {
    if (!req.user.customerName || !incident.orderId) return null;
    const order = await ProductionOrder.exists({ ...scope, orderNo: incident.orderId, customerName: req.user.customerName });
    if (!order) return null;
  }
  return incident;
}

export async function ensureIncidentForAlert(alert: any, machine: any) {
  if (!machine?.factoryUnit) return null;
  const existing = await Incident.findOne({ alertId: String(alert._id), status: ACTIVE_STATUSES }).lean();
  if (existing) return existing;
  const critical = alert.severity === 'critical';
  const incident = await Incident.create({
    incidentNo: `INC-${Date.now()}`,
    alertId: String(alert._id),
    category: 'machine_downtime',
    severity: critical ? 'critical' : 'high',
    title: `${machine.name || machine.machineId} early-warning signal`,
    description: alert.technicianSummary || alert.message,
    factoryUnit: machine.factoryUnit,
    machineId: machine.machineId,
    status: 'new',
    stage: 'detect',
    dueAt: new Date(Date.now() + (critical ? 18 : 72) * 60 * 60_000),
    responseSlaMinutes: critical ? 30 : 120,
    resolutionSlaMinutes: critical ? 720 : 2880,
    impactScore: critical ? 82 : 58,
    createdBy: 'sensor-pipeline',
  });
  emitOperation('incident:new', incident);
  return incident;
}

router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scope = scopeFor(req);
    if (scope === null) {
      res.status(403).json({ success: false, error: 'No factory scope assigned' });
      return;
    }
    const customerOrderScope = req.user.role === 'customer' && req.user.customerName
      ? { ...scope, customerName: req.user.customerName }
      : scope;
    const [orders, runs, materials, quality, workforce, incidents, impacts] = await Promise.all([
      ProductionOrder.find(customerOrderScope).sort({ dueDate: 1 }).limit(50).lean(),
      ProductionRun.find(scope).sort({ updatedAt: -1 }).limit(50).lean(),
      Material.find(scope).sort({ requiredBy: 1 }).limit(50).lean(),
      QualityInspection.find(scope).sort({ createdAt: -1 }).limit(50).lean(),
      req.user.role === 'customer' ? Promise.resolve([]) : WorkforceAssignment.find(scope).sort({ updatedAt: -1 }).limit(50).lean(),
      Incident.find({ ...scope, status: ACTIVE_STATUSES }).sort({ impactScore: -1, dueAt: 1 }).limit(50).lean(),
      BusinessImpact.find(scope).sort({ calculatedAt: -1 }).limit(50).lean(),
    ]);
    const customerOrderIds = new Set(orders.map((order: any) => order.orderNo));
    const visibleIncidents = req.user.role === 'customer' ? incidents.filter((incident: any) => customerOrderIds.has(incident.orderId)) : incidents;
    const visibleRuns = req.user.role === 'customer' ? runs.filter((run: any) => customerOrderIds.has(run.orderId)) : runs;
    const visibleQuality = req.user.role === 'customer' ? quality.filter((inspection: any) => customerOrderIds.has(inspection.orderId)) : quality;
    const visibleImpacts = req.user.role === 'customer' ? impacts.filter((impact: any) => customerOrderIds.has(impact.orderId)) : impacts;
    const good = visibleRuns.reduce((sum, run: any) => sum + (run.goodQuantity || 0), 0);
    const planned = visibleRuns.reduce((sum, run: any) => sum + (run.plannedQuantity || 0), 0);
    const downtime = visibleRuns.reduce((sum, run: any) => sum + (run.downtimeHours || 0), 0);
    const scrap = visibleRuns.reduce((sum, run: any) => sum + (run.scrapQuantity || 0), 0);
    const overtime = visibleRuns.reduce((sum, run: any) => sum + (run.overtimeCost || 0), 0);
    const availableHours = visibleRuns.reduce((sum, run: any) => sum + (run.runtimeHours || 0) + (run.downtimeHours || 0), 0);
    const availability = availableHours > 0 ? visibleRuns.reduce((sum, run: any) => sum + (run.runtimeHours || 0), 0) / availableHours : 0;
    const qualityRate = visibleRuns.reduce((sum, run: any) => sum + (run.producedQuantity || 0), 0) > 0 ? good / visibleRuns.reduce((sum, run: any) => sum + (run.producedQuantity || 0), 0) : 0;
    const oee = Math.round(availability * qualityRate * (planned > 0 ? Math.min(1, good / planned) : 0) * 100);
    const estimatedLoss = visibleImpacts.reduce((sum, impact: any) => sum + (impact.estimatedLoss || 0), 0);
    const visibleOrders = req.user.role === 'customer' ? orders.map((order: any) => ({ orderNo: order.orderNo, customerName: order.customerName, product: order.product, quantity: order.quantity, dueDate: order.dueDate, priority: order.priority, status: order.status, factoryUnit: order.factoryUnit })) : orders;
    const visibleMaterials = req.user.role === 'customer' ? materials.map((material: any) => ({ sku: material.sku, name: material.name, status: material.status, requiredBy: material.requiredBy, quantityOnHand: material.quantityOnHand, requiredQuantity: material.requiredQuantity, factoryUnit: material.factoryUnit })) : materials;
    const visibleQualityData = req.user.role === 'customer' ? visibleQuality.map((inspection: any) => ({ inspectionNo: inspection.inspectionNo, orderId: inspection.orderId, result: inspection.result, defectRate: inspection.defectRate, holdStatus: inspection.holdStatus, factoryUnit: inspection.factoryUnit })) : visibleQuality;
    const visibleImpactData = req.user.role === 'customer' ? visibleImpacts.map((impact: any) => ({ incidentId: impact.incidentId, orderId: impact.orderId, productionValueAtRisk: impact.productionValueAtRisk, estimatedLoss: impact.estimatedLoss, deliveryRisk: impact.deliveryRisk, confidence: impact.confidence, calculatedAt: impact.calculatedAt })) : visibleImpacts;
    res.json({
      success: true,
      data: {
        orders: visibleOrders,
        runs: req.user.role === 'customer' ? visibleRuns.map((run: any) => ({ runNo: run.runNo, orderId: run.orderId, lineName: run.lineName, plannedQuantity: run.plannedQuantity, goodQuantity: run.goodQuantity, producedQuantity: run.producedQuantity, status: run.status, factoryUnit: run.factoryUnit })) : visibleRuns,
        materials: visibleMaterials,
        quality: visibleQualityData,
        workforce,
        incidents: visibleIncidents.map((incident) => incidentPublicView(incident, req.user.role === 'customer')),
        impacts: visibleImpactData,
        kpis: {
          plannedOutput: planned,
          goodOutput: good,
          scheduleAdherence: planned > 0 ? Math.round((good / planned) * 100) : 0,
          downtimeHours: Number(downtime.toFixed(1)),
          scrapQuantity: scrap,
          outputLoss: Math.max(0, planned - good),
          overtimeCost: overtime,
          oee,
          estimatedLoss,
          activeIncidentCount: visibleIncidents.length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/orders', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  const query = req.user.role === 'customer' && req.user.customerName ? { ...scope, customerName: req.user.customerName } : scope;
  const data = await ProductionOrder.find(query).sort({ dueDate: 1 }).lean();
  res.json({ success: true, data: req.user.role === 'customer' ? data.map((order: any) => ({ orderNo: order.orderNo, customerName: order.customerName, product: order.product, quantity: order.quantity, dueDate: order.dueDate, priority: order.priority, status: order.status, factoryUnit: order.factoryUnit })) : data });
});

router.get('/production', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  const data = await ProductionRun.find(scope).sort({ updatedAt: -1 }).lean();
  if (req.user.role !== 'customer') { res.json({ success: true, data }); return; }
  const orders = await ProductionOrder.find(req.user.customerName ? { ...scope, customerName: req.user.customerName } : { factoryUnit: '__no_access__' }).select('orderNo').lean();
  const orderIds = new Set(orders.map((order: any) => order.orderNo));
  res.json({ success: true, data: data.filter((run: any) => orderIds.has(run.orderId)).map((run: any) => ({ runNo: run.runNo, orderId: run.orderId, lineName: run.lineName, plannedQuantity: run.plannedQuantity, producedQuantity: run.producedQuantity, goodQuantity: run.goodQuantity, status: run.status, factoryUnit: run.factoryUnit })) });
});

router.get('/materials', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  const data = await Material.find(scope).sort({ requiredBy: 1 }).lean();
  res.json({ success: true, data: req.user.role === 'customer' ? data.map((material: any) => ({ sku: material.sku, name: material.name, status: material.status, requiredBy: material.requiredBy, quantityOnHand: material.quantityOnHand, requiredQuantity: material.requiredQuantity, factoryUnit: material.factoryUnit })) : data });
});

router.get('/quality', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  const data = await QualityInspection.find(scope).sort({ createdAt: -1 }).lean();
  if (req.user.role !== 'customer') { res.json({ success: true, data }); return; }
  const orders = await ProductionOrder.find(req.user.customerName ? { ...scope, customerName: req.user.customerName } : { factoryUnit: '__no_access__' }).select('orderNo').lean();
  const orderIds = new Set(orders.map((order: any) => order.orderNo));
  res.json({ success: true, data: data.filter((inspection: any) => orderIds.has(inspection.orderId)).map((inspection: any) => ({ inspectionNo: inspection.inspectionNo, orderId: inspection.orderId, result: inspection.result, defectRate: inspection.defectRate, holdStatus: inspection.holdStatus, factoryUnit: inspection.factoryUnit })) });
});

router.get('/workforce', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  const data = req.user.role === 'customer' ? [] : await WorkforceAssignment.find(scope).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data });
});

router.get('/demand', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  const query = req.user.role === 'customer' && req.user.customerName ? { ...scope, customerName: req.user.customerName } : scope;
  res.json({ success: true, data: await DemandPlan.find(query).sort({ createdAt: -1 }).lean() });
});

router.post('/orders', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payload = { ...req.body, factoryUnit: String(req.body.factoryUnit || '') };
    if (!payload.factoryUnit || scopeFor(req, payload.factoryUnit) === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const order = await ProductionOrder.create(payload);
    res.status(201).json({ success: true, data: order });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/production', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payload = { ...req.body, factoryUnit: String(req.body.factoryUnit || '') };
    if (!payload.factoryUnit || scopeFor(req, payload.factoryUnit) === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const run = await ProductionRun.create(payload);
    res.status(201).json({ success: true, data: run });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/materials', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payload = { ...req.body, factoryUnit: String(req.body.factoryUnit || '') };
    if (!payload.factoryUnit || scopeFor(req, payload.factoryUnit) === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const material = await Material.create(payload);
    res.status(201).json({ success: true, data: material });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/quality', requireRoles('maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payload = { ...req.body, factoryUnit: String(req.body.factoryUnit || '') };
    if (!payload.factoryUnit || scopeFor(req, payload.factoryUnit) === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const inspection = await QualityInspection.create(payload);
    res.status(201).json({ success: true, data: inspection });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/workforce', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payload = { ...req.body, factoryUnit: String(req.body.factoryUnit || '') };
    if (!payload.factoryUnit || scopeFor(req, payload.factoryUnit) === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const assignment = await WorkforceAssignment.create(payload);
    res.status(201).json({ success: true, data: assignment });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/demand', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payload = { ...req.body, factoryUnit: String(req.body.factoryUnit || '') };
    if (!payload.factoryUnit || scopeFor(req, payload.factoryUnit) === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const plan = await DemandPlan.create(payload);
    res.status(201).json({ success: true, data: plan });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.get('/incidents', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scope = scopeFor(req, req.query.factoryUnit ? String(req.query.factoryUnit) : undefined);
    if (scope === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const query: Record<string, any> = { ...scope };
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.category) query.category = String(req.query.category);
    if (req.user.role === 'customer') {
      const orders = req.user.customerName ? await ProductionOrder.find({ ...scope, customerName: req.user.customerName }).select('orderNo').lean() : [];
      query.orderId = { $in: orders.map((order: any) => order.orderNo) };
    }
    const incidents = await Incident.find(query).sort({ impactScore: -1, dueAt: 1 }).limit(100).lean();
    res.json({ success: true, data: incidents.map((incident) => incidentPublicView(incident, req.user.role === 'customer')) });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/incidents', requireRoles('maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const factoryUnit = String(body.factoryUnit || '');
    if (!factoryUnit || scopeFor(req, factoryUnit) === null) { res.status(403).json({ success: false, error: 'Factory unit is outside your scope' }); return; }
    const resolutionSlaMinutes = Number(body.resolutionSlaMinutes) || 1440;
    const dueAt = body.dueAt ? new Date(body.dueAt) : new Date(Date.now() + resolutionSlaMinutes * 60_000);
    const incident = await Incident.create({
      incidentNo: body.incidentNo || `INC-${Date.now()}`,
      alertId: body.alertId,
      category: body.category || 'machine_downtime',
      severity: body.severity || 'medium',
      title: String(body.title || 'Production disruption signal'),
      description: String(body.description || 'Created from the operations control tower.'),
      factoryUnit,
      machineId: body.machineId,
      orderId: body.orderId,
      status: 'new',
      stage: 'detect',
      dueAt,
      responseSlaMinutes: Number(body.responseSlaMinutes) || 60,
      resolutionSlaMinutes,
      impactScore: Math.min(100, Math.max(0, Number(body.impactScore) || 0)),
      createdBy: req.user.id,
    });
    if (body.impact) await calculateAndSaveImpact(incident, body.impact);
    emitOperation('incident:new', incident);
    res.status(201).json({ success: true, data: incident });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.patch('/incidents/:id', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const current = await getIncident(req, String(req.params.id));
    if (!current) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const allowed = ['title', 'description', 'status', 'stage', 'dueAt', 'responseSlaMinutes', 'resolutionSlaMinutes', 'impactScore', 'ownerUserId', 'ownerName', 'ownerTeam'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) if (req.body?.[key] !== undefined) update[key] = req.body[key];
    const incident = await Incident.findByIdAndUpdate(current._id, { $set: update }, { new: true }).lean();
    emitOperation('incident:updated', incident);
    res.json({ success: true, data: incident });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/incidents/:id/assign', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const current = await getIncident(req, String(req.params.id));
    if (!current) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const incident = await Incident.findByIdAndUpdate(current._id, { $set: { ownerUserId: String(req.body?.ownerUserId || ''), ownerName: String(req.body?.ownerName || ''), ownerTeam: String(req.body?.ownerTeam || ''), status: 'triaged', stage: 'triage', firstResponseAt: new Date() } }, { new: true }).lean();
    emitOperation('incident:assigned', incident);
    res.json({ success: true, data: incident });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/incidents/:id/actions', requireRoles('maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const current = await getIncident(req, String(req.params.id));
    if (!current) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : new Date(Date.now() + 24 * 60 * 60_000);
    const action = await CorrectiveAction.create({ incidentId: String(current._id), title: String(req.body?.title || 'Corrective action'), description: String(req.body?.description || ''), ownerUserId: req.body?.ownerUserId, ownerName: req.body?.ownerName || '', dueAt, createdBy: req.user.id });
    await Incident.findByIdAndUpdate(current._id, { $set: { status: 'action_required', stage: 'correct' } });
    emitOperation('incident:action-created', action);
    res.status(201).json({ success: true, data: action });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.get('/incidents/:id/activity', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const incident = await getIncident(req, String(req.params.id));
    if (!incident) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const incidentId = String(incident._id);
    const [actions, comments, evidence, escalations, impact] = await Promise.all([
      CorrectiveAction.find({ incidentId }).sort({ createdAt: -1 }).lean(),
      Comment.find({ entityType: 'incident', entityId: incidentId, ...(req.user.role === 'customer' ? { visibility: 'customer' } : {}) }).sort({ createdAt: 1 }).lean(),
      Evidence.find({ entityType: 'incident', entityId: incidentId }).sort({ createdAt: -1 }).lean(),
      Escalation.find({ incidentId }).sort({ triggeredAt: -1 }).lean(),
      BusinessImpact.findOne({ incidentId }).sort({ calculatedAt: -1 }).lean(),
    ]);
    res.json({ success: true, data: { incident: incidentPublicView(incident, req.user.role === 'customer'), actions, comments, evidence, escalations, impact } });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/incidents/:id/comments', requireRoles('maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator', 'customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const incident = await getIncident(req, String(req.params.id));
    if (!incident) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const body = String(req.body?.body || '').trim();
    if (!body) { res.status(400).json({ success: false, error: 'Comment cannot be empty' }); return; }
    const comment = await Comment.create({ entityType: 'incident', entityId: String(incident._id), factoryUnit: incident.factoryUnit, authorId: req.user.id, authorName: req.user.email, body, visibility: req.user.role === 'customer' ? 'customer' : (req.body?.visibility === 'customer' ? 'customer' : 'internal') });
    res.status(201).json({ success: true, data: comment });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/incidents/:id/evidence', requireRoles('maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const incident = await getIncident(req, String(req.params.id));
    if (!incident) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const evidence = await Evidence.create({ entityType: 'incident', entityId: String(incident._id), factoryUnit: incident.factoryUnit, fileName: String(req.body?.fileName || 'evidence'), mimeType: String(req.body?.mimeType || 'application/octet-stream'), size: Number(req.body?.size) || 0, storageRef: String(req.body?.storageRef || req.body?.fileName || ''), checksum: String(req.body?.checksum || ''), capturedBy: req.user.id, notes: String(req.body?.notes || '') });
    res.status(201).json({ success: true, data: evidence });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/incidents/:id/escalate', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const current = await getIncident(req, String(req.params.id));
    if (!current) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const level = (current.escalationLevel || 0) + 1;
    const targetRole = level > 1 ? 'maintenance_engineer' : 'factory_manager';
    const escalation = await Escalation.create({ incidentId: String(current._id), factoryUnit: current.factoryUnit, fromRole: req.user.role, toRole: String(req.body?.toRole || targetRole), toUserId: req.body?.toUserId, reason: String(req.body?.reason || 'SLA or business-impact escalation'), level });
    const incident = await Incident.findByIdAndUpdate(current._id, { $set: { escalationLevel: level, status: 'action_required', stage: 'correct' } }, { new: true }).lean();
    emitOperation('incident:escalated', { incident, escalation });
    res.status(201).json({ success: true, data: { incident, escalation } });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/incidents/:id/resolve', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const current = await getIncident(req, String(req.params.id));
    if (!current) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const rootCause = String(req.body?.rootCause || '').trim();
    if (!rootCause) { res.status(400).json({ success: false, error: 'Resolution cause is required' }); return; }
    const incident = await Incident.findByIdAndUpdate(current._id, { $set: { status: 'resolved', stage: 'verify', rootCause, resolutionAt: new Date(), recoveryVerified: false, recoveryEvidence: String(req.body?.recoveryEvidence || '') } }, { new: true }).lean();
    emitOperation('incident:resolved', incident);
    res.json({ success: true, data: incident });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.post('/incidents/:id/verify-recovery', requireRoles('maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const current = await getIncident(req, String(req.params.id));
    if (!current) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const recovered = Boolean(req.body?.recovered);
    const incident = await Incident.findByIdAndUpdate(current._id, { $set: { recoveryVerified: recovered, recoveryEvidence: String(req.body?.evidence || ''), stage: recovered ? 'closed' : 'correct', status: recovered ? 'closed' : 'action_required' } }, { new: true }).lean();
    emitOperation('incident:recovery-verified', incident);
    res.json({ success: true, data: incident });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

async function calculateAndSaveImpact(incident: any, rawInputs: Record<string, any>) {
  const inputs = {
    productionValuePerUnit: Number(rawInputs.productionValuePerUnit) || 0,
    unitsAtRisk: Number(rawInputs.unitsAtRisk) || 0,
    orderUrgency: Math.min(5, Math.max(1, Number(rawInputs.orderUrgency) || 1)),
    deliveryHoursRemaining: Math.max(0, Number(rawInputs.deliveryHoursRemaining) || 0),
    materialAvailability: Math.min(1, Math.max(0, Number(rawInputs.materialAvailability) || 0)),
    qualityLossRate: Math.min(1, Math.max(0, Number(rawInputs.qualityLossRate) || 0)),
    laborCost: Math.max(0, Number(rawInputs.laborCost) || 0),
    scrapCost: Math.max(0, Number(rawInputs.scrapCost) || 0),
    downtimeHours: Math.max(0, Number(rawInputs.downtimeHours) || 0),
  };
  const calculation = impactFromInputs(inputs);
  return BusinessImpact.findOneAndUpdate({ incidentId: String(incident._id) }, { $set: { ...inputs, ...calculation, incidentId: String(incident._id), orderId: incident.orderId, factoryUnit: incident.factoryUnit, calculatedAt: new Date() } }, { upsert: true, new: true });
}

router.post('/incidents/:id/impact', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const incident = await getIncident(req, String(req.params.id));
    if (!incident) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const impact = await calculateAndSaveImpact(incident, req.body ?? {});
    if (impact) await Incident.findByIdAndUpdate(incident._id, { $set: { impactScore: impact.deliveryRisk } });
    res.json({ success: true, data: impact });
  } catch (error: any) { res.status(400).json({ success: false, error: error.message }); }
});

router.get('/business-impact', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  let query: Record<string, any> = { ...scope };
  if (req.user.role === 'customer') {
    const orders = req.user.customerName ? await ProductionOrder.find({ ...scope, customerName: req.user.customerName }).select('orderNo').lean() : [];
    query.orderId = { $in: orders.map((order: any) => order.orderNo) };
  }
  res.json({ success: true, data: await BusinessImpact.find(query).sort({ estimatedLoss: -1 }).limit(100).lean() });
});

router.get('/slas/breaches', async (req: AuthRequest, res: Response): Promise<void> => {
  const scope = scopeFor(req);
  if (scope === null) { res.status(403).json({ success: false, error: 'No factory scope assigned' }); return; }
  const query: Record<string, any> = { ...scope, dueAt: { $lt: new Date() }, status: ACTIVE_STATUSES };
  if (req.user.role === 'customer') {
    const orders = req.user.customerName ? await ProductionOrder.find({ ...scope, customerName: req.user.customerName }).select('orderNo').lean() : [];
    query.orderId = { $in: orders.map((order: any) => order.orderNo) };
  }
  const data = await Incident.find(query).sort({ dueAt: 1 }).lean();
  res.json({ success: true, data: data.map((incident) => incidentPublicView(incident, req.user.role === 'customer')) });
});

export async function escalateOverdueIncidents(): Promise<void> {
  const overdue = await Incident.find({ dueAt: { $lt: new Date() }, status: ACTIVE_STATUSES }).limit(100).lean();
  for (const incident of overdue) {
    const level = (incident.escalationLevel || 0) + 1;
    const existing = await Escalation.exists({ incidentId: String(incident._id), level });
    if (existing) continue;
    const escalation = await Escalation.create({
      incidentId: String(incident._id),
      factoryUnit: incident.factoryUnit,
      fromRole: incident.ownerTeam || 'factory_manager',
      toRole: level > 1 ? 'maintenance_engineer' : 'factory_manager',
      reason: `Automatic escalation: SLA breached at ${new Date().toISOString()}`,
      level,
    });
    const updated = await Incident.findByIdAndUpdate(incident._id, { $set: { escalationLevel: level, status: 'action_required', stage: 'correct' } }, { new: true }).lean();
    emitOperation('incident:escalated', { incident: updated, escalation, automatic: true });
  }
}

export default router;
