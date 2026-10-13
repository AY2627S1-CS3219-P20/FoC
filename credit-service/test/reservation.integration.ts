import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import pg from "pg";
import express from "express";
import { createInternalCreditRouter } from "../src/routes/internal-credit.route.js";
import { errorHandler } from "../src/middleware/error.middleware.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { reserveCredits, abortReservation, getReservation } from "../src/services/reservation.service.js";
import { grantInitialCredits, getCreditBalance, getCreditTransactions } from "../src/services/credit.service.js";
import { AppError } from "../src/errors/errors.js";

const connectionString = process.env.CREDIT_TEST_DATABASE_URL;
test("F4 PostgreSQL atomicity, races, recovery and ledger regressions", { skip: !connectionString }, async t => {
    const schema = `f4_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({ connectionString });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema}` }, { schema }) });
    try {
        await admin.query(`SET search_path TO "${schema}"`);
        for (const name of (await readdir(new URL("../prisma/migrations/", import.meta.url))).sort()) {
            if (name === "migration_lock.toml") continue;
            await admin.query(await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
        }
        const input = (requesterId = randomUUID(), amount = 10) => ({ reservationId: randomUUID(), orderId: randomUUID(), requesterId, amount });
        const errorStatus = (status: number) => (e: unknown) => e instanceof AppError && e.statusCode === status;
        await t.test("reserve, identical replay, conflicts and unchanged F1/F2/F3", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            assert.equal((await reserveCredits(prisma, request)).created, true);
            const retry = await reserveCredits(prisma, { ...request, requesterId: request.requesterId.toUpperCase() });
            assert.equal(retry.created, false);
            assert.equal(retry.reservation.status, "RESERVED");
            await assert.rejects(reserveCredits(prisma, { ...request, amount: 11 }), errorStatus(409));
            await assert.rejects(reserveCredits(prisma, { ...request, reservationId: randomUUID() }), errorStatus(409));
            await assert.rejects(reserveCredits(prisma, input(request.requesterId, 45)), errorStatus(409));
            await assert.rejects(reserveCredits(prisma, input()), errorStatus(404));
            const balance = await getCreditBalance(prisma, request.requesterId);
            assert.ok(balance.status === "READY");
            assert.equal(balance.availableCredits, 40);
            assert.equal(balance.reservedCredits, 10);
            assert.equal((await grantInitialCredits(prisma, request.requesterId)).created, false);
            const history = await getCreditTransactions(prisma, request.requesterId, { limit: 20, sort: "asc" });
            assert.ok(history.status === "READY");
            assert.deepEqual(history.items.map(row => [row.type, row.availableDelta, row.reservedDelta]), [["INITIAL_ALLOCATION", 50, 0], ["RESERVATION", -10, 10]]);
        });
        await t.test("concurrent duplicate calls create one hold and ledger row", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            const results = await Promise.all(Array.from({ length: 3 }, () => reserveCredits(prisma, request)));
            assert.equal(results.filter(result => result.created).length, 1);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: request.reservationId } }), 1);
        });
        await t.test("concurrent holds cannot overdraw or duplicate an active order", async () => {
            const request = input(undefined, 30);
            await grantInitialCredits(prisma, request.requesterId);
            const results = await Promise.allSettled([reserveCredits(prisma, request), reserveCredits(prisma, input(request.requesterId, 30))]);
            assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
            assert.equal(account.availableCredits, 20);
            assert.equal(account.reservedCredits, 30);
            const another = input();
            await grantInitialCredits(prisma, another.requesterId);
            const sameOrder = await Promise.allSettled([reserveCredits(prisma, another), reserveCredits(prisma, { ...another, reservationId: randomUUID() })]);
            assert.equal(sameOrder.filter(result => result.status === "fulfilled").length, 1);
        });
        await t.test("ledger failure rolls back hold and balances", async () => {
            const request = input();
            const grant = await grantInitialCredits(prisma, request.requesterId);
            await admin.query(`CREATE FUNCTION fail_reservation_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."type" = 'RESERVATION' THEN RAISE EXCEPTION 'injected ledger failure'; END IF; RETURN NEW; END $$`);
            await admin.query(`CREATE TRIGGER fail_reservation_ledger BEFORE INSERT ON "CreditTransaction" FOR EACH ROW EXECUTE FUNCTION fail_reservation_ledger()`);
            try { await assert.rejects(reserveCredits(prisma, request), /injected ledger failure/); }
            finally { await admin.query(`DROP TRIGGER fail_reservation_ledger ON "CreditTransaction"`); }
            assert.equal(await prisma.creditReservation.count({ where: { id: request.reservationId } }), 0);
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { id: grant.account.id } });
            assert.equal(account.availableCredits, 50);
            assert.equal(account.reservedCredits, 0);
        });
        await t.test("funded abort refunds once; unfunded tombstone blocks late reserve", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            await reserveCredits(prisma, request);
            await admin.query(`CREATE FUNCTION fail_abort_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."type" = 'RELEASE' THEN RAISE EXCEPTION 'injected ledger uniqueness failure' USING ERRCODE = '23505'; END IF; RETURN NEW; END $$`);
            await admin.query(`CREATE TRIGGER fail_abort_ledger BEFORE INSERT ON "CreditTransaction" FOR EACH ROW EXECUTE FUNCTION fail_abort_ledger()`);
            try {
                await assert.rejects(abortReservation(prisma, request), (error: any) => error.code === "P2002");
                assert.equal((await getReservation(prisma, request.reservationId)).status, "RESERVED");
                const held = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
                assert.equal(held.availableCredits, 40);
                assert.equal(held.reservedCredits, 10);
            } finally { await admin.query(`DROP TRIGGER fail_abort_ledger ON "CreditTransaction"`); }
            await Promise.all([abortReservation(prisma, request), abortReservation(prisma, request)]);
            assert.equal((await getReservation(prisma, request.reservationId)).status, "ABORTED");
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
            assert.equal(account.availableCredits, 50);
            assert.equal(account.reservedCredits, 0);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: request.reservationId, type: "RELEASE" } }), 1);
            const absent = input();
            await abortReservation(prisma, absent);
            assert.equal((await reserveCredits(prisma, absent)).reservation.status, "ABORTED");
            assert.equal(await prisma.creditAccount.count({ where: { userId: absent.requesterId } }), 0);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: absent.reservationId } }), 0);
        });
        await t.test("reserve/abort race always finishes ABORTED without held funds", async () => {
            for (let i = 0; i < 5; i++) {
                const request = input();
                await grantInitialCredits(prisma, request.requesterId);
                await Promise.all([reserveCredits(prisma, request), abortReservation(prisma, request)]);
                assert.equal((await getReservation(prisma, request.reservationId)).status, "ABORTED");
                const account = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
                assert.equal(account.availableCredits, 50);
                assert.equal(account.reservedCredits, 0);
            }
        });
        await t.test("HTTP reserve/replay/lookup/abort return committed states", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            const app = express();
            app.use("/internal/credits", createInternalCreditRouter(prisma, () => "test-token"));
            app.use(errorHandler);
            const server = app.listen(0, "127.0.0.1");
            await new Promise<void>(resolve => server.once("listening", resolve));
            const address = server.address();
            assert.ok(address && typeof address !== "string");
            const url = `http://127.0.0.1:${address.port}/internal/credits/reservations`;
            const post = (path: string, body: unknown) => fetch(path, { method: "POST", headers: { authorization: "Bearer test-token", "Content-Type": "application/json" }, body: JSON.stringify(body) });
            try {
                assert.equal((await post(url, request)).status, 201);
                assert.equal((await post(url, request)).status, 200);
                const lookup = await fetch(`${url}/${request.reservationId}`, { headers: { authorization: "Bearer test-token" } });
                assert.equal(lookup.status, 200);
                assert.equal((await lookup.json()).data.status, "RESERVED");
                const aborted = await post(`${url}/${request.reservationId}/abort`, request);
                assert.equal(aborted.status, 200);
                assert.equal((await aborted.json()).data.status, "ABORTED");
            } finally {
                await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            }
        });
        await t.test("adapter connection failure becomes temporary HTTP 503", async () => {
            const unavailable = new PrismaClient({ adapter: new PrismaPg({ host: "127.0.0.1", port: 1, user: "test", database: "test", connectionTimeoutMillis: 100 }) });
            try { await assert.rejects(reserveCredits(unavailable, input()), errorStatus(503)); }
            finally { await unavailable.$disconnect(); }
        });
        await t.test("migration keeps ledger append-only and balance checks", async () => {
            await assert.rejects(admin.query(`UPDATE "CreditTransaction" SET "amount" = "amount"`), /append-only/);
            await assert.rejects(admin.query(`DELETE FROM "CreditTransaction"`), /append-only/);
            await assert.rejects(admin.query(`TRUNCATE "CreditTransaction"`), /append-only/);
            await assert.rejects(admin.query(`UPDATE "CreditAccount" SET "availableCredits" = -1`), /nonnegative/);
        });
    } finally {
        await prisma.$disconnect();
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.end();
    }
});
