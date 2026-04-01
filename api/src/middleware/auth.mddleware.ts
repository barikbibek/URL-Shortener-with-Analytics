import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface jwtPayload {
    userId: string;
    email: string;
}

// extend express's Request type to include user payload

declare global {
    namespace Express {
        interface Request {
            user?: jwtPayload;
        }
    }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers["authorization"]
    const token = authHeader?.split(" ")[1]

    if(!token){
        res.status(401).json({ error: "Access token required" })
        return
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwtPayload;

        req.user = payload;
        next()
    } catch{
        res.status(401).json({ error: "Invalid or expired token" });

    }
}