import { db } from "../config/dbConfig.js";
import { execQuery } from "../config/dbUtil.js";

const escapeValue = (value) => db.escape(value);

export const loginMdl = (signupdata, callback) => {
    const query = `SELECT * FROM user WHERE email = ${escapeValue(signupdata.userEmail)}`;
    execQuery(db, query, callback);
};

export const createUserMdl = (userData, callback) => {
    const { userName, firstName, lastName, email, password, address, mobileNo, role } = userData;

    const checkEmailQuery = `SELECT COUNT(*) AS emailCount FROM user WHERE email = ${escapeValue(email)}`;
    execQuery(db, checkEmailQuery, function (err, results) {
        if (err) return callback(err, null);

        if (results[0].emailCount > 0) {
            return callback(new Error("Email already exists"), null);
        }

        const checkUsernameQuery = `SELECT COUNT(*) AS usernameCount FROM user WHERE user_name = ${escapeValue(userName)}`;
        execQuery(db, checkUsernameQuery, function (err, results) {
            if (err) return callback(err, null);

            if (results[0].usernameCount > 0) {
                return callback(new Error("Username already exists"), null);
            }

            const insertQuery = `
                INSERT INTO user (user_name, first_name, last_name, email, password, mobile_no, address, role) 
                VALUES (${escapeValue(userName)}, ${escapeValue(firstName)}, ${escapeValue(lastName)},
                        ${escapeValue(email)}, ${escapeValue(password)}, ${escapeValue(mobileNo)},
                        ${escapeValue(address)}, ${escapeValue(role)})
            `;
            execQuery(db, insertQuery, callback);
        });
    });
};

export const updateUserConditionMdl = (userData, callback) => {
    const { userId, condition } = userData;
    const query = `UPDATE user SET \`condition\` = ${escapeValue(condition)} WHERE user_id = ${escapeValue(userId)}`;
    execQuery(db, query, callback);
};
