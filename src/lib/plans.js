// lib/plans.js - Enhanced with proper limits and features
export const PLANS = {
  FREE: { 
    id: 'free', 
    name: 'Free',
    aliasLimit: 5,
    features: [
      'Up to 5 email aliases',
      'Email forwarding',
      'Basic inbox management',
      'Send emails from aliases'
    ],
    price: 0,
    priceDisplay: 'Free'
  },
  PRO: { 
    id: 'pro', 
    name: 'Pro',
    aliasLimit: Infinity,
    features: [
      'Unlimited email aliases',
      'Email forwarding',
      'Advanced inbox management',
      'Send emails from aliases',
      'Collaborative aliases',
      'Priority support',
      'Analytics (coming soon)',
      'Custom domains (coming soon)'
    ],
    price: 499, // in rupees
    priceDisplay: '₹499/month'
  }
};

export const getPlanByUser = (user) => {
  const userPlan = user?.plan || PLANS.FREE.id;
  return userPlan === PLANS.PRO.id ? PLANS.PRO : PLANS.FREE;
};

export const canCreateAlias = (user, currentAliasCount) => {
  const plan = getPlanByUser(user);
  return plan.aliasLimit === Infinity || currentAliasCount < plan.aliasLimit;
};

export default PLANS;