import { prisma } from "../libs/prisma.js";
import { AppError } from "../errors/errors.js";

const LIMIT: number = 15; // only a max of 15 suppliers per page is displayed per page 

// this function fetches the suppliers based on the page the user is in
export async function fetchSuppliers(page: number) {
    const suppliers = await prisma.supplier.findMany({
        include: { openingHours: true }, // also get opening hours of suppliers
        orderBy: { name: 'asc' }, // case-sensitive
        take: LIMIT, 
        skip: LIMIT * (page - 1),
    });

    if (!suppliers || suppliers.length == 0) {
        throw new AppError("No records found for this page", 400, "BAD_REQUEST");
    }

    return { suppliers: suppliers };
} 