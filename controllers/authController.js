import express from "express";
const app = express();

import Jwt from 'jsonwebtoken';
const { jwt } = Jwt;

import { loginMdl } from '../models/authModel.js'
import { createUserMdl, updateUserConditionMdl } from '../models/authModel.js';


export const LoginAppCtrl = function (req, res) {
    var data = req.body;
        loginMdl(data, function (err, results) {
            try {
                if (err) {
                    res.send({ status: 400, message: "Not able to process the request, please try again" });
                    return;
                }
                // console.log(results.length);
                if (results.length <= 0) {
                    res.send({ status: 404, message: "Email/Mobile number not exist" });
                } else if (results.length > 0) {
                    // console.log(req.body.Password)
                    const validPass = (
                        req.body.Password == results[0].password
                    )
                   
                    if (validPass) {
                      
                        var SecretKey = process.env.SecretKey
                      
                        let payload = {
                            subject: req.body.userEmail
                        };
                        let token = Jwt.sign(payload, SecretKey, { expiresIn: "3h" });

                        res.send({
                            status: 200, message: "login Successful", results, token: token
                        });
                        // }
                    } else {
                        res.send({ status: 400, message: "Invalid password" })
                    }
                }
            } catch (err) {
                res.send({ status: 500, message: "Internal server error" })
            }
        });
};



export const createUserCtrl = (req, res) => {
    const userData = req.body;

    createUserMdl(userData, (err, results) => {
        if (err) {
            if (err.message === "Email already exists") {
                res.status(400).json({ status: 400, message: "Email already exists" });
            } else if (err.message === "Username already exists") {
                res.status(400).json({ status: 400, message: "Username already exists" });
            } else {
                res.status(500).json({ status: 500, message: "Internal server error" });
            }
        } else {
            res.status(201).json({ status: 201, message: "User registered successfully" });
        }
    });
};


export const updateUserConditionCtrl = (req, res) => {
    const { user_id, condition } = req.body; // Extract user_id and condition from the request body

    if (!user_id || !condition) {
        return res.status(400).json({ status: 400, message: "User ID and condition are required" });
    }

    const userData = {
        userId: user_id,
        condition
    };

    updateUserConditionMdl(userData, (err, results) => {
        if (err) {
            res.status(500).json({ status: 500, message: "Internal server error" });
        } else {
            res.status(200).json({ status: 200, message: "User condition updated successfully" });
        }
    });
};