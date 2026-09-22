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

    return suppliers;
} 

// this function creates a new supplier type
export async function createType(type: string) {
    const duplicateType = await prisma.supplierType.findFirst({
        where: { 
            type: {
                equals: type,
                mode: 'insensitive',
            }
        }
    });

    if (duplicateType) { // this type already exists, throw error
        throw new AppError("This type already exists", 400, "BAD_REQUEST");
    }

    const newType = await prisma.supplierType.upsert({
        where: {
            type: type,
        },
        create: {
            type: type,
        },
        update: {}
    });

    return newType;
}

// this function deletes an existing supplier type, with no associated supplier record
export async function deleteType(type: string) {
    // there should only be one corresponding type found
    const typeToDelete = await prisma.supplierType.findFirst({
        where: { type: type },
    })

    if (!typeToDelete) {
        // could not find the type to be deleted, it does not exist
        throw new AppError("This type does not exist", 400, "BAD_REQUEST");
    }

    const associatedSuppliers = await prisma.supplier.findMany({
        where: { type: typeToDelete.type },
    })
    // console.log(associatedSuppliers)
    
    if (associatedSuppliers.length > 0) {
        // there are suppliers to the type that the user wants to delete
        throw new AppError("There are suppliers associated to this type, hence it cannot be deleted", 403);
    }

    const deletedType = await prisma.supplierType.delete({
        where: { id: typeToDelete.id }
    })

    return deletedType;
}