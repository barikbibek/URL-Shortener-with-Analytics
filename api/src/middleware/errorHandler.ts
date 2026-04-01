import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);
    
    if(err.message.includes("Unique constraint")){
        res.status(409).json({ error: "Already exists" })
        return
    }
    res.status(500).json({ error: "Internal server error" })
}