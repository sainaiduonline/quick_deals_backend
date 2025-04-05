import express from "express";
import { LoginAppCtrl, createUserCtrl, updateUserConditionCtrl } from '../controllers/authController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

router.post("/login", LoginAppCtrl);
router.post("/register", createUserCtrl);
router.post("/user/condition", verifyToken, updateUserConditionCtrl);

export default router;
