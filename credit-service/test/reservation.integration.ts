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
    const legacyId = randomUUID();
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema}` }, { schema }) });
    try {
        await admin.query(`SET search_path TO "${schema}"`);
        for (const name of (await readdir(new URL("../prisma/migrations/", import.meta.url))).sort()) {
            if (name === "migration_lock.toml") continue;
            const sql = await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8");
            if (name === "20261017000000_allow_multiple_order_reservations") {
                await t.test("upgrade preserves an existing hold and permits another for the same order", async () => {
                    const orderId = randomUUID();
                    const requesterId = randomUUID();
                    const insert = `INSERT INTO "CreditReservation" ("id", "orderId", "requesterId", "amount", "updatedAt") VALUES ($1, $2, $3, 10, CURRENT_TIMESTAMP) RETURNING *`;
                    const first = await admin.query(insert, [randomUUID(), orderId, requesterId]);
                    await assert.rejects(admin.query(insert, [randomUUID(), orderId, requesterId]),
                        (error: any) => error.code === "23505" && error.constraint === "CreditReservation_one_active_order");
                    await admin.query(sql);
                    const preserved = await admin.query(`SELECT * FROM "CreditReservation" WHERE "id" = $1`, [first.rows[0].id]);
                    assert.deepEqual(preserved.rows, first.rows);
                    await admin.query(insert, [randomUUID(), orderId, requesterId]);
                    const holds = await admin.query(`SELECT "id" FROM "CreditReservation" WHERE "orderId" = $1 AND "status" = 'RESERVED'`, [orderId]);
                    assert.equal(holds.rowCount, 2);
                });
            } else {
                await admin.query(sql);
            }
        }
        const input = (requesterId = randomUUID(), amount = 10) => ({ orderId: randomUUID(), requesterId, amount });
        const reservationFor = (request: ReturnType<typeof input>) => prisma.creditReservation.findFirstOrThrow({ where: { orderId: request.orderId } });
        const errorStatus = (status: number) => (e: unknown) => e instanceof AppError && e.statusCode === status;
        await t.test("historical abort tombstones remain readable", async () => {
            await admin.query(`INSERT INTO "CreditReservation" ("id", "orderId", "requesterId", "amount", "status", "updatedAt") VALUES ($1, $2, $3, 10, 'ABORTED', CURRENT_TIMESTAMP)`, [legacyId, randomUUID(), randomUUID()]);
            const legacy = await getReservation(prisma, legacyId);
            assert.equal(legacy.status, "ABORTED");
        });
        await t.test("reserve generates IDs, rejects caller IDs and preserves F1/F2/F3", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            const first = await reserveCredits(prisma, { ...request, requesterId: request.requesterId.toUpperCase() });
            assert.equal(first.created, true);
            assert.match(first.reservation.id, /^[0-9a-f-]{36}$/);
            assert.equal(first.reservation.status, "RESERVED");
            assert.equal("idempotencyKey" in first.reservation, false);
            await assert.rejects(reserveCredits(prisma, { ...request, reservationId: randomUUID() }), errorStatus(400));
            await assert.rejects(reserveCredits(prisma, { ...request, idempotencyKey: randomUUID() }), errorStatus(400));
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
        await t.test("identical concurrent calls create separate holds with generated IDs", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            const results = await Promise.all(Array.from({ length: 3 }, () => reserveCredits(prisma, request)));
            assert.equal(results.filter(result => result.created).length, 3);
            assert.equal(new Set(results.map(result => result.reservation.id)).size, 3);
            assert.equal(await prisma.creditTransaction.count({ where: { orderId: request.orderId } }), 3);
        });
        await t.test("concurrent holds cannot overdraw; same order permits multiple active reservations", async () => {
            const request = input(undefined, 30);
            await grantInitialCredits(prisma, request.requesterId);
            const results = await Promise.allSettled([reserveCredits(prisma, request), reserveCredits(prisma, input(request.requesterId, 30))]);
            assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
            assert.equal(account.availableCredits, 20);
            assert.equal(account.reservedCredits, 30);
            const another = input();
            await grantInitialCredits(prisma, another.requesterId);
            const sameOrder = await Promise.allSettled([reserveCredits(prisma, another), reserveCredits(prisma, another)]);
            assert.equal(sameOrder.filter(result => result.status === "fulfilled").length, 2);
            const holds = await prisma.creditReservation.findMany({ where: { orderId: another.orderId } });
            assert.equal(holds.length, 2);
            assert.notEqual(holds[0]!.id, holds[1]!.id);
            assert.ok(holds.every(hold => hold.status === "RESERVED"));
            await abortReservation(prisma, { ...another, reservationId: holds[0]!.id });
            assert.equal(await prisma.creditReservation.count({ where: { orderId: another.orderId, status: "RESERVED" } }), 1);
            const remaining = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: another.requesterId } });
            assert.deepEqual([remaining.availableCredits, remaining.reservedCredits], [40, 10]);
        });
        await t.test("reserve and abort balance overflow leave state unchanged", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            await prisma.creditAccount.update({ where: { userId: request.requesterId }, data: { reservedCredits: 2_147_483_647 } });
            await assert.rejects(reserveCredits(prisma, request), errorStatus(409));
            assert.equal(await prisma.creditReservation.count({ where: { orderId: request.orderId } }), 0);
            await prisma.creditAccount.update({ where: { userId: request.requesterId }, data: { reservedCredits: 0 } });
            const { reservation } = await reserveCredits(prisma, request);
            await prisma.creditAccount.update({ where: { userId: request.requesterId }, data: { availableCredits: 2_147_483_647 } });
            await assert.rejects(abortReservation(prisma, { ...request, reservationId: (await reservationFor(request)).id }), errorStatus(409));
            assert.equal((await getReservation(prisma, reservation.id)).status, "RESERVED");
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
            assert.deepEqual([account.availableCredits, account.reservedCredits], [2_147_483_647, 10]);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: reservation.id } }), 1);
        });
        await t.test("ledger failure rolls back hold and balances", async () => {
            const request = input();
            const grant = await grantInitialCredits(prisma, request.requesterId);
            await admin.query(`CREATE FUNCTION fail_reservation_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."type" = 'RESERVATION' THEN RAISE EXCEPTION 'injected ledger failure'; END IF; RETURN NEW; END $$`);
            await admin.query(`CREATE TRIGGER fail_reservation_ledger BEFORE INSERT ON "CreditTransaction" FOR EACH ROW EXECUTE FUNCTION fail_reservation_ledger()`);
            try { await assert.rejects(reserveCredits(prisma, request), /injected ledger failure/); }
            finally { await admin.query(`DROP TRIGGER fail_reservation_ledger ON "CreditTransaction"`); }
            assert.equal(await prisma.creditReservation.count({ where: { orderId: request.orderId } }), 0);
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { id: grant.account.id } });
            assert.equal(account.availableCredits, 50);
            assert.equal(account.reservedCredits, 0);
        });
        await t.test("funded abort refunds once; missing reservation returns 404", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            await reserveCredits(prisma, request);
            await admin.query(`CREATE FUNCTION fail_abort_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."type" = 'RELEASE' THEN RAISE EXCEPTION 'injected ledger uniqueness failure' USING ERRCODE = '23505'; END IF; RETURN NEW; END $$`);
            await admin.query(`CREATE TRIGGER fail_abort_ledger BEFORE INSERT ON "CreditTransaction" FOR EACH ROW EXECUTE FUNCTION fail_abort_ledger()`);
            try {
                await assert.rejects(abortReservation(prisma, { ...request, reservationId: (await reservationFor(request)).id }), (error: any) => error.code === "P2002");
                assert.equal((await getReservation(prisma, (await reservationFor(request)).id)).status, "RESERVED");
                const held = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
                assert.equal(held.availableCredits, 40);
                assert.equal(held.reservedCredits, 10);
            } finally { await admin.query(`DROP TRIGGER fail_abort_ledger ON "CreditTransaction"`); }
            await Promise.all([abortReservation(prisma, { ...request, reservationId: (await reservationFor(request)).id }), abortReservation(prisma, { ...request, reservationId: (await reservationFor(request)).id })]);
            assert.equal((await getReservation(prisma, (await reservationFor(request)).id)).status, "ABORTED");
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
            assert.equal(account.availableCredits, 50);
            assert.equal(account.reservedCredits, 0);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: (await reservationFor(request)).id, type: "RELEASE" } }), 1);
            await assert.rejects(abortReservation(prisma, { ...request, reservationId: randomUUID() }), errorStatus(404));
        });
        await t.test("abort rejects mismatched reservation details without releasing credits", async () => {
            const request = input();
            await grantInitialCredits(prisma, request.requesterId);
            const { reservation } = await reserveCredits(prisma, request);
            for (const change of [{ orderId: randomUUID() }, { requesterId: randomUUID() }, { amount: 11 }]) {
                await assert.rejects(abortReservation(prisma, { ...request, reservationId: reservation.id, ...change }), errorStatus(409));
            }
            assert.equal((await getReservation(prisma, reservation.id)).status, "RESERVED");
            const account = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: request.requesterId } });
            assert.deepEqual([account.availableCredits, account.reservedCredits], [40, 10]);
        });
        await t.test("HTTP reserve creates a new hold per call; lookup and abort use returned ID", async () => {
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
                const created = await post(url, request);
                assert.equal(created.status, 201);
                const reservationId = (await created.json()).data.id;
                assert.ok(reservationId);
                assert.equal((await post(url, { ...request, reservationId: randomUUID() })).status, 400);
                const second = await post(url, request);
                assert.equal(second.status, 201);
                assert.notEqual((await second.json()).data.id, reservationId);
                const lookup = await fetch(`${url}/${reservationId}`, { headers: { authorization: "Bearer test-token" } });
                assert.equal(lookup.status, 200);
                assert.equal((await lookup.json()).data.status, "RESERVED");
                const aborted = await post(`${url}/${reservationId}/abort`, { ...request, reservationId });
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
