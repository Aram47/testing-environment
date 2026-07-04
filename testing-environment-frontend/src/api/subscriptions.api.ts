import type { CompanyProfile, SubscriptionPlan, SubscriptionTier } from '../types';
import { apiClient } from './client';

interface SubscriptionPlanResponse extends Omit<SubscriptionPlan, 'tier'> {
  id: string;
  name: SubscriptionTier;
}

class SubscriptionsApi {
  listPlans = async (): Promise<SubscriptionPlan[]> => {
    const { data } = await apiClient.get<SubscriptionPlanResponse[]>('/subscriptions/plans');
    return data.map((plan) => this.toSubscriptionPlan(plan));
  };

  changePlan = async (planName: SubscriptionTier): Promise<CompanyProfile> => {
    const { data } = await apiClient.patch<CompanyProfile>('/subscriptions/current', { planName });
    return data;
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
