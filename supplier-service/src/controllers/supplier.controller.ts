import type { Request, Response } from "express";

export async function viewAllAvailableSuppliers(req: Request, res: Response) {
    console.log("Fetching all suppliers...");
    return res.status(200).json({
        success: true,
        data: {
            message: "All suppliers fetched successfully",
        },
    });
}