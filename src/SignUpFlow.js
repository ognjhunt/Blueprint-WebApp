import React, { useState } from 'react';

const Card = ({ className, children }) => (
  <div className={`signupflow-card ${className}`}>{children}</div>
);

const CardContent = ({ className, children }) => (
  <div className={`signupflow-card-content ${className}`}>{children}</div>
);

const Input = ({ placeholder, type }) => (
  <input 
    className="signupflow-input" 
    placeholder={placeholder} 
    type={type || "text"} 
  />
);

const Button = ({ variant, onClick, className, children }) => (
  <button 
    className={`signupflow-button ${variant === 'outline' ? 'signupflow-button-outline' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </button>
);

const Select = ({ children }) => (
  <div className="signupflow-select">
    {children}
  </div>
);

const SelectTrigger = ({ children }) => (
  <div className="signupflow-select-trigger">
    {children}
  </div>
);

const SelectValue = ({ placeholder }) => (
  <div className="signupflow-select-value">
    {placeholder}
  </div>
);

const SelectContent = ({ children }) => (
  <div className="signupflow-select-content">
    {children}
  </div>
);

const SelectItem = ({ value, children }) => (
  <div className="signupflow-select-item" data-value={value}>
    {children}
  </div>
);

const Progress = ({ value }) => (
  <div className="signupflow-progress">
    <div className="signupflow-progress-bar" style={{width: `${value}%`}}></div>
  </div>
);

const RadioGroup = ({ onValueChange, children }) => (
  <div className="signupflow-radio-group" onChange={(e) => onValueChange(e.target.value)}>
    {children}
  </div>
);

const RadioGroupItem = ({ value, id }) => (
  <input type="radio" className="signupflow-radio-item" value={value} id={id} name="userType" />
);

const SignUpFlow = () => {
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState(null);
  const totalSteps = userType === 'consumer' ? 4 : 5;

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const renderStep = () => {
    switch(step) {
      case 1:
        return <UserTypeSelection setUserType={setUserType} />;
      case 2:
        return <AccountSetup />;
      case 3:
        return userType === 'consumer' ? <ConsumerInfo /> : <BusinessInfo />;
      case 4:
        return userType === 'consumer' ? <ConsumerPreferences /> : <BusinessUseCase />;
      case 5:
        return <BusinessPreferences />;
      default:
        return <UserTypeSelection setUserType={setUserType} />;
    }
  };

  return (
    <div className="signupflow-container">
      <Card className="signupflow-main-card">
        <CardContent>
          <div className="signupflow-header">
            <h1 className="signupflow-title">Blueprint</h1>
            <p className="signupflow-subtitle">Create your account</p>
          </div>
          
          <Progress value={(step / totalSteps) * 100} />
          
          {renderStep()}
          
          <div className="signupflow-navigation">
            {step > 1 && (
              <Button variant="outline" onClick={prevStep}>Back</Button>
            )}
            <Button 
              className="signupflow-next-button"
              onClick={step < totalSteps ? nextStep : () => console.log("Sign up complete")}
            >
              {step < totalSteps ? "Next" : "Complete Sign Up"}
            </Button>
          </div>
          
          <div className="signupflow-step-indicator">
            <p>
              Step {step} of {totalSteps}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const UserTypeSelection = ({ setUserType }) => (
  <div className="signupflow-section">
    <h2 className="signupflow-section-title">How will you use Blueprint?</h2>
    <RadioGroup onValueChange={setUserType}>
      <div className="signupflow-radio-option">
        <RadioGroupItem value="consumer" id="consumer" />
        <label htmlFor="consumer">I want to experience Blueprints as a user</label>
      </div>
      <div className="signupflow-radio-option">
        <RadioGroupItem value="business" id="business" />
        <label htmlFor="business">I want to create Blueprints for my business or location</label>
      </div>
    </RadioGroup>
  </div>
);

const AccountSetup = () => (
  <div className="signupflow-section">
    <h2 className="signupflow-section-title">Create Your Account</h2>
    <Input placeholder="Email" type="email" />
    <Input placeholder="Password" type="password" />
    <Input placeholder="Confirm Password" type="password" />
  </div>
);

const ConsumerInfo = () => (
  <div className="signupflow-section">
    <h2 className="signupflow-section-title">Tell Us About Yourself</h2>
    <Input placeholder="Full Name" />
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Age Range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="18-24">18-24</SelectItem>
        <SelectItem value="25-34">25-34</SelectItem>
        <SelectItem value="35-44">35-44</SelectItem>
        <SelectItem value="45-54">45-54</SelectItem>
        <SelectItem value="55+">55+</SelectItem>
      </SelectContent>
    </Select>
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Primary Interest" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="home">Smart Home Experiences</SelectItem>
        <SelectItem value="retail">Enhanced Shopping</SelectItem>
        <SelectItem value="workplace">Workplace Optimization</SelectItem>
        <SelectItem value="entertainment">Entertainment Venues</SelectItem>
        <SelectItem value="education">Educational Environments</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

const ConsumerPreferences = () => (
  <div className="signupflow-section">
    <h2 className="signupflow-section-title">Customize Your Experience</h2>
    <p className="signupflow-section-subtitle">Select your areas of interest:</p>
    <div className="signupflow-interest-grid">
      {['Smart Home', 'AR Navigation', 'Virtual Assistants', 'Interactive Retail', 'Personalized Spaces', 'Event Experiences'].map((interest) => (
        <Button key={interest} variant="outline" className="signupflow-interest-button">
          <span className="signupflow-interest-icon">⚪</span> {interest}
        </Button>
      ))}
    </div>
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="How did you hear about us?" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="social">Social Media</SelectItem>
        <SelectItem value="friend">Friend or Colleague</SelectItem>
        <SelectItem value="search">Search Engine</SelectItem>
        <SelectItem value="event">Event or Conference</SelectItem>
        <SelectItem value="other">Other</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

const BusinessInfo = () => (
  <div className="signupflow-section">
    <h2 className="signupflow-section-title">Your Business Details</h2>
    <Input placeholder="Company Name" />
    <Input placeholder="Your Role" />
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Company Size" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1-10">1-10 employees</SelectItem>
        <SelectItem value="11-50">11-50 employees</SelectItem>
        <SelectItem value="51-200">51-200 employees</SelectItem>
        <SelectItem value="201-500">201-500 employees</SelectItem>
        <SelectItem value="500+">500+ employees</SelectItem>
      </SelectContent>
    </Select>
    <Input placeholder="Industry" />
  </div>
);

const BusinessUseCase = () => (
  <div className="signupflow-section">
    <h2 className="signupflow-section-title">Your Blueprint Goals</h2>
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Primary Use Case" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="customer-experience">Enhance Customer Experience</SelectItem>
        <SelectItem value="employee-productivity">Boost Employee Productivity</SelectItem>
        <SelectItem value="space-optimization">Optimize Physical Spaces</SelectItem>
        <SelectItem value="process-automation">Automate Business Processes</SelectItem>
        <SelectItem value="data-visualization">Visualize Complex Data</SelectItem>
      </SelectContent>
    </Select>
    <textarea 
      className="signupflow-textarea" 
      placeholder="Briefly describe your main goal with Blueprint"
      rows={3}
    />
  </div>
);

const BusinessPreferences = () => (
  <div className="signupflow-section">
    <h2 className="signupflow-section-title">Customize Your Blueprint</h2>
    <p className="signupflow-section-subtitle">Select your areas of interest:</p>
    <div className="signupflow-interest-grid">
      {['AR Interfaces', 'IoT Integration', 'Data Analytics', 'AI Assistance', 'Spatial Design', 'Process Automation'].map((interest) => (
        <Button key={interest} variant="outline" className="signupflow-interest-button">
          <span className="signupflow-interest-icon">⚪</span> {interest}
        </Button>
      ))}
    </div>
    <Select>
      <SelectTrigger>
        <SelectValue placeholder="Preferred Contact Method" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="email">Email</SelectItem>
        <SelectItem value="phone">Phone</SelectItem>
        <SelectItem value="in-app">In-app Notifications</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export default SignUpFlow;