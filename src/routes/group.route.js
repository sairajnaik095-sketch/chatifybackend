import express from "express";
import {
  createGroup,
  getUserGroups,
  getGroupById,
  addMembers,
  removeMember,
  updateGroup,
  getGroupMessages,
  sendMessageToGroup,
} from "../controllers/group.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// Apply middlewares
router.use(arcjetProtection, protectRoute);

// Group management routes
router.post("/create", createGroup);
router.get("/my-groups", getUserGroups);
router.get("/:groupId", getGroupById);
router.put("/:groupId", updateGroup);
router.post("/:groupId/members", addMembers);
router.delete("/:groupId/members/:memberId", removeMember);

// Group messaging routes
router.get("/:groupId/messages", getGroupMessages);
router.post("/:groupId/messages", sendMessageToGroup);

export default router;
