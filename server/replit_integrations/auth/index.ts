export { setupAuth, isAuthenticated, getSession, generateAutomationKey, verifyAutomationKey, createAutomationAuthMiddleware } from "./replitAuth";
export { authStorage, type IAuthStorage, resolveWorkspaceId, resolveWorkspace } from "./storage";
export { registerAuthRoutes } from "./routes";
