import Jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { loginMdl, createUserMdl, updateUserConditionMdl } from '../models/authModel.js';

export const LoginAppCtrl = async (req, res) => {
    const { userEmail, Password } = req.body;
    try {
        loginMdl({ userEmail }, async (err, results) => {
            if (err) return res.status(400).json({ status: 400, message: "Request failed" });

            if (results.length === 0) {
                return res.status(404).json({ status: 404, message: "User not found" });
            }

            const user = results[0];
            const isMatch = await bcrypt.compare(Password, user.password);
            if (!isMatch) {
                return res.status(401).json({ status: 401, message: "Invalid password" });
            }

            const token = Jwt.sign({ subject: user.email }, process.env.SecretKey, { expiresIn: '3h' });

            return res.status(200).json({ status: 200, message: "Login successful", results: user, token });
        });
    } catch (err) {
        return res.status(500).json({ status: 500, message: "Internal server error", error: err.message });
    }
};

export const createUserCtrl = async (req, res) => {
    try {
        const userData = req.body;
        userData.password = await bcrypt.hash(userData.password, 10);

        createUserMdl(userData, (err, results) => {
            if (err) {
                const message = err.message.includes("Email") ? "Email already exists" :
                                err.message.includes("Username") ? "Username already exists" :
                                "Internal server error";
                const status = message.includes("already exists") ? 400 : 500;
                return res.status(status).json({ status, message });
            }
            res.status(201).json({ status: 201, message: "User registered successfully" });
        });
    } catch (err) {
        res.status(500).json({ status: 500, message: "Server error", error: err.message });
    }
};

export const updateUserConditionCtrl = (req, res) => {
    const { user_id, condition } = req.body;

    if (!user_id || !condition) {
        return res.status(400).json({ status: 400, message: "User ID and condition are required" });
    }

    const userData = { userId: user_id, condition };

    updateUserConditionMdl(userData, (err) => {
        if (err) return res.status(500).json({ status: 500, message: "Internal server error" });
        res.status(200).json({ status: 200, message: "User condition updated successfully" });
    });
};
