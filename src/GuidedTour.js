import React, { useState } from 'react';

const Dialog = ({ open, onOpenChange, children }) => (
  open ? (
    <div className="guidedtour-dialog-overlay">
      <div className="guidedtour-dialog-content">
        {children}
        <button className="guidedtour-dialog-close" onClick={() => onOpenChange(false)}>×</button>
      </div>
    </div>
  ) : null
);

const DialogContent = ({ children }) => (
  <div className="guidedtour-dialog-body">{children}</div>
);

const DialogHeader = ({ children }) => (
  <div className="guidedtour-dialog-header">{children}</div>
);

const DialogTitle = ({ children }) => (
  <h2 className="guidedtour-dialog-title">{children}</h2>
);

const DialogDescription = ({ children }) => (
  <p className="guidedtour-dialog-description">{children}</p>
);

const Button = ({ onClick, disabled, children }) => (
  <button className="guidedtour-button" onClick={onClick} disabled={disabled}>{children}</button>
);

const Progress = ({ value }) => (
  <div className="guidedtour-progress">
    <div className="guidedtour-progress-bar" style={{ width: `${value}%` }}></div>
  </div>
);

const Card = ({ children, className }) => (
  <div className={`guidedtour-card ${className}`}>{children}</div>
);

const CardContent = ({ children, className }) => (
  <div className={`guidedtour-card-content ${className}`}>{children}</div>
);

const tourSteps = [
  {
    title: "Welcome to Blueprint",
    description: "Discover how Blueprint can transform your business operations.",
    content: (
      <div className="guidedtour-welcome">
        <div className="guidedtour-welcome-icon">🏢</div>
        <p>Blueprint helps you optimize your space, enhance customer experience, and boost efficiency.</p>
      </div>
    )
  },
  {
    title: "Choose Your Space",
    description: "Select the type of environment you want to optimize.",
    content: (
      <div className="guidedtour-space-grid">
        {['Retail', 'Office', 'Restaurant', 'Healthcare'].map(type => (
          <Card key={type} className="guidedtour-space-card">
            <CardContent>
              <div className="guidedtour-space-icon">🏪</div>
              <h4 className="guidedtour-space-type">{type}</h4>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  },
  {
    title: "Customize Your Layout",
    description: "Drag and drop elements to design your space.",
    content: (
      <div className="guidedtour-layout">
        <div className="guidedtour-layout-element guidedtour-layout-entrance">Entrance</div>
        <div className="guidedtour-layout-element guidedtour-layout-checkout">Checkout</div>
        <div className="guidedtour-layout-placeholder">Drag elements here</div>
      </div>
    )
  },
  {
    title: "Set Up Smart Actions",
    description: "Create automated responses to events in your space.",
    content: (
      <div className="guidedtour-actions">
        <div className="guidedtour-action">
          <div className="guidedtour-action-condition">When customer enters</div>
          <div className="guidedtour-action-arrow">➡️</div>
          <div className="guidedtour-action-response">Send welcome message</div>
        </div>
        <div className="guidedtour-action">
          <div className="guidedtour-action-condition">If queue &gt; 5 minutes</div>
          <div className="guidedtour-action-arrow">➡️</div>
          <div className="guidedtour-action-response">Open additional checkout</div>
        </div>
        <Button className="guidedtour-add-action">Add New Action</Button>
      </div>
    )
  },
  {
    title: "Analyze and Optimize",
    description: "Gain insights and improve your operations.",
    content: (
      <div className="guidedtour-analytics">
        <div className="guidedtour-chart-placeholder">
          [Interactive Chart Placeholder]
        </div>
        <div className="guidedtour-metrics">
          <Card>
            <CardContent>
              <h5 className="guidedtour-metric-title">Daily Visitors</h5>
              <p className="guidedtour-metric-value">1,234</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h5 className="guidedtour-metric-title">Avg. Time Spent</h5>
              <p className="guidedtour-metric-value">18 min</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
];

const GuidedTour = () => {
  const [open, setOpen] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setOpen(false); // End the tour
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tourSteps[currentStep].title}</DialogTitle>
          <DialogDescription>{tourSteps[currentStep].description}</DialogDescription>
        </DialogHeader>
        <Progress value={progress} />
        <div className="guidedtour-step-content">
          {tourSteps[currentStep].content}
        </div>
        <div className="guidedtour-navigation">
          <Button onClick={handlePrevious} disabled={currentStep === 0}>Previous</Button>
          <Button onClick={handleNext}>{currentStep === tourSteps.length - 1 ? "Finish Tour" : "Next"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuidedTour;