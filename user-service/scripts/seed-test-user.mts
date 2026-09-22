import argon2 from "argon2";
import { prisma } from "../src/libs/prisma.js";

async function seedUser(
    email: string,
    password: string,
    username: string,
    role: "STUDENT" | "ADMIN",
    phoneNumber: string = "+6500000000",
) {
    const hash = await argon2.hash(password);
    await prisma.user.deleteMany({ where: { email } });
    const user = await prisma.user.create({
        data: {
            email,
            username,
            password: hash,
            phoneNumber,
            role,
        },
    });
    console.log("Seeded user:", { id: user.userId, email, role: user.role });
    console.log(`Password: ${password}`);
}

async function main() {
    await seedUser("tester@example.com", "Test1234!", "tester", "STUDENT");
    await seedUser("admin@example.com", "Admin1234!", "admin", "ADMIN", "+6511111111");
    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
