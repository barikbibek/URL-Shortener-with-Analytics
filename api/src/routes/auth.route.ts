import { Router, Request, Response, NextFunction } from "express";
import { date, z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db";
import { authenticateToken } from "../middleware/auth.mddleware";


const router = Router()

const SignupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters")
})
const SigninSchema = z.object({
    email: z.string().email(),
    password: z.string(),
})

router.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = SignupSchema.parse(req.body);

        const passwordHash = await bcrypt.hash(password, 12)

        const user = await prisma.user.create({
            data: { email, passwordHash },
            select: { id: true, email: true, createdAt: true } // never return password
        })

        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" })

        res.status(201).json({ user, token })
    } catch (err) {
        next(err)
    }
})

router.post("/login", async(req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = SigninSchema.parse(req.body)

        const user = await prisma.user.findUnique({ where: { email } })
        const isPasswordMatched = await bcrypt.compare(password, user!.passwordHash)

        if(!user || !isPasswordMatched){
            res.status(401).json({ error: "Invalid credentials" })
            return
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "7d" })

        res.status(200).json({ user: { id: user.id, email: user.email, createdAt: user.createdAt }, token })
    } catch (err) {
        next(err)
    }
})

router.get("/me", authenticateToken, async(req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, email: true, createdAt: true }, })

        if(!user){
            res.status(404).json({ error: "user not found" })
            return;
        }
        res.status(200).json({ user })
    } catch (err) {
        next(err)
    }
})

export default router;