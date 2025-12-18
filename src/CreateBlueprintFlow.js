import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

// Custom components
const Card = ({ children }) => (
  <div className="createblueprint-card">{children}</div>
);

const CardHeader = ({ children }) => (
  <div className="createblueprint-card-header">{children}</div>
);

const CardContent = ({ children }) => (
  <div className="createblueprint-card-content">{children}</div>
);

const Input = ({ placeholder, value, onChange }) => (
  <input
    className="createblueprint-input"
    placeholder={placeholder}
    value={value}
    onChange={onChange}
  />
);

const Button = ({ children, className, onClick, disabled, style }) => (
  <button
    className={`createblueprint-button ${className}`}
    onClick={onClick}
    disabled={disabled}
    style={style}
  >
    {children}
  </button>
);

const Select = ({ value, onChange, options }) => (
  <select
    className="createblueprint-select"
    value={value}
    onChange={onChange}
  >
    <option value="">Select an option</option>
    {options.map((option) => (
      <option value={option} key={option}>
        {option}
      </option>
    ))}
  </select>
);

const Checkbox = ({ id, checked, onChange, label }) => (
  <div className="createblueprint-checkbox-item">
    <input
      type="checkbox"
      id={id}
      className="createblueprint-checkbox"
      checked={checked}
      onChange={onChange}
    />
    <label htmlFor={id} className="createblueprint-checkbox-label">
      {label}
    </label>
  </div>
);

const Textarea = ({ placeholder, value, onChange }) => (
  <textarea
    className="createblueprint-textarea"
    placeholder={placeholder}
    value={value}
    onChange={onChange}
  ></textarea>
);

const CreateBlueprintFlow = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const navigate = useNavigate(); // Initialize navigate

  // Step 1: Choose Account Type
  const [accountType, setAccountType] = useState('');

  // Step 2: Quick Tour of Key Features
  const [tourStep, setTourStep] = useState(0);
  const tourFeatures = [
    {
      title: 'Interactive Space Mapping',
      description: 'Easily map your business space using your smartphone.',
      icon: '📱',
    },
    {
      title: 'AI-Powered Insights',
      description:
        'Get actionable insights with AI analysis of your space.',
      icon: '🤖',
    },
    {
      title: 'Personalized Actions',
      description:
        'Add custom actions to enhance customer experience.',
      icon: '🎯',
    },
    {
      title: 'Seamless Integration',
      description:
        'Connect your existing operational tools effortlessly.',
      icon: '🔗',
    },
  ];

  // Step 3: Business Overview (Business Profile Creation)
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessSize, setBusinessSize] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');

  // Step 6: Select Business/Blueprint Goals (Advanced)
  const [businessGoals, setBusinessGoals] = useState([]);

  // Step 4: Map Business Space w/ phone (QR code/App Clip)
  const qrCodeUrl = 'https://yourappclipurl.com'; // Replace with your actual App Clip URL

  // Step 5: Actions/Points of Interest
  const [pois, setPois] = useState([]);

  // Step 7: Connect AI Model Provider
  const [aiProvider, setAiProvider] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const aiProviders = ['OpenAI', 'Anthropic', 'Google', 'Meta'];

  // Step 8: Select/Connect Operational Tools
  const [operationalTools, setOperationalTools] = useState([]);

  // Handle navigation between steps
  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleAccountTypeSelect = (type) => {
    setAccountType(type);
  };

  const handleGoalChange = (goal) => {
    setBusinessGoals((prevGoals) =>
      prevGoals.includes(goal)
        ? prevGoals.filter((g) => g !== goal)
        : [...prevGoals, goal]
    );
  };

  const handleOperationalToolChange = (tool) => {
    setOperationalTools((prevTools) =>
      prevTools.includes(tool)
        ? prevTools.filter((t) => t !== tool)
        : [...prevTools, tool]
    );
  };

  const handleAddPoi = () => {
    setPois([...pois, { name: '', actions: '' }]);
  };

  const handleUpdatePoi = (index, updatedPoi) => {
    const newPois = [...pois];
    newPois[index] = updatedPoi;
    setPois(newPois);
  };

  return (
    <div className="createblueprint-container">
      <h1 className="createblueprint-title">Create Your Blueprint</h1>

      {currentStep === 1 && (
        // Step 1: Choose Account Type
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">Welcome to Blueprint</h2>
          </CardHeader>
          <CardContent>
            <p>Please select your account type:</p>
            <div className="account-type-selection">
              {['Small Business', 'Enterprise'].map((type) => (
                <Button
                  key={type}
                  className={`account-type-button ${
                    accountType === type ? 'active' : ''
                  }`}
                  onClick={() => handleAccountTypeSelect(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
            <Button
              className="next-button"
              onClick={handleNext}
              disabled={!accountType}
            >
              Begin Your Blueprint Journey
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        // Step 2: Quick Tour of Key Features
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">Quick Tour</h2>
            <Button
              className="skip-tour-button"
              onClick={handleNext}
              style={{ float: 'right' }}
            >
              Skip Tour
            </Button>
          </CardHeader>
          <CardContent>
            <div className="tour-feature">
              <div className="tour-icon">{tourFeatures[tourStep].icon}</div>
              <h3>{tourFeatures[tourStep].title}</h3>
              <p>{tourFeatures[tourStep].description}</p>
            </div>
            <div className="tour-navigation">
              <Button
                className="back-button"
                onClick={() =>
                  tourStep > 0 ? setTourStep(tourStep - 1) : handleBack()
                }
                disabled={currentStep === 1 && tourStep === 0}
              >
                Back
              </Button>
              {tourStep < tourFeatures.length - 1 ? (
                <Button
                  className="next-button"
                  onClick={() => setTourStep(tourStep + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button className="next-button" onClick={handleNext}>
                  Finish Tour
                </Button>
              )}
            </div>
            <div className="tour-progress-dots">
              {tourFeatures.map((_, index) => (
                <span
                  key={index}
                  className={`dot ${tourStep === index ? 'active' : ''}`}
                ></span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        // Step 3: Business Overview (Business Profile Creation)
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">Business Overview</h2>
          </CardHeader>
          <CardContent>
            <div className="createblueprint-form-group">
              <label className="createblueprint-label">Business Name</label>
              <Input
                placeholder="Enter your business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div className="createblueprint-form-group">
              <label className="createblueprint-label">Address</label>
              <Input
                placeholder="Enter your business address"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
              />
            </div>

            <div className="createblueprint-form-group">
              <label className="createblueprint-label">Business Type</label>
              <Input
                placeholder="e.g., Retail, Restaurant"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
            </div>

            <div className="createblueprint-form-group">
              <label className="createblueprint-label">Business Size</label>
              <Input
                placeholder="Number of employees"
                value={businessSize}
                onChange={(e) => setBusinessSize(e.target.value)}
              />
            </div>

            <div className="createblueprint-form-group">
              <label className="createblueprint-label">Industry</label>
              <Select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                options={[
                  'Retail',
                  'Hospitality',
                  'Healthcare',
                  'Education',
                  'Technology',
                  'Other',
                ]}
              />
            </div>

            <div className="createblueprint-form-group">
              <label className="createblueprint-label">
                Website or Social Media Link
              </label>
              <Input
                placeholder="Enter URL"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
              <Button
                className="next-button"
                onClick={handleNext}
                disabled={!businessName || !businessType}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        // Step 4: Map Business Space w/ phone (QR code/App Clip)
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">
              Map Your Business Space
            </h2>
          </CardHeader>
          <CardContent>
            <p>
              To map your business space, please scan the App Clip code below with
              your iPhone camera to launch the Blueprnt iOS app. The more in-depth the mapping, the better we can understand your space!
            </p>
            <div className="qr-code">
              {/* Replace the src with your actual QR code image URL */}
              <img src="https://via.placeholder.com/200" alt="QR Code" />
            </div>
            <p>
              After scanning, follow the instructions on your phone to complete
              the mapping process.
            </p>
            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
              <Button className="next-button" onClick={handleNext}>
                I've Completed the Scan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 5 && (
        // Step 5: Actions/Points of Interest
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">
              Actions and Points of Interest
            </h2>
          </CardHeader>
          <CardContent>
            <p>
              Based on your space scan, we've identified the following areas.
              Please assign actions to each point of interest.
            </p>
            {pois.map((poi, index) => (
              <div key={index} className="poi-section">
                <Input
                  placeholder="Point of Interest Name"
                  value={poi.name}
                  onChange={(e) =>
                    handleUpdatePoi(index, {
                      ...poi,
                      name: e.target.value,
                    })
                  }
                />
                <Textarea
                  placeholder="Actions (e.g., Display menu, Show promotions)"
                  value={poi.actions}
                  onChange={(e) =>
                    handleUpdatePoi(index, {
                      ...poi,
                      actions: e.target.value,
                    })
                  }
                />
              </div>
            ))}
            <Button className="add-poi-button" onClick={handleAddPoi}>
              Add Point of Interest
            </Button>
            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
              <Button
                className="next-button"
                onClick={handleNext}
                disabled={pois.length === 0}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 6 && (
        // Step 6: Select Business/Blueprint Goals (Advanced)
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">
              Select Your Blueprint Goals
            </h2>
          </CardHeader>
          <CardContent>
            <div className="createblueprint-form-group">
              <label className="createblueprint-label">Advanced Goals</label>
              <div className="createblueprint-checkbox-group">
                {[
                  'Increase Customer Engagement',
                  'Improve Operational Efficiency',
                  'Enhance Data Analytics',
                  'Integrate Smart Technologies',
                  'Boost Employee Productivity',
                ].map((goal) => (
                  <Checkbox
                    key={goal}
                    id={goal}
                    label={goal}
                    checked={businessGoals.includes(goal)}
                    onChange={() => handleGoalChange(goal)}
                  />
                ))}
              </div>
            </div>
            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
              <Button
                className="next-button"
                onClick={handleNext}
                disabled={businessGoals.length === 0}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 7 && (
        // Step 7: Connect AI Model Provider
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">
              Connect Your AI Model Provider
            </h2>
          </CardHeader>
          <CardContent>
            <p>Select your AI model provider and enter your API key:</p>
            <div className="createblueprint-form-group">
              <label className="createblueprint-label">AI Model Provider</label>
              <Select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                options={aiProviders}
              />
            </div>
            {aiProvider && (
              <div className="createblueprint-form-group">
                <label className="createblueprint-label">{aiProvider} API Key</label>
                <Input
                  placeholder="Enter your API key"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                />
              </div>
            )}
            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
              <Button
                className="next-button"
                onClick={handleNext}
                disabled={!aiProvider || !aiApiKey}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 8 && (
        // Step 8: Select/Connect Operational Tools
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">
              Connect Operational Tools
            </h2>
          </CardHeader>
          <CardContent>
            <p>Select the tools you'd like to integrate:</p>
            <div className="createblueprint-checkbox-group">
              {[
                'Inventory Management System',
                'Point of Sale (POS) System',
                'Customer Relationship Management (CRM)',
                'Accounting Software',
                'Project Management Tool',
              ].map((tool) => (
                <Checkbox
                  key={tool}
                  id={tool}
                  label={tool}
                  checked={operationalTools.includes(tool)}
                  onChange={() => handleOperationalToolChange(tool)}
                />
              ))}
            </div>
            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
              <Button className="next-button" onClick={handleNext}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 9 && (
        // Step 9: Preview Blueprint
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">Preview Your Blueprint</h2>
          </CardHeader>
          <CardContent>
            <div className="createblueprint-preview">
              <p>
                <strong>Business Name:</strong> {businessName}
              </p>
              <p>
                <strong>Business Type:</strong> {businessType}
              </p>
              <p>
                <strong>Industry:</strong> {industry}
              </p>
              <p>
                <strong>Website:</strong> {website}
              </p>
              <p>
                <strong>Blueprint Goals:</strong> {businessGoals.join(', ')}
              </p>
              <p>
                <strong>AI Model Provider:</strong> {aiProvider}
              </p>
              <p>
                <strong>Operational Tools:</strong> {operationalTools.join(', ')}
              </p>
              <p>
                <strong>Points of Interest:</strong> {pois.length}
              </p>
            </div>
            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
              <Button className="next-button" onClick={handleNext}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 10 && (
        // Step 10: Save/Share/Go Live
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">Finalize Your Blueprint</h2>
          </CardHeader>
          <CardContent>
            <Button
              className="save-button"
              onClick={() => {
                // Implement save functionality
                alert('Blueprint saved successfully!');
              }}
            >
              Save Blueprint
            </Button>
            <Button
              className="share-button"
              onClick={() => {
                // Implement share functionality
                alert('Share functionality coming soon!');
              }}
            >
              Share with Team
            </Button>
            <Button className="go-live-button" onClick={handleNext}>
              Go Live
            </Button>
            <div className="navigation-buttons">
              <Button className="back-button" onClick={handleBack}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 11 && (
        // Step 11: Go to Dashboard
        <Card>
          <CardHeader>
            <h2 className="createblueprint-subtitle">Welcome to Your Dashboard</h2>
          </CardHeader>
          <CardContent>
            <p>
              Your Blueprint is now live! You can manage and monitor your
              Blueprint from your dashboard.
            </p>
            <Button
              className="dashboard-button"
              onClick={() => {
                // Redirect to dashboard
                navigate('/dashboard');
              }}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateBlueprintFlow;
