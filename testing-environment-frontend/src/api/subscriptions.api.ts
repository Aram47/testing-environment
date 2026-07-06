import type { CompanyProfile, SubscriptionPlan, SubscriptionTier } from '../types';
import { generatedApi } from './generated-client';
import type { ChangeSubscriptionPlanDto } from '../generated/api';

interface SubscriptionPlanResponse extends Omit<SubscriptionPlan, 'tier'> {
  id: string;
  name: SubscriptionTier;
}

class SubscriptionsApi {
  listPlans = async (): Promise<SubscriptionPlan[]> => {
    const data = await generatedApi.SubscriptionsController_listPlans({ path: {} }) as SubscriptionPlanResponse[];
    return data.map((plan) => this.toSubscriptionPlan(plan));
  };

  changePlan = async (planName: SubscriptionTier): Promise<CompanyProfile> => {
    return generatedApi.SubscriptionsController_changeCurrentPlan(
      { path: {} },
      { planName } as ChangeSubscriptionPlanDto,
    ) as Promise<CompanyProfile>;
  };

  private toSubscriptionPlan(plan: SubscriptionPlanResponse): SubscriptionPlan {
    return {
      tier: plan.name,
      maxProjects: plan.maxProjects,
      maxRunsPerMonth: plan.maxRunsPerMonth,
      maxConcurrentRuns: plan.maxConcurrentRuns,
      maxRunnerMinutes: plan.maxRunnerMinutes,
      reportRetentionDays: plan.reportRetentionDays,
    };
  }
}

export const subscriptionsApi = new SubscriptionsApi();
