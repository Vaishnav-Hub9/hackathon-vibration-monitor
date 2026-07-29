import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import machinesRouter from "./machines.js";
import alertsRouter from "./alerts.js";
import analyticsRouter from "./analytics.js";
import maintenanceRouter from "./maintenance.js";
import simulatorRouter from "./simulator.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/machines", machinesRouter);
router.use("/alerts", alertsRouter);
router.use("/analytics", analyticsRouter);
router.use("/maintenance", maintenanceRouter);
router.use("/simulator", simulatorRouter);

export default router;
