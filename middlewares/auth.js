import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) return res.status(401).send('Unauthorized request');

    const token = authHeader.split(' ')[1];

    if (!token || token === 'null') return res.status(401).send('Unauthorized request');

    try {
        const payload = jwt.verify(token, process.env.SecretKey);
        req.userId = payload.subject;
        next();
    } catch {
        return res.status(401).send('Unauthorized request');
    }
};
