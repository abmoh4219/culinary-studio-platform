import type { FastifyPluginAsync } from 'fastify';

import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { AuthError } from '../auth/auth.service';

import {
  consumeCredits,
  createMembershipEnrollment,
  creditWallet,
  debitWallet,
  getAccountReceivables,
  getInvoice,
  getInvoiceOutstanding,
  getCreditBalance,
  getEffectivePriceBook,
  getWalletBalance,
  issueInvoice,
  purchaseCreditPack,
  recordManualPayment,
  renewMembership,
  resolveCreditPackPrice,
  resolveMembershipPrice
} from './billing.service';

type EffectivePriceBookQuery = {
  asOf?: string;
  currency?: string;
};

type MembershipPriceQuery = {
  asOf?: string;
  currency?: string;
};

type CreditPackPriceQuery = {
  asOf?: string;
  currency?: string;
};

type MembershipEnrollmentBody = {
  membershipPlanId: string;
  startsAt?: string;
  autoRenew?: boolean;
  asOf?: string;
};

type RenewMembershipBody = {
  asOf?: string;
};

type PurchaseCreditPackBody = {
  creditPackId: string;
  asOf?: string;
};

type ConsumeCreditsBody = {
  amount: number;
  reason?: string;
};

type WalletQuery = {
  currency?: string;
};

type WalletAdjustBody = {
  userId?: string;
  amount: number;
  currency?: string;
  reason?: string;
};

type IssueInvoiceBody = {
  customerUserId?: string;
  asOf?: string;
  currency?: string;
  dueAt?: string;
  discountPercent?: number;
  discountReason?: string;
  lines: Array<
    | {
        type: 'MEMBERSHIP_PLAN';
        membershipPlanId: string;
        quantity?: number;
      }
    | {
        type: 'CREDIT_PACK';
        creditPackId: string;
        quantity?: number;
      }
  >;
};

type RecordPaymentBody = {
  invoiceId: string;
  method: 'CASH' | 'CHECK' | 'MANUAL_CARD';
  amount: number;
  referenceNumber?: string;
  checkNumber?: string;
  cardLast4?: string;
  cardBrand?: string;
  cardAuthCode?: string;
  notes?: string;
  receivedAt?: string;
};

type ReceivablesQuery = {
  userId?: string;
};

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: EffectivePriceBookQuery }>(
    '/price-books/effective',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await getEffectivePriceBook(request.query);
        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Params: { membershipPlanId: string }; Querystring: MembershipPriceQuery }>(
    '/membership-plans/:membershipPlanId/price',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await resolveMembershipPrice({
          membershipPlanId: request.params.membershipPlanId,
          asOf: request.query.asOf,
          currency: request.query.currency
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: MembershipEnrollmentBody }>(
    '/memberships/enroll',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await createMembershipEnrollment({
          userId: request.user.sub,
          ...request.body
        });

        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Params: { enrollmentId: string }; Body: RenewMembershipBody }>(
    '/memberships/:enrollmentId/renew',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await renewMembership({
          enrollmentId: request.params.enrollmentId,
          actorUserId: request.user.sub,
          actorRoles: request.user.roles ?? [],
          asOf: request.body.asOf
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Params: { creditPackId: string }; Querystring: CreditPackPriceQuery }>(
    '/credit-packs/:creditPackId/price',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await resolveCreditPackPrice({
          creditPackId: request.params.creditPackId,
          asOf: request.query.asOf,
          currency: request.query.currency
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: PurchaseCreditPackBody }>(
    '/credit-packs/purchase',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await purchaseCreditPack({
          userId: request.user.sub,
          ...request.body
        });

        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get(
    '/credits/balance',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await getCreditBalance({
          userId: request.user.sub
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: ConsumeCreditsBody }>(
    '/credits/consume',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await consumeCredits({
          userId: request.user.sub,
          amount: request.body.amount,
          reason: request.body.reason
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Querystring: WalletQuery }>(
    '/wallet',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await getWalletBalance({
          userId: request.user.sub,
          currency: request.query.currency
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: WalletAdjustBody }>(
    '/wallet/top-up',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const result = await creditWallet({
          userId: request.body.userId ?? request.user.sub,
          amount: request.body.amount,
          currency: request.body.currency,
          reason: request.body.reason
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: WalletAdjustBody }>(
    '/wallet/debit',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const result = await debitWallet({
          userId: request.body.userId ?? request.user.sub,
          amount: request.body.amount,
          currency: request.body.currency,
          reason: request.body.reason
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: IssueInvoiceBody }>(
    '/invoices/issue',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await issueInvoice({
          actorUserId: request.user.sub,
          actorRoles: request.user.roles ?? [],
          ...request.body
        });

        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Params: { invoiceId: string } }>(
    '/invoices/:invoiceId',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await getInvoice(request.params.invoiceId, request.user.sub, request.user.roles ?? []);
        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Params: { invoiceId: string } }>(
    '/invoices/:invoiceId/outstanding',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await getInvoiceOutstanding(
          request.params.invoiceId,
          request.user.sub,
          request.user.roles ?? []
        );
        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.get<{ Querystring: ReceivablesQuery }>(
    '/receivables',
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const result = await getAccountReceivables({
          actorUserId: request.user.sub,
          actorRoles: request.user.roles ?? [],
          userId: request.query.userId
        });

        return reply.send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );

  app.post<{ Body: RecordPaymentBody }>(
    '/payments/manual',
    {
      preHandler: [requireAuth, requireRoles(['ADMIN'])]
    },
    async (request, reply) => {
      try {
        const result = await recordManualPayment({
          actorUserId: request.user.sub,
          actorRoles: request.user.roles ?? [],
          ...request.body
        });

        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({ message: error.message });
        }

        request.log.error(error);
        return reply.code(500).send({ message: 'Internal server error' });
      }
    }
  );
};
