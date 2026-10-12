import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { reserveCredits, abortReservation, getReservation } from "../src/services/reservation.service.js";
import { grantInitialCredits, getCreditTransactions } from "../src/services/credit.service.js";
import { AppError } from "../src/errors/errors.js";

import { transferCredits } from "../src/services/settlement.service.js";
import { processSettlementMessage, startSettlementConsumer } from "../src/services/settlement-consumer.service.js";
import { connectSettlementMessaging, publishConfirmed, SETTLEMENT_MESSAGING, REGISTRATION_MESSAGING, declareRegistrationTopology } from "../src/libs/rabbitmq.js";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";
import type { ConfirmChannel, ConsumeMessage } from "amqplib";

const connectionString = process.env.CREDIT_TEST_DATABASE_URL;
test("F5 PostgreSQL transfers, races, rollback and history", { skip: !connectionString }, async t => {
    const schema = `f5_test_${randomUUID().replaceAll("-", "")}`;
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
        const errorStatus = (status: number) => (error: unknown) => error instanceof AppError && error.statusCode === status;
        async function held(amount = 10) {
            const request = { reservationId: randomUUID(), orderId: randomUUID(), requesterId: randomUUID(), amount };
            const courierId = randomUUID();
            await grantInitialCredits(prisma, request.requesterId); await grantInitialCredits(prisma, courierId); await reserveCredits(prisma, request);
            const event = { ...request, courierId, eventId: randomUUID(), eventType: "ORDER_RECEIVED", eventVersion: 1,
                occurredAt: new Date().toISOString(), orderVersion: 7, orderName: "Lunch" };
            return { request, event };
        }
        async function balances(requesterId: string, courierId: string) {
            const requester = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: requesterId } });
            const courier = await prisma.creditAccount.findUniqueOrThrow({ where: { userId: courierId } });
            return [requester.availableCredits, requester.reservedCredits, courier.availableCredits, courier.reservedCredits];
        }
        await t.test("transfer conserves funds, replays once and appears through existing F3", async () => {
            const { event } = await held();
            assert.equal((await transferCredits(prisma, event)).transferred, true);
            assert.deepEqual(await balances(event.requesterId, event.courierId), [40, 0, 60, 0]);
            assert.equal((await transferCredits(prisma, { ...event, courierId: event.courierId.toUpperCase() })).transferred, false);
            const reservation = await getReservation(prisma, event.reservationId);
            assert.equal(reservation.status, "TRANSFERRED"); assert.equal(reservation.settlementEventId, event.eventId);
            assert.equal(reservation.settlementReason, "RECEIVED"); assert.ok(reservation.settledAt);
            const sent = await getCreditTransactions(prisma, event.requesterId, { type: "TRANSFER_SENT", limit: 20, sort: "desc" });
            const received = await getCreditTransactions(prisma, event.courierId, { type: "TRANSFER_RECEIVED", limit: 20, sort: "desc" });
            assert.ok(sent.status === "READY" && received.status === "READY");
            assert.equal(sent.items.length, 1); assert.equal(received.items.length, 1);
            assert.deepEqual([sent.items[0]?.availableDelta, sent.items[0]?.reservedDelta, received.items[0]?.availableDelta, received.items[0]?.reservedDelta], [0, -10, 10, 0]);
            assert.equal((await grantInitialCredits(prisma, event.courierId)).created, false);
            assert.deepEqual(await balances(event.requesterId, event.courierId), [40, 0, 60, 0]);
        });
        await t.test("mismatch, self-transfer and altered full-envelope replays fail unchanged", async () => {
            const { event } = await held();
            for (const change of [{ amount: 11 }, { orderId: randomUUID() }, { requesterId: randomUUID() }, { courierId: event.requesterId }]) {
                await assert.rejects(transferCredits(prisma, { ...event, ...change }), errorStatus(409));
            }
            assert.deepEqual(await balances(event.requesterId, event.courierId), [40, 10, 50, 0]); await transferCredits(prisma, event);
            for (const change of [{ eventId: randomUUID() }, { courierId: randomUUID() }, { orderVersion: 8 }, { orderName: "Dinner" }, { occurredAt: "2026-10-01T00:00:00.000Z" }]) {
                await assert.rejects(transferCredits(prisma, { ...event, ...change }), errorStatus(409));
            }
            assert.deepEqual(await balances(event.requesterId, event.courierId), [40, 0, 60, 0]);
        });
        await t.test("missing courier is recoverable and never provisions implicitly", async () => {
            const { event } = await held(); const missing = { ...event, courierId: randomUUID() };
            await assert.rejects(transferCredits(prisma, missing), errorStatus(404));
            assert.equal(await prisma.creditAccount.count({ where: { userId: missing.courierId } }), 0);
            assert.equal((await getReservation(prisma, event.reservationId)).status, "RESERVED");
            await grantInitialCredits(prisma, missing.courierId); await transferCredits(prisma, missing);
            assert.deepEqual(await balances(missing.requesterId, missing.courierId), [40, 0, 60, 0]);
        });
        await t.test("second ledger insert failure rolls back state and both balances", async () => {
            const { event } = await held();
            await admin.query(`CREATE FUNCTION fail_transfer_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."type" = 'TRANSFER_RECEIVED' THEN RAISE EXCEPTION 'injected transfer failure'; END IF; RETURN NEW; END $$`);
            await admin.query(`CREATE TRIGGER fail_transfer_ledger BEFORE INSERT ON "CreditTransaction" FOR EACH ROW EXECUTE FUNCTION fail_transfer_ledger()`);
            try { await assert.rejects(transferCredits(prisma, event), /injected transfer failure/); }
            finally { await admin.query(`DROP TRIGGER fail_transfer_ledger ON "CreditTransaction"`); }
            assert.deepEqual(await balances(event.requesterId, event.courierId), [40, 10, 50, 0]);
            const reservation = await getReservation(prisma, event.reservationId);
            assert.equal(reservation.status, "RESERVED"); assert.equal(reservation.settlementEventId, null);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: event.reservationId } }), 1);
        });
        await t.test("duplicate and contradictory concurrent receipts settle once", async () => {
            const { event } = await held();
            const results = await Promise.all(Array.from({ length: 3 }, () => transferCredits(prisma, event)));
            assert.equal(results.filter(result => result.transferred).length, 1);
            const other = await held();
            const competing = await Promise.allSettled([transferCredits(prisma, other.event), transferCredits(prisma, { ...other.event, eventId: randomUUID() })]);
            assert.equal(competing.filter(result => result.status === "fulfilled").length, 1);
            assert.deepEqual(await balances(other.event.requesterId, other.event.courierId), [40, 0, 60, 0]);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: event.reservationId } }), 3);
        });
        await t.test("transfer versus abort has exactly one terminal winner", async () => {
            for (let i = 0; i < 5; i++) {
                const { event, request } = await held();
                const outcomes = await Promise.allSettled([transferCredits(prisma, event), abortReservation(prisma, request)]);
                assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
                const reservation = await getReservation(prisma, request.reservationId);
                assert.deepEqual(await balances(event.requesterId, event.courierId), reservation.status === "TRANSFERRED" ? [40, 0, 60, 0] : [50, 0, 50, 0]);
            }
        });
        await t.test("event reuse, overflow and short reserve roll back", async () => {
            const first = await held(); const second = await held(); await transferCredits(prisma, first.event);
            await assert.rejects(transferCredits(prisma, { ...second.event, eventId: first.event.eventId }), errorStatus(409));
            assert.deepEqual(await balances(second.event.requesterId, second.event.courierId), [40, 10, 50, 0]);
            await prisma.creditAccount.update({ where: { userId: second.event.courierId }, data: { availableCredits: 2_147_483_647 } });
            await assert.rejects(transferCredits(prisma, second.event), errorStatus(409));
            assert.equal((await getReservation(prisma, second.event.reservationId)).status, "RESERVED");
            const short = await held(); await prisma.creditAccount.update({ where: { userId: short.event.requesterId }, data: { reservedCredits: 0 } });
            await assert.rejects(transferCredits(prisma, short.event), errorStatus(409));
            assert.equal((await getReservation(prisma, short.event.reservationId)).status, "RESERVED");
        });
        await t.test("lost acknowledgment after commit replays without another transfer", async () => {
            const { event } = await held();
            const delivery = { content: Buffer.from(JSON.stringify(event)), fields: { routingKey: SETTLEMENT_MESSAGING.routingKey }, properties: { messageId: event.eventId } } as ConsumeMessage;
            await assert.rejects(processSettlementMessage(prisma, { ack: () => { throw new Error("ack lost"); } } as unknown as ConfirmChannel, delivery), /ack lost/);
            let acked = false;
            await processSettlementMessage(prisma, { ack: () => { acked = true; } } as unknown as ConfirmChannel, delivery);
            assert.equal(acked, true); assert.deepEqual(await balances(event.requesterId, event.courierId), [40, 0, 60, 0]);
            assert.equal(await prisma.creditTransaction.count({ where: { reservationId: event.reservationId } }), 3);
        });
        await t.test("real broker routing, delayed retry, DLQ, redrive and background consumer", { skip: !process.env.CREDIT_TEST_RABBITMQ_URL }, async () => {
            const previous = process.env.RABBITMQ_URL; process.env.RABBITMQ_URL = process.env.CREDIT_TEST_RABBITMQ_URL;
            const { connection, channel } = await connectSettlementMessaging();
            async function get(queue: string) {
                const deadline = Date.now() + 15_000;
                while (Date.now() < deadline) { const message = await channel.get(queue, { noAck: false }); if (message) return message; await delay(100); }
                throw new Error(`Timed out waiting for ${queue}`);
            }
            try {
                const { event } = await held(); const body = Buffer.from(JSON.stringify(event));
                await publishConfirmed(channel, SETTLEMENT_MESSAGING.exchange, SETTLEMENT_MESSAGING.routingKey, body, { messageId: event.eventId });
                await declareRegistrationTopology(channel);
                const delivered = await get(SETTLEMENT_MESSAGING.queue); assert.equal(delivered.content.toString(), body.toString());
                assert.equal(await channel.get(REGISTRATION_MESSAGING.queue, { noAck: false }), false);
                await processSettlementMessage(prisma, channel, delivered);
                await publishConfirmed(channel, SETTLEMENT_MESSAGING.exchange, SETTLEMENT_MESSAGING.routingKey, body, { messageId: event.eventId });
                await processSettlementMessage(prisma, channel, await get(SETTLEMENT_MESSAGING.queue));
                assert.deepEqual(await balances(event.requesterId, event.courierId), [40, 0, 60, 0]);
                const pending = await held(); pending.event.courierId = randomUUID(); const pendingBody = Buffer.from(JSON.stringify(pending.event));
                await publishConfirmed(channel, SETTLEMENT_MESSAGING.exchange, SETTLEMENT_MESSAGING.routingKey, pendingBody, { messageId: pending.event.eventId });
                await processSettlementMessage(prisma, channel, await get(SETTLEMENT_MESSAGING.queue));
                const start = Date.now(); const retry = await get(SETTLEMENT_MESSAGING.queue);
                assert.ok(Date.now() - start >= 9_000); assert.equal(retry.properties.headers?.["x-retry-count"], 1); assert.equal(retry.content.toString(), pendingBody.toString());
                await grantInitialCredits(prisma, pending.event.courierId); await processSettlementMessage(prisma, channel, retry);
                const contradictory = { ...pending.event, eventId: randomUUID() };
                await publishConfirmed(channel, SETTLEMENT_MESSAGING.exchange, SETTLEMENT_MESSAGING.routingKey, Buffer.from(JSON.stringify(contradictory)), { messageId: contradictory.eventId });
                await processSettlementMessage(prisma, channel, await get(SETTLEMENT_MESSAGING.queue));
                const dead = await get(SETTLEMENT_MESSAGING.deadQueue); assert.equal(dead.properties.headers?.["x-credit-failure"], "CONFLICT"); channel.ack(dead);
                const recover = await held(); recover.event.courierId = randomUUID(); const recoverBody = Buffer.from(JSON.stringify(recover.event));
                await publishConfirmed(channel, "", SETTLEMENT_MESSAGING.deadQueue, recoverBody, { messageId: recover.event.eventId, headers: { "x-retry-count": 5 } });
                await grantInitialCredits(prisma, recover.event.courierId);
                const child = spawn(process.execPath, ["--import", "tsx", "src/scripts/redrive-settlement.ts", "--limit", "1"], { cwd: new URL("../", import.meta.url), env: process.env, stdio: "pipe" });
                const exitCode = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); }); assert.equal(exitCode, 0);
                const redriven = await get(SETTLEMENT_MESSAGING.queue); assert.equal(redriven.content.toString(), recoverBody.toString()); assert.equal(redriven.properties.headers?.["x-retry-count"], 0);
                await processSettlementMessage(prisma, channel, redriven);
                // Real connection loss after commit returns the unacknowledged delivery.
                const lost = await held();
                await publishConfirmed(channel, SETTLEMENT_MESSAGING.exchange, SETTLEMENT_MESSAGING.routingKey, Buffer.from(JSON.stringify(lost.event)), { messageId: lost.event.eventId });
                const crashed = await connectSettlementMessaging();
                const unacked = await crashed.channel.get(SETTLEMENT_MESSAGING.queue, { noAck: false });
                assert.ok(unacked); await transferCredits(prisma, JSON.parse(unacked.content.toString()));
                await crashed.connection.close();
                const replay = await get(SETTLEMENT_MESSAGING.queue); assert.equal(replay.fields.redelivered, true);
                await processSettlementMessage(prisma, channel, replay);
                assert.deepEqual(await balances(lost.event.requesterId, lost.event.courierId), [40, 0, 60, 0]);
                assert.equal(await prisma.creditTransaction.count({ where: { reservationId: lost.event.reservationId } }), 3);
                const unroutable = await connectSettlementMessaging();
                try {
                    await assert.rejects(publishConfirmed(unroutable.channel, SETTLEMENT_MESSAGING.exchange, "order.unroutable.v1", body, { messageId: event.eventId }), /unroutable/);
                } finally { await unroutable.connection.close().catch(() => undefined); }
                const background = await held(); const stop = startSettlementConsumer(prisma);
                try {
                    await publishConfirmed(channel, SETTLEMENT_MESSAGING.exchange, SETTLEMENT_MESSAGING.routingKey, Buffer.from(JSON.stringify(background.event)), { messageId: background.event.eventId });
                    const deadline = Date.now() + 10_000;
                    while ((await getReservation(prisma, background.event.reservationId)).status !== "TRANSFERRED" && Date.now() < deadline) await delay(100);
                    assert.equal((await getReservation(prisma, background.event.reservationId)).status, "TRANSFERRED");
                } finally { await stop(); }
            } finally {
                await connection.close(); if (previous === undefined) delete process.env.RABBITMQ_URL; else process.env.RABBITMQ_URL = previous;
            }
        });
    } finally {
        await prisma.$disconnect();
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.end();
    }
});
