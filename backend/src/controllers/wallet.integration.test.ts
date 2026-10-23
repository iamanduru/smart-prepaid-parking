import request from "supertest";
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import app from "../app";
import { prisma } from "../config/prisma";
import { resetTestDatabase } from "../test/reset-test-database";

describe("Wallet API integration tests", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await prisma.$disconnect();
  });

  async function createAuthenticatedOwner(
    email = "wallet.owner@example.com",
    phone = "0788444444"
  ) {
    const password = "SecurePass123";

    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Wallet Test Owner",
        email,
        phone,
        password,
      });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email,
        password,
      });

    return loginResponse.body.data.token as string;
  }

  describe("GET /api/wallet", () => {
    it("returns the authenticated owner's wallet with an initial zero balance", async () => {
      const token =
        await createAuthenticatedOwner();

      const response = await request(app)
        .get("/api/wallet")
        .set(
          "Authorization",
          `Bearer ${token}`
        );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(
        response.body.data.wallet.balance
      ).toBe(0);

      expect(
        response.body.data.currency
      ).toBe("RWF");
    });

    it("rejects wallet access without authentication", async () => {
      const response = await request(app)
        .get("/api/wallet");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(
        false
      );
    });
  });

  describe("POST /api/wallet/recharge", () => {
    it("recharges the wallet and creates a completed transaction", async () => {
      const token =
        await createAuthenticatedOwner();

      const response = await request(app)
        .post("/api/wallet/recharge")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          amount: 5000,
          phoneNumber: "0788444444",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(
        response.body.data.wallet.balance
      ).toBe(5000);

      expect(
        response.body.data.transaction.amount
      ).toBe(5000);

      expect(
        response.body.data.transaction.type
      ).toBe("RECHARGE");

      expect(
        response.body.data.transaction.status
      ).toBe("COMPLETED");

      /*
       * Confirm that the database also reflects
       * the updated wallet balance.
       */
      const user =
        await prisma.user.findUnique({
          where: {
            email: "wallet.owner@example.com",
          },
          include: {
            wallet: true,
          },
        });

      expect(user).not.toBeNull();

      expect(
        user?.wallet?.balance
      ).toBe(5000);

      /*
       * Confirm that the recharge transaction
       * was persisted.
       */
      const transaction =
        await prisma.transaction.findFirst({
          where: {
            type: "RECHARGE",
          },
        });

      expect(transaction).not.toBeNull();

      expect(
        transaction?.amount
      ).toBe(5000);

      expect(
        transaction?.status
      ).toBe("COMPLETED");

      /*
       * Successful recharge must also create
       * an audit event.
       */
      const auditLog =
        await prisma.auditLog.findFirst({
          where: {
            action: "WALLET_RECHARGED",
          },
        });

      expect(auditLog).not.toBeNull();

      expect(
        auditLog?.result
      ).toBe("SUCCESS");
    });

    it("rejects a recharge below the minimum amount", async () => {
      const token =
        await createAuthenticatedOwner();

      const response = await request(app)
        .post("/api/wallet/recharge")
        .set(
          "Authorization",
          `Bearer ${token}`
        )
        .send({
          amount: 100,
          phoneNumber: "0788444444",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(
        false
      );

      /*
       * A rejected recharge must not change
       * the wallet balance.
       */
      const user =
        await prisma.user.findUnique({
          where: {
            email: "wallet.owner@example.com",
          },
          include: {
            wallet: true,
          },
        });

      expect(
        user?.wallet?.balance
      ).toBe(0);

      /*
       * Validation failure must not create
       * a financial transaction.
       */
      const transactions =
        await prisma.transaction.count();

      expect(transactions).toBe(0);

      /*
       * And because the recharge never
       * succeeded, no WALLET_RECHARGED audit
       * event should exist.
       */
      const rechargeAuditCount =
        await prisma.auditLog.count({
          where: {
            action: "WALLET_RECHARGED",
          },
        });

      expect(rechargeAuditCount).toBe(0);
    });
  });

  describe("GET /api/wallet/transactions", () => {
    it("returns only transactions belonging to the authenticated owner", async () => {
      /*
       * Create first owner.
       */
      const firstToken =
        await createAuthenticatedOwner();

      /*
       * First owner's recharge.
       */
      const firstRecharge =
        await request(app)
          .post("/api/wallet/recharge")
          .set(
            "Authorization",
            `Bearer ${firstToken}`
          )
          .send({
            amount: 5000,
            phoneNumber: "0788444444",
          });

      expect(firstRecharge.status).toBe(200);

      /*
       * Create a second independent owner.
       */
      const secondToken =
        await createAuthenticatedOwner(
          "second.wallet.owner@example.com",
          "0788555555"
        );

      /*
       * Second owner's recharge.
       */
      const secondRecharge =
        await request(app)
          .post("/api/wallet/recharge")
          .set(
            "Authorization",
            `Bearer ${secondToken}`
          )
          .send({
            amount: 9000,
            phoneNumber: "0788555555",
          });

      expect(secondRecharge.status).toBe(200);

      /*
       * Request transaction history using
       * only the first owner's JWT.
       */
      const response = await request(app)
        .get("/api/wallet/transactions")
        .set(
          "Authorization",
          `Bearer ${firstToken}`
        );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(
        true
      );

      expect(
        response.body.data.currency
      ).toBe("RWF");

      const transactions =
        response.body.data.transactions;

      expect(transactions).toHaveLength(1);

      expect(
        transactions[0].amount
      ).toBe(5000);

      expect(
        transactions[0].type
      ).toBe("RECHARGE");

      expect(
        transactions[0].status
      ).toBe("COMPLETED");

      /*
       * The second owner's 9000 RWF transaction
       * must not appear in the first owner's
       * transaction history.
       */
      expect(
        transactions.some(
          (transaction: {
            amount: number;
          }) =>
            transaction.amount === 9000
        )
      ).toBe(false);

      /*
       * The database should still contain both
       * transactions. The API is responsible for
       * filtering them by the authenticated owner.
       */
      const totalTransactions =
        await prisma.transaction.count({
          where: {
            type: "RECHARGE",
          },
        });

      expect(totalTransactions).toBe(2);
    });
  });
});