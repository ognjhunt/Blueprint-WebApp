import React, { useState } from 'react';

const Card = ({ className, children }) => (
  <div className={`pricingpage-card ${className}`}>{children}</div>
);

const CardHeader = ({ children }) => (
  <div className="pricingpage-card-header">{children}</div>
);

const CardContent = ({ children }) => (
  <div className="pricingpage-card-content">{children}</div>
);

const CardFooter = ({ children }) => (
  <div className="pricingpage-card-footer">{children}</div>
);

const Button = ({ variant, size, onClick, className, children }) => (
  <button 
    className={`pricingpage-button ${variant === 'outline' ? 'pricingpage-button-outline' : ''} ${size === 'lg' ? 'pricingpage-button-lg' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </button>
);

const Switch = ({ checked, onCheckedChange }) => (
  <label className="pricingpage-switch">
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onCheckedChange(!checked)}
    />
    <span className="pricingpage-switch-slider"></span>
  </label>
);

const PricingPage = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [userType, setUserType] = useState('consumer');

  const consumerPlans = [
    {
      name: "Basic",
      price: isAnnual ? "$49/year" : "$4.99/month",
      features: [
        "Access to public Blueprints",
        "Create 1 personal Blueprint",
        "Basic AR interactions",
        "Community support"
      ]
    },
    {
      name: "Pro",
      price: isAnnual ? "$99/year" : "$9.99/month",
      features: [
        "All Basic features",
        "Create up to 5 personal Blueprints",
        "Advanced AR interactions",
        "Priority support"
      ]
    },
    {
      name: "Family",
      price: isAnnual ? "$149/year" : "$14.99/month",
      features: [
        "All Pro features",
        "Up to 5 family members",
        "Unlimited personal Blueprints",
        "Exclusive AR templates",
        "24/7 support"
      ]
    }
  ];

  const businessPlans = [
    {
      name: "Startup",
      price: isAnnual ? "$499/year" : "$49/month",
      features: [
        "Up to 5 locations",
        "Basic analytics",
        "Standard integrations",
        "Email support"
      ]
    },
    {
      name: "Business",
      price: isAnnual ? "$999/year" : "$99/month",
      features: [
        "Up to 20 locations",
        "Advanced analytics",
        "Custom integrations",
        "Priority support",
        "Employee training"
      ]
    },
    {
      name: "Enterprise",
      price: "Custom",
      features: [
        "Unlimited locations",
        "AI-powered insights",
        "Dedicated account manager",
        "Custom development",
        "On-site support"
      ]
    }
  ];

  const plans = userType === 'consumer' ? consumerPlans : businessPlans;

  return (
    <div className="pricingpage-container">
      <div className="pricingpage-content">
        <h1 className="pricingpage-title">Pricing Plans</h1>
        <p className="pricingpage-subtitle">
          Choose the perfect plan for your Blueprint journey
        </p>

        <div className="pricingpage-user-type">
          <Button
            variant={userType === 'consumer' ? 'default' : 'outline'}
            onClick={() => setUserType('consumer')}
          >
            Consumer
          </Button>
          <Button
            variant={userType === 'business' ? 'default' : 'outline'}
            onClick={() => setUserType('business')}
          >
            Business
          </Button>
        </div>

        <div className="pricingpage-billing-toggle">
          <span className={isAnnual ? 'pricingpage-billing-inactive' : 'pricingpage-billing-active'}>Monthly</span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <span className={isAnnual ? 'pricingpage-billing-active' : 'pricingpage-billing-inactive'}>Annual (Save 20%)</span>
        </div>

        <div className="pricingpage-plans">
          {plans.map((plan, index) => (
            <Card key={index} className={index === 1 ? 'pricingpage-card-popular' : ''}>
              {index === 1 && (
                <div className="pricingpage-popular-tag">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <h2 className="pricingpage-plan-name">{plan.name}</h2>
                <p className="pricingpage-plan-price">{plan.price}</p>
              </CardHeader>
              <CardContent>
                <ul className="pricingpage-features">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="pricingpage-feature">
                      <span className="pricingpage-feature-check">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="pricingpage-cta-button">
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="pricingpage-help">
          <h2 className="pricingpage-help-title">Not sure which plan is right for you?</h2>
          <Button variant="outline" size="lg">
            Talk to an Expert
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;