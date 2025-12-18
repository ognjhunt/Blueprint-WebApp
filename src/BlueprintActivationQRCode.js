import React from 'react';

const Card = ({ children }) => (
  <div className="blueprint-card">{children}</div>
);

const CardHeader = ({ children }) => (
  <div className="blueprint-card-header">{children}</div>
);

const CardContent = ({ children }) => (
  <div className="blueprint-card-content">{children}</div>
);

const Button = ({ children, variant, className }) => (
  <button className={`blueprint-button ${variant} ${className}`}>{children}</button>
);

const Alert = ({ children, variant }) => (
  <div className={`blueprint-alert ${variant}`}>{children}</div>
);

const AlertTitle = ({ children }) => (
  <h3 className="blueprint-alert-title">{children}</h3>
);

const AlertDescription = ({ children }) => (
  <p className="blueprint-alert-description">{children}</p>
);

const BlueprintActivationQRCode = () => {
  return (
    <div className="blueprint-container">
      <h1 className="blueprint-title">Blueprint Activation Complete</h1>
      <Card>
        <CardHeader>
          <h2 className="blueprint-subtitle">Your Blueprint QR Code</h2>
        </CardHeader>
        <CardContent>
          <div className="blueprint-qr-container">
            <div className="blueprint-qr-wrapper">
              <svg
                className="blueprint-qr-svg"
                viewBox="0 0 37 37"
                shapeRendering="crispEdges"
              >
                <path fill="#ffffff" d="M0 0h37v37H0z" />
                <path stroke="#000000" d="M4 4.5h7m1 0h2m1 0h1m1 0h2m3 0h2m1 0h3m2 0h7M4 5.5h1m5 0h1m1 0h1m2 0h4m3 0h3m1 0h1m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m2 0h1m1 0h2m5 0h2m4 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m1 0h2m2 0h2m1 0h1m1 0h2m4 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m3 0h4m3 0h1m1 0h2m1 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m1 0h2m3 0h1m1 0h1m6 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M13 11.5h1m2 0h1m1 0h1m1 0h1m1 0h2M5 12.5h1m1 0h5m2 0h3m1 0h1m3 0h2m2 0h3m1 0h1M4 13.5h1m1 0h1m1 0h1m3 0h6m5 0h1m1 0h1m2 0h2m1 0h1M4 14.5h1m3 0h2m3 0h1m2 0h5m2 0h1m2 0h5M5 15.5h2m1 0h2m1 0h2m1 0h1m1 0h1m1 0h1m2 0h1m5 0h1m4 0h1M6 16.5h1m1 0h2m1 0h1m1 0h2m4 0h1m5 0h2m2 0h1m1 0h2M5 17.5h4m2 0h1m1 0h1m1 0h2m3 0h1m5 0h1m1 0h1m2 0h2M4 18.5h1m1 0h1m4 0h1m4 0h2m4 0h1m2 0h3m1 0h1m1 0h2M4 19.5h3m1 0h1m2 0h2m3 0h1m2 0h1m1 0h4m2 0h1m1 0h1M7 20.5h2m1 0h4m2 0h1m2 0h2m1 0h2m2 0h1m4 0h2M5 21.5h3m1 0h1m2 0h1m1 0h1m2 0h3m2 0h1m2 0h2m1 0h5M5 22.5h1m1 0h2m2 0h1m1 0h2m1 0h4m3 0h5m3 0h2M4 23.5h1m1 0h8m1 0h2m3 0h3m2 0h1m2 0h1m2 0h2M13 24.5h1m1 0h4m1 0h3m1 0h5m1 0h2M4 25.5h7m1 0h1m1 0h1m2 0h1m2 0h4m1 0h2m1 0h1m2 0h2M4 26.5h1m5 0h1m3 0h2m5 0h2m3 0h4m1 0h2M4 27.5h1m1 0h3m1 0h1m1 0h1m1 0h2m2 0h1m1 0h3m2 0h1m2 0h1m3 0h1M4 28.5h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m2 0h2m2 0h2m1 0h1m3 0h2M4 29.5h1m1 0h3m1 0h1m2 0h4m1 0h2m1 0h2m1 0h2m1 0h1m1 0h1m1 0h2M4 30.5h1m5 0h1m1 0h2m3 0h7m1 0h1m3 0h1m1 0h2M4 31.5h7m2 0h3m1 0h1m1 0h1m2 0h1m3 0h1m4 0h2" />
              </svg>
              <div className="blueprint-qr-label">Blueprint</div>
            </div>
          </div>
          <Alert>
            <AlertTitle>Instructions</AlertTitle>
            <AlertDescription>
              1. Print this QR code<br />
              2. Display it prominently at your store entrance<br />
              3. Customers can scan it to instantly access your Blueprint experience
            </AlertDescription>
          </Alert>
          <div className="blueprint-button-group">
            <Button className="blueprint-button-full">Print QR Code</Button>
            <Button variant="outline" className="blueprint-button-full">Download QR Code</Button>
          </div>
          <Alert variant="warning">
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Ensure the QR code is clearly visible and easily scannable. Consider laminating the printed code for durability.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlueprintActivationQRCode;