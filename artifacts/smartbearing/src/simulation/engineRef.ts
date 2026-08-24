/**
 * Module-level singleton for the PhysicsEngine.
 *
 * Instead of routing every 20 Hz telemetry frame through Zustand (which
 * triggers cascading re-renders across dozens of subscribers), the 3D
 * components and useFrame hooks read the live motor/thermal/tachometer
 * state directly from this ref. Zustand is reserved for user-controlled
 * parameters and UI state that changes infrequently.
 *
 * The engine also reads mechanical params directly from the Zustand store
 * on each tick to avoid subscription timing gaps.
 */
import { PhysicsEngine } from './PhysicsEngine';

export const engine = new PhysicsEngine();
